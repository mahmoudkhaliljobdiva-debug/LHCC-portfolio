-- One specialty per student, server-enforced mock timers, unlimited retake
-- of completed exams, and direct review of the student's completed answers.
-- Existing accounts with conflicting histories remain unassigned and choose once.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialty_id uuid REFERENCES public.specialties(id);
CREATE INDEX IF NOT EXISTS idx_profiles_specialty ON public.profiles(specialty_id) WHERE specialty_id IS NOT NULL;

WITH history AS (
 select p.id,a.specialty_id from public.profiles p
 cross join lateral (
   select distinct t.specialty_id from (
     select specialty_id from public.course_package_access where user_id=p.id and status='ACTIVE'
     union all
     select b.specialty_id from public.user_bank_access g join public.question_banks b on b.id=g.question_bank_id
       where g.user_id=p.id and g.status='ACTIVE'
     union all
     select b.specialty_id from public.question_attempts e join public.question_banks b on b.id=e.question_bank_id
       where e.student_id=p.id
   ) t where specialty_id is not null
 ) a where p.role='STUDENT' and p.specialty_id is null
), unambiguous as (
 select id,min(specialty_id::text)::uuid specialty_id from history group by id having count(distinct specialty_id)=1
)
UPDATE public.profiles p SET specialty_id=h.specialty_id
FROM unambiguous h WHERE p.id=h.id AND p.specialty_id IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  profile_age integer;
  profile_gender public.profile_gender;
  profile_home_address text;
  profile_phone text;
  profile_country_code text;
  profile_specialty uuid;
begin
  if coalesce(new.raw_user_meta_data ->> 'age', '') ~ '^[0-9]{1,3}$' then
    profile_age := (new.raw_user_meta_data ->> 'age')::integer;
    if profile_age not between 1 and 120 then
      profile_age := null;
    end if;
  end if;

  profile_gender := case upper(new.raw_user_meta_data ->> 'gender')
    when 'MALE' then 'MALE'::public.profile_gender
    when 'FEMALE' then 'FEMALE'::public.profile_gender
    else null
  end;

  profile_home_address := nullif(
    btrim(left(new.raw_user_meta_data ->> 'home_address', 500)),
    ''
  );

  profile_phone := nullif(btrim(new.raw_user_meta_data ->> 'phone'), '');
  if profile_phone is not null and profile_phone !~ '^\+[1-9][0-9]{6,14}$' then
    profile_phone := null;
  end if;

  profile_country_code := upper(nullif(btrim(new.raw_user_meta_data ->> 'country_code'), ''));
  if profile_country_code is not null and profile_country_code !~ '^[A-Z]{2}$' then
    profile_country_code := null;
  end if;

  select id into profile_specialty from public.specialties
    where slug=new.raw_user_meta_data->>'specialty_slug'
    and slug in ('dentistry','medical','nursing') and published;

  insert into public.profiles (
    id,
    full_name,
    phone,
    country_code,
    age,
    gender,
    home_address,
    specialty_id,
    role,
    status
  )
  values (
    new.id,
    coalesce(
      nullif(btrim(left(new.raw_user_meta_data ->> 'full_name', 200)), ''),
      'Pending user'
    ),
    profile_phone,
    profile_country_code,
    profile_age,
    profile_gender,
    profile_home_address,
    profile_specialty,
    'STUDENT',
    'ACTIVE'
  )
  on conflict (id) do nothing;

  -- The signup choice is stored in a protected profile column, not trusted
  -- as a future role/permission claim in the JWT.
  UPDATE public.profiles p
     SET specialty_id=s.id
    FROM public.specialties s
   WHERE p.id=new.id AND p.role='STUDENT'
     AND s.slug=new.raw_user_meta_data->>'specialty_slug'
     AND s.slug IN ('dentistry','medical','nursing')
     AND s.published AND p.specialty_id IS NULL;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.can_open_bank(bank_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT private.is_active_role('STUDENT') AND EXISTS (
  SELECT 1 FROM public.question_banks b
  WHERE b.id=bank_id
   AND b.status='active'
   AND b.publication_status='PUBLISHED'
   AND b.material_kind IN ('EXAM_TRACK','SUBJECT')
   AND b.specialty_id=(SELECT specialty_id FROM public.profiles WHERE id=auth.uid() AND role='STUDENT')
   AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
       AND p.role='STUDENT' AND p.specialty_id=b.specialty_id)
   AND EXISTS (
     SELECT 1 FROM public.specialties s
     WHERE s.id=b.specialty_id AND s.published
   )
   AND (
     EXISTS (
       SELECT 1 FROM public.user_bank_access a
       WHERE a.user_id=(SELECT auth.uid())
         AND a.question_bank_id=b.id AND a.status='ACTIVE'
     )
     OR EXISTS (
       SELECT 1 FROM public.course_package_access a
       WHERE a.user_id=(SELECT auth.uid())
         AND a.specialty_id=b.specialty_id AND a.status='ACTIVE'
     )
   )
 )
$function$
;

CREATE OR REPLACE FUNCTION private.request_course_package_access(target_specialty_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result uuid;
begin
  if not private.is_active_role('STUDENT'::public.user_role) then
    raise exception 'Active student required' using errcode='42501';
  end if;
  if target_specialty_id is distinct from (select specialty_id from public.profiles where id=auth.uid() and role='STUDENT') then
    raise exception 'Request only your enrolled specialty' using errcode='42501';
  end if;
  if target_specialty_id is null or not exists (
    select 1 from public.specialties s
    where s.id=target_specialty_id and s.published
      and exists (select 1 from public.question_banks b
                  where b.specialty_id=s.id and b.status='active'
                  and b.publication_status='PUBLISHED'
                  and b.material_kind in ('SUBJECT','EXAM_TRACK'))
  ) then raise exception 'Published course package not found' using errcode='23514'; end if;
  if exists (
    select 1 from public.course_package_access a
    where a.user_id=auth.uid() and a.specialty_id=target_specialty_id and a.status='ACTIVE'
  ) then raise exception 'Package access already granted' using errcode='23505'; end if;
  insert into public.course_package_access_requests(user_id,specialty_id)
  values(auth.uid(),target_specialty_id) returning id into result;
  return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_bank_access(bank_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result uuid;
begin
 if not private.is_active_role('STUDENT') then raise exception 'Student access required' using errcode='42501'; end if;
 if not exists(select 1 from public.question_banks b
    join public.profiles p on p.id=auth.uid() and p.specialty_id=b.specialty_id
    where b.id=bank_id and b.status='active'
  and b.material_kind IN ('EXAM_TRACK','SUBJECT') and b.publication_status='PUBLISHED'
  and b.specialty_id=(select specialty_id from public.profiles where id=auth.uid() and role='STUDENT')
  and exists (select 1 from public.specialties s where s.id=b.specialty_id and s.published)) then
  raise exception 'Published course required' using errcode='42501'; end if;
 insert into public.user_bank_access_requests(question_bank_id) values(bank_id) returning id into result;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION private.review_course_package_access(target_request_id uuid, decision text, reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.course_package_access_requests; grant_row public.course_package_access;
begin
  if not private.is_active_role('ADMIN'::public.user_role) then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  if decision not in ('APPROVED','REJECTED') or decision is null then
    raise exception 'Invalid decision' using errcode='23514';
  end if;
  select * into r from public.course_package_access_requests
  where id=target_request_id for update;
  if not found or r.status<>'PENDING' then
    raise exception 'Package request is no longer pending' using errcode='23514';
  end if;
  if decision='APPROVED' then
    perform 1 from public.profiles p where p.id=r.user_id
      and p.role='STUDENT' and p.status='ACTIVE' and p.specialty_id=r.specialty_id for share;
    if not found then raise exception 'Student account is disabled' using errcode='42501'; end if;
    perform 1 from public.specialties s where s.id=r.specialty_id and s.published
    and exists (select 1 from public.question_banks b
                where b.specialty_id=s.id and b.status='active'
                and b.publication_status='PUBLISHED')
    for share;
    if not found then raise exception 'Course package is unavailable' using errcode='23514'; end if;

    insert into public.course_package_access(user_id,specialty_id,granted_by,request_id)
    values(r.user_id,r.specialty_id,auth.uid(),r.id)
    on conflict(user_id,specialty_id) do update set
      status='ACTIVE', granted_at=statement_timestamp(), granted_by=excluded.granted_by,
      request_id=excluded.request_id, revoked_at=null
    returning * into grant_row;

    insert into public.wallet_transactions(
      transaction_type,name,description,amount,user_id,question_bank_id,
      course_package_access_id,created_by,transaction_date)
    select 'BANK_SALE', b.name||' package access',
      b.name||' access approved through course package',
      b.price, r.user_id, b.id, grant_row.id, auth.uid(),current_date
    from public.question_banks b
    where b.specialty_id=r.specialty_id and b.status='active'
      and b.publication_status='PUBLISHED'
      and b.material_kind='EXAM_TRACK' and b.price>0
    on conflict(course_package_access_id,question_bank_id)
       where transaction_type='BANK_SALE' and course_package_access_id is not null
    do nothing;
  end if;
  update public.course_package_access_requests
    set status=decision, reviewed_at=statement_timestamp(),
      reviewed_by=auth.uid(),
      rejection_reason=case when decision='REJECTED' then nullif(btrim(reason),'') else null end
    where id=r.id;
end $function$
;

CREATE OR REPLACE FUNCTION private.start_learning_exam(config jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare bid text:=config->>'bankId'; kind text:=config->>'source'; e record; a public.question_attempts; q record;
 learning text:=config->>'mode'; minutes integer:=(config->>'timeLimitMinutes')::integer;
 specialty_slug text; bank_name text; published_minutes integer;
begin
 -- Mock duration is enforced inside the database, never entrusted to a form.
 -- Only published mock definitions in Dentistry/Medical have mandatory timing.
 IF kind IN ('SHARED','PAST') THEN
   SELECT CASE WHEN s.slug='dentistry' THEN 120 WHEN s.slug='medical' THEN 180 END
   INTO minutes
   FROM public.question_banks b
   JOIN public.specialties s ON s.id=b.specialty_id
   WHERE b.id=bid AND s.slug IN ('dentistry','medical')
     AND (
       (kind='PAST' AND EXISTS (
         SELECT 1 FROM public.past_exams pe WHERE pe.id=(config->>'sourceId')::uuid
           AND pe.question_bank_id=bid AND pe.status='PUBLISHED' AND pe.title ILIKE '%mock%'))
       OR (kind='SHARED' AND EXISTS (
         SELECT 1 FROM public.shared_exams se WHERE se.id=(config->>'sourceId')::uuid
           AND se.question_bank_id=bid AND se.status='PUBLISHED' AND se.title ILIKE '%mock%'))
     );
   IF minutes IS NOT NULL THEN
     learning:='EXAM';
     config:=config||jsonb_build_object('mode','EXAM','timeLimitMinutes',minutes);
   ELSE
     minutes:=(config->>'timeLimitMinutes')::integer;
   END IF;
 END IF;
 if kind is null or kind not in ('SHARED','PAST') then return private.start_nonshared_learning_exam(config); end if;
 perform private.lock_exam_access(bid);
 if learning is null or learning not in ('EXAM','PRACTICE') or (config->>'count')::integer is null
  or (config->>'count')::integer not between 1 and 30 or (minutes is not null and minutes not between 1 and 1440) then
  raise exception 'Invalid setup' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||bid,0));
 select * into a from public.question_attempts where student_id=auth.uid() and question_bank_id=bid and status='IN_PROGRESS' for update;
 if found and a.mode='EXAM' then
  if a.setup_signature is distinct from config then raise exception 'Continue your unfinished attempt first' using errcode='23514'; end if;
  return a.id;
 end if;
 if found then update public.question_attempts set status='ABANDONED',submitted_at=now() where id=a.id; end if;
 if kind='SHARED' then
  select id,title,question_count,null::integer as exam_year into e from public.shared_exams
  where id=(config->>'sourceId')::uuid and question_bank_id=bid and status='PUBLISHED' for share;
 else
  perform 1 from public.past_exams where id=(config->>'sourceId')::uuid and question_bank_id=bid and status='PUBLISHED' for share;
  if not found then raise exception 'Exam unavailable' using errcode='42501'; end if;
  select id,title,(select count(*)::integer from public.past_exam_questions where exam_id=p.id) as question_count,exam_year into e
  from public.past_exams p where id=(config->>'sourceId')::uuid;
 end if;
 if not found then raise exception 'Exam unavailable' using errcode='42501'; end if;
 -- Server-owned, published timer: ignore a student's request payload.
 select s.slug,b.name into specialty_slug,bank_name
 from public.question_banks b join public.specialties s on s.id=b.specialty_id where b.id=bid;
 if kind='PAST' then
   select p.time_limit_minutes into published_minutes from public.past_exams p where p.id=e.id;
 else
   select x.time_limit_minutes into published_minutes from public.shared_exams x where x.id=e.id;
 end if;
 minutes:=case
   when specialty_slug='dentistry' and (e.title ilike '%mock%' or bank_name ilike '%mock%') then 120
   when specialty_slug='medical' and (e.title ilike '%mock%' or bank_name ilike '%mock%') then 180
   else published_minutes end;
 if e.question_count=0 or (kind='PAST' and e.question_count<>(select count(*) from private.past_exam_snapshots where exam_id=e.id))
  or (kind='SHARED' and e.question_count<>(select count(*) from private.shared_exam_questions where exam_id=e.id)) then
  raise exception 'Definition requires review' using errcode='23514'; end if;
 insert into public.question_attempts(student_id,question_bank_id,total_questions,mode,bank_name_snapshot,shared_exam_id,past_exam_id,
  exam_title_snapshot,exam_year_snapshot,learning_mode,source_kind,setup_signature,deadline_at)
 select auth.uid(),id,e.question_count,'EXAM',name,case when kind='SHARED' then e.id end,case when kind='PAST' then e.id end,e.title,e.exam_year,learning,kind,config,
  case when minutes is not null then now()+make_interval(mins=>minutes) end from public.question_banks where id=bid returning * into a;
 for q in select question_id,position,snapshot from private.shared_exam_questions where exam_id=e.id and kind='SHARED'
  union all select s.question_id,eq.position,s.snapshot from private.past_exam_snapshots s
  join public.past_exam_questions eq on eq.exam_id=s.exam_id and eq.question_id=s.question_id where s.exam_id=e.id and kind='PAST' order by position loop
  insert into public.question_attempt_questions(attempt_id,question_id,display_order,text,options,section_id_snapshot,case_title_snapshot,case_description_snapshot,source_number_snapshot)
  values(a.id,q.question_id,q.position,q.snapshot->>'text',
   (select jsonb_agg(jsonb_build_object('id',o->>'id','text',o->>'text') order by n) from jsonb_array_elements(q.snapshot->'options') with ordinality t(o,n)),
   q.snapshot->>'section_id',q.snapshot->>'case_title',q.snapshot->>'case_description',
   case when kind='PAST' then (select source_number from public.past_exam_questions where exam_id=e.id and question_id=q.question_id) end);
  insert into private.exam_question_solutions values(a.id,q.question_id,q.snapshot->>'correct_option_id');
 end loop;
 return a.id;
end $function$
;

CREATE OR REPLACE FUNCTION private.save_past_exam(payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare fixed_minutes integer; special text; bank_name text;
begin
  perform private.require_exam_material(payload->>'bankId');
  select s.slug,b.name into special,bank_name from public.question_banks b
    join public.specialties s on s.id=b.specialty_id where b.id=payload->>'bankId';
  fixed_minutes:=case
    when special='dentistry' and (payload->>'title' ilike '%mock%' or bank_name ilike '%mock%') then 120
    when special='medical' and (payload->>'title' ilike '%mock%' or bank_name ilike '%mock%') then 180
    else null end;
  return private.pretyped_save_past_exam(
    case when fixed_minutes is not null
      then jsonb_set(payload,'{timeLimitMinutes}',to_jsonb(fixed_minutes),true)
      else payload end
  );
end $function$
;

CREATE OR REPLACE FUNCTION private.pre_live_exam_data(attempt_id uuid, subject_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb; a public.question_attempts;
begin
  result:=private.original_exam_data(attempt_id,subject_id);
  select * into a from public.question_attempts where id=attempt_id;
  result:=result || jsonb_build_object('title',coalesce(a.exam_title_snapshot,a.bank_name_snapshot),'year',a.exam_year_snapshot,
    'learningMode',a.learning_mode,'source',a.source_kind,'deadlineAt',a.deadline_at,
    'sourceId',coalesce(a.past_exam_id::text,a.shared_exam_id::text,a.chapter_id::text),
    'unanswered',(select a.total_questions-count(*) from public.question_attempt_answers where question_attempt_answers.attempt_id=a.id),
    'timeTakenSeconds',case when a.submitted_at is not null then greatest(0,extract(epoch from least(a.submitted_at,coalesce(a.deadline_at,a.submitted_at))-a.started_at)::integer) end);
  result:=jsonb_set(result,'{questions}',coalesce((select jsonb_agg(q || case when a.status='COMPLETED' or (a.learning_mode='PRACTICE' and c.question_id is not null) then
    jsonb_build_object('outcome',coalesce(ans.selected_option_id=s.correct_option_id,false),'correctOptionId',s.correct_option_id) else '{}'::jsonb end order by (q->>'order')::integer)
    from jsonb_array_elements(result->'questions') q left join private.practice_checks c on c.attempt_id=a.id and c.question_id=q->>'id'
    left join private.exam_question_solutions s on s.attempt_id=a.id and s.question_id=q->>'id'
    left join public.question_attempt_answers ans on ans.attempt_id=a.id and ans.question_id=q->>'id'),'[]'));
  return result;
end $function$
;

CREATE OR REPLACE FUNCTION private.original_exam_data(attempt_id uuid, subject_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.question_attempts;
begin
  select * into a from public.question_attempts t where t.id=attempt_id and t.mode='EXAM';
  if not found then raise exception 'Attempt unavailable' using errcode='42501'; end if;
  if private.is_active_role('ADMIN') and subject_id is not null and a.student_id=subject_id then null;
  elsif subject_id is null and a.student_id=auth.uid() and private.is_active_role('STUDENT')
    and exists(select 1 from public.profiles p join public.question_banks b
               on b.specialty_id=p.specialty_id
               where p.id=auth.uid() and b.id=a.question_bank_id)
    and (a.status='COMPLETED' or private.can_open_bank(a.question_bank_id))
    and exists(select 1 from public.question_banks b join public.profiles p on p.specialty_id=b.specialty_id
      where b.id=a.question_bank_id and p.id=auth.uid() and p.role='STUDENT') then null;
  else raise exception 'Attempt unavailable' using errcode='42501'; end if;
  return jsonb_build_object('id',a.id,'bankId',a.question_bank_id,'bankName',a.bank_name_snapshot,'status',a.status,
    'totalQuestions',a.total_questions,'startedAt',a.started_at,'submittedAt',a.submitted_at,
    'result',case when a.status='COMPLETED' then jsonb_build_object('correct',a.correct_answers,
      'incorrect',a.incorrect_answers,'score',a.score_percentage) else null end,
    'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.question_id,'text',q.text,'options',q.options,
      'order',q.display_order,'caseTitle',q.case_title_snapshot,'caseDescription',q.case_description_snapshot,
      'selectedOptionId',ans.selected_option_id) || case when a.status='COMPLETED' then
        jsonb_build_object('outcome',coalesce(ans.is_correct,false)) else '{}'::jsonb end order by q.display_order)
      from public.question_attempt_questions q left join public.question_attempt_answers ans
        on ans.attempt_id=q.attempt_id and ans.question_id=q.question_id where q.attempt_id=a.id),'[]'::jsonb));
end $function$
;

CREATE OR REPLACE FUNCTION private.student_missed_question_review(max_questions integer DEFAULT 40, filter_question_id text DEFAULT NULL::text, filter_source_kind text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare output jsonb;
begin
 if not private.is_active_role('STUDENT') then
   raise exception 'Active student access required' using errcode='42501';
 end if;
 if max_questions is null or max_questions not between 1 and 100
    or length(coalesce(filter_question_id,''))>200
    or (filter_source_kind is not null and filter_source_kind not in ('PAST','RANDOM','ALL','CASE','SHARED','CHAPTER'))
 then raise exception 'Invalid review filter' using errcode='23514'; end if;

 with completed as materialized (
   select a.id as attempt_id,a.question_bank_id,a.source_kind,a.exam_title_snapshot,
          a.bank_name_snapshot,a.submitted_at,a.score_percentage,
          coalesce(s.name,b.name,a.bank_name_snapshot,'Other') as specialty_name,
          coalesce(b.name,a.bank_name_snapshot,'Question bank') as bank_name
   from public.question_attempts a
   left join public.question_banks b on b.id=a.question_bank_id
   left join public.specialties s on s.id=b.specialty_id
   where a.student_id=auth.uid() and a.mode='EXAM' and a.status='COMPLETED' and b.specialty_id=(select specialty_id from public.profiles where id=auth.uid() and role='STUDENT')
     and exists(select 1 from public.profiles p
                where p.id=auth.uid() and p.specialty_id=b.specialty_id)
 ), wrong as materialized (
   select a.*,snap.question_id,snap.text as question_text,snap.options,
          snap.case_title_snapshot as case_title,snap.case_description_snapshot as case_description,
          snap.source_number_snapshot as source_number,
          ans.selected_option_id,sol.correct_option_id
   from completed a
   join public.question_attempt_answers ans on ans.attempt_id=a.attempt_id
   join private.exam_question_solutions sol on sol.attempt_id=ans.attempt_id
                                         and sol.question_id=ans.question_id
   join public.question_attempt_questions snap on snap.attempt_id=ans.attempt_id
                                              and snap.question_id=ans.question_id
   where ans.selected_option_id<>sol.correct_option_id
 ), occurrences as materialized (
   select question_bank_id, source_kind, question_id,
          count(*)::integer as wrong_count, max(submitted_at) as last_missed_at
   from wrong group by question_bank_id,source_kind,question_id
 ), last_wrong as materialized (
   select distinct on (question_bank_id,source_kind,question_id)
     question_bank_id,source_kind,question_id,
     specialty_name,bank_name,exam_title_snapshot,question_text,options,case_title,case_description,
     source_number,selected_option_id,correct_option_id,submitted_at
   from wrong
   order by question_bank_id,source_kind,question_id,submitted_at desc,attempt_id desc
 ), top_questions as materialized (
   select o.question_id as "questionId",o.question_bank_id as "bankId",
     w.specialty_name as "specialty",w.bank_name as "bankName",
     o.source_kind as "sourceKind",
     case o.source_kind when 'PAST' then coalesce(nullif(w.exam_title_snapshot,''),'Past exam')
       when 'RANDOM' then 'Random questions'
       when 'ALL' then 'All questions'
       when 'CASE' then 'Clinical cases'
       when 'SHARED' then 'Shared exam'
       when 'CHAPTER' then 'Chapter questions' else 'Exam' end as "sourceLabel",
     w.question_text as "questionText",w.options as "options",
     w.case_title as "caseTitle",w.case_description as "caseDescription",
     w.source_number as "sourceNumber",
     w.selected_option_id as "selectedOptionId",w.correct_option_id as "correctOptionId",
     o.wrong_count as "wrongCount",o.last_missed_at as "lastMissedAt",
     case when rv.approval_status='APPROVED' and nullif(btrim(rv.explanation),'') is not null
            then rv.explanation else null end as "explanation"
   from occurrences o join last_wrong w
     on w.question_bank_id=o.question_bank_id
    and w.source_kind=o.source_kind and w.question_id=o.question_id
   left join private.question_answer_reviews rv on rv.question_id=o.question_id
   where (filter_question_id is null or o.question_id=filter_question_id)
     and (filter_source_kind is null or o.source_kind=filter_source_kind)
   order by o.wrong_count desc,o.last_missed_at desc,o.question_id
   limit max_questions
 )
 select jsonb_build_object(
   'mistakes',(select count(*)::integer from wrong),
   'uniqueQuestions',(select count(*)::integer from occurrences),
   'completedExams',(select count(*)::integer from completed),
   'specialties',coalesce((select jsonb_agg(
      jsonb_build_object('name',x.specialty_name,'mistakes',x.n) order by x.n desc,x.specialty_name)
     from (select specialty_name,count(*)::integer n from wrong
           group by specialty_name order by n desc,specialty_name limit 8) x),'[]'::jsonb),
   'scoreHistogram',coalesce((
     select jsonb_agg(jsonb_build_object('label',bins.label,'count',coalesce(c.n,0)) order by bins.bucket)
     from (values (0,'0–19%'),(1,'20–39%'),(2,'40–59%'),(3,'60–79%'),(4,'80–100%')) bins(bucket,label)
     left join (
       select least(4,floor(score_percentage / 20)::int) bucket,count(*)::int n from completed
       group by least(4,floor(score_percentage / 20)::int)
     ) c on c.bucket=bins.bucket
    ),'[]'::jsonb),
   'questions',coalesce((
      select jsonb_agg(to_jsonb(q) order by q."wrongCount" desc,q."lastMissedAt" desc,q."questionId")
      from top_questions q
   ),'[]'::jsonb)
 ) into output;
 return output;
end
$function$
;

CREATE OR REPLACE FUNCTION private.choose_student_specialty(specialty_slug text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare selected uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if specialty_slug not in ('dentistry','medical','nursing') or specialty_slug is null then
   raise exception 'Choose Dentistry, Medicine or Nursing' using errcode='23514'; end if;
 select id into selected from public.specialties
 where slug=specialty_slug and published;
 if selected is null then raise exception 'Specialty is not available' using errcode='23514'; end if;
 update public.profiles p set specialty_id=selected
 where p.id=auth.uid() and p.role='STUDENT' and p.status='ACTIVE' and p.specialty_id is null;
 if not found then raise exception 'Specialty already selected or account inactive' using errcode='42501'; end if;
 return selected;
end $function$
;

CREATE OR REPLACE FUNCTION public.choose_student_specialty(specialty_slug text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$ SELECT private.choose_student_specialty(specialty_slug) $function$
;

REVOKE ALL ON FUNCTION private.choose_student_specialty(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.choose_student_specialty(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.choose_student_specialty(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.choose_student_specialty(text) TO authenticated;
UPDATE public.past_exams SET time_limit_minutes=120
 WHERE id='452094b7-6831-4e36-83f9-e881c5deba1a' AND title ILIKE '%mock%';
UPDATE private.past_exam_drafts SET content=jsonb_set(content,'{timeLimitMinutes}','120'::jsonb,true)
 WHERE exam_id='452094b7-6831-4e36-83f9-e881c5deba1a';

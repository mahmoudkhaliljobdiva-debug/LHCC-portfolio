-- One declared specialty per student. Enrollment remains admin-managed after signup.
-- Grant/attempt functions enforce the choice independently of UI filtering.
-- Published catalog RPC stays public; authenticated student queries are restricted.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialty_id uuid REFERENCES public.specialties(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_profiles_student_specialty ON public.profiles(specialty_id) WHERE role='STUDENT';
-- Infer legacy selection only if the account has exactly one distinct ACTIVE granted specialty.
WITH grants AS (
  SELECT uba.user_id,b.specialty_id
  FROM public.user_bank_access uba JOIN public.question_banks b ON b.id=uba.question_bank_id WHERE uba.status='ACTIVE'
  UNION ALL SELECT user_id,specialty_id FROM public.course_package_access WHERE status='ACTIVE'
), unique_choices AS (
 SELECT user_id,min(specialty_id::text)::uuid specialty_id
 FROM grants GROUP BY user_id HAVING count(distinct specialty_id)=1
)
UPDATE public.profiles p SET specialty_id=u.specialty_id FROM unique_choices u
 WHERE p.id=u.user_id AND p.role='STUDENT' AND p.specialty_id IS NULL;

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

  insert into public.profiles (
    id,
    full_name,
    phone,
    country_code,
    age,
    gender,
    home_address,
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
CREATE OR REPLACE FUNCTION private.admin_update_managed_profile(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target public.profiles; ids text[]; result public.profiles;
begin
  if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
  select * into target from public.profiles where id=(payload->>'id')::uuid for update;
  if not found or target.role='ADMIN' then raise exception 'Managed profile required' using errcode='42501'; end if;
  if payload->>'role' not in ('STUDENT','TEACHER') or payload->>'status' not in ('ACTIVE','INACTIVE') then raise exception 'Invalid role or status'; end if;
  if jsonb_typeof(payload->'teacherBankIds') is distinct from 'array' then raise exception 'Assignments required'; end if;
  select coalesce(array_agg(distinct value),'{}') into ids from jsonb_array_elements_text(payload->'teacherBankIds');
  if payload->>'role'='TEACHER' and cardinality(ids)=0 then raise exception 'Assign at least one question bank'; end if;
  if cardinality(ids)>100 or exists(select 1 from unnest(ids) selected(bank_id) where not exists(select 1 from public.question_banks b where b.id=selected.bank_id)) then raise exception 'Invalid question bank'; end if;
  update public.profiles set full_name=payload->>'full_name', phone=nullif(payload->>'phone',''),
    age=(payload->>'age')::integer, gender=(payload->>'gender')::public.profile_gender,
    home_address=nullif(payload->>'home_address',''), role=(payload->>'role')::public.user_role,
    status=(payload->>'status')::public.user_status,
    activation_start=(payload->>'activation_start')::timestamptz,
    activation_months=(payload->>'activation_months')::integer,
    expiration_date=(payload->>'expiration_date')::timestamptz,
    specialty_id=case when payload->>'role'='STUDENT'
      then coalesce(
        (SELECT s.id FROM public.specialties s WHERE s.slug=payload->>'specialtySlug'
           AND s.slug IN ('dentistry','medical','nursing') AND s.published),
        target.specialty_id
      ) else null end,
    created_by=coalesce(created_by,(payload->>'created_by')::uuid),
    deactivated_at=(payload->>'deactivated_at')::timestamptz,
    reactivated_at=(payload->>'reactivated_at')::timestamptz
    where id=target.id returning * into result;
  delete from public.teacher_bank_assignments where teacher_id=target.id;
  if result.role='TEACHER' then
    insert into public.teacher_bank_assignments(teacher_id,question_bank_id,assigned_by)
    select target.id,selected.bank_id,auth.uid() from unnest(ids) selected(bank_id);
  end if;
  return to_jsonb(result);
end;
$function$
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
   where a.student_id=auth.uid() and a.mode='EXAM' and a.status='COMPLETED'
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
    and (a.status='COMPLETED' or private.can_open_bank(a.question_bank_id)) then null;
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
  and exists (select 1 from public.specialties s where s.id=b.specialty_id and s.published)) then
  raise exception 'Published course required' using errcode='42501'; end if;
 insert into public.user_bank_access_requests(question_bank_id) values(bank_id) returning id into result;
 return result;
end $function$
;
ALTER POLICY bank_catalog ON public.question_banks USING ((( SELECT private.is_active_role('ADMIN'::user_role) AS is_active_role) OR private.teacher_has_bank(id) OR ((( SELECT private.is_active_role('STUDENT'::user_role) AS is_active_role) AND EXISTS (
 SELECT 1 FROM public.profiles profile_choice
 JOIN public.question_banks scoped_bank ON scoped_bank.id=question_banks.id
 WHERE profile_choice.id=(SELECT auth.uid()) AND profile_choice.specialty_id=scoped_bank.specialty_id
)) AND (status = 'active'::text) AND (publication_status = 'PUBLISHED'::text) AND (material_kind = ANY (ARRAY['EXAM_TRACK'::text, 'SUBJECT'::text])) AND (EXISTS ( SELECT 1
   FROM specialties s
  WHERE ((s.id = question_banks.specialty_id) AND s.published))))));
CREATE OR REPLACE FUNCTION private.start_learning_exam(config jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare bid text:=config->>'bankId'; kind text:=config->>'source'; e record; a public.question_attempts; q record;
 learning text:=config->>'mode'; minutes integer:=(config->>'timeLimitMinutes')::integer;
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

CREATE OR REPLACE FUNCTION private.fix_mock_exam_timer()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $func$
DECLARE chosen_slug text;
BEGIN
 SELECT s.slug INTO chosen_slug FROM public.question_banks b
 JOIN public.specialties s ON s.id=b.specialty_id WHERE b.id=NEW.question_bank_id;
 IF NEW.title ILIKE '%mock%' AND chosen_slug IN ('dentistry','medical') THEN
   NEW.time_limit_minutes:=CASE WHEN chosen_slug='dentistry' THEN 120 ELSE 180 END;
 END IF;
 RETURN NEW;
END $func$;
DROP TRIGGER IF EXISTS enforce_mock_duration ON public.past_exams;
CREATE TRIGGER enforce_mock_duration BEFORE INSERT OR UPDATE ON public.past_exams
 FOR EACH ROW EXECUTE FUNCTION private.fix_mock_exam_timer();
DROP TRIGGER IF EXISTS enforce_mock_duration ON public.shared_exams;
CREATE TRIGGER enforce_mock_duration BEFORE INSERT OR UPDATE ON public.shared_exams
 FOR EACH ROW EXECUTE FUNCTION private.fix_mock_exam_timer();
UPDATE public.past_exams e SET time_limit_minutes=120
FROM public.question_banks b JOIN public.specialties s ON s.id=b.specialty_id
WHERE e.question_bank_id=b.id AND e.title ILIKE '%mock%' AND s.slug='dentistry' AND e.time_limit_minutes IS DISTINCT FROM 120;
UPDATE public.past_exams e SET time_limit_minutes=180
FROM public.question_banks b JOIN public.specialties s ON s.id=b.specialty_id
WHERE e.question_bank_id=b.id AND e.title ILIKE '%mock%' AND s.slug='medical' AND e.time_limit_minutes IS DISTINCT FROM 180;
UPDATE public.shared_exams e SET time_limit_minutes=120
FROM public.question_banks b JOIN public.specialties s ON s.id=b.specialty_id
WHERE e.question_bank_id=b.id AND e.title ILIKE '%mock%' AND s.slug='dentistry' AND e.time_limit_minutes IS DISTINCT FROM 120;
UPDATE public.shared_exams e SET time_limit_minutes=180
FROM public.question_banks b JOIN public.specialties s ON s.id=b.specialty_id
WHERE e.question_bank_id=b.id AND e.title ILIKE '%mock%' AND s.slug='medical' AND e.time_limit_minutes IS DISTINCT FROM 180;

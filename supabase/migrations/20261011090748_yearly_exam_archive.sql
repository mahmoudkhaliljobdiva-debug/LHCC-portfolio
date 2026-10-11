-- Additive archive/import model. Existing bank/case/question/attempt rows are untouched.
create table public.exam_sources (
  id uuid primary key, question_bank_id text not null references public.question_banks(id),
  filename text not null check(length(filename) between 1 and 500), storage_path text not null unique,
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index exam_sources_bank_idx on public.exam_sources(question_bank_id);
create index exam_sources_uploader_idx on public.exam_sources(uploaded_by);
create table public.past_exams (
  id uuid primary key, question_bank_id text not null references public.question_banks(id),
  source_id uuid references public.exam_sources(id), title text not null check(length(btrim(title)) between 1 and 500),
  exam_year integer check(exam_year between 1900 and 2200), session text not null default '',
  status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','ARCHIVED')),
  time_limit_minutes integer check(time_limit_minutes between 1 and 1440), provenance text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(status<>'PUBLISHED' or exam_year is not null)
);
create index past_exams_bank_year_idx on public.past_exams(question_bank_id,exam_year desc);
create index past_exams_source_idx on public.past_exams(source_id);
create table public.past_exam_questions (
  exam_id uuid not null references public.past_exams(id), question_id text not null references public.bank_questions(id),
  position integer not null check(position between 1 and 1000), source_number text not null,
  primary key(exam_id,question_id), unique(exam_id,position)
);
create index past_exam_questions_question_idx on public.past_exam_questions(question_id);
create table private.past_exam_drafts (
  exam_id uuid primary key references public.past_exams(id), content jsonb not null
);
create table private.imported_question_owners (
  question_id text primary key references public.bank_questions(id), exam_id uuid not null references public.past_exams(id)
);
create index imported_question_owner_exam_idx on private.imported_question_owners(exam_id);
alter table private.imported_question_owners enable row level security;
create policy deny_import_owners on private.imported_question_owners for all using(false) with check(false);
revoke all on private.imported_question_owners from public,anon,authenticated;
grant all on private.imported_question_owners to service_role;
alter table private.past_exam_drafts enable row level security;
create policy deny_exam_drafts on private.past_exam_drafts for all using(false) with check(false);
revoke all on private.past_exam_drafts from public,anon,authenticated;
grant all on private.past_exam_drafts to service_role;
alter table public.exam_sources enable row level security;
alter table public.past_exams enable row level security;
alter table public.past_exam_questions enable row level security;
revoke all on public.exam_sources,public.past_exams,public.past_exam_questions from public,anon,authenticated;
grant select on public.exam_sources,public.past_exams,public.past_exam_questions to authenticated;
grant all on public.exam_sources,public.past_exams,public.past_exam_questions to service_role;
create policy source_admin on public.exam_sources for select to authenticated using((select private.is_active_role('ADMIN')));
create policy past_exam_catalog on public.past_exams for select to authenticated using(
  (select private.is_active_role('ADMIN')) or (status='PUBLISHED' and private.can_open_bank(question_bank_id))
);
create policy past_exam_question_catalog on public.past_exam_questions for select to authenticated using(
  exists(select 1 from public.past_exams e where e.id=exam_id)
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('exam-source-pdfs','exam-source-pdfs',false,20971520,array['application/pdf']);
create policy exam_pdf_admin_read on storage.objects for select to authenticated using(
  bucket_id='exam-source-pdfs' and (select private.is_active_role('ADMIN')));
create policy exam_pdf_admin_insert on storage.objects for insert to authenticated with check(
  bucket_id='exam-source-pdfs' and (select private.is_active_role('ADMIN')));
-- No client UPDATE/DELETE: original sources are immutable and private.
alter table public.bank_questions add column include_in_complete_bank boolean not null default true;
alter table public.question_attempts add column past_exam_id uuid references public.past_exams(id);
alter table public.question_attempts add column exam_title_snapshot text;
alter table public.question_attempts add column exam_year_snapshot integer;
alter table public.question_attempts add column learning_mode text not null default 'EXAM' check(learning_mode in ('EXAM','PRACTICE'));
alter table public.question_attempts add column source_kind text not null default 'RANDOM' check(source_kind in ('RANDOM','ALL','CASE','PAST'));
alter table public.question_attempts add column setup_signature jsonb;
alter table public.question_attempts add column deadline_at timestamptz;
create index attempt_past_exam_idx on public.question_attempts(past_exam_id);
alter table public.question_attempt_questions drop constraint question_attempt_questions_display_order_check;
alter table public.question_attempt_questions add constraint question_attempt_questions_display_order_check check(display_order >= 1);
create table private.practice_checks (
  attempt_id uuid not null, question_id text not null, checked_at timestamptz not null default now(),
  primary key(attempt_id,question_id),
  foreign key(attempt_id,question_id) references public.question_attempt_questions(attempt_id,question_id) on delete cascade
);
alter table private.practice_checks enable row level security;
create policy deny_practice_checks on private.practice_checks for all using(false) with check(false);
revoke all on private.practice_checks from public,anon,authenticated;
grant all on private.practice_checks to service_role;

create function private.register_exam_source(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare source_id uuid:=(payload->>'id')::uuid;
begin
  if not private.is_active_role('ADMIN') then raise exception 'Admin required' using errcode='42501'; end if;
  if not exists(select 1 from storage.objects where bucket_id='exam-source-pdfs' and name=payload->>'storagePath') then
    raise exception 'Upload the private source first' using errcode='23514'; end if;
  insert into public.exam_sources(id,question_bank_id,filename,storage_path,sha256,uploaded_by)
    values(source_id,payload->>'bankId',payload->>'filename',payload->>'storagePath',payload->>'sha256',auth.uid());
  return source_id;
end $$;

create function private.save_past_exam(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare eid uuid:=(payload->>'id')::uuid; bid text:=payload->>'bankId'; q jsonb; qid text; cid text; key text; p integer:=0; case_order integer; options jsonb; seen text[]:='{}';
begin
  if not private.is_active_role('ADMIN') then raise exception 'Admin required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(bid,0));
  if jsonb_typeof(payload->'questions')<>'array' or jsonb_array_length(payload->'questions')>1000
    or nullif(btrim(payload->>'title'),'') is null or nullif(btrim(payload->>'provenance'),'') is null then
    raise exception 'Invalid draft' using errcode='23514'; end if;
  if exists(select 1 from public.past_exams where id=eid and question_bank_id<>bid) then raise exception 'Cannot move exams' using errcode='23514'; end if;
  if nullif(payload->>'sourceId','') is not null and not exists(select 1 from public.exam_sources where id=(payload->>'sourceId')::uuid and question_bank_id=bid) then
    raise exception 'Source belongs to another bank' using errcode='23514'; end if;
  -- Unpublishing never deletes questions or attempts. Drafts retain their review content.
  insert into public.past_exams(id,question_bank_id,source_id,title,exam_year,session,status,time_limit_minutes,provenance)
    values(eid,bid,(payload->>'sourceId')::uuid,btrim(payload->>'title'),(payload->>'year')::integer,
      coalesce(payload->>'session',''),payload->>'status',(payload->>'timeLimitMinutes')::integer,payload->>'provenance')
    on conflict(id) do update set source_id=excluded.source_id,title=excluded.title,exam_year=excluded.exam_year,
      session=excluded.session,status=excluded.status,time_limit_minutes=excluded.time_limit_minutes,provenance=excluded.provenance,updated_at=now();
  if payload->>'status'='PUBLISHED' then
    if (payload->>'year') is null or jsonb_array_length(payload->'questions')=0 then raise exception 'Confirm year and questions' using errcode='23514'; end if;
    delete from public.past_exam_questions where exam_id=eid;
    for q in select value from jsonb_array_elements(payload->'questions') loop
      p:=p+1; qid:=coalesce(nullif(q->>'reuseQuestionId',''),q->>'id'); key:=q->>'correctOptionId'; cid:=nullif(q->>'caseId','');
      if qid=any(seen) then raise exception 'Duplicate question association' using errcode='23514'; end if; seen:=array_append(seen,qid);
      if coalesce((q->>'verified')::boolean,false)=false or jsonb_array_length(q->'warnings')<>0
        or nullif(btrim(q->>'text'),'') is null or jsonb_typeof(q->'options')<>'array'
        or jsonb_array_length(q->'options') not between 2 and 10
        or not exists(select 1 from jsonb_array_elements(q->'options') o where o->>'id'=key)
        or exists(select 1 from jsonb_array_elements(q->'options') o where nullif(btrim(o->>'text'),'') is null or nullif(o->>'id','') is null)
        or (select count(distinct o->>'id') from jsonb_array_elements(q->'options') o)<>jsonb_array_length(q->'options') then
        raise exception 'Review every question and verify all keys' using errcode='23514'; end if;
      if nullif(q->>'reuseQuestionId','') is not null then
        -- Explicit reuse only; no fuzzy merging and no edits to a reused question/key/case.
        if not exists(select 1 from public.bank_questions b join private.question_solutions s on s.question_id=b.id
          where b.id=qid and b.question_bank_id=bid and b.status='active' and s.correct_option_id=key
          and b.text=q->>'text' and b.options=q->'options') then raise exception 'Reused question must match the approved original' using errcode='23514'; end if;
      else
        if coalesce((q->>'duplicateReviewed')::boolean,false)=false and exists(select 1 from public.bank_questions
          where question_bank_id=bid and id<>qid and lower(btrim(text))=lower(btrim(q->>'text'))) then
          raise exception 'Review potential duplicates and choose explicit reuse or confirm a distinct record' using errcode='23514'; end if;
        if cid is not null then
          if exists(select 1 from public.question_sections where id=cid and question_bank_id<>bid) then raise exception 'Wrong bank case' using errcode='23514'; end if;
          if not exists(select 1 from public.question_sections where id=cid) then
            select coalesce(max(display_order),0)+1 into case_order from public.question_sections where question_bank_id=bid;
            insert into public.question_sections(id,question_bank_id,title,description,display_order)
              values(cid,bid,q->>'caseTitle',q->>'caseDescription',case_order);
          elsif not exists(select 1 from public.question_sections where id=cid and title=q->>'caseTitle' and description=q->>'caseDescription') then
            raise exception 'Existing case must be preserved; edit it through case management' using errcode='23514'; end if;
        end if;
        select jsonb_agg(jsonb_build_object('id',o->>'id','text',o->>'text') order by n) into options from jsonb_array_elements(q->'options') with ordinality x(o,n);
        -- Only records created by this exam can be updated through this import flow.
        if exists(select 1 from public.bank_questions where id=qid) and not exists(
          select 1 from private.imported_question_owners where question_id=qid and exam_id=eid) then
          raise exception 'Use explicit reuse for existing questions' using errcode='23514'; end if;
        insert into public.bank_questions(id,question_bank_id,text,status,options,section_id,display_order,include_in_complete_bank)
          values(qid,bid,q->>'text','active',options,cid,p,(q->>'includeInBank')::boolean)
          on conflict(id) do update set text=excluded.text,options=excluded.options,section_id=excluded.section_id,
            include_in_complete_bank=excluded.include_in_complete_bank,updated_at=now();
        insert into private.question_solutions values(qid,key) on conflict(question_id) do update set correct_option_id=excluded.correct_option_id;
        insert into private.imported_question_owners values(qid,eid) on conflict(question_id) do nothing;
      end if;
      insert into public.past_exam_questions values(eid,qid,p,coalesce(q->>'sourceNumber',p::text));
    end loop;
  end if;
  insert into private.past_exam_drafts values(eid,payload) on conflict(exam_id) do update set content=excluded.content;
  return eid;
end $$;
create function private.admin_past_exams(bank_id text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_active_role('ADMIN') then raise exception 'Admin required' using errcode='42501'; end if;
  return jsonb_build_object('exams',coalesce((select jsonb_agg(d.content order by e.exam_year desc nulls last,e.created_at desc)
    from public.past_exams e join private.past_exam_drafts d on d.exam_id=e.id where e.question_bank_id=bank_id),'[]'),
    'sources',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'filename',s.filename,'storagePath',s.storage_path)) from public.exam_sources s where s.question_bank_id=bank_id),'[]'));
end $$;

create function private.start_learning_exam(config jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare bid text:=config->>'bankId'; kind text:=config->>'source'; learning text:=config->>'mode'; a public.question_attempts;
  e public.past_exams; selected jsonb; q record; size integer; minutes integer:=(config->>'timeLimitMinutes')::integer; count_limit integer:=(config->>'count')::integer;
begin
  perform private.lock_exam_access(bid);
  if kind is null or learning is null or count_limit is null or kind not in ('RANDOM','ALL','CASE','PAST') or learning not in ('PRACTICE','EXAM')
    or count_limit not between 1 and 30 or (minutes is not null and minutes not between 1 and 1440) then raise exception 'Invalid setup' using errcode='23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||bid,0));
  select * into a from public.question_attempts where student_id=auth.uid() and question_bank_id=bid and status='IN_PROGRESS' for update;
  if found and a.mode='EXAM' then
    if (a.setup_signature is not null and a.setup_signature<>config) or (a.setup_signature is null and (kind<>'RANDOM' or learning<>'EXAM' or minutes is not null or count_limit<>30)) then raise exception 'Continue your unfinished attempt first' using errcode='23514'; end if;
    return a.id;
  end if;
  if found then update public.question_attempts set status='ABANDONED',submitted_at=now() where id=a.id; end if;
  if kind='PAST' then
    select * into e from public.past_exams where id=(config->>'sourceId')::uuid and question_bank_id=bid and status='PUBLISHED' for share;
    if not found then raise exception 'Exam unavailable' using errcode='42501'; end if;
  elsif kind='CASE' and not exists(select 1 from public.question_sections where id=config->>'sourceId' and question_bank_id=bid) then
    raise exception 'Case unavailable' using errcode='42501';
  end if;
  select jsonb_agg(to_jsonb(pool) order by position) into selected from (
    select chosen.*,row_number() over(order by chosen.random_order,chosen.exam_order,chosen.case_order,chosen.question_order,chosen.id) as position from (
      select b.id,b.text,b.options,s.correct_option_id,b.section_id as section_id_snapshot,
        sec.title as case_title_snapshot,sec.description as case_description_snapshot,
        case when kind='RANDOM' then random() else 0 end as random_order,eq.position as exam_order,
        sec.display_order as case_order,b.display_order as question_order
      from public.bank_questions b join private.question_solutions s on s.question_id=b.id
      left join public.question_sections sec on sec.id=b.section_id and sec.question_bank_id=bid
      left join public.past_exam_questions eq on eq.question_id=b.id and eq.exam_id=e.id
      where b.question_bank_id=bid and b.status='active' and jsonb_array_length(b.options) between 2 and 10
        and exists(select 1 from jsonb_array_elements(b.options) o where o->>'id'=s.correct_option_id)
        and (case when kind='PAST' then eq.exam_id is not null else b.include_in_complete_bank end)
        and (kind<>'CASE' or b.section_id=config->>'sourceId')
      order by random_order,eq.position,sec.display_order,b.display_order,b.id
      limit case when kind='RANDOM' then count_limit else null end
    ) chosen
  ) pool;
  size:=coalesce(jsonb_array_length(selected),0);
  if size=0 then raise exception 'No eligible questions' using errcode='23514'; end if;
  if kind='PAST' and size<>(select count(*) from public.past_exam_questions where exam_id=e.id) then raise exception 'An exam question is unavailable; admin review required' using errcode='23514'; end if;
  insert into public.question_attempts(student_id,question_bank_id,total_questions,mode,bank_name_snapshot,past_exam_id,
    exam_title_snapshot,exam_year_snapshot,learning_mode,source_kind,setup_signature,deadline_at)
    select auth.uid(),id,size,'EXAM',name,e.id,coalesce(e.title,case kind when 'ALL' then 'Complete question bank' when 'CASE' then 'Clinical case practice' else 'Random question bank' end),
      e.exam_year,learning,kind,config,case when minutes is not null then now()+make_interval(mins=>minutes) end
    from public.question_banks where id=bid returning * into a;
  for q in select * from jsonb_to_recordset(selected) as r(id text,text text,options jsonb,correct_option_id text,
    section_id_snapshot text,case_title_snapshot text,case_description_snapshot text,position integer) loop
    insert into public.question_attempt_questions(attempt_id,question_id,display_order,text,options,section_id_snapshot,case_title_snapshot,case_description_snapshot)
      values(a.id,q.id,q.position,q.text,(select jsonb_agg(jsonb_build_object('id',o->>'id','text',o->>'text')) from jsonb_array_elements(q.options) o),q.section_id_snapshot,q.case_title_snapshot,q.case_description_snapshot);
    insert into private.exam_question_solutions values(a.id,q.id,q.correct_option_id);
  end loop;
  return a.id;
end $$;

create or replace function private.start_exam(bank_id text) returns uuid language sql security definer set search_path='' as $$
  select private.start_learning_exam(jsonb_build_object('bankId',bank_id,'source','RANDOM','sourceId',null,'mode','EXAM','count',30,'timeLimitMinutes',null))
$$;

create or replace function private.save_exam_answer(attempt_id uuid,question_id text,option_id text) returns void
language plpgsql security definer set search_path='' as $$
declare a public.question_attempts;
begin
  select * into a from public.question_attempts t where t.id=attempt_id and t.student_id=auth.uid() and t.mode='EXAM';
  if not found then raise exception 'Attempt unavailable' using errcode='42501'; end if;
  perform private.lock_exam_access(a.question_bank_id);
  select * into a from public.question_attempts t where t.id=attempt_id for update;
  if a.status<>'IN_PROGRESS' or (a.deadline_at is not null and clock_timestamp()>=a.deadline_at) then raise exception 'Attempt completed or timer expired' using errcode='23514'; end if;
  if exists(select 1 from private.practice_checks c where c.attempt_id=a.id and c.question_id=save_exam_answer.question_id) then raise exception 'Checked answer is final' using errcode='23514'; end if;
  if not exists(select 1 from public.question_attempt_questions q where q.attempt_id=a.id and q.question_id=save_exam_answer.question_id
    and exists(select 1 from jsonb_array_elements(q.options) o where o->>'id'=option_id)) then raise exception 'Invalid answer' using errcode='23514'; end if;
  insert into public.question_attempt_answers(attempt_id,question_id,selected_option_id,is_correct) values(a.id,question_id,option_id,null)
    on conflict on constraint question_attempt_answers_attempt_id_question_id_key do update set selected_option_id=excluded.selected_option_id,answered_at=now();
  update public.question_attempts set updated_at=now() where id=a.id;
end $$;
create function private.check_practice_answer(attempt_id uuid,question_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.question_attempts; selected text; key text;
begin
  select * into a from public.question_attempts t where t.id=attempt_id and t.student_id=auth.uid() and t.mode='EXAM' and t.learning_mode='PRACTICE';
  if not found then raise exception 'Practice attempt required' using errcode='42501'; end if;
  perform private.lock_exam_access(a.question_bank_id);
  select * into a from public.question_attempts t where t.id=attempt_id for update;
  if a.status<>'IN_PROGRESS' or (a.deadline_at is not null and clock_timestamp()>=a.deadline_at) then raise exception 'Attempt unavailable' using errcode='23514'; end if;
  select ans.selected_option_id,s.correct_option_id into selected,key from public.question_attempt_answers ans
    join private.exam_question_solutions s on s.attempt_id=ans.attempt_id and s.question_id=ans.question_id
    where ans.attempt_id=a.id and ans.question_id=check_practice_answer.question_id;
  if not found then raise exception 'Save an answer first' using errcode='23514'; end if;
  insert into private.practice_checks values(a.id,question_id,now()) on conflict do nothing;
  return jsonb_build_object('outcome',selected=key,'correctOptionId',key);
end $$;

-- Retain tested authorization, case snapshots and existing result payload; enrich only after its guard.
alter function private.exam_data(uuid,uuid) rename to original_exam_data;
create function private.exam_data(attempt_id uuid,subject_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; a public.question_attempts;
begin
  result:=private.original_exam_data(attempt_id,subject_id);
  select * into a from public.question_attempts where id=attempt_id;
  result:=result || jsonb_build_object('title',coalesce(a.exam_title_snapshot,a.bank_name_snapshot),'year',a.exam_year_snapshot,
    'learningMode',a.learning_mode,'source',a.source_kind,'deadlineAt',a.deadline_at,
    'unanswered',(select a.total_questions-count(*) from public.question_attempt_answers where question_attempt_answers.attempt_id=a.id),
    'timeTakenSeconds',case when a.submitted_at is not null then greatest(0,extract(epoch from least(a.submitted_at,coalesce(a.deadline_at,a.submitted_at))-a.started_at)::integer) end);
  result:=jsonb_set(result,'{questions}',coalesce((select jsonb_agg(q || case when a.status='COMPLETED' or (a.learning_mode='PRACTICE' and c.question_id is not null) then
    jsonb_build_object('outcome',coalesce(ans.selected_option_id=s.correct_option_id,false),'correctOptionId',s.correct_option_id) else '{}'::jsonb end order by (q->>'order')::integer)
    from jsonb_array_elements(result->'questions') q left join private.practice_checks c on c.attempt_id=a.id and c.question_id=q->>'id'
    left join private.exam_question_solutions s on s.attempt_id=a.id and s.question_id=q->>'id'
    left join public.question_attempt_answers ans on ans.attempt_id=a.id and ans.question_id=q->>'id'),'[]'));
  return result;
end $$;
alter function private.exam_bank_data(text,uuid) rename to original_exam_bank_data;
create function private.exam_bank_data(bank_id text,subject_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; eligible integer; target uuid:=coalesce(subject_id,auth.uid());
begin
  result:=private.original_exam_bank_data(bank_id,subject_id);
  select count(*) into eligible from public.bank_questions b join private.question_solutions s on s.question_id=b.id where b.question_bank_id=bank_id
    and b.status='active' and b.include_in_complete_bank and jsonb_array_length(b.options) between 2 and 10 and exists(select 1 from jsonb_array_elements(b.options) o where o->>'id'=s.correct_option_id);
  return result || jsonb_build_object('available',eligible,'examCount',least(eligible,30),
    'pastExams',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'year',e.exam_year,'session',e.session,
      'timeLimitMinutes',e.time_limit_minutes,'questionCount',(select count(*) from public.past_exam_questions where exam_id=e.id),
      'completed',(select count(*) from public.question_attempts where student_id=target and past_exam_id=e.id and status='COMPLETED'),
      'bestScore',(select max(score_percentage) from public.question_attempts where student_id=target and past_exam_id=e.id and status='COMPLETED')) order by e.exam_year desc,e.session,e.title)
      from public.past_exams e where e.question_bank_id=bank_id and e.status='PUBLISHED'),'[]'));
end $$;
-- Refresh wrapper resolution after renaming implementations.
create or replace function public.exam_data(attempt_id uuid,subject_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.exam_data(attempt_id,subject_id) $$;
create or replace function public.exam_bank_data(bank_id text,subject_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.exam_bank_data(bank_id,subject_id) $$;
create function public.start_learning_exam(config jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.start_learning_exam(config) $$;
create function public.check_practice_answer(attempt_id uuid,question_id text) returns jsonb language sql security invoker set search_path='' as $$ select private.check_practice_answer(attempt_id,question_id) $$;
create function public.register_exam_source(payload jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.register_exam_source(payload) $$;
create function public.save_past_exam(payload jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.save_past_exam(payload) $$;
create function public.admin_past_exams(bank_id text) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_past_exams(bank_id) $$;
revoke all on function private.original_exam_data(uuid,uuid),private.original_exam_bank_data(text,uuid) from public,anon,authenticated;
revoke all on function private.exam_data(uuid,uuid),private.exam_bank_data(text,uuid),public.start_learning_exam(jsonb),private.start_learning_exam(jsonb),
  public.check_practice_answer(uuid,text),private.check_practice_answer(uuid,text),public.register_exam_source(jsonb),private.register_exam_source(jsonb),
  public.save_past_exam(jsonb),private.save_past_exam(jsonb),public.admin_past_exams(text),private.admin_past_exams(text) from public,anon;
grant execute on function private.exam_data(uuid,uuid),private.exam_bank_data(text,uuid),public.start_learning_exam(jsonb),private.start_learning_exam(jsonb),
  public.check_practice_answer(uuid,text),private.check_practice_answer(uuid,text),public.register_exam_source(jsonb),private.register_exam_source(jsonb),
  public.save_past_exam(jsonb),private.save_past_exam(jsonb),public.admin_past_exams(text),private.admin_past_exams(text) to authenticated;

create function private.learning_progress() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_active_role('STUDENT') then raise exception 'Student required' using errcode='42501'; end if;
  return jsonb_build_object('groups',coalesce((select jsonb_agg(to_jsonb(g)) from (
    select bank_name_snapshot as bank,coalesce(exam_title_snapshot,'Complete bank') as exam,exam_year_snapshot as year,learning_mode as mode,count(*)::integer as completed,
      round(avg(score_percentage),2) as score from public.question_attempts where student_id=auth.uid() and mode='EXAM' and status='COMPLETED'
    group by bank_name_snapshot,past_exam_id,exam_title_snapshot,exam_year_snapshot,learning_mode order by bank_name_snapshot,exam_year_snapshot desc nulls last,learning_mode
  ) g),'[]'),'cases',coalesce((select jsonb_agg(to_jsonb(g)) from (
    select q.case_title_snapshot as title,a.bank_name_snapshot as bank,count(*)::integer as questions,
      count(*) filter(where ans.is_correct)::integer as correct,
      round(count(*) filter(where ans.is_correct)::numeric*100/count(*),2) as score
    from public.question_attempt_questions q join public.question_attempts a on a.id=q.attempt_id
      left join public.question_attempt_answers ans on ans.attempt_id=q.attempt_id and ans.question_id=q.question_id
    where a.student_id=auth.uid() and a.mode='EXAM' and a.status='COMPLETED' and q.case_title_snapshot is not null
    group by q.section_id_snapshot,q.case_title_snapshot,a.bank_name_snapshot order by a.bank_name_snapshot,q.case_title_snapshot
  ) g),'[]'));
end $$;
create function public.learning_progress() returns jsonb language sql security invoker set search_path='' as $$ select private.learning_progress() $$;
revoke all on function private.learning_progress(),public.learning_progress() from public,anon;
grant execute on function private.learning_progress(),public.learning_progress() to authenticated;

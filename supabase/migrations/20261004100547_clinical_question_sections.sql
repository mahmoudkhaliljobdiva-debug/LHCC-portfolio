-- Additive migration: production already has question_sections and question ordering.
-- Never replace or reseed existing clinical content.
create table if not exists public.question_sections (
  id text primary key default gen_random_uuid()::text,
  question_bank_id text not null references public.question_banks(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 500),
  description text not null check (length(btrim(description)) between 1 and 10000),
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(question_bank_id,display_order)
);
alter table public.bank_questions add column if not exists section_id text references public.question_sections(id) on delete set null;
alter table public.bank_questions add column if not exists display_order integer check (display_order >= 1);
create index if not exists idx_question_sections_bank_order on public.question_sections(question_bank_id,display_order);
create index if not exists idx_bank_questions_section_order on public.bank_questions(section_id,display_order);
alter table public.question_sections enable row level security;
revoke all on public.question_sections from public,anon,authenticated;
grant select on public.question_sections to authenticated;
grant all on public.question_sections to service_role;
drop policy if exists section_catalog on public.question_sections;
create policy section_catalog on public.question_sections for select to authenticated using (
  private.can_open_bank(question_bank_id) or private.teacher_has_bank(question_bank_id)
  or (select private.is_active_role('ADMIN'))
);

-- The snapshot has no FK to sections so deleting or editing a case cannot change an exam.
alter table public.question_attempt_questions add column if not exists section_id_snapshot text;
alter table public.question_attempt_questions add column if not exists case_title_snapshot text;
alter table public.question_attempt_questions add column if not exists case_description_snapshot text;

create or replace function private.admin_bank_data() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
  return jsonb_build_object(
    'banks',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'description',description,'status',status,
      'displayOrder',display_order,'imageUrl',image_url,'price',price,'createdAt',created_at,'updatedAt',updated_at) order by display_order)
      from public.question_banks),'[]'::jsonb),
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'bankId',s.question_bank_id,'title',s.title,
      'description',s.description,'displayOrder',s.display_order,'createdAt',s.created_at,'updatedAt',s.updated_at)
      order by s.question_bank_id,s.display_order) from public.question_sections s),'[]'::jsonb),
    'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'bankId',q.question_bank_id,'sectionId',q.section_id,
      'displayOrder',q.display_order,'text',q.text,'status',q.status,'type','QCU','createdAt',q.created_at,'updatedAt',q.updated_at,
      'answers',(select jsonb_agg(o || jsonb_build_object('isCorrect',o->>'id'=s.correct_option_id)) from jsonb_array_elements(q.options) o))
      order by q.question_bank_id,coalesce(sec.display_order,2147483647),coalesce(q.display_order,2147483647),q.created_at)
      from public.bank_questions q join private.question_solutions s on s.question_id=q.id
      left join public.question_sections sec on sec.id=q.section_id and sec.question_bank_id=q.question_bank_id),'[]'::jsonb));
end $$;

create or replace function private.start_exam(bank_id text) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.question_attempts; q record; selected jsonb; size integer;
begin
  perform private.lock_exam_access(bank_id);
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||bank_id,0));
  select * into a from public.question_attempts where student_id=auth.uid() and question_bank_id=bank_id and status='IN_PROGRESS' for update;
  if found and a.mode='EXAM' then return a.id; end if;
  if found then update public.question_attempts set status='ABANDONED',submitted_at=now() where id=a.id; end if;
  select jsonb_agg(to_jsonb(pool) order by pool.position) into selected from (
    select chosen.*,row_number() over () as position from (
      select b.id,b.text,b.options,s.correct_option_id,b.section_id as section_id_snapshot,
        sec.title as case_title_snapshot,sec.description as case_description_snapshot
      from public.bank_questions b join private.question_solutions s on s.question_id=b.id
      left join public.question_sections sec on sec.id=b.section_id and sec.question_bank_id=b.question_bank_id
      where b.question_bank_id=bank_id and b.status='active'
        and jsonb_array_length(b.options) between 2 and 10
        and exists(select 1 from jsonb_array_elements(b.options) o where o->>'id'=s.correct_option_id)
      order by random() limit 30
    ) chosen
  ) pool;
  size:=coalesce(jsonb_array_length(selected),0);
  if size=0 then raise exception 'No eligible questions' using errcode='P0002'; end if;
  insert into public.question_attempts(student_id,question_bank_id,total_questions,mode,bank_name_snapshot)
    select auth.uid(),id,size,'EXAM',name from public.question_banks where id=bank_id returning * into a;
  for q in select * from jsonb_to_recordset(selected) as r(id text,text text,options jsonb,correct_option_id text,
    section_id_snapshot text,case_title_snapshot text,case_description_snapshot text,position integer) loop
    insert into public.question_attempt_questions(attempt_id,question_id,display_order,text,options,
      section_id_snapshot,case_title_snapshot,case_description_snapshot)
      values(a.id,q.id,q.position,q.text,
        (select jsonb_agg(jsonb_build_object('id',o->>'id','text',o->>'text')) from jsonb_array_elements(q.options) o),
        q.section_id_snapshot,q.case_title_snapshot,q.case_description_snapshot);
    insert into private.exam_question_solutions values(a.id,q.id,q.correct_option_id);
  end loop;
  return a.id;
end $$;

create or replace function private.exam_data(attempt_id uuid,subject_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.question_attempts;
begin
  select * into a from public.question_attempts t where t.id=attempt_id and t.mode='EXAM';
  if not found then raise exception 'Attempt unavailable' using errcode='42501'; end if;
  if private.is_active_role('ADMIN') and subject_id is not null and a.student_id=subject_id then null;
  elsif subject_id is null and a.student_id=auth.uid() and private.is_active_role('STUDENT')
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
end $$;

create or replace function private.exam_bank_data(bank_id text,subject_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=coalesce(subject_id,auth.uid()); bank public.question_banks; eligible integer;
begin
  if subject_id is not null then
    if not private.is_active_role('ADMIN') or not exists(select 1 from public.profiles where id=target and role='STUDENT') then
      raise exception 'Access denied' using errcode='42501'; end if;
    if not exists(select 1 from public.user_bank_access where user_id=target and question_bank_id=bank_id and status='ACTIVE') then
      raise exception 'Access denied' using errcode='42501'; end if;
  elsif not private.can_open_bank(bank_id) then raise exception 'Access denied' using errcode='42501'; end if;
  select * into bank from public.question_banks where id=bank_id and status='active';
  if not found then raise exception 'Bank unavailable' using errcode='42501'; end if;
  select count(*)::integer into eligible from public.bank_questions b join private.question_solutions s on s.question_id=b.id
    where b.question_bank_id=bank_id and b.status='active' and jsonb_array_length(b.options) between 2 and 10
      and exists(select 1 from jsonb_array_elements(b.options) o where o->>'id'=s.correct_option_id);
  return jsonb_build_object('id',bank.id,'name',bank.name,'description',bank.description,'available',eligible,
    'examCount',least(eligible,30),
    'cases',coalesce((select jsonb_agg(jsonb_build_object('id',sec.id,'title',sec.title,'description',sec.description,
      'displayOrder',sec.display_order,'questionCount',(select count(*)::integer from public.bank_questions b
        join private.question_solutions s on s.question_id=b.id where b.section_id=sec.id and b.question_bank_id=bank_id
          and b.status='active' and jsonb_array_length(b.options) between 2 and 10
          and exists(select 1 from jsonb_array_elements(b.options) o where o->>'id'=s.correct_option_id)))
      order by sec.display_order,sec.id) from public.question_sections sec where sec.question_bank_id=bank_id),'[]'::jsonb),
    'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'status',status,'mode',mode,'startedAt',started_at,
      'submittedAt',submitted_at,'totalQuestions',total_questions,
      'score',case when status='COMPLETED' then score_percentage else null end) order by started_at desc,id)
      from public.question_attempts where student_id=target and question_bank_id=bank_id),'[]'::jsonb));
end $$;

create or replace function private.manage_bank_content(operation text,item_id text,payload jsonb default '{}') returns void
language plpgsql security definer set search_path='' as $$
declare correct_id text; safe_options jsonb; target_section text; target_order integer;
begin
  if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
  if operation='save_bank' then
    insert into public.question_banks(id,name,description,status,display_order,image_url,price,created_by)
    values(item_id,payload->>'name',payload->>'description',payload->>'status',coalesce((payload->>'displayOrder')::integer,0),
      nullif(btrim(payload->>'imageUrl'),''),coalesce((payload->>'price')::numeric,0),auth.uid())
    on conflict(id) do update set name=excluded.name,description=excluded.description,status=excluded.status,
      display_order=excluded.display_order,image_url=excluded.image_url,price=excluded.price;
  elsif operation='delete_bank' then
    delete from public.question_banks where id=item_id;
  elsif operation='save_section' then
    if nullif(btrim(payload->>'bankId'),'') is null or nullif(btrim(payload->>'title'),'') is null
      or nullif(btrim(payload->>'description'),'') is null then raise exception 'Bank, title and case description are required' using errcode='23514'; end if;
    if exists(select 1 from public.question_sections where id=item_id and question_bank_id<>payload->>'bankId') then
      raise exception 'Cannot move a case to another bank' using errcode='23514'; end if;
    insert into public.question_sections(id,question_bank_id,title,description,display_order)
    values(item_id,payload->>'bankId',btrim(payload->>'title'),btrim(payload->>'description'),coalesce((payload->>'displayOrder')::integer,0))
    on conflict(id) do update set title=excluded.title,description=excluded.description,display_order=excluded.display_order,
      updated_at=statement_timestamp();
  elsif operation='delete_section' then
    delete from public.question_sections where id=item_id;
  elsif operation='save_question' then
    if jsonb_typeof(payload->'answers') <> 'array' or jsonb_array_length(payload->'answers') not between 2 and 10 then
      raise exception 'Provide 2 to 10 answers' using errcode='23514'; end if;
    if (select count(*) from jsonb_array_elements(payload->'answers') a where a->>'isCorrect'='true') <> 1 then
      raise exception 'Exactly one correct answer required' using errcode='23514'; end if;
    if exists(select 1 from jsonb_array_elements(payload->'answers') a where nullif(btrim(a->>'text'),'') is null or nullif(a->>'id','') is null)
      or (select count(distinct a->>'id') from jsonb_array_elements(payload->'answers') a) <> jsonb_array_length(payload->'answers') then
      raise exception 'Invalid answers' using errcode='23514'; end if;
    if exists(select 1 from public.bank_questions where id=item_id and question_bank_id<>payload->>'bankId') then
      raise exception 'Cannot move a question to another bank' using errcode='23514'; end if;
    target_section:=nullif(payload->>'sectionId',''); target_order:=nullif(payload->>'displayOrder','')::integer;
    if target_section is not null and not exists(select 1 from public.question_sections x where x.id=target_section and x.question_bank_id=payload->>'bankId') then
      raise exception 'Case does not belong to this bank' using errcode='23514'; end if;
    select a->>'id' into correct_id from jsonb_array_elements(payload->'answers') a where a->>'isCorrect'='true';
    select jsonb_agg(jsonb_build_object('id',a->>'id','text',a->>'text')) into safe_options from jsonb_array_elements(payload->'answers') a;
    insert into public.bank_questions(id,question_bank_id,text,status,options,section_id,display_order)
    values(item_id,payload->>'bankId',payload->>'text',payload->>'status',safe_options,target_section,target_order)
    on conflict(id) do update set text=excluded.text,status=excluded.status,options=excluded.options,
      section_id=excluded.section_id,display_order=excluded.display_order;
    insert into private.question_solutions values(item_id,correct_id)
      on conflict(question_id) do update set correct_option_id=excluded.correct_option_id;
  elsif operation='delete_question' then delete from public.bank_questions where id=item_id;
  else raise exception 'Invalid operation' using errcode='23514'; end if;
end $$;

-- Additive specialty catalog and fixed shared definitions. Existing questions,
-- sources, grants, wallet entries and attempts retain their IDs and semantics.
create table public.specialties (
  id uuid primary key default gen_random_uuid(), slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check(length(btrim(name)) between 1 and 200), description text not null default '' check(length(description)<=3000),
  icon text not null default 'medical' check(icon in ('nursing','medical','dentistry','pharmacy','laboratory','radiology','physiotherapy','other')),
  published boolean not null default true, display_order integer not null default 0
);
alter table public.specialties enable row level security;
revoke all on public.specialties from public,anon,authenticated;
grant select on public.specialties to anon,authenticated;
grant all on public.specialties to service_role;
create policy specialty_read on public.specialties for select to anon,authenticated using(published or (select private.is_active_role('ADMIN')));
alter table public.question_banks add column specialty_id uuid references public.specialties(id);
create index question_banks_specialty_idx on public.question_banks(specialty_id);
-- These three independent categories are explicitly requested configuration, not
-- fabricated offerings. Empty categories advertise no nonexistent materials.
insert into public.specialties(slug,name,icon,display_order) values
 ('nursing','Nursing','nursing',0),('medical','Medical','medical',1),('dentistry','Dentistry','dentistry',2);
update public.question_banks set specialty_id=(select id from public.specialties where slug='nursing')
 where lower(btrim(name))='nursing colloquium' and specialty_id is null;

create function private.learning_catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'slug',s.slug,'name',s.name,'description',s.description,'icon',s.icon,
 'materials',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'description',b.description) order by b.display_order,b.id)
 from public.question_banks b where b.specialty_id=s.id and b.status='active'),'[]')) order by s.display_order,s.id),'[]')
 from public.specialties s where s.published
$$;
-- Bind the safe lookup at creation time. The public wrapper remains invoker;
-- anon receives EXECUTE on this one metadata lookup, not private-schema USAGE.
create function public.learning_catalog() returns jsonb language sql stable security invoker set search_path=''
begin atomic select private.learning_catalog(); end;
revoke all on function private.learning_catalog(),public.learning_catalog() from public;
grant execute on function public.learning_catalog() to anon,authenticated;
grant execute on function private.learning_catalog() to anon,authenticated;

create function private.save_specialty(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid:=(payload->>'id')::uuid;
begin
 if not private.is_active_role('ADMIN') then raise exception 'Admin required' using errcode='42501'; end if;
 insert into public.specialties(id,slug,name,description,icon,published,display_order)
 values(sid,payload->>'slug',btrim(payload->>'name'),coalesce(payload->>'description',''),payload->>'icon',
 (payload->>'published')::boolean,(payload->>'displayOrder')::integer)
 on conflict(id) do update set slug=excluded.slug,name=excluded.name,description=excluded.description,icon=excluded.icon,
 published=excluded.published,display_order=excluded.display_order;
 return sid;
end $$;
create function public.save_specialty(payload jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.save_specialty(payload) $$;
create function private.assign_bank_specialty(bank_id text,specialty_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_active_role('ADMIN') then raise exception 'Admin required' using errcode='42501'; end if;
 update public.question_banks b set specialty_id=assign_bank_specialty.specialty_id where b.id=bank_id;
 if not found then raise exception 'Bank not found' using errcode='23514'; end if;
end $$;
create function public.assign_bank_specialty(bank_id text,specialty_id uuid default null) returns void language sql security invoker set search_path='' as $$ select private.assign_bank_specialty(bank_id,specialty_id) $$;
revoke all on function private.save_specialty(jsonb),public.save_specialty(jsonb),private.assign_bank_specialty(text,uuid),public.assign_bank_specialty(text,uuid) from public,anon;
grant execute on function private.save_specialty(jsonb),public.save_specialty(jsonb),private.assign_bank_specialty(text,uuid),public.assign_bank_specialty(text,uuid) to authenticated;

create table public.shared_exams (
 id uuid primary key, question_bank_id text not null references public.question_banks(id),
 title text not null check(length(btrim(title)) between 1 and 500),
 status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','ARCHIVED')),
 question_count integer not null check(question_count between 1 and 1000),
 time_limit_minutes integer check(time_limit_minutes between 1 and 1440),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create index shared_exams_bank_idx on public.shared_exams(question_bank_id,status,created_at desc);
create index shared_exams_creator_idx on public.shared_exams(created_by);
alter table public.shared_exams enable row level security;
revoke all on public.shared_exams from public,anon,authenticated;
grant select on public.shared_exams to authenticated;
grant all on public.shared_exams to service_role;
create policy shared_exam_read on public.shared_exams for select to authenticated using(
 (select private.is_active_role('ADMIN')) or (status='PUBLISHED' and private.can_open_bank(question_bank_id)));
-- Definition snapshots and their keys are never exposed through a public table.
create table private.shared_exam_questions (
 exam_id uuid not null references public.shared_exams(id), question_id text not null references public.bank_questions(id),
 position integer not null check(position between 1 and 1000), snapshot jsonb not null,
 primary key(exam_id,question_id), unique(exam_id,position) deferrable initially deferred
);
create index shared_exam_questions_question_idx on private.shared_exam_questions(question_id);
alter table private.shared_exam_questions enable row level security;
create policy deny_shared_snapshots on private.shared_exam_questions for all using(false) with check(false);
revoke all on private.shared_exam_questions from public,anon,authenticated;
grant all on private.shared_exam_questions to service_role;
alter table public.question_attempts add column shared_exam_id uuid references public.shared_exams(id);
create index question_attempts_shared_idx on public.question_attempts(shared_exam_id,student_id);
alter table public.question_attempts drop constraint question_attempts_source_kind_check;
alter table public.question_attempts add constraint question_attempts_source_kind_check check(source_kind in ('RANDOM','ALL','CASE','PAST','SHARED'));

create function private.generate_shared_exam(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare eid uuid:=(payload->>'id')::uuid; bid text:=payload->>'bankId'; desired integer:=(payload->>'count')::integer; pool jsonb;
begin
 if not private.is_active_role('ADMIN') then raise exception 'Admin required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(bid,0));
 if exists(select 1 from public.shared_exams where id=eid) then
   if not exists(select 1 from public.shared_exams where id=eid and question_bank_id=bid and created_by=auth.uid()) then
    raise exception 'Definition conflict' using errcode='23514'; end if;
   return eid;
 end if;
 if desired is null or desired not between 1 and 1000 then raise exception 'Invalid count' using errcode='23514'; end if;
 select jsonb_agg(to_jsonb(q)) into pool from (
  select b.id,b.text,b.options,s.correct_option_id,b.section_id,
   c.title as case_title,c.description as case_description
  from public.bank_questions b join private.question_solutions s on s.question_id=b.id
  left join public.question_sections c on c.id=b.section_id and c.question_bank_id=bid
  where b.question_bank_id=bid and b.status='active' and b.include_in_complete_bank
   and jsonb_array_length(b.options) between 2 and 10
   and exists(select 1 from jsonb_array_elements(b.options) o where o->>'id'=s.correct_option_id)
  order by random() limit desired
 ) q;
 if coalesce(jsonb_array_length(pool),0)=0 then raise exception 'No eligible questions' using errcode='23514'; end if;
 insert into public.shared_exams(id,question_bank_id,title,question_count,time_limit_minutes,created_by)
 values(eid,bid,btrim(payload->>'title'),jsonb_array_length(pool),(payload->>'timeLimitMinutes')::integer,auth.uid());
 insert into private.shared_exam_questions(exam_id,question_id,position,snapshot)
 select eid,q->>'id',n::integer,q from jsonb_array_elements(pool) with ordinality t(q,n);
 return eid;
end $$;
create function public.generate_shared_exam(payload jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.generate_shared_exam(payload) $$;

create function private.save_shared_exam(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare e public.shared_exams; ids jsonb:=payload->'questionIds'; state text:=payload->>'status';
begin
 if not private.is_active_role('ADMIN') then raise exception 'Admin required' using errcode='42501'; end if;
 select * into e from public.shared_exams where id=(payload->>'id')::uuid for update;
 if not found then raise exception 'Exam unavailable' using errcode='23514'; end if;
 if e.status<>'DRAFT' then
  if state is distinct from 'ARCHIVED' or payload->>'title' is distinct from e.title or (payload->>'timeLimitMinutes')::integer is distinct from e.time_limit_minutes
   or ids is distinct from (select jsonb_agg(question_id order by position) from private.shared_exam_questions where exam_id=e.id) then
    raise exception 'Published definition is immutable; generate a new exam' using errcode='23514'; end if;
  update public.shared_exams set status='ARCHIVED' where id=e.id; return;
 end if;
 if state is null or state not in ('DRAFT','PUBLISHED','ARCHIVED') or jsonb_typeof(ids) is distinct from 'array'
  or jsonb_array_length(ids)<>e.question_count
  or (select count(distinct v) from jsonb_array_elements_text(ids) t(v))<>e.question_count
  or exists(select 1 from jsonb_array_elements_text(ids) t(v) where not exists(select 1 from private.shared_exam_questions where exam_id=e.id and question_id=v)) then
   raise exception 'Exact generated question set required' using errcode='23514'; end if;
 update private.shared_exam_questions q set position=t.n::integer from jsonb_array_elements_text(ids) with ordinality t(v,n)
 where q.exam_id=e.id and q.question_id=t.v;
 update public.shared_exams set title=btrim(payload->>'title'),status=state,time_limit_minutes=(payload->>'timeLimitMinutes')::integer where id=e.id;
end $$;
create function public.save_shared_exam(payload jsonb) returns void language sql security invoker set search_path='' as $$ select private.save_shared_exam(payload) $$;
create function private.admin_shared_exams(bank_id text,page_number integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_active_role('ADMIN') then raise exception 'Admin required' using errcode='42501'; end if;
 if page_number is null or page_number not between 0 and 100000 then raise exception 'Invalid page' using errcode='23514'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'bankId',e.question_bank_id,'title',e.title,'status',e.status,
  'questionCount',e.question_count,'timeLimitMinutes',e.time_limit_minutes,'questions',
  (select jsonb_agg(q.snapshot || jsonb_build_object('questionId',q.question_id,'position',q.position) order by q.position) from private.shared_exam_questions q where q.exam_id=e.id))
 order by e.created_at desc,e.id) from (select * from public.shared_exams where question_bank_id=bank_id order by created_at desc,id limit 5 offset page_number*5) e),'[]');
end $$;
create function public.admin_shared_exams(bank_id text,page_number integer default 0) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_shared_exams(bank_id,page_number) $$;
revoke all on function private.generate_shared_exam(jsonb),public.generate_shared_exam(jsonb),private.save_shared_exam(jsonb),public.save_shared_exam(jsonb),private.admin_shared_exams(text,integer),public.admin_shared_exams(text,integer) from public,anon;
grant execute on function private.generate_shared_exam(jsonb),public.generate_shared_exam(jsonb),private.save_shared_exam(jsonb),public.save_shared_exam(jsonb),private.admin_shared_exams(text,integer),public.admin_shared_exams(text,integer) to authenticated;

-- Existing personal/historical/case logic is reused without rewriting it.
-- Historical definitions keep their original text/options/case/key even when a
-- canonical bank question is edited. An explicit reviewed re-publication refreshes
-- the definition; existing attempts always retain their own immutable snapshots.
create table private.past_exam_snapshots (
 exam_id uuid not null, question_id text not null, snapshot jsonb not null,
 primary key(exam_id,question_id),
 foreign key(exam_id,question_id) references public.past_exam_questions(exam_id,question_id) on delete cascade
);
create index past_exam_snapshots_question_idx on private.past_exam_snapshots(question_id);
alter table private.past_exam_snapshots enable row level security;
create policy deny_historical_snapshots on private.past_exam_snapshots for all using(false) with check(false);
revoke all on private.past_exam_snapshots from public,anon,authenticated;
grant all on private.past_exam_snapshots to service_role;
insert into private.past_exam_snapshots(exam_id,question_id,snapshot)
 select eq.exam_id,b.id,jsonb_build_object('text',b.text,'options',b.options,'correct_option_id',s.correct_option_id,
 'section_id',b.section_id,'case_title',c.title,'case_description',c.description)
 from public.past_exam_questions eq join public.bank_questions b on b.id=eq.question_id
 join private.question_solutions s on s.question_id=b.id left join public.question_sections c on c.id=b.section_id;
create function private.capture_past_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.past_exam_snapshots(exam_id,question_id,snapshot)
 select new.exam_id,b.id,jsonb_build_object('text',b.text,'options',b.options,'correct_option_id',s.correct_option_id,
 'section_id',b.section_id,'case_title',c.title,'case_description',c.description)
 from public.bank_questions b join private.question_solutions s on s.question_id=b.id left join public.question_sections c on c.id=b.section_id
 where b.id=new.question_id;
 if not found then raise exception 'Verified historical key required' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function private.capture_past_snapshot() from public,anon,authenticated;
create trigger capture_past_snapshot after insert on public.past_exam_questions for each row execute function private.capture_past_snapshot();

alter function private.start_learning_exam(jsonb) rename to start_nonshared_learning_exam;
revoke all on function private.start_nonshared_learning_exam(jsonb) from public,anon,authenticated;
create function private.start_learning_exam(config jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare bid text:=config->>'bankId'; kind text:=config->>'source'; e record; a public.question_attempts; q record;
 learning text:=config->>'mode'; minutes integer:=(config->>'timeLimitMinutes')::integer;
begin
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
  insert into public.question_attempt_questions(attempt_id,question_id,display_order,text,options,section_id_snapshot,case_title_snapshot,case_description_snapshot)
  values(a.id,q.question_id,q.position,q.snapshot->>'text',
   (select jsonb_agg(jsonb_build_object('id',o->>'id','text',o->>'text') order by n) from jsonb_array_elements(q.snapshot->'options') with ordinality t(o,n)),
   q.snapshot->>'section_id',q.snapshot->>'case_title',q.snapshot->>'case_description');
  insert into private.exam_question_solutions values(a.id,q.question_id,q.snapshot->>'correct_option_id');
 end loop;
 return a.id;
end $$;
create or replace function public.start_learning_exam(config jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.start_learning_exam(config) $$;
revoke all on function private.start_learning_exam(jsonb) from public,anon;
grant execute on function private.start_learning_exam(jsonb) to authenticated;

alter function private.exam_bank_data(text,uuid) rename to archive_exam_bank_data;
revoke all on function private.archive_exam_bank_data(text,uuid) from public,anon,authenticated;
create function private.exam_bank_data(bank_id text,subject_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=private.archive_exam_bank_data(bank_id,subject_id); -- Existing ownership/access guard first.
 return result || jsonb_build_object('sharedExams',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,
 'questionCount',e.question_count,'timeLimitMinutes',e.time_limit_minutes) order by e.created_at desc,e.id)
 from public.shared_exams e where e.question_bank_id=bank_id and e.status='PUBLISHED'),'[]'));
end $$;
create or replace function public.exam_bank_data(bank_id text,subject_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.exam_bank_data(bank_id,subject_id) $$;
revoke all on function private.exam_bank_data(text,uuid) from public,anon;
grant execute on function private.exam_bank_data(text,uuid) to authenticated;

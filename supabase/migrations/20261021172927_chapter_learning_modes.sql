-- Additive chapter taxonomy, reviewed difficulty metadata and generated selection.
-- No production content is seeded, assigned, reclassified or deleted.
create table public.bank_chapters (
 id uuid primary key, question_bank_id text not null references public.question_banks(id),
 title text not null check(length(btrim(title)) between 1 and 200),
 description text not null default '' check(length(description)<=3000),
 display_order integer not null default 0 check(display_order>=0), published boolean not null default false,
 unique(id,question_bank_id)
);
create index bank_chapters_bank_idx on public.bank_chapters(question_bank_id,published,display_order);
alter table public.bank_questions add column difficulty text check(difficulty in ('EASY','MEDIUM','HARD'));
alter table public.bank_questions add constraint bank_questions_id_bank_unique unique(id,question_bank_id);
create table public.chapter_questions (
 chapter_id uuid not null, question_id text not null, question_bank_id text not null,
 primary key(chapter_id,question_id),
 foreign key(chapter_id,question_bank_id) references public.bank_chapters(id,question_bank_id),
 foreign key(question_id,question_bank_id) references public.bank_questions(id,question_bank_id) on delete cascade
);
create index chapter_questions_question_idx on public.chapter_questions(question_id,question_bank_id,chapter_id);
create index chapter_questions_chapter_bank_idx on public.chapter_questions(chapter_id,question_bank_id);
create index chapter_questions_bank_idx on public.chapter_questions(question_bank_id);
create table public.bank_generation_settings (
 question_bank_id text primary key references public.question_banks(id),
 default_count integer not null default 30 check(default_count between 1 and 30),
 prioritize_incorrect boolean not null default false
);
alter table public.question_attempts add column chapter_id uuid references public.bank_chapters(id);
alter table public.question_attempt_questions add column source_number_snapshot text;
create index attempts_chapter_student_idx on public.question_attempts(chapter_id,student_id,status);
alter table public.question_attempts drop constraint question_attempts_source_kind_check;
alter table public.question_attempts add constraint question_attempts_source_kind_check
 check(source_kind in ('RANDOM','ALL','CASE','PAST','SHARED','CHAPTER'));

alter table public.bank_chapters enable row level security;
alter table public.chapter_questions enable row level security;
alter table public.bank_generation_settings enable row level security;
revoke all on public.bank_chapters,public.chapter_questions,public.bank_generation_settings from public,anon,authenticated;
grant select on public.bank_chapters,public.chapter_questions,public.bank_generation_settings to authenticated;
grant all on public.bank_chapters,public.chapter_questions,public.bank_generation_settings to service_role;
create policy chapters_read on public.bank_chapters for select to authenticated using(
 (select private.is_active_role('ADMIN')) or (published and private.can_open_bank(question_bank_id)));
-- Mapping/difficulty review is Admin-only; Students get authorized aggregate counts.
create policy chapter_mapping_admin on public.chapter_questions for select to authenticated using((select private.is_active_role('ADMIN')));
create policy generation_read on public.bank_generation_settings for select to authenticated using(
 (select private.is_active_role('ADMIN')) or private.can_open_bank(question_bank_id));

create function private.manage_chapters(operation text,payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare bid text:=payload->>'bankId'; qid text:=payload->>'questionId'; cid uuid; ids uuid[];
begin
 if not private.is_active_role('ADMIN') then raise exception 'Admin required' using errcode='42501'; end if;
 perform 1 from public.question_banks where id=bid for update;
 if not found then raise exception 'Bank not found' using errcode='23514'; end if;
 if operation='save_chapter' then
  cid:=(payload->>'id')::uuid;
  if exists(select 1 from public.bank_chapters where id=cid and question_bank_id<>bid) then raise exception 'Wrong bank' using errcode='23514'; end if;
  insert into public.bank_chapters(id,question_bank_id,title,description,display_order,published)
   values(cid,bid,btrim(payload->>'title'),coalesce(payload->>'description',''),(payload->>'displayOrder')::integer,(payload->>'published')::boolean)
  on conflict(id) do update set title=excluded.title,description=excluded.description,display_order=excluded.display_order,published=excluded.published;
 elsif operation='assign_question' then
  if jsonb_typeof(payload->'chapterIds') is distinct from 'array' or jsonb_array_length(payload->'chapterIds')>100 then raise exception 'Invalid chapters' using errcode='23514'; end if;
  select coalesce(array_agg(value::uuid),'{}') into ids from jsonb_array_elements_text(payload->'chapterIds');
  if cardinality(ids)<>(select count(distinct id) from unnest(ids) t(id)) or exists(select 1 from unnest(ids) t(id)
   where not exists(select 1 from public.bank_chapters c where c.id=t.id and c.question_bank_id=bid)) then raise exception 'Wrong chapter bank' using errcode='23514'; end if;
  perform 1 from public.bank_questions where id=qid and question_bank_id=bid for update;
  if not found then raise exception 'Wrong question bank' using errcode='23514'; end if;
  update public.bank_questions set difficulty=nullif(payload->>'difficulty','') where id=qid;
  delete from public.chapter_questions where question_id=qid and question_bank_id=bid and not(chapter_id=any(ids));
  insert into public.chapter_questions(chapter_id,question_id,question_bank_id) select id,qid,bid from unnest(ids) t(id) on conflict do nothing;
 elsif operation='save_generation' then
  insert into public.bank_generation_settings values(bid,(payload->>'defaultCount')::integer,(payload->>'prioritizeIncorrect')::boolean)
   on conflict(question_bank_id) do update set default_count=excluded.default_count,prioritize_incorrect=excluded.prioritize_incorrect;
 else raise exception 'Invalid operation' using errcode='23514'; end if;
end $$;
create function public.manage_chapters(operation text,payload jsonb) returns void language sql security invoker set search_path='' as $$ select private.manage_chapters(operation,payload) $$;

create function private.admin_chapters(bank_id text,page_number integer default 0,search_text text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_active_role('ADMIN') then raise exception 'Admin required' using errcode='42501'; end if;
 if page_number is null or page_number not between 0 and 100000 or search_text is null or length(search_text)>200 then raise exception 'Invalid page' using errcode='23514'; end if;
 return jsonb_build_object('bankId',bank_id,'bankName',(select name from public.question_banks where id=bank_id),
  'specialtyName',(select s.name from public.question_banks b join public.specialties s on s.id=b.specialty_id where b.id=bank_id),
  'defaultCount',coalesce((select default_count from public.bank_generation_settings where question_bank_id=bank_id),30),
  'prioritizeIncorrect',coalesce((select prioritize_incorrect from public.bank_generation_settings where question_bank_id=bank_id),false),
  'chapters',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'description',c.description,'published',c.published,'displayOrder',c.display_order,
   'questionCount',(select count(*) from public.chapter_questions where chapter_id=c.id)) order by c.display_order,c.id) from public.bank_chapters c where c.question_bank_id=bank_id),'[]'),
  'total',(select count(*) from public.bank_questions where question_bank_id=bank_id and text ilike '%'||search_text||'%'),
  'questions',coalesce((select jsonb_agg(to_jsonb(q)) from (
   select b.id,b.text,b.difficulty,b.status,
    coalesce((select jsonb_agg(chapter_id order by chapter_id) from public.chapter_questions where question_id=b.id),'[]') as chapters
   from public.bank_questions b where b.question_bank_id=bank_id and b.text ilike '%'||search_text||'%' order by b.created_at,b.id limit 20 offset page_number*20
  ) q),'[]'));
end $$;
create function public.admin_chapters(bank_id text,page_number integer default 0,search_text text default '') returns jsonb language sql stable security invoker set search_path='' as $$ select private.admin_chapters(bank_id,page_number,search_text) $$;

-- Wrap existing guarded material metadata; never send the question pool to clients.
alter function private.exam_bank_data(text,uuid) rename to prechapter_exam_bank_data;
revoke all on function private.prechapter_exam_bank_data(text,uuid) from public,anon,authenticated;
create function private.exam_bank_data(bank_id text,subject_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; target uuid:=coalesce(subject_id,auth.uid());
begin
 result:=private.prechapter_exam_bank_data(bank_id,subject_id);
 return result||jsonb_build_object(
  'specialty',(select jsonb_build_object('name',s.name,'slug',s.slug) from public.question_banks b join public.specialties s on s.id=b.specialty_id where b.id=bank_id and s.published),
  'generation',jsonb_build_object('defaultCount',coalesce((select default_count from public.bank_generation_settings where question_bank_id=bank_id),30),
   'prioritizeIncorrect',coalesce((select prioritize_incorrect from public.bank_generation_settings where question_bank_id=bank_id),false)),
  'chapters',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'description',c.description,'displayOrder',c.display_order,
   'questionCount',(select count(*) from public.chapter_questions cq join public.bank_questions b on b.id=cq.question_id join private.question_solutions s on s.question_id=b.id
    where cq.chapter_id=c.id and b.status='active' and b.include_in_complete_bank and jsonb_array_length(b.options) between 2 and 10
    and exists(select 1 from jsonb_array_elements(b.options) o where o->>'id'=s.correct_option_id)),
   'completed',(select count(*) from public.question_attempts where chapter_id=c.id and student_id=target and status='COMPLETED'),
   'bestScore',(select max(score_percentage) from public.question_attempts where chapter_id=c.id and student_id=target and status='COMPLETED'))
   order by c.display_order,c.id) from public.bank_chapters c where c.question_bank_id=bank_id and c.published),'[]'));
end $$;
create or replace function public.exam_bank_data(bank_id text,subject_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.exam_bank_data(bank_id,subject_id) $$;

alter function private.exam_data(uuid,uuid) rename to prechapter_exam_data;
revoke all on function private.prechapter_exam_data(uuid,uuid) from public,anon,authenticated;
create function private.exam_data(attempt_id uuid,subject_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=private.prechapter_exam_data(attempt_id,subject_id);
 return result||jsonb_build_object('questions',(select jsonb_agg(q||jsonb_build_object('sourceNumber',s.source_number_snapshot) order by n)
  from jsonb_array_elements(result->'questions') with ordinality t(q,n)
  join public.question_attempt_questions s on s.attempt_id=exam_data.attempt_id and s.question_id=q->>'id'));
end $$;
create or replace function public.exam_data(attempt_id uuid,subject_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.exam_data(attempt_id,subject_id) $$;
revoke all on function private.exam_data(uuid,uuid) from public,anon;
grant execute on function private.exam_data(uuid,uuid) to authenticated;

alter function private.start_nonshared_learning_exam(jsonb) rename to start_legacy_nonshared_learning_exam;
revoke all on function private.start_legacy_nonshared_learning_exam(jsonb) from public,anon,authenticated;
create function private.start_nonshared_learning_exam(config jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare bid text:=config->>'bankId'; kind text:=config->>'source'; learning text:=config->>'mode'; a public.question_attempts;
 selected jsonb; q record; chapter public.bank_chapters; size integer; minutes integer:=(config->>'timeLimitMinutes')::integer;
 count_limit integer:=coalesce((config->>'count')::integer,30); prefer_wrong boolean;
begin
 if kind is null or kind not in ('RANDOM','CHAPTER') then return private.start_legacy_nonshared_learning_exam(config); end if;
 perform private.lock_exam_access(bid);
 if learning is null or learning not in ('EXAM','PRACTICE') or count_limit not between 1 and 30
  or (minutes is not null and minutes not between 1 and 1440) or (config ? 'prioritizeIncorrect' and jsonb_typeof(config->'prioritizeIncorrect')<>'boolean') then raise exception 'Invalid setup' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||bid,0));
 select * into a from public.question_attempts where student_id=auth.uid() and question_bank_id=bid and status='IN_PROGRESS' for update;
 if found and a.mode='EXAM' then
  if a.setup_signature is distinct from config and not(a.setup_signature is null and kind='RANDOM' and learning='EXAM' and minutes is null and count_limit=30) then raise exception 'Continue your unfinished attempt first' using errcode='23514'; end if;
  return a.id;
 end if;
 if found then update public.question_attempts set status='ABANDONED',submitted_at=now() where id=a.id; end if;
 if kind='CHAPTER' then
  select * into chapter from public.bank_chapters where id=(config->>'sourceId')::uuid and question_bank_id=bid and published for share;
  if not found then raise exception 'Chapter unavailable' using errcode='42501'; end if;
 end if;
 prefer_wrong:=coalesce((config->>'prioritizeIncorrect')::boolean,(select prioritize_incorrect from public.bank_generation_settings where question_bank_id=bid),false);
 with eligible as (
  select b.id,b.text,b.options,s.correct_option_id,b.section_id as section_id_snapshot,sec.title as case_title_snapshot,sec.description as case_description_snapshot,
   b.display_order,sec.display_order as case_order,
   coalesce((select min(c.id::text) from public.chapter_questions cq join public.bank_chapters c on c.id=cq.chapter_id where cq.question_id=b.id and c.published),'unassigned') as chapter_bucket,
   coalesce((select min(e.exam_year)::text from public.past_exam_questions eq join public.past_exams e on e.id=eq.exam_id where eq.question_id=b.id and e.question_bank_id=bid and e.status='PUBLISHED'),'unknown') as year_bucket,
   coalesce(b.difficulty,'unknown') as difficulty_bucket,
   prefer_wrong and exists(select 1 from public.question_attempt_answers ans join public.question_attempts atp on atp.id=ans.attempt_id
    where atp.student_id=auth.uid() and atp.status='COMPLETED' and ans.question_id=b.id and ans.is_correct=false) as missed
  from public.bank_questions b join private.question_solutions s on s.question_id=b.id
  left join public.question_sections sec on sec.id=b.section_id and sec.question_bank_id=bid
  where b.question_bank_id=bid and b.status='active' and b.include_in_complete_bank and jsonb_array_length(b.options) between 2 and 10
   and exists(select 1 from jsonb_array_elements(b.options) o where o->>'id'=s.correct_option_id)
   and (kind<>'CHAPTER' or exists(select 1 from public.chapter_questions cq where cq.chapter_id=chapter.id and cq.question_id=b.id))
 ), ranked as (
  select eligible.*,row_number() over(partition by chapter_bucket,year_bucket,difficulty_bucket order by missed desc,random()) as bucket_rank,random() as tie from eligible
 ), chosen as (
  select * from ranked order by case when kind='RANDOM' then bucket_rank end,case when kind='RANDOM' then tie end,case_order,display_order,id
   limit case when kind='RANDOM' then count_limit else null end
 ), ordered as (
  select chosen.*,row_number() over(order by case when kind='RANDOM' then bucket_rank end,case when kind='RANDOM' then tie end,case_order,display_order,id) as position from chosen
 ) select jsonb_agg(to_jsonb(ordered) order by position) into selected from ordered;
 size:=coalesce(jsonb_array_length(selected),0);
 if size=0 then raise exception 'No eligible questions' using errcode='23514'; end if;
 insert into public.question_attempts(student_id,question_bank_id,total_questions,mode,bank_name_snapshot,chapter_id,exam_title_snapshot,learning_mode,source_kind,setup_signature,deadline_at)
  select auth.uid(),id,size,'EXAM',name,chapter.id,case when kind='CHAPTER' then chapter.title else 'AI-Generated Exam' end,learning,kind,config,
   case when minutes is not null then now()+make_interval(mins=>minutes) end from public.question_banks where id=bid returning * into a;
 for q in select * from jsonb_to_recordset(selected) as r(id text,text text,options jsonb,correct_option_id text,section_id_snapshot text,case_title_snapshot text,case_description_snapshot text,position integer) loop
  insert into public.question_attempt_questions(attempt_id,question_id,display_order,text,options,section_id_snapshot,case_title_snapshot,case_description_snapshot)
   values(a.id,q.id,q.position,q.text,(select jsonb_agg(jsonb_build_object('id',o->>'id','text',o->>'text') order by n) from jsonb_array_elements(q.options) with ordinality t(o,n)),q.section_id_snapshot,q.case_title_snapshot,q.case_description_snapshot);
  insert into private.exam_question_solutions values(a.id,q.id,q.correct_option_id);
 end loop;
 return a.id;
end $$;
-- Rebind wrappers to the new guarded implementations after renaming originals.
create or replace function private.start_learning_exam(config jsonb) returns uuid language plpgsql security definer set search_path='' as $$
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
  insert into public.question_attempt_questions(attempt_id,question_id,display_order,text,options,section_id_snapshot,case_title_snapshot,case_description_snapshot,source_number_snapshot)
  values(a.id,q.question_id,q.position,q.snapshot->>'text',
   (select jsonb_agg(jsonb_build_object('id',o->>'id','text',o->>'text') order by n) from jsonb_array_elements(q.snapshot->'options') with ordinality t(o,n)),
   q.snapshot->>'section_id',q.snapshot->>'case_title',q.snapshot->>'case_description',
   case when kind='PAST' then (select source_number from public.past_exam_questions where exam_id=e.id and question_id=q.question_id) end);
  insert into private.exam_question_solutions values(a.id,q.question_id,q.snapshot->>'correct_option_id');
 end loop;
 return a.id;
end $$;
create or replace function public.start_learning_exam(config jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.start_learning_exam(config) $$;
revoke all on function private.manage_chapters(text,jsonb),public.manage_chapters(text,jsonb),private.admin_chapters(text,integer,text),public.admin_chapters(text,integer,text),private.exam_bank_data(text,uuid),private.start_nonshared_learning_exam(jsonb) from public,anon;
grant execute on function private.manage_chapters(text,jsonb),public.manage_chapters(text,jsonb),private.admin_chapters(text,integer,text),public.admin_chapters(text,integer,text),private.exam_bank_data(text,uuid) to authenticated;
-- Internal selector is called only through the existing outer guarded entrypoint.
revoke all on function private.start_nonshared_learning_exam(jsonb) from authenticated;
create trigger lhcc_live_change after insert or update or delete on public.bank_chapters for each row execute function private.live_change();
create trigger lhcc_live_change after insert or update or delete on public.chapter_questions for each row execute function private.live_change();
create trigger lhcc_live_change after insert or update or delete on public.bank_generation_settings for each row execute function private.live_change();

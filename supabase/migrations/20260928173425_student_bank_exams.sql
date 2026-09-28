-- Existing practice history stays intact; new exams freeze content and keys.
alter table public.question_attempts add column mode text not null default 'PRACTICE'
  check (mode in ('PRACTICE','EXAM'));
alter table public.question_attempts add column bank_name_snapshot text;
alter table public.question_attempt_answers alter column is_correct drop not null;

create table public.question_attempt_questions (
  attempt_id uuid not null references public.question_attempts(id) on delete cascade,
  question_id text not null references public.bank_questions(id),
  display_order integer not null check (display_order between 1 and 30),
  text text not null,
  options jsonb not null check (jsonb_typeof(options)='array'),
  created_at timestamptz not null default now(),
  primary key (attempt_id,question_id), unique(attempt_id,display_order)
);
create index attempt_questions_question_idx on public.question_attempt_questions(question_id);
create table private.exam_question_solutions (
  attempt_id uuid not null,
  question_id text not null,
  correct_option_id text not null,
  primary key(attempt_id,question_id),
  foreign key(attempt_id,question_id) references public.question_attempt_questions(attempt_id,question_id) on delete cascade
);
alter table public.question_attempt_questions enable row level security;
alter table private.exam_question_solutions enable row level security;
revoke all on public.question_attempt_questions from public,anon,authenticated;
revoke all on private.exam_question_solutions from public,anon,authenticated;
grant select on public.question_attempt_questions to authenticated;
grant all on public.question_attempt_questions,private.exam_question_solutions to service_role;
alter policy own_or_staff_attempts on public.question_attempts using (
  (select private.is_active_role('ADMIN')) or
  (student_id=(select auth.uid()) and (select private.is_active_role('STUDENT'))
    and (status<>'IN_PROGRESS' or mode='PRACTICE' or private.can_open_bank(question_bank_id)))
);
create policy own_exam_questions on public.question_attempt_questions for select to authenticated using (
  exists(select 1 from public.question_attempts a where a.id=attempt_id)
);

-- An exam answer is ungraded until submit. Historical practice semantics stay intact.
create or replace function private.prepare_attempt_answer()
returns trigger language plpgsql security definer set search_path='' as $$
declare a public.question_attempts; key text;
begin
  select * into a from public.question_attempts where id=new.attempt_id;
  if a.mode='EXAM' then
    if not exists(select 1 from public.question_attempt_questions q where q.attempt_id=a.id and q.question_id=new.question_id
      and exists(select 1 from jsonb_array_elements(q.options) o where o->>'id'=new.selected_option_id)) then
      raise exception 'Invalid exam answer' using errcode='23514';
    end if;
    if a.status='IN_PROGRESS' then new.is_correct:=null;
    elsif a.status='COMPLETED' then
      select correct_option_id into key from private.exam_question_solutions where attempt_id=a.id and question_id=new.question_id;
      new.is_correct:=key=new.selected_option_id;
    else raise exception 'Attempt unavailable' using errcode='23514'; end if;
  else
    select s.correct_option_id into key from public.bank_questions q join private.question_solutions s on s.question_id=q.id
    where q.id=new.question_id and q.question_bank_id=a.question_bank_id
      and exists(select 1 from jsonb_array_elements(q.options) o where o->>'id'=new.selected_option_id);
    if key is null then raise exception 'Invalid answer' using errcode='23514'; end if;
    new.is_correct:=key=new.selected_option_id;
  end if;
  return new;
end $$;
-- Retire the correctness oracle. Existing stored practice history remains readable.
revoke execute on function public.submit_bank_answer(text,text),private.submit_bank_answer(text,text) from authenticated,anon,public;

create function private.lock_exam_access(bank_id text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles where id=auth.uid() for share;
  perform 1 from public.question_banks where id=bank_id for share;
  perform 1 from public.user_bank_access where user_id=auth.uid() and question_bank_id=bank_id for share;
  if not private.can_open_bank(bank_id) then raise exception 'Bank access required' using errcode='42501'; end if;
end $$;
revoke all on function private.lock_exam_access(text) from public,anon,authenticated;

create function private.start_exam(bank_id text) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.question_attempts; q record; selected jsonb; size integer;
begin
  perform private.lock_exam_access(bank_id);
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||bank_id,0));
  select * into a from public.question_attempts where student_id=auth.uid() and question_bank_id=bank_id and status='IN_PROGRESS' for update;
  if found and a.mode='EXAM' then return a.id; end if;
  -- Explicit Start Exam supersedes unfinished legacy practice; never deletes its answers.
  if found then update public.question_attempts set status='ABANDONED',submitted_at=now() where id=a.id; end if;
  select jsonb_agg(to_jsonb(pool) order by pool.position) into selected from (
    select chosen.*,row_number() over () as position from (
      select b.id,b.text,b.options,s.correct_option_id from public.bank_questions b
      join private.question_solutions s on s.question_id=b.id
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
  for q in select * from jsonb_to_recordset(selected) as r(id text,text text,options jsonb,correct_option_id text,position integer) loop
    insert into public.question_attempt_questions(attempt_id,question_id,display_order,text,options)
      values(a.id,q.id,q.position,q.text,(select jsonb_agg(jsonb_build_object('id',o->>'id','text',o->>'text')) from jsonb_array_elements(q.options) o));
    insert into private.exam_question_solutions values(a.id,q.id,q.correct_option_id);
  end loop;
  return a.id;
end $$;

create function private.save_exam_answer(attempt_id uuid,question_id text,option_id text) returns void
language plpgsql security definer set search_path='' as $$
declare a public.question_attempts;
begin
  select * into a from public.question_attempts t where t.id=attempt_id and t.student_id=auth.uid() and t.mode='EXAM';
  if not found then raise exception 'Attempt unavailable' using errcode='42501'; end if;
  perform private.lock_exam_access(a.question_bank_id);
  select * into a from public.question_attempts t where t.id=attempt_id for update;
  if a.status<>'IN_PROGRESS' then raise exception 'Attempt completed' using errcode='23514'; end if;
  if not exists(select 1 from public.question_attempt_questions q where q.attempt_id=a.id and q.question_id=save_exam_answer.question_id
    and exists(select 1 from jsonb_array_elements(q.options) o where o->>'id'=option_id)) then
    raise exception 'Invalid answer' using errcode='23514'; end if;
  insert into public.question_attempt_answers(attempt_id,question_id,selected_option_id,is_correct)
    values(a.id,question_id,option_id,null)
    on conflict on constraint question_attempt_answers_attempt_id_question_id_key
    do update set selected_option_id=excluded.selected_option_id,answered_at=now();
  update public.question_attempts set updated_at=now() where id=a.id;
end $$;

create function private.submit_exam(attempt_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.question_attempts; correct_count integer;
begin
  if not private.is_active_role('STUDENT') then raise exception 'Student required' using errcode='42501'; end if;
  select * into a from public.question_attempts t where t.id=attempt_id and t.student_id=auth.uid() and t.mode='EXAM';
  if not found then raise exception 'Attempt unavailable' using errcode='42501'; end if;
  if a.status='COMPLETED' then return a.id; end if;
  perform private.lock_exam_access(a.question_bank_id);
  select * into a from public.question_attempts t where t.id=attempt_id for update;
  if a.status='COMPLETED' then return a.id; end if;
  if a.status<>'IN_PROGRESS' then raise exception 'Attempt unavailable' using errcode='23514'; end if;
  select count(*)::integer into correct_count from public.question_attempt_answers ans
    join private.exam_question_solutions s on s.attempt_id=ans.attempt_id and s.question_id=ans.question_id
    where ans.attempt_id=a.id and ans.selected_option_id=s.correct_option_id;
  update public.question_attempts set status='COMPLETED',submitted_at=now(),correct_answers=correct_count,
    incorrect_answers=total_questions-correct_count,score_percentage=round(correct_count::numeric*100/total_questions,2)
    where id=a.id;
  update public.question_attempt_answers set is_correct=false where question_attempt_answers.attempt_id=a.id;
  return a.id;
end $$;

create function private.exam_data(attempt_id uuid,subject_id uuid default null) returns jsonb
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
    'result',case when a.status='COMPLETED' then jsonb_build_object('correct',a.correct_answers,'incorrect',a.incorrect_answers,'score',a.score_percentage) else null end,
    'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.question_id,'text',q.text,'options',q.options,'order',q.display_order,
      'selectedOptionId',ans.selected_option_id) || case when a.status='COMPLETED' then jsonb_build_object('outcome',coalesce(ans.is_correct,false)) else '{}'::jsonb end order by q.display_order)
      from public.question_attempt_questions q left join public.question_attempt_answers ans on ans.attempt_id=q.attempt_id and ans.question_id=q.question_id where q.attempt_id=a.id),'[]'));
end $$;

create function private.exam_bank_data(bank_id text,subject_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target uuid:=coalesce(subject_id,auth.uid()); bank public.question_banks; eligible integer;
begin
  if subject_id is not null then
    if not private.is_active_role('ADMIN') or not exists(select 1 from public.profiles where id=target and role='STUDENT') then raise exception 'Access denied' using errcode='42501'; end if;
    if not exists(select 1 from public.user_bank_access where user_id=target and question_bank_id=bank_id and status='ACTIVE') then raise exception 'Access denied' using errcode='42501'; end if;
  elsif not private.can_open_bank(bank_id) then raise exception 'Access denied' using errcode='42501'; end if;
  select * into bank from public.question_banks where id=bank_id and status='active';
  if not found then raise exception 'Bank unavailable' using errcode='42501'; end if;
  select count(*)::integer into eligible from public.bank_questions b join private.question_solutions s on s.question_id=b.id
    where b.question_bank_id=bank_id and b.status='active' and jsonb_array_length(b.options) between 2 and 10
      and exists(select 1 from jsonb_array_elements(b.options) o where o->>'id'=s.correct_option_id);
  return jsonb_build_object('id',bank.id,'name',bank.name,'description',bank.description,'available',eligible,'examCount',least(eligible,30),
    'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'status',status,'mode',mode,'startedAt',started_at,'submittedAt',submitted_at,
      'totalQuestions',total_questions,'score',case when status='COMPLETED' then score_percentage else null end) order by started_at desc,id)
      from public.question_attempts where student_id=target and question_bank_id=bank_id),'[]'));
end $$;

create function public.start_exam(bank_id text) returns uuid language sql security invoker set search_path='' as $$ select private.start_exam(bank_id) $$;
create function public.save_exam_answer(attempt_id uuid,question_id text,option_id text) returns void language sql security invoker set search_path='' as $$ select private.save_exam_answer(attempt_id,question_id,option_id) $$;
create function public.submit_exam(attempt_id uuid) returns uuid language sql security invoker set search_path='' as $$ select private.submit_exam(attempt_id) $$;
create function public.exam_data(attempt_id uuid,subject_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.exam_data(attempt_id,subject_id) $$;
create function public.exam_bank_data(bank_id text,subject_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.exam_bank_data(bank_id,subject_id) $$;
revoke all on function public.start_exam(text),private.start_exam(text),public.save_exam_answer(uuid,text,text),private.save_exam_answer(uuid,text,text),public.submit_exam(uuid),private.submit_exam(uuid),public.exam_data(uuid,uuid),private.exam_data(uuid,uuid),public.exam_bank_data(text,uuid),private.exam_bank_data(text,uuid) from public,anon;
grant execute on function public.start_exam(text),private.start_exam(text),public.save_exam_answer(uuid,text,text),private.save_exam_answer(uuid,text,text),public.submit_exam(uuid),private.submit_exam(uuid),public.exam_data(uuid,uuid),private.exam_data(uuid,uuid),public.exam_bank_data(text,uuid),private.exam_bank_data(text,uuid) to authenticated;

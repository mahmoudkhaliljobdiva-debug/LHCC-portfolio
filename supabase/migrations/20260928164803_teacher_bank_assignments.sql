-- Additive teacher permissions; no existing user is assigned automatically.
create table public.teacher_bank_assignments (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  question_bank_id text not null references public.question_banks(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (teacher_id, question_bank_id)
);
create index teacher_bank_assignments_bank_idx on public.teacher_bank_assignments(question_bank_id);
create index teacher_bank_assignments_actor_idx on public.teacher_bank_assignments(assigned_by);
alter table public.teacher_bank_assignments enable row level security;
revoke all on public.teacher_bank_assignments from anon, authenticated;
grant select on public.teacher_bank_assignments to authenticated;
grant all on public.teacher_bank_assignments to service_role;
create policy teacher_assignment_reads on public.teacher_bank_assignments for select to authenticated
using (teacher_id = (select auth.uid()) or (select private.is_active_role('ADMIN')));

create function private.teacher_has_bank(bank_id text)
returns boolean language sql stable security definer set search_path='' as $$
  select private.is_active_role('TEACHER') and exists (
    select 1 from public.teacher_bank_assignments a join public.question_banks b on b.id=a.question_bank_id
    where a.teacher_id=(select auth.uid()) and a.question_bank_id=bank_id and b.status='active'
  );
$$;
revoke all on function private.teacher_has_bank(text) from public, anon;
grant execute on function private.teacher_has_bank(text) to authenticated, service_role;

alter policy bank_catalog on public.question_banks using (
  (status='active' and (select private.is_active_role('STUDENT')))
  or private.teacher_has_bank(id) or (select private.is_active_role('ADMIN'))
);
alter policy approved_questions on public.bank_questions using (
  (status='active' and private.can_open_bank(question_bank_id))
  or private.teacher_has_bank(question_bank_id) or (select private.is_active_role('ADMIN'))
);
-- Teachers have question authoring, not institution-wide student reporting.
alter policy own_or_staff_attempts on public.question_attempts using (
  student_id=(select auth.uid()) or (select private.is_active_role('ADMIN'))
);
alter policy own_or_staff_attempt_answers on public.question_attempt_answers using (
  exists(select 1 from public.question_attempts a where a.id=attempt_id
    and (a.student_id=(select auth.uid()) or (select private.is_active_role('ADMIN'))))
);

create function private.admin_update_managed_profile(payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
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
$$;
create function public.admin_update_managed_profile(payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.admin_update_managed_profile(payload); $$;
revoke all on function private.admin_update_managed_profile(jsonb), public.admin_update_managed_profile(jsonb) from public, anon;
grant execute on function private.admin_update_managed_profile(jsonb), public.admin_update_managed_profile(jsonb) to authenticated;

create function private.teacher_add_question(item_id text, payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare correct_id text; safe_options jsonb;
begin
  -- Serializes assignment removal/profile changes against this authoring action.
  perform 1 from public.profiles where id=auth.uid() for share;
  perform 1 from public.teacher_bank_assignments where teacher_id=auth.uid() and question_bank_id=payload->>'bankId' for share;
  if not private.teacher_has_bank(payload->>'bankId') then raise exception 'Assigned teacher access required' using errcode='42501'; end if;
  if nullif(btrim(item_id),'') is null or length(item_id)>200
    or nullif(btrim(payload->>'text'),'') is null or length(payload->>'text')>10000
    or payload->>'status' is distinct from 'active' then raise exception 'Invalid question'; end if;
  if jsonb_typeof(payload->'answers') is distinct from 'array' then raise exception 'Invalid answers'; end if;
  if jsonb_array_length(payload->'answers') not between 2 and 10 then raise exception 'Provide 2 to 10 answers'; end if;
  if (select count(*) from jsonb_array_elements(payload->'answers') a where a->>'isCorrect'='true')<>1 then raise exception 'Exactly one correct answer required'; end if;
  if exists(select 1 from jsonb_array_elements(payload->'answers') a where nullif(btrim(a->>'text'),'') is null or length(a->>'text')>5000 or nullif(a->>'id','') is null or length(a->>'id')>200)
    or (select count(distinct a->>'id') from jsonb_array_elements(payload->'answers') a)<>jsonb_array_length(payload->'answers') then raise exception 'Invalid answers'; end if;
  select a->>'id' into correct_id from jsonb_array_elements(payload->'answers') a where a->>'isCorrect'='true';
  select jsonb_agg(jsonb_build_object('id',a->>'id','text',btrim(a->>'text'))) into safe_options from jsonb_array_elements(payload->'answers') a;
  -- INSERT ONLY: an existing ID can never update another question.
  insert into public.bank_questions(id,question_bank_id,text,status,options)
    values(item_id,payload->>'bankId',btrim(payload->>'text'),'active',safe_options);
  insert into private.question_solutions(question_id,correct_option_id) values(item_id,correct_id);
end;
$$;
create function public.teacher_add_question(item_id text, payload jsonb)
returns void language sql security invoker set search_path='' as $$ select private.teacher_add_question(item_id,payload); $$;
revoke all on function private.teacher_add_question(text,jsonb), public.teacher_add_question(text,jsonb) from public, anon;
grant execute on function private.teacher_add_question(text,jsonb), public.teacher_add_question(text,jsonb) to authenticated;

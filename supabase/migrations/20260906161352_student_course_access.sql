begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- Existing disabled/expired students are deliberately not bulk activated.
alter table public.profiles drop constraint profiles_active_subscription_configured;
alter table public.profiles add constraint profiles_active_subscription_configured
  check (status <> 'ACTIVE' or role <> 'TEACHER' or expiration_date is not null);
comment on column public.profiles.status is 'Administrative account state. ACTIVE students do not require a subscription; teachers still require unexpired activation.';

create or replace function public.is_profile_access_active(profile_status public.user_status, profile_role public.user_role, profile_expiration_date timestamptz)
returns boolean language sql stable security invoker set search_path = '' as $$
  select profile_status = 'ACTIVE' and (profile_role in ('ADMIN', 'STUDENT') or profile_expiration_date > statement_timestamp());
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

  return new;
end;
$$;

comment on function public.handle_new_auth_user() is 'Public registrations create ACTIVE STUDENT accounts with no course grants. Metadata never controls privileges.';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.question_banks (
  id text primary key default gen_random_uuid()::text,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  description text not null check (char_length(btrim(description)) between 1 and 5000),
  status text not null default 'active' check (status in ('active','inactive')),
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);
create table public.bank_questions (
  id text primary key default gen_random_uuid()::text,
  question_bank_id text not null references public.question_banks(id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 10000),
  status text not null default 'active' check (status in ('active','inactive')),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 10),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);
create table private.question_solutions (
  question_id text primary key references public.bank_questions(id) on delete cascade,
  correct_option_id text not null
);
create table public.user_bank_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  question_bank_id text not null references public.question_banks(id),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  requested_at timestamptz not null default statement_timestamp(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  rejection_reason text check (char_length(rejection_reason) <= 1000),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint request_review_valid check (
    (status = 'PENDING' and reviewed_at is null and reviewed_by is null and rejection_reason is null)
    or (status <> 'PENDING' and reviewed_at is not null and reviewed_by is not null))
);
create unique index one_pending_bank_request on public.user_bank_access_requests(user_id, question_bank_id) where status = 'PENDING';
create index bank_requests_bank_idx on public.user_bank_access_requests(question_bank_id);
create index bank_requests_reviewer_idx on public.user_bank_access_requests(reviewed_by);
create index bank_requests_student_history_idx on public.user_bank_access_requests(user_id, requested_at desc);
create table public.user_bank_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_bank_id text not null references public.question_banks(id),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','REVOKED')),
  granted_at timestamptz not null default statement_timestamp(),
  granted_by uuid not null references public.profiles(id),
  request_id uuid unique references public.user_bank_access_requests(id),
  primary key(user_id, question_bank_id)
);
create index bank_access_bank_idx on public.user_bank_access(question_bank_id);
create index bank_access_grantor_idx on public.user_bank_access(granted_by);
create index bank_questions_bank_idx on public.bank_questions(question_bank_id);

create function private.is_active_role(required_role public.user_role)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id = (select auth.uid()) and role = required_role
 and public.is_profile_access_active(status,role,expiration_date));
$$;
create function private.can_open_bank(bank_id text)
returns boolean language sql stable security definer set search_path = '' as $$
 select private.is_active_role('STUDENT') and exists (
 select 1 from public.user_bank_access a join public.question_banks b on b.id = a.question_bank_id
 where a.user_id = (select auth.uid()) and a.question_bank_id = bank_id and a.status = 'ACTIVE' and b.status = 'active');
$$;
revoke all on function private.is_active_role(public.user_role), private.can_open_bank(text) from public, anon;
grant execute on function private.is_active_role(public.user_role), private.can_open_bank(text) to authenticated;

alter table public.question_banks enable row level security;
alter table public.bank_questions enable row level security;
alter table private.question_solutions enable row level security;
alter table public.user_bank_access_requests enable row level security;
alter table public.user_bank_access enable row level security;
revoke all on public.question_banks,public.bank_questions,public.user_bank_access_requests,public.user_bank_access from anon,authenticated;
revoke all on private.question_solutions from public,anon,authenticated;
grant select on public.question_banks,public.bank_questions,public.user_bank_access_requests,public.user_bank_access to authenticated;
grant insert (question_bank_id) on public.user_bank_access_requests to authenticated;
create policy bank_catalog on public.question_banks for select to authenticated using (
  (status = 'active' and (select private.is_active_role('STUDENT'))) or (select private.is_active_role('ADMIN')));
create policy approved_questions on public.bank_questions for select to authenticated using (
  (status = 'active' and private.can_open_bank(question_bank_id)) or (select private.is_active_role('ADMIN')));
create policy own_requests on public.user_bank_access_requests for select to authenticated using (
  (user_id = (select auth.uid()) and (select private.is_active_role('STUDENT'))) or (select private.is_active_role('ADMIN')));
create policy own_pending_request on public.user_bank_access_requests for insert to authenticated with check (
  user_id = (select auth.uid()) and (select private.is_active_role('STUDENT')) and status = 'PENDING'
  and reviewed_at is null and reviewed_by is null and rejection_reason is null
  and exists(select 1 from public.question_banks b where b.id = question_bank_id and b.status = 'active')
  and not private.can_open_bank(question_bank_id));
create policy own_access on public.user_bank_access for select to authenticated using (
  (user_id = (select auth.uid()) and (select private.is_active_role('STUDENT'))) or (select private.is_active_role('ADMIN')));

create trigger banks_updated before update on public.question_banks for each row execute function public.set_updated_at();
create trigger questions_updated before update on public.bank_questions for each row execute function public.set_updated_at();
create trigger requests_updated before update on public.user_bank_access_requests for each row execute function public.set_updated_at();

create function public.request_bank_access(bank_id text) returns uuid language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
 if not private.is_active_role('STUDENT') then raise exception 'Student access required' using errcode = '42501'; end if;
 insert into public.user_bank_access_requests(question_bank_id) values(bank_id) returning id into result;
 return result;
end;
$$;

-- Trusted RPC checks the caller itself and locks the pending request before granting.
create function public.review_bank_access(request_id uuid, decision text, reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.user_bank_access_requests;
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if decision not in ('APPROVED','REJECTED') then raise exception 'Invalid decision'; end if;
 select * into r from public.user_bank_access_requests where id=request_id for update;
 if not found or r.status <> 'PENDING' then raise exception 'Request is no longer pending'; end if;
 if decision='APPROVED' then
   perform 1 from public.question_banks where id=r.question_bank_id and status='active' for share;
   if not found then raise exception 'Bank is unavailable'; end if;
   perform 1 from public.profiles where id=r.user_id and role='STUDENT' and status='ACTIVE' for share;
   if not found then raise exception 'Student account is disabled'; end if;
   insert into public.user_bank_access(user_id,question_bank_id,granted_by,request_id)
   values(r.user_id,r.question_bank_id,auth.uid(),r.id)
   on conflict(user_id,question_bank_id) do update set status='ACTIVE',granted_at=statement_timestamp(),granted_by=auth.uid(),request_id=r.id;
 end if;
 update public.user_bank_access_requests set status=decision,reviewed_at=statement_timestamp(),reviewed_by=auth.uid(),
 rejection_reason=case when decision='REJECTED' then nullif(btrim(reason),'') else null end where id=r.id;
end;
$$;

create function public.list_bank_access_requests() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('student_name',p.full_name,'bank_name',b.name) order by r.requested_at desc)
 from public.user_bank_access_requests r join public.profiles p on p.id=r.user_id join public.question_banks b on b.id=r.question_bank_id),'[]');
end;
$$;

create function public.submit_bank_answer(question_id text, option_id text) returns boolean language plpgsql security definer set search_path='' as $$
declare q public.bank_questions; correct_id text;
begin
 select * into q from public.bank_questions where id=question_id and status='active';
 if not found or not private.can_open_bank(q.question_bank_id) then raise exception 'Course access required' using errcode='42501'; end if;
 if not exists(select 1 from jsonb_array_elements(q.options) o where o->>'id'=option_id) then raise exception 'Invalid option'; end if;
 select correct_option_id into correct_id from private.question_solutions s where s.question_id=q.id;
 if correct_id is null then raise exception 'Question unavailable'; end if;
 return correct_id=option_id;
end;
$$;

create function public.admin_bank_data() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 return jsonb_build_object('banks',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'description',description,'status',status,'displayOrder',display_order,'createdAt',created_at,'updatedAt',updated_at) order by display_order) from public.question_banks),'[]'),
 'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'bankId',q.question_bank_id,'text',q.text,'status',q.status,'type','QCU','createdAt',q.created_at,'updatedAt',q.updated_at,
 'answers',(select jsonb_agg(o || jsonb_build_object('isCorrect',o->>'id'=s.correct_option_id)) from jsonb_array_elements(q.options) o)))
 from public.bank_questions q join private.question_solutions s on s.question_id=q.id),'[]'));
end;
$$;

create function public.manage_bank_content(operation text, item_id text, payload jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
declare correct_id text; safe_options jsonb;
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if operation='save_bank' then
   insert into public.question_banks(id,name,description,status,display_order)
   values(item_id,payload->>'name',payload->>'description',payload->>'status',coalesce((payload->>'displayOrder')::integer,0))
   on conflict(id) do update set name=excluded.name,description=excluded.description,status=excluded.status,display_order=excluded.display_order;
 elsif operation='delete_bank' then
   -- Preserve reviewed request history: referenced banks must be made inactive instead.
   delete from public.question_banks where id=item_id;
 elsif operation='save_question' then
   if jsonb_typeof(payload->'answers') <> 'array' or jsonb_array_length(payload->'answers') not between 2 and 10 then raise exception 'Provide 2 to 10 answers'; end if;
   if (select count(*) from jsonb_array_elements(payload->'answers') a where a->>'isCorrect'='true') <> 1 then raise exception 'Exactly one correct answer required'; end if;
   if exists(select 1 from jsonb_array_elements(payload->'answers') a where nullif(btrim(a->>'text'),'') is null or nullif(a->>'id','') is null)
   or (select count(distinct a->>'id') from jsonb_array_elements(payload->'answers') a) <> jsonb_array_length(payload->'answers') then raise exception 'Invalid answers'; end if;
   select a->>'id' into correct_id from jsonb_array_elements(payload->'answers') a where a->>'isCorrect'='true';
   select jsonb_agg(jsonb_build_object('id',a->>'id','text',a->>'text')) into safe_options from jsonb_array_elements(payload->'answers') a;
   insert into public.bank_questions(id,question_bank_id,text,status,options) values(item_id,payload->>'bankId',payload->>'text',payload->>'status',safe_options)
   on conflict(id) do update set text=excluded.text,status=excluded.status,options=excluded.options;
   insert into private.question_solutions values(item_id,correct_id) on conflict(question_id) do update set correct_option_id=excluded.correct_option_id;
 elsif operation='delete_question' then delete from public.bank_questions where id=item_id;
 else raise exception 'Invalid operation'; end if;
end;
$$;

revoke all on function public.request_bank_access(text), public.review_bank_access(uuid,text,text), public.list_bank_access_requests(), public.submit_bank_answer(text,text), public.admin_bank_data(), public.manage_bank_content(text,text,jsonb) from public,anon;
grant execute on function public.request_bank_access(text), public.review_bank_access(uuid,text,text), public.list_bank_access_requests(), public.submit_bank_answer(text,text), public.admin_bank_data(), public.manage_bank_content(text,text,jsonb) to authenticated;

-- Import the existing shared demo catalog once; browser data is not an authority.
insert into public.question_banks(id,name,description,status,display_order) values('anatomy','Human Anatomy','Structural organization of the human body and its systems.','active',1);
insert into public.question_banks(id,name,description,status,display_order) values('physiology','Medical Physiology','Functions and mechanisms of cells, organs, and body systems.','active',2);
insert into public.question_banks(id,name,description,status,display_order) values('pharmacology','Pharmacology','Drug actions, therapeutic uses, and adverse effects.','active',3);
insert into public.question_banks(id,name,description,status,display_order) values('pathology','General Pathology','Disease mechanisms, cellular injury, and tissue responses.','active',4);
insert into public.question_banks(id,name,description,status,display_order) values('microbiology','Medical Microbiology','Clinically significant organisms and infectious diseases.','inactive',5);
insert into public.question_banks(id,name,description,status,display_order) values('clinical-medicine','Clinical Medicine','Integrated diagnosis and management across clinical systems.','active',6);
insert into public.bank_questions(id,question_bank_id,text,status,options) values('question-anatomy-heart','anatomy','Which organ pumps blood through the human body?','active','[{"id":"answer-heart-liver","text":"Liver"},{"id":"answer-heart-heart","text":"Heart"},{"id":"answer-heart-kidney","text":"Kidney"},{"id":"answer-heart-lung","text":"Lung"}]'::jsonb);
insert into private.question_solutions values('question-anatomy-heart','answer-heart-heart');
insert into public.bank_questions(id,question_bank_id,text,status,options) values('question-anatomy-bones','anatomy','How many bones are typically present in the adult human body?','active','[{"id":"answer-bones-186","text":"186"},{"id":"answer-bones-206","text":"206"},{"id":"answer-bones-226","text":"226"},{"id":"answer-bones-246","text":"246"}]'::jsonb);
insert into private.question_solutions values('question-anatomy-bones','answer-bones-206');
insert into public.bank_questions(id,question_bank_id,text,status,options) values('question-physiology-insulin','physiology','Which organ produces insulin?','active','[{"id":"answer-insulin-liver","text":"Liver"},{"id":"answer-insulin-pancreas","text":"Pancreas"},{"id":"answer-insulin-spleen","text":"Spleen"}]'::jsonb);
insert into private.question_solutions values('question-physiology-insulin','answer-insulin-pancreas');

commit;

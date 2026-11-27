
-- A specialty is the durable course package. Published materials inherit package
-- membership from question_banks.specialty_id, including any later additions.
-- Retains legacy per-course requests, grants and wallet entries intact.
set lock_timeout='5s';
set statement_timeout='60s';

create table public.course_package_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  specialty_id uuid not null references public.specialties(id),
  status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED')),
  requested_at timestamptz not null default statement_timestamp(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason)<=1000),
  constraint package_request_review_consistency check (
    (status='PENDING' and reviewed_at is null and reviewed_by is null and rejection_reason is null)
    or (status<>'PENDING' and reviewed_at is not null and reviewed_by is not null)
  )
);
create unique index one_pending_package_request on public.course_package_access_requests(user_id,specialty_id) where status='PENDING';
create index package_requests_user_date_idx on public.course_package_access_requests(user_id,requested_at desc);
create index package_requests_status_date_idx on public.course_package_access_requests(status,requested_at desc);

create table public.course_package_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  specialty_id uuid not null references public.specialties(id),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','REVOKED')),
  granted_at timestamptz not null default statement_timestamp(),
  granted_by uuid not null references public.profiles(id),
  request_id uuid references public.course_package_access_requests(id),
  revoked_at timestamptz,
  unique(user_id,specialty_id),
  unique(request_id),
  constraint package_grant_state_consistency check (
    (status='ACTIVE' and revoked_at is null) or (status='REVOKED' and revoked_at is not null)
  )
);
create index package_grant_user_idx on public.course_package_access(user_id,status);

alter table public.course_package_access_requests enable row level security;
alter table public.course_package_access enable row level security;
revoke all on public.course_package_access_requests, public.course_package_access from public, anon, authenticated, service_role;
grant select on public.course_package_access_requests, public.course_package_access to authenticated, service_role;
create policy own_package_requests on public.course_package_access_requests
for select to authenticated using (
  (user_id=(select auth.uid()) and (select private.is_active_role('STUDENT'::public.user_role)))
  or (select private.is_active_role('ADMIN'::public.user_role))
);
create policy own_package_grants on public.course_package_access
for select to authenticated using (
  (user_id=(select auth.uid()) and (select private.is_active_role('STUDENT'::public.user_role)))
  or (select private.is_active_role('ADMIN'::public.user_role))
);

-- Keep paid EXAM_TRACK approvals in the existing wallet/Bank Sale reports, tied
-- to this package grant. A unique key prevents repeat sales on reapproval.
alter table public.wallet_transactions
add column course_package_access_id uuid references public.course_package_access(id);
create unique index one_package_sale_per_bank
on public.wallet_transactions(course_package_access_id,question_bank_id)
where transaction_type='BANK_SALE' and course_package_access_id is not null;

create or replace function private.request_course_package_access(target_specialty_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not private.is_active_role('STUDENT'::public.user_role) then
    raise exception 'Active student required' using errcode='42501';
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
end $$;

create or replace function public.request_course_package_access(target_specialty_id uuid)
returns uuid language sql set search_path='' as $$
  select private.request_course_package_access(target_specialty_id);
$$;

create or replace function private.review_course_package_access(
  target_request_id uuid, decision text, reason text default null)
returns void language plpgsql security definer set search_path='' as $$
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
      and p.role='STUDENT' and p.status='ACTIVE' for share;
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
end $$;

create or replace function public.review_course_package_access(
  target_request_id uuid, decision text, reason text default null)
returns void language sql set search_path='' as $$
  select private.review_course_package_access(target_request_id,decision,reason);
$$;

create or replace function private.revoke_course_package_access(target_request_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.is_active_role('ADMIN'::public.user_role) then
    raise exception 'Administrator required' using errcode='42501'; end if;
  update public.course_package_access a set status='REVOKED',revoked_at=statement_timestamp()
  where a.request_id=target_request_id and a.status='ACTIVE';
  if not found then raise exception 'Active package grant not found' using errcode='23514'; end if;
end $$;

create or replace function public.revoke_course_package_access(target_request_id uuid)
returns void language sql set search_path='' as $$
  select private.revoke_course_package_access(target_request_id);
$$;

create or replace function private.list_course_package_requests()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_active_role('ADMIN'::public.user_role) then
    raise exception 'Administrator required' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(
      to_jsonb(r) || jsonb_build_object(
        'student_name',p.full_name,
        'bank_name',case when s.slug='medical' then 'Medicine'
                         when s.slug='nursing' then 'Nursing Colloquium'
                         else s.name end,
        'kind','PACKAGE',
        'accessActive',exists(
           select 1 from public.course_package_access a
           where a.request_id=r.id and a.status='ACTIVE'))
      order by r.requested_at desc)
    from public.course_package_access_requests r
    join public.profiles p on p.id=r.user_id
    join public.specialties s on s.id=r.specialty_id
  ),'[]'::jsonb);
end $$;

create or replace function public.list_course_package_requests()
returns jsonb language sql stable set search_path='' as $$
  select private.list_course_package_requests();
$$;

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
$function$;

revoke all on function public.request_course_package_access(uuid) from PUBLIC,anon;
revoke all on function public.review_course_package_access(uuid,text,text) from PUBLIC,anon;
revoke all on function public.revoke_course_package_access(uuid) from PUBLIC,anon;
revoke all on function public.list_course_package_requests() from PUBLIC,anon;
grant execute on function public.request_course_package_access(uuid) to authenticated;
grant execute on function public.review_course_package_access(uuid,text,text) to authenticated;
grant execute on function public.revoke_course_package_access(uuid) to authenticated;
grant execute on function public.list_course_package_requests() to authenticated;

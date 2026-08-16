begin;

create type public.user_role as enum ('ADMIN', 'TEACHER', 'STUDENT');
create type public.user_status as enum ('ACTIVE', 'INACTIVE', 'EXPIRED');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'STUDENT',
  status public.user_status not null default 'INACTIVE',
  activation_start timestamptz,
  activation_months integer,
  expiration_date timestamptz,
  phone text,
  avatar_url text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  constraint profiles_full_name_valid check (
    char_length(btrim(full_name)) between 1 and 200
  ),
  constraint profiles_phone_valid check (
    phone is null or char_length(btrim(phone)) between 1 and 50
  ),
  constraint profiles_activation_bundle_valid check (
    (activation_start is null and activation_months is null and expiration_date is null)
    or
    (activation_start is not null and activation_months is not null and expiration_date is not null)
  ),
  constraint profiles_activation_months_valid check (
    role = 'ADMIN'
    or activation_months is null
    or (role = 'STUDENT' and activation_months = 1)
    or (role = 'TEACHER' and activation_months >= 1)
  ),
  constraint profiles_active_subscription_configured check (
    status <> 'ACTIVE'
    or role = 'ADMIN'
    or expiration_date is not null
  ),
  constraint profiles_expiration_after_activation check (
    expiration_date is null or expiration_date > activation_start
  )
);

comment on table public.profiles is
  'Application profile linked one-to-one with Supabase Auth. Auth remains the identity provider.';
comment on column public.profiles.status is
  'Stored administrative status. Effective access must also compare expiration_date with database time.';
comment on column public.profiles.activation_months is
  'Students use one month; teachers use one or more months; admins may omit subscription activation.';

create index profiles_role_idx on public.profiles (role);
create index profiles_status_idx on public.profiles (status);
create index profiles_expiration_date_idx on public.profiles (expiration_date)
  where expiration_date is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.is_profile_access_active(
  profile_status public.user_status,
  profile_role public.user_role,
  profile_expiration_date timestamptz
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    profile_status = 'ACTIVE'
    and (
      profile_role = 'ADMIN'
      or (
        profile_expiration_date is not null
        and profile_expiration_date > statement_timestamp()
      )
    );
$$;

comment on function public.is_profile_access_active(public.user_status, public.user_role, timestamptz) is
  'Manual INACTIVE/EXPIRED status denies access. Non-admin expiration at or before database time also denies access.';

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role, status)
  values (
    new.id,
    coalesce(
      nullif(btrim(left(new.raw_user_meta_data ->> 'full_name', 200)), ''),
      'Pending user'
    ),
    'STUDENT',
    'INACTIVE'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Creates an inactive STUDENT profile. Public signup never creates an active or administrative account.';

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

create policy "Authenticated users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

-- No INSERT, UPDATE, or DELETE policies are intentionally granted. Profile
-- provisioning uses the auth trigger; later trusted admin operations will use
-- server-validated functions or a server-only administrative client.
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.is_profile_access_active(public.user_status, public.user_role, timestamptz) from public, anon;
grant execute on function public.is_profile_access_active(public.user_status, public.user_role, timestamptz) to authenticated;

commit;

begin;

create type public.profile_gender as enum ('MALE', 'FEMALE');

alter table public.profiles
  add column age integer,
  add column gender public.profile_gender,
  add column home_address text,
  add constraint profiles_age_valid check (
    age is null or age between 1 and 120
  ),
  add constraint profiles_home_address_valid check (
    home_address is null
    or char_length(btrim(home_address)) between 1 and 500
  );

comment on column public.profiles.age is
  'Self-reported age. Nullable for accounts created before demographic collection was introduced.';
comment on column public.profiles.gender is
  'Self-reported gender restricted to the supported public signup values.';
comment on column public.profiles.home_address is
  'Self-reported home address, limited to 500 characters. Nullable for existing accounts.';

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

  insert into public.profiles (
    id,
    full_name,
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
    profile_age,
    profile_gender,
    profile_home_address,
    'STUDENT',
    'INACTIVE'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Creates an inactive STUDENT profile and copies validated non-authorization signup metadata.';

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

commit;

begin;

alter table public.profiles
  add column country_code text,
  add constraint profiles_country_code_valid check (
    country_code is null or country_code ~ '^[A-Z]{2}$'
  );

comment on column public.profiles.country_code is
  'ISO 3166-1 alpha-2 country selected for the profile phone number.';
comment on column public.profiles.phone is
  'International phone number. Public signup stores a validated E.164 value.';

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
    'INACTIVE'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Creates an inactive STUDENT profile and copies validated non-authorization signup metadata, including an E.164 phone and ISO country code.';

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

commit;

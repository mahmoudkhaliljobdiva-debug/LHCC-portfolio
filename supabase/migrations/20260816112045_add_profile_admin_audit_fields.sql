begin;

alter table public.profiles
  add column created_by uuid references auth.users (id) on delete set null,
  add column deactivated_at timestamptz,
  add column reactivated_at timestamptz;

comment on column public.profiles.created_by is
  'Authenticated administrator who provisioned the managed account; null for self-provisioned or bootstrap accounts.';
comment on column public.profiles.deactivated_at is
  'Most recent administrative deactivation timestamp.';
comment on column public.profiles.reactivated_at is
  'Most recent administrative reactivation timestamp.';

-- Postgres does not automatically index foreign-key columns. This supports
-- future audit queries and efficient ON DELETE SET NULL processing.
create index profiles_created_by_idx on public.profiles (created_by)
  where created_by is not null;

commit;

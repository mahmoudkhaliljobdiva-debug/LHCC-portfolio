-- Evidence: already applied in production; NOT a new migration or a replay instruction.
-- Captured read-only on 2026-11-11. Historical definition preserved verbatim below.

create table if not exists private.question_import_sources (
  id uuid primary key default gen_random_uuid(),
  question_bank_id text not null references public.question_banks(id) on delete cascade,
  drive_file_id text not null unique,
  drive_url text not null,
  original_filename text not null,
  source_title text,
  page_count integer not null check (page_count > 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  import_status text not null default 'REGISTERED' check (import_status in ('REGISTERED','IN_PROGRESS','PARTIAL','COMPLETE','FAILED')),
  source_storage_path text,
  imported_count integer not null default 0 check(imported_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists question_import_sources_bank_sha on private.question_import_sources(question_bank_id, sha256);
create table if not exists private.question_import_staging (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references private.question_import_sources(id) on delete cascade,
  page_start integer not null check (page_start > 0),
  page_end integer not null check (page_end >= page_start),
  original_question_no text,
  content_fingerprint text not null,
  draft_payload jsonb not null check (jsonb_typeof(draft_payload) = 'object'),
  extraction_confidence numeric check (extraction_confidence between 0 and 1),
  answer_status text not null default 'UNVERIFIED' check (answer_status in ('UNVERIFIED','MISSING_IN_SOURCE','SOURCE_VERIFIED','AMBIGUOUS')),
  review_status text not null default 'PENDING' check (review_status in ('PENDING','REVIEWED','REJECTED')),
  review_notes text,
  linked_question_id text unique references public.bank_questions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(source_id,content_fingerprint)
);
create table if not exists private.question_source_links (
  question_id text primary key references public.bank_questions(id) on delete cascade,
  source_id uuid not null references private.question_import_sources(id) on delete restrict,
  page_start integer not null check(page_start > 0),
  page_end integer not null check(page_end >= page_start),
  original_question_no text,
  content_fingerprint text not null,
  created_at timestamptz not null default now(),
  unique(source_id,content_fingerprint)
);
create table if not exists private.question_answer_reviews (
  question_id text primary key references public.bank_questions(id) on delete cascade,
  answer_status text not null check (answer_status in ('SOURCE_VERIFIED','MEDICALLY_REVIEWED','AMBIGUOUS','MISSING_IN_SOURCE')),
  correct_option_id text,
  source_answer_page integer check(source_answer_page is null or source_answer_page > 0),
  source_evidence text,
  explanation text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.question_groups (
  id uuid primary key default gen_random_uuid(),
  question_bank_id text not null references public.question_banks(id) on delete cascade,
  group_type text not null default 'SHARED_OPTIONS',
  instructions text,
  shared_options jsonb,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint shared_options_if_set_is_array check(shared_options is null or jsonb_typeof(shared_options)='array')
);
alter table public.bank_questions add column if not exists group_id uuid references public.question_groups(id) on delete set null;
create table if not exists public.question_assets (
  id uuid primary key default gen_random_uuid(),
  question_id text not null references public.bank_questions(id) on delete cascade,
  asset_kind text not null default 'IMAGE',
  storage_path text not null,
  source_page int check(source_page is null or source_page>0),
  display_order int not null default 0,
  alt_text text,
  created_at timestamptz not null default now()
);
alter table public.question_groups enable row level security;
alter table public.question_assets enable row level security;
revoke all on private.question_import_sources, private.question_import_staging, private.question_source_links, private.question_answer_reviews from PUBLIC, anon, authenticated;
revoke all on public.question_groups, public.question_assets from PUBLIC, anon, authenticated;

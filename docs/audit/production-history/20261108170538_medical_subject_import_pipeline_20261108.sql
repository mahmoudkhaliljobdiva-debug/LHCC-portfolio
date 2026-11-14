-- Evidence: already applied in production; NOT a new migration or a replay instruction.
-- Captured read-only on 2026-11-11. Historical definition preserved verbatim below.

CREATE TABLE IF NOT EXISTS private.question_import_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 question_bank_id text NOT NULL REFERENCES public.question_banks(id),
 drive_file_id text NOT NULL UNIQUE,
 original_filename text NOT NULL,
 source_title text,
 page_count integer NOT NULL CHECK(page_count>0),
 sha256 text CHECK(sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),
 source_storage_path text,
 import_status text NOT NULL DEFAULT 'REGISTERED' CHECK(import_status IN ('REGISTERED','EXTRACTING','STAGED','PARTIAL','COMPLETE','ERROR')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS private.question_import_staging (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_id uuid NOT NULL REFERENCES private.question_import_sources(id),
 question_bank_id text NOT NULL REFERENCES public.question_banks(id),
 page_start integer NOT NULL CHECK(page_start>0),
 page_end integer NOT NULL CHECK(page_end>=page_start),
 original_question_no text,
 draft_payload jsonb NOT NULL,
 content_fingerprint text NOT NULL,
 extraction_confidence numeric CHECK(extraction_confidence BETWEEN 0 AND 1),
 review_status text NOT NULL DEFAULT 'PENDING' CHECK(review_status IN ('PENDING','APPROVED','REJECTED','NEEDS_REVIEW')),
 review_notes text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_id,content_fingerprint)
);
CREATE TABLE IF NOT EXISTS private.question_source_links (
 question_id text NOT NULL REFERENCES public.bank_questions(id) ON DELETE CASCADE,
 source_id uuid NOT NULL REFERENCES private.question_import_sources(id),
 page_start integer NOT NULL CHECK(page_start>0),
 page_end integer NOT NULL CHECK(page_end>=page_start),
 original_question_no text,
 content_fingerprint text,
 PRIMARY KEY (question_id,source_id,page_start)
);
CREATE TABLE IF NOT EXISTS private.question_answer_reviews (
 question_id text PRIMARY KEY REFERENCES public.bank_questions(id) ON DELETE CASCADE,
 answer_status text NOT NULL CHECK(answer_status IN ('CONFIRMED_IN_SOURCE','EXPERT_VERIFIED','MISSING_IN_SOURCE','AMBIGUOUS')),
 source_evidence text,
 explanation text,
 reviewed_by uuid REFERENCES public.profiles(id),
 reviewed_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.question_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 question_id text NOT NULL REFERENCES public.bank_questions(id) ON DELETE CASCADE,
 asset_kind text NOT NULL DEFAULT 'IMAGE',
 storage_path text NOT NULL,
 source_page integer,
 display_order integer NOT NULL DEFAULT 0,
 alt_text text
);
ALTER TABLE public.question_assets ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.question_groups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 question_bank_id text NOT NULL REFERENCES public.question_banks(id),
 instructions text,
 shared_options jsonb,
 group_type text NOT NULL DEFAULT 'SHARED_OPTIONS',
 display_order integer NOT NULL DEFAULT 0
);
ALTER TABLE public.question_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_questions ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.question_groups(id);
CREATE INDEX IF NOT EXISTS idx_import_stage_source_status ON private.question_import_staging(source_id,review_status);
CREATE INDEX IF NOT EXISTS idx_import_sources_bank ON private.question_import_sources(question_bank_id);
CREATE INDEX IF NOT EXISTS idx_question_assets_question ON public.question_assets(question_id);
CREATE INDEX IF NOT EXISTS idx_question_groups_bank ON public.question_groups(question_bank_id);

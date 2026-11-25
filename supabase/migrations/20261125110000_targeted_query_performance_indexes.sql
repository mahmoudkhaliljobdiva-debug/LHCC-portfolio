-- LHCC production query-performance audit (2026-11-25).
-- Use measured query patterns and Supabase advisor findings; avoid blanket indexing.
-- Keeps all existing business records and approved/unapproved question states.
-- Each statement is idempotent for safe application to a fresh project.

-- Missing FK covers reported by the performance advisor.
CREATE INDEX IF NOT EXISTS idx_bank_questions_group_fk
  ON public.bank_questions (group_id)
  WHERE group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lesson_questions_lesson_bank_fk
  ON public.lesson_questions (lesson_id, question_bank_id);

CREATE INDEX IF NOT EXISTS idx_lessons_chapter_bank_fk
  ON public.lessons (chapter_id, question_bank_id)
  WHERE chapter_id IS NOT NULL;

-- Partial index for published/active questions; avoid indexing all ungraded OCR rows.
CREATE INDEX IF NOT EXISTS idx_bank_questions_active_bank_id
  ON public.bank_questions (question_bank_id, id)
  WHERE status = 'active';

-- Per-student completed exams and missed-question history.
CREATE INDEX IF NOT EXISTS idx_attempts_completed_student_submitted
  ON public.question_attempts (student_id, submitted_at DESC)
  WHERE mode = 'EXAM' AND status = 'COMPLETED';

-- Authenticated SELECT policies are permissive and combined with OR by Postgres.
-- Replace the two policies with their exact logical OR to avoid redundant evaluation.
-- Do not broaden student/teacher/admin visibility. Only change if both policies match roles.
DO $merge$
DECLARE catalog_expr text;
DECLARE med_expr text;
DECLARE catalog_roles text[];
DECLARE med_roles text[];
BEGIN
  SELECT qual,roles INTO catalog_expr,catalog_roles FROM pg_policies
  WHERE schemaname='public' AND tablename='question_banks'
    AND policyname='bank_catalog' AND cmd='SELECT';
  SELECT qual,roles INTO med_expr,med_roles FROM pg_policies
  WHERE schemaname='public' AND tablename='question_banks'
    AND policyname='medical_free_subject_catalog' AND cmd='SELECT';
  IF med_expr IS NULL THEN RETURN; END IF;
  IF catalog_expr IS NULL
     OR catalog_roles IS DISTINCT FROM med_roles
     OR catalog_roles <> ARRAY['authenticated']::text[] THEN
    RAISE EXCEPTION 'Catalog security policy changed. Verify access rules manually.';
  END IF;
  EXECUTE format('ALTER POLICY bank_catalog ON public.question_banks USING ((%s) OR (%s))', catalog_expr,med_expr);
  EXECUTE 'DROP POLICY medical_free_subject_catalog ON public.question_banks';
END $merge$;

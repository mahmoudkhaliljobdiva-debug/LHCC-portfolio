-- LHCC: Allow unlisted draft mock exams under draft EXAM_TRACKs.
-- Existing published exam guard remains unchanged for PUBLISHED/ARCHIVED exam rows.
CREATE OR REPLACE FUNCTION private.guard_exam_material()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM 1 FROM public.question_banks
   WHERE id = NEW.question_bank_id
     AND material_kind = 'EXAM_TRACK'
     AND (
       publication_status = 'PUBLISHED'
       OR (publication_status = 'DRAFT' AND NEW.status = 'DRAFT')
     )
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Published exam track required for publication; draft exam requires a draft or published exam track'
      USING errcode = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

-- Admin-only operation. Selection must belong to exactly one Subject.
-- Activation is denied until the existing approved-answer predicate passes.
CREATE OR REPLACE FUNCTION private.bulk_update_subject_question_status(
  bank_id text, question_ids text[], target_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  chosen integer;
  updated integer;
BEGIN
  IF NOT private.is_active_role('ADMIN') THEN
    RAISE EXCEPTION 'Administrator access required' USING errcode = '42501';
  END IF;

  IF target_status NOT IN ('active', 'inactive')
    OR question_ids IS NULL
    OR array_length(question_ids, 1) IS NULL
    OR array_length(question_ids, 1) > 100
    OR array_position(question_ids, NULL) IS NOT NULL
    OR EXISTS (SELECT 1 FROM unnest(question_ids) id WHERE length(btrim(id)) NOT BETWEEN 1 AND 200)
  THEN
    RAISE EXCEPTION 'Select 1 to 100 questions and a valid status' USING errcode = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.question_banks
    WHERE id = bank_id AND material_kind = 'SUBJECT'
  ) THEN
    RAISE EXCEPTION 'Subject not found' USING errcode = '23514';
  END IF;

  SELECT count(*) INTO chosen
  FROM public.bank_questions
  WHERE question_bank_id = bank_id AND id = ANY(question_ids);

  IF chosen <> (SELECT count(DISTINCT id) FROM unnest(question_ids) x(id))
    OR chosen <> array_length(question_ids, 1)
  THEN
    RAISE EXCEPTION 'Selection contains duplicate or cross-Subject question IDs'
      USING errcode = '23514';
  END IF;

  IF target_status = 'active' AND EXISTS (
    SELECT 1 FROM public.bank_questions q
    WHERE q.question_bank_id = bank_id
      AND q.id = ANY(question_ids)
      AND (
        NOT private.subject_question_eligible(q.id)
        OR NOT EXISTS (
          SELECT 1 FROM private.question_solutions sol
          WHERE sol.question_id = q.id
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(q.options) opt
              WHERE opt ->> 'id' = sol.correct_option_id
            )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Every question needs an administratively approved answer before activation'
      USING errcode = '23514';
  END IF;

  UPDATE public.bank_questions
  SET status = target_status,
      include_in_complete_bank = (target_status = 'active')
  WHERE question_bank_id = bank_id AND id = ANY(question_ids);
  GET DIAGNOSTICS updated = ROW_COUNT;

  RETURN jsonb_build_object('updated', updated, 'status', target_status);
END;
$function$;

REVOKE ALL ON FUNCTION private.bulk_update_subject_question_status(text, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.bulk_update_subject_question_status(text, text[], text) TO authenticated;

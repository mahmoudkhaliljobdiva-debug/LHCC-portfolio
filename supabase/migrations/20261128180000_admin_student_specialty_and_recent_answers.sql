
CREATE OR REPLACE FUNCTION private.admin_set_student_specialty(target_user uuid, selected_slug text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE result uuid;
BEGIN
  IF NOT private.is_active_role('ADMIN') THEN
    RAISE EXCEPTION 'Admin access required' USING errcode='42501';
  END IF;
  SELECT id INTO result FROM public.specialties
    WHERE slug=selected_slug AND published AND slug IN ('dentistry','medical','nursing');
  IF result IS NULL OR target_user IS NULL THEN
    RAISE EXCEPTION 'Invalid student or specialty' USING errcode='23514';
  END IF;
  UPDATE public.profiles SET specialty_id=result
  WHERE id=target_user AND role='STUDENT';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student profile not found' USING errcode='42501';
  END IF;
  RETURN result;
END $fn$;

CREATE OR REPLACE FUNCTION public.admin_set_student_specialty(target_user uuid, selected_slug text)
RETURNS uuid LANGUAGE sql SET search_path TO ''
AS $fn$ SELECT private.admin_set_student_specialty(target_user,selected_slug); $fn$;
REVOKE ALL ON FUNCTION private.admin_set_student_specialty(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_set_student_specialty(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.admin_set_student_specialty(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_student_specialty(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.student_recent_answers(max_answers integer DEFAULT 15)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE output jsonb;
BEGIN
  IF NOT private.is_active_role('STUDENT') THEN
    RAISE EXCEPTION 'Active student required' USING errcode='42501';
  END IF;
  IF max_answers NOT BETWEEN 1 AND 30 OR max_answers IS NULL THEN
    RAISE EXCEPTION 'Invalid limit' USING errcode='23514';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."answeredAt" DESC,x."attemptId"),'[]'::jsonb)
  INTO output
  FROM (
    SELECT a.id::text AS "attemptId",a.exam_title_snapshot AS "examTitle",
           b.name AS "bankName",q.question_id AS "questionId",
           q.text AS "questionText",ans.answered_at AS "answeredAt",
           ans.selected_option_id AS "selectedOptionId",
           sol.correct_option_id AS "correctOptionId",
           (SELECT o->>'text' FROM jsonb_array_elements(q.options) o
             WHERE o->>'id'=ans.selected_option_id LIMIT 1) AS "selectedText",
           (SELECT o->>'text' FROM jsonb_array_elements(q.options) o
             WHERE o->>'id'=sol.correct_option_id LIMIT 1) AS "correctText",
           (ans.selected_option_id=sol.correct_option_id) AS "isCorrect"
    FROM public.question_attempts a
    JOIN public.question_banks b ON b.id=a.question_bank_id
    JOIN public.profiles p ON p.id=auth.uid() AND p.specialty_id=b.specialty_id
    JOIN public.question_attempt_answers ans ON ans.attempt_id=a.id
    JOIN public.question_attempt_questions q ON q.attempt_id=ans.attempt_id AND q.question_id=ans.question_id
    JOIN private.exam_question_solutions sol ON sol.attempt_id=ans.attempt_id AND sol.question_id=ans.question_id
    WHERE a.student_id=auth.uid() AND a.status='COMPLETED' AND a.mode='EXAM'
    ORDER BY ans.answered_at DESC,a.submitted_at DESC,a.id DESC
    LIMIT max_answers
  ) x;
  RETURN output;
END $fn$;

CREATE OR REPLACE FUNCTION public.student_recent_answers(max_answers integer DEFAULT 15)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO ''
AS $fn$ SELECT private.student_recent_answers(max_answers); $fn$;
REVOKE ALL ON FUNCTION private.student_recent_answers(integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.student_recent_answers(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.student_recent_answers(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_recent_answers(integer) TO authenticated;
SELECT n.nspname,p.proname,has_function_privilege('authenticated',p.oid,'EXECUTE') auth_exec,
has_function_privilege('anon',p.oid,'EXECUTE') anon_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.proname IN ('admin_set_student_specialty','student_recent_answers')
ORDER BY p.proname,n.nspname;
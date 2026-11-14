-- Evidence: already applied in production; NOT a new migration or a replay instruction.
-- Captured read-only on 2026-11-11. Historical definition preserved verbatim below.

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
   AND (
    (b.material_kind='EXAM_TRACK' AND EXISTS (
       SELECT 1 FROM public.user_bank_access a
       WHERE a.user_id=(SELECT auth.uid())
         AND a.question_bank_id=b.id AND a.status='ACTIVE'))
    OR
    (b.material_kind='SUBJECT' AND b.price=0 AND EXISTS (
       SELECT 1 FROM public.specialties s
       WHERE s.id=b.specialty_id AND s.slug='medical' AND s.published))
   )
 )
$function$;
DROP POLICY IF EXISTS medical_free_subject_catalog ON public.question_banks;
CREATE POLICY medical_free_subject_catalog ON public.question_banks
FOR SELECT TO authenticated
USING (
 material_kind='SUBJECT'
 AND status='active'
 AND publication_status='PUBLISHED'
 AND price=0
 AND EXISTS (SELECT 1 FROM public.specialties s
             WHERE s.id=specialty_id AND s.slug='medical' AND s.published)
 AND (SELECT private.is_active_role('STUDENT'))
);

CREATE OR REPLACE FUNCTION private.learning_catalog()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
 SELECT coalesce(
  jsonb_agg(
   jsonb_build_object(
    'id',s.id,'slug',s.slug,'name',s.name,'description',s.description,'icon',s.icon,
    'materials',coalesce(
      (SELECT jsonb_agg(
         jsonb_build_object(
          'id',b.id,'name',b.name,'description',b.description,
          'materialKind',b.material_kind,'examCategory',b.exam_category,
          'icon',b.material_icon,'language',b.content_language
         ) ORDER BY b.display_order,b.id)
       FROM public.question_banks b
       WHERE b.specialty_id=s.id
         AND b.status='active' AND b.publication_status='PUBLISHED'
         AND (
           b.material_kind='EXAM_TRACK'
           OR (
              b.material_kind='SUBJECT' AND b.price=0
              AND s.slug='medical'
              AND EXISTS (
                SELECT 1 FROM public.bank_questions q
                WHERE q.question_bank_id=b.id AND q.status='active'
              )
           )
         )
      ),'[]'::jsonb)
   ) ORDER BY s.display_order,s.id
  ),'[]'::jsonb
 )
 FROM public.specialties s WHERE s.published
$function$;

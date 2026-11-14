-- Evidence: already applied in production; NOT a new migration or a replay instruction.
-- Captured read-only on 2026-11-11. Historical definition preserved verbatim below.

DO $block$
DECLARE medical_specialty_id uuid;
BEGIN
 SELECT id INTO STRICT medical_specialty_id
 FROM public.specialties WHERE slug='medical';

 ALTER TABLE public.question_banks
 DROP CONSTRAINT IF EXISTS question_banks_material_shape;

 EXECUTE format($fmt$
 ALTER TABLE public.question_banks
 ADD CONSTRAINT question_banks_material_shape
 CHECK (
    (material_kind='EXAM_TRACK' AND exam_category IS NOT NULL)
    OR
    (
     material_kind='SUBJECT'
     AND exam_category IS NULL
     AND specialty_id IS NOT NULL
     AND price=0
     AND (
      (publication_status='DRAFT' AND status='inactive')
      OR
      (specialty_id=%L::uuid AND publication_status='PUBLISHED' AND status='active')
     )
    )
 )
 $fmt$,medical_specialty_id);
END
$block$;

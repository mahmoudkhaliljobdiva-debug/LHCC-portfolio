-- Source-extracted Medicine questions exposed as ungraded student study previews.
-- No unapproved answers are activated; answer keys are never returned to students.
-- The existing editorial approval requirement is retained for scored questions.

CREATE OR REPLACE FUNCTION private.medical_preview_eligible(qid text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(
   select 1
   from public.bank_questions q
   join private.question_answer_reviews r on r.question_id=q.id
   join public.question_banks b on b.id=q.question_bank_id
   where q.id=qid
     and b.material_kind='SUBJECT'
     and b.specialty_id='dee77965-75c4-430d-8148-85b453c39007'::uuid
     and q.status='inactive'
     and r.answer_status='SOURCE_VERIFIED'
     and length(btrim(q.text))>=60
     and jsonb_typeof(q.options)='array'
     and jsonb_array_length(q.options)>=4
     and (select count(*) from jsonb_array_elements(q.options) item)=
         (select count(distinct item->>'id') from jsonb_array_elements(q.options) item)
     and (select bool_and(length(btrim(item->>'text'))>=3) from jsonb_array_elements(q.options) item)
     and not exists(
       select 1 from jsonb_array_elements(q.options) item
       where item->>'text' ~* '(correct answer|answer key|explanation)'
     )
 );
$function$
;

CREATE OR REPLACE FUNCTION private.student_medical_subject_preview(target_bank_id text, page_number integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare b public.question_banks;
begin
 if not private.is_active_role('STUDENT') then
   raise exception 'Active student required' using errcode='42501';
 end if;
 if page_number is null or page_number not between 0 and 1000 or
    target_bank_id is null or length(target_bank_id)>200 then
   raise exception 'Invalid study request' using errcode='23514';
 end if;
 select * into b from public.question_banks q where q.id=target_bank_id
   and q.material_kind='SUBJECT'
   and q.specialty_id='dee77965-75c4-430d-8148-85b453c39007'::uuid
   and q.status='active' and q.publication_status='PUBLISHED';
 if not found then raise exception 'Published Medicine subject not found' using errcode='23514'; end if;
 return jsonb_build_object(
   'bank',jsonb_build_object('id',b.id,'name',b.name,'description',b.description),
   'page',page_number,
   'total',(select count(*)::integer from public.bank_questions q where q.question_bank_id=b.id and private.medical_preview_eligible(q.id)),
   'questions',coalesce(
     (select jsonb_agg(jsonb_build_object('id',t.id,'text',t.text,'options',(select coalesce(jsonb_agg(
          jsonb_build_object('id',opt->>'id','text',opt->>'text') order by ord
        ),'[]'::jsonb)
        from jsonb_array_elements(t.options) with ordinality z(opt,ord)),'order',t.display_order)
                        order by t.display_order nulls last,t.id)
      from (
        select q.id,q.text,q.options,q.display_order
        from public.bank_questions q
        where q.question_bank_id=b.id and private.medical_preview_eligible(q.id)
        order by q.display_order nulls last,q.id
        limit 20 offset (page_number*20)
      ) t
     ),'[]'::jsonb)
 );
end
$function$
;

CREATE OR REPLACE FUNCTION public.student_medical_subject_preview(target_bank_id text, page_number integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select private.student_medical_subject_preview(target_bank_id,page_number)
$function$
;

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
                WHERE q.question_bank_id=b.id AND (q.status='active'
                  OR private.medical_preview_eligible(q.id))
              )
           )
         )
      ),'[]'::jsonb)
   ) ORDER BY s.display_order,s.id
  ),'[]'::jsonb
 )
 FROM public.specialties s WHERE s.published
$function$
;

REVOKE ALL ON FUNCTION private.medical_preview_eligible(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.student_medical_subject_preview(text,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.student_medical_subject_preview(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.student_medical_subject_preview(text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_medical_subject_preview(text,integer) TO authenticated;

-- Publish subject listings only when validated ungraded previews exist.
UPDATE public.question_banks b
SET status='active',publication_status='PUBLISHED'
WHERE b.specialty_id='dee77965-75c4-430d-8148-85b453c39007'::uuid
  AND b.material_kind='SUBJECT'
  AND b.price=0
  AND b.status='inactive'
  AND b.publication_status='DRAFT'
  AND EXISTS (
    SELECT 1 FROM public.bank_questions q
    WHERE q.question_bank_id=b.id AND private.medical_preview_eligible(q.id)
  );

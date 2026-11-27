-- Unified published courses: requests, approvals, study access, and protected questions.
-- Retain all existing learning data, wallet records, access history and users.
set lock_timeout = '5s';
set statement_timeout = '30s';

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
   AND b.material_kind IN ('EXAM_TRACK','SUBJECT')
   AND EXISTS (
     SELECT 1 FROM public.specialties s
     WHERE s.id=b.specialty_id AND s.published
   )
   AND EXISTS (
     SELECT 1 FROM public.user_bank_access a
     WHERE a.user_id=(SELECT auth.uid())
       AND a.question_bank_id=b.id AND a.status='ACTIVE'
   )
 )
$function$;

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
         AND b.material_kind IN ('EXAM_TRACK','SUBJECT')
      ),'[]'::jsonb)
   ) ORDER BY s.display_order,s.id
  ),'[]'::jsonb
 )
 FROM public.specialties s WHERE s.published
$function$;

CREATE OR REPLACE FUNCTION private.review_bank_access(request_id uuid, decision text, reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.user_bank_access_requests; access_row public.user_bank_access; bank_row public.question_banks;
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if decision is null or decision not in ('APPROVED','REJECTED') then raise exception 'Invalid decision'; end if;
 select * into r from public.user_bank_access_requests where id=request_id for update;
 if not found or r.status<>'PENDING' then raise exception 'Request is no longer pending'; end if;
 if decision='APPROVED' then
  select * into bank_row from public.question_banks where id=r.question_bank_id and status='active'
   and material_kind IN ('EXAM_TRACK','SUBJECT') and publication_status='PUBLISHED'
   and exists (select 1 from public.specialties s where s.id=specialty_id and s.published) for share;
  if not found then raise exception 'Published course required' using errcode='42501'; end if;
  perform 1 from public.profiles where id=r.user_id and role='STUDENT' and status='ACTIVE' for share;
  if not found then raise exception 'Student account is disabled' using errcode='42501'; end if;
  insert into public.user_bank_access(user_id,question_bank_id,granted_by,request_id,price)
   values(r.user_id,r.question_bank_id,auth.uid(),r.id,bank_row.price)
   on conflict(user_id,question_bank_id) do update set status='ACTIVE',granted_at=statement_timestamp(),
    granted_by=auth.uid(),request_id=r.id,price=excluded.price,revoked_at=null returning * into access_row;
  if bank_row.price>0 then
   insert into public.wallet_transactions(transaction_type,name,description,amount,user_id,question_bank_id,user_bank_access_id,created_by,transaction_date)
    values('BANK_SALE',bank_row.name||' access',bank_row.name||' access granted',bank_row.price,r.user_id,r.question_bank_id,access_row.id,auth.uid(),current_date)
    on conflict(user_bank_access_id) where transaction_type='BANK_SALE' do nothing;
  end if;
 end if;
 update public.user_bank_access_requests set status=decision,reviewed_at=statement_timestamp(),reviewed_by=auth.uid(),
  rejection_reason=case when decision='REJECTED' then nullif(btrim(reason),'') else null end where id=r.id;
end $function$;

CREATE OR REPLACE FUNCTION private.student_medical_subject_preview(target_bank_id text, page_number integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE b public.question_banks;
BEGIN
  IF NOT private.is_active_role('STUDENT') THEN
    RAISE EXCEPTION 'Active student required' USING errcode='42501';
  END IF;
  IF page_number IS NULL OR page_number NOT BETWEEN 0 AND 1000
    OR target_bank_id IS NULL OR length(target_bank_id)>200 THEN
    RAISE EXCEPTION 'Invalid study request' USING errcode='23514';
  END IF;
  SELECT * INTO b FROM public.question_banks bank
  WHERE bank.id=target_bank_id AND bank.material_kind='SUBJECT'
    AND bank.specialty_id='dee77965-75c4-430d-8148-85b453c39007'::uuid
    AND bank.status='active' AND bank.publication_status='PUBLISHED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Published Medicine subject not found' USING errcode='23514';
  END IF;
  IF NOT private.can_open_bank(target_bank_id) THEN
    RAISE EXCEPTION 'Course approval required' USING errcode='42501';
  END IF;
  RETURN (
   WITH staged AS MATERIALIZED (
     SELECT st.id::text id,
       COALESCE(NULLIF(btrim(q.text),''),
         NULLIF(btrim(st.draft_payload->>'text'),''),
         NULLIF(btrim(st.draft_payload->>'question'),''),
         '[Question text could not be extracted]') as question_text,
       CASE WHEN q.id IS NOT NULL THEN q.options
            WHEN jsonb_typeof(st.draft_payload->'options')='array' THEN st.draft_payload->'options'
            ELSE '[]'::jsonb END as raw_options,
       s.original_filename as filename,st.page_start as page_start,
       CASE WHEN q.id IS NOT NULL AND private.medical_preview_eligible(q.id)
             THEN 'SOURCE_EXTRACTED' ELSE 'NEEDS_OCR_REVIEW' END AS quality,
       st.created_at,st.id as stage_id
     FROM private.question_import_staging st
     JOIN private.question_import_sources s ON s.id=st.source_id
     LEFT JOIN public.bank_questions q ON q.id=st.linked_question_id AND q.question_bank_id=s.question_bank_id
     WHERE s.question_bank_id=b.id
   ), sliced AS (
     SELECT p.* FROM staged p
     ORDER BY p.filename,p.page_start NULLS LAST,p.created_at,p.stage_id
     LIMIT 20 OFFSET (page_number*20)
   )
   SELECT jsonb_build_object(
      'bank',jsonb_build_object('id',b.id,'name',b.name,'description',b.description),
      'page',page_number,
      'total',(SELECT count(*) FROM staged),
      'questions',coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',item.id,
            'text',private.clean_student_study_text(item.question_text),
            'options',coalesce((
               SELECT jsonb_agg(
                 jsonb_build_object(
                   'id',left(coalesce(o.opt->>'id',o.ord::text),200),
                   'text',private.clean_student_study_text(o.opt->>'text')
                 ) ORDER BY o.ord
               )
               FROM jsonb_array_elements(item.raw_options) WITH ORDINALITY o(opt,ord)
               WHERE jsonb_typeof(o.opt)='object'
                 AND length(btrim(coalesce(o.opt->>'text','')))>0
                 AND length(private.clean_student_study_text(o.opt->>'text'))>0
              ),'[]'::jsonb),
            'quality',item.quality,
            'filename',item.filename,
            'pageStart',item.page_start
          )
          ORDER BY item.filename,item.page_start NULLS LAST,item.created_at,item.stage_id
        ) FROM sliced item
      ),'[]'::jsonb)
   )
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.request_bank_access(bank_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result uuid;
begin
 if not private.is_active_role('STUDENT') then raise exception 'Student access required' using errcode='42501'; end if;
 if not exists(select 1 from public.question_banks b where b.id=bank_id and b.status='active'
  and b.material_kind IN ('EXAM_TRACK','SUBJECT') and b.publication_status='PUBLISHED'
  and exists (select 1 from public.specialties s where s.id=b.specialty_id and s.published)) then
  raise exception 'Published course required' using errcode='42501'; end if;
 insert into public.user_bank_access_requests(question_bank_id) values(bank_id) returning id into result;
 return result;
end $function$;


-- Public-facing metadata is limited to published courses in published specialties.
drop policy if exists bank_catalog on public.question_banks;
create policy bank_catalog on public.question_banks for select to authenticated using (
  (select private.is_active_role('ADMIN'::public.user_role))
  or private.teacher_has_bank(id)
  or (
    (select private.is_active_role('STUDENT'::public.user_role))
    and status='active' and publication_status='PUBLISHED'
    and material_kind in ('EXAM_TRACK','SUBJECT')
    and exists (select 1 from public.specialties s where s.id=specialty_id and s.published)
  )
);

-- A student can request published subjects and exam tracks, but cannot approve themselves.
drop policy if exists own_pending_request on public.user_bank_access_requests;
create policy own_pending_request on public.user_bank_access_requests for insert to authenticated with check (
  user_id=(select auth.uid())
  and (select private.is_active_role('STUDENT'::public.user_role))
  and status='PENDING' and reviewed_at is null and reviewed_by is null and rejection_reason is null
  and exists (
    select 1 from public.question_banks b join public.specialties s on s.id=b.specialty_id
    where b.id=question_bank_id and b.status='active' and b.publication_status='PUBLISHED'
      and b.material_kind in ('EXAM_TRACK','SUBJECT') and s.published
  )
  and not private.can_open_bank(question_bank_id)
);

-- The previous subject_approved_questions_only policy allowed unconditional
-- EXAM_TRACK reads and some SUBJECT reads without approved access. Restrict
-- questions to approved students, assigned teachers and active administrators.
drop policy if exists approved_questions on public.bank_questions;
drop policy if exists subject_approved_questions_only on public.bank_questions;
create policy approved_questions on public.bank_questions for select to authenticated using (
  (select private.is_active_role('ADMIN'::public.user_role))
  or private.teacher_has_bank(question_bank_id)
  or (
    status='active' and private.can_open_bank(question_bank_id)
    and exists (
      select 1 from public.question_banks b where b.id=question_bank_id
        and (
          b.material_kind='EXAM_TRACK'
          or (b.material_kind='SUBJECT' and private.subject_question_eligible(id))
        )
    )
  )
);

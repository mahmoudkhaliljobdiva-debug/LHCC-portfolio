
-- Import every source-linked Medicine OCR draft as an editable inactive admin question.
-- Drafts without extracted choices must NOT be forced to fake answer choices.
-- Active questions still require >= 2 choices. No answer keys are invented.
-- Already imported questions and original staged PDF evidence are preserved.
ALTER TABLE public.bank_questions DROP CONSTRAINT IF EXISTS bank_questions_options_check;
ALTER TABLE public.bank_questions
  ADD CONSTRAINT bank_questions_options_check CHECK (
    jsonb_typeof(options)='array'
    AND jsonb_array_length(options) BETWEEN 0 AND 10
    AND (status='inactive' OR jsonb_array_length(options)>=2)
  );

DO $bulk$
DECLARE
  n integer;
  n_imported integer;
  n_links integer;
  n_reviews integer;
  n_updated integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('lhcc-medicine-bulk-ocr-import',0));

  CREATE TEMP TABLE med_ocr_import_candidates ON COMMIT DROP AS
  SELECT st.id AS stage_id,
     'medical-ocr-'||st.id::text AS question_id,
     src.question_bank_id AS bank_id, src.id AS source_id,
     st.page_start, st.page_end,st.original_question_no,st.content_fingerprint,
     coalesce(
       nullif(btrim(private.clean_student_study_text(st.draft_payload->>'text')),''),
       nullif(btrim(private.clean_student_study_text(st.draft_payload->>'question')),''),
       '[OCR transcription requires correction from the original PDF]'
     ) AS question_text,
     coalesce((
       SELECT jsonb_agg(
         jsonb_build_object(
           'id',left(coalesce(nullif(btrim(opt->>'id'),''),chr(64+ord::integer)),200),
           'text',left(btrim(private.clean_student_study_text(opt->>'text')),5000)
         ) ORDER BY ord
       )
       FROM jsonb_array_elements(
         CASE WHEN jsonb_typeof(st.draft_payload->'options')='array'
           THEN st.draft_payload->'options' ELSE '[]'::jsonb END
       ) WITH ORDINALITY AS item(opt,ord)
       WHERE ord<=10 AND jsonb_typeof(opt)='object'
         AND length(btrim(private.clean_student_study_text(opt->>'text')))>0
     ),'[]'::jsonb) AS options
  FROM private.question_import_staging st
  JOIN private.question_import_sources src ON src.id=st.source_id
  JOIN public.question_banks b ON b.id=src.question_bank_id
  WHERE b.specialty_id='dee77965-75c4-430d-8148-85b453c39007'::uuid
    AND b.material_kind='SUBJECT'
    AND b.status='active' AND b.publication_status='PUBLISHED'
    AND st.linked_question_id IS NULL;

  SELECT count(*) INTO n FROM med_ocr_import_candidates;
  IF n=0 THEN RETURN; END IF;
  IF n>20000 THEN RAISE EXCEPTION 'Unexpected OCR batch size: %',n; END IF;

  IF EXISTS (
    SELECT 1 FROM med_ocr_import_candidates c
    WHERE EXISTS (SELECT 1 FROM public.bank_questions q WHERE q.id=c.question_id)
       OR EXISTS (SELECT 1 FROM private.question_source_links link
                 WHERE link.source_id=c.source_id
                   AND link.content_fingerprint=c.content_fingerprint)
       OR length(c.question_text) NOT BETWEEN 1 AND 10000
       OR jsonb_typeof(c.options)<>'array'
       OR jsonb_array_length(c.options)>10
       OR c.page_start<1 OR c.page_end<c.page_start
  ) THEN
    RAISE EXCEPTION 'Invalid OCR draft/duplicate source detected; refusing partial import';
  END IF;

  INSERT INTO public.bank_questions
    (id,question_bank_id,text,options,status,display_order,include_in_complete_bank)
  SELECT question_id,bank_id,question_text,options,'inactive',NULL,false
  FROM med_ocr_import_candidates;
  GET DIAGNOSTICS n_imported=ROW_COUNT;

  INSERT INTO private.question_source_links
    (question_id,source_id,page_start,page_end,original_question_no,content_fingerprint)
  SELECT question_id,source_id,page_start,page_end,original_question_no,content_fingerprint
  FROM med_ocr_import_candidates;
  GET DIAGNOSTICS n_links=ROW_COUNT;

  INSERT INTO private.question_answer_reviews
    (question_id,answer_status,correct_option_id,approval_status,explanation_origin)
  SELECT question_id,'AMBIGUOUS',NULL,'PENDING','UNKNOWN'
  FROM med_ocr_import_candidates;
  GET DIAGNOSTICS n_reviews=ROW_COUNT;

  UPDATE private.question_import_staging st SET
    linked_question_id=c.question_id,imported_at=now()
  FROM med_ocr_import_candidates c
  WHERE st.id=c.stage_id AND st.linked_question_id IS NULL;
  GET DIAGNOSTICS n_updated=ROW_COUNT;

  IF n_imported<>n OR n_links<>n OR n_reviews<>n OR n_updated<>n THEN
    RAISE EXCEPTION 'Import consistency check failed: %/%/%/% vs %',n_imported,n_links,n_reviews,n_updated,n;
  END IF;
END $bulk$;

-- Expose both the imported total and the remaining editorial-review workload.
CREATE OR REPLACE FUNCTION private.admin_subject_materials(specialty_filter text, page_number integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if page_number is null or page_number not between 0 and 100000 or specialty_filter is null
  or (specialty_filter<>'unassigned' and not exists(select 1 from public.specialties where id::text=specialty_filter)) then raise exception 'Invalid Subject folder' using errcode='23514'; end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(m) order by m."displayOrder",m.id) from (
  select b.id,b.name,b.description,b.specialty_id as "specialtyId",b.material_kind as "materialKind",b.exam_category as "examCategory",
   b.publication_status as "publicationStatus",b.material_icon as icon,b.content_language as language,b.display_order as "displayOrder",b.status,
   (select count(*) from public.bank_questions q where q.question_bank_id=b.id) as "questionCount",
   (select count(*) from private.question_import_staging st join private.question_import_sources s on s.id=st.source_id where s.question_bank_id=b.id) as "extractedCount",
   (select count(*) from private.question_import_staging st join private.question_import_sources s on s.id=st.source_id where s.question_bank_id=b.id and st.linked_question_id is null) as "draftCount",
   (select count(*) from public.bank_questions q left join private.question_answer_reviews r on r.question_id=q.id
     where q.question_bank_id=b.id and coalesce(r.approval_status,'PENDING')<>'APPROVED') as "needsReviewCount",
   (select count(*) from public.bank_chapters c where c.question_bank_id=b.id) as "chapterCount"
  from public.question_banks b where b.material_kind='SUBJECT' and coalesce(b.specialty_id::text,'unassigned')=specialty_filter
  order by b.display_order,b.id limit 20 offset page_number*20) m),'[]'),
 'total',(select count(*) from public.question_banks b where b.material_kind='SUBJECT' and coalesce(b.specialty_id::text,'unassigned')=specialty_filter),
 'folders',(select coalesce(jsonb_agg(f order by f."displayOrder",f.name),'[]') from (
  select s.id::text id,case when s.slug='medical' then 'Medicine' else s.name end name,s.display_order as "displayOrder",
   (select count(*) from public.question_banks b where b.material_kind='SUBJECT' and b.specialty_id=s.id) total
  from public.specialties s union all select 'unassigned','Unassigned specialty',2147483647,
   (select count(*) from public.question_banks b where b.material_kind='SUBJECT' and b.specialty_id is null)) f));
end $function$
;

CREATE OR REPLACE FUNCTION private.admin_subject_questions(bank_id text, page_number integer DEFAULT 0, search_text text DEFAULT ''::text, view_kind text DEFAULT 'questions'::text, chapter_filter uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if page_number is null or page_number not between 0 and 100000 or length(search_text)>200 or view_kind not in ('questions','review') then raise exception 'Invalid question query' using errcode='23514'; end if;
 if not exists(select 1 from public.question_banks where id=bank_id and material_kind='SUBJECT') then raise exception 'Subject not found' using errcode='23514'; end if;
 select jsonb_build_object('bank',jsonb_build_object('id',b.id,'name',b.name,'specialtyName',case when sp.slug='medical' then 'Medicine' else sp.name end),
  'questionCount',(select count(*) from public.bank_questions q where q.question_bank_id=b.id),
  'extractedCount',(select count(*) from private.question_import_staging st join private.question_import_sources s on s.id=st.source_id where s.question_bank_id=b.id),
  'pendingCount',(select count(*) from private.question_import_staging st join private.question_import_sources s on s.id=st.source_id where s.question_bank_id=b.id and st.linked_question_id is null),
  'needsReviewCount',(select count(*) from public.bank_questions q left join private.question_answer_reviews r on r.question_id=q.id
    where q.question_bank_id=b.id and coalesce(r.approval_status,'PENDING')<>'APPROVED'),
  'chapters',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title) order by c.display_order,c.id) from public.bank_chapters c where c.question_bank_id=b.id),'[]'),
  'sources',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'filename',s.original_filename,'driveFileId',s.drive_file_id,'pages',s.page_count,'kind',s.source_kind,
   'processedPages',(select count(*) from private.question_import_pages p where p.source_id=s.id),
   'needsReviewPages',(select count(*) from private.question_import_pages p where p.source_id=s.id and p.status='NEEDS_REVIEW')) order by s.created_at) from private.question_import_sources s where s.question_bank_id=b.id),'[]'))
 into result from public.question_banks b left join public.specialties sp on sp.id=b.specialty_id where b.id=bank_id;
 if view_kind='review' then
  return result||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(t) order by t."createdAt",t.id) from (
   select st.id,st.revision,st.draft_payload as draft,st.answer_status as "answerStatus",st.review_status as "reviewStatus",st.review_notes as notes,
    st.source_id as "sourceId",s.original_filename as filename,st.page_start as "pageStart",st.page_end as "pageEnd",st.original_question_no as "sourceNumber",
    st.linked_question_id as "questionId",st.imported_at as "importedAt",st.reviewed_by as "reviewedBy",st.reviewed_at as "reviewedAt",st.created_at as "createdAt",
    (select count(*) from public.bank_questions q where q.id is distinct from st.linked_question_id
      and md5(lower(regexp_replace(q.text,'\s+',' ','g')))=md5(lower(regexp_replace(coalesce(st.draft_payload->>'text',st.draft_payload->>'question',''),'\s+',' ','g'))) and lower(regexp_replace(q.text,'\s+',' ','g'))=lower(regexp_replace(coalesce(st.draft_payload->>'text',st.draft_payload->>'question',''),'\s+',' ','g')))+(select count(*) from private.question_import_staging other where other.id<>st.id and (other.linked_question_id is null or other.linked_question_id is distinct from st.linked_question_id)
      and md5(lower(regexp_replace(coalesce(other.draft_payload->>'text',other.draft_payload->>'question',''),'\s+',' ','g')))=md5(lower(regexp_replace(coalesce(st.draft_payload->>'text',st.draft_payload->>'question',''),'\s+',' ','g'))) and lower(regexp_replace(coalesce(other.draft_payload->>'text',other.draft_payload->>'question',''),'\s+',' ','g'))=lower(regexp_replace(coalesce(st.draft_payload->>'text',st.draft_payload->>'question',''),'\s+',' ','g'))) as "possibleDuplicates"
   from private.question_import_staging st join private.question_import_sources s on s.id=st.source_id
   where s.question_bank_id=bank_id and st.linked_question_id is null and (search_text='' or st.draft_payload::text ilike '%'||search_text||'%')
   order by st.created_at,st.id limit 20 offset page_number*20) t),'[]'),
   'total',(select count(*) from private.question_import_staging st join private.question_import_sources s on s.id=st.source_id where s.question_bank_id=bank_id and st.linked_question_id is null and (search_text='' or st.draft_payload::text ilike '%'||search_text||'%')));
 end if;
 return result||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(t) order by t."displayOrder" nulls last,t.id) from (
  select q.id,q.text,q.options,q.status,q.display_order as "displayOrder",sol.correct_option_id as "correctOptionId",
   coalesce(r.approval_status,'PENDING') as "approvalStatus",r.explanation,r.source_evidence as evidence,r.answer_status as "answerStatus",r.explanation_origin as "explanationOrigin",r.source_answer_page as "answerPage",
   sec.title as "caseTitle",sec.description as "caseDescription",
   s.original_filename as filename,s.drive_file_id as "driveFileId",ln.page_start as "pageStart",ln.page_end as "pageEnd",ln.original_question_no as "sourceNumber",
   (select st.id from private.question_import_staging st where st.linked_question_id=q.id) as "stagingId",
   (select st.revision from private.question_import_staging st where st.linked_question_id=q.id) as "stagingRevision",
   (select cq.chapter_id from public.chapter_questions cq where cq.question_id=q.id order by cq.chapter_id limit 1) as "chapterId",
   (select lq.lesson_id from public.lesson_questions lq where lq.question_id=q.id limit 1) as "lessonId",
   coalesce((select jsonb_agg(c.title) from public.chapter_questions cq join public.bank_chapters c on c.id=cq.chapter_id where cq.question_id=q.id),'[]') as chapters,
   g.instructions as "groupInstructions",g.shared_options as "sharedOptions",
   (select count(*) from public.question_assets a where a.question_id=q.id) as "assetCount"
  from public.bank_questions q left join private.question_solutions sol on sol.question_id=q.id
   left join private.question_answer_reviews r on r.question_id=q.id left join private.question_source_links ln on ln.question_id=q.id
   left join private.question_import_sources s on s.id=ln.source_id left join public.question_groups g on g.id=q.group_id
   left join public.question_sections sec on sec.id=q.section_id and sec.question_bank_id=q.question_bank_id
  where q.question_bank_id=bank_id and (search_text='' or q.text ilike '%'||search_text||'%')
   and (chapter_filter is null or exists(select 1 from public.chapter_questions cq where cq.question_id=q.id and cq.chapter_id=chapter_filter))
  order by q.display_order nulls last,q.created_at,q.id limit 20 offset page_number*20) t),'[]'),
  'total',(select count(*) from public.bank_questions q where q.question_bank_id=bank_id and (search_text='' or q.text ilike '%'||search_text||'%')
   and (chapter_filter is null or exists(select 1 from public.chapter_questions cq where cq.question_id=q.id and cq.chapter_id=chapter_filter))));
end $function$
;

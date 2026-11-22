-- Subject admin management shows all extracted PDF entries, separately from scored
-- bank_questions records. An existing OCR draft can be reviewed and imported
-- in place after explicit admin verification. No automatic approval occurs.
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

CREATE OR REPLACE FUNCTION private.save_reviewed_subject_question(bank_id text, question_id text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare staged private.question_import_staging; result jsonb; target uuid; existing text;
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload->'approvalConfirmed' is distinct from 'true'::jsonb then
  raise exception 'Explicit content review and approval required' using errcode='23514'; end if;
 if not exists(select 1 from public.question_banks where id=bank_id and material_kind='SUBJECT') then raise exception 'Subject required' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended('subject-import:'||bank_id,0));
 if question_id is not null then
  select q.id into existing from public.bank_questions q where q.id=question_id and q.question_bank_id=bank_id for update;
  if existing is null then raise exception 'Question does not belong to this Subject' using errcode='23514'; end if;
  select * into staged from private.question_import_staging s where s.linked_question_id=question_id for update;
  if staged.id is not null and staged.revision is distinct from (payload->>'expectedRevision')::integer then raise exception 'Question changed; reload before saving' using errcode='40001'; end if;
 end if;
 -- Review an existing OCR draft in place instead of creating a duplicate.
 -- This path still requires explicit administrative approval and all of the
 -- existing source-evidence, answer-key, explanation and visual checks.
 if question_id is null and nullif(payload->>'stagingId','') is not null then
  select st.* into staged from private.question_import_staging st
    join private.question_import_sources src on src.id=st.source_id
    where st.id=(payload->>'stagingId')::uuid and src.question_bank_id=bank_id
    for update of st;
  if staged.id is null or staged.linked_question_id is not null then
    raise exception 'Unimported source draft not found in this Subject' using errcode='23514';
  end if;
  if staged.revision is distinct from (payload->>'expectedRevision')::integer then
    raise exception 'Source draft changed; reload before saving' using errcode='40001';
  end if;
 end if;
 target:=coalesce(staged.id,gen_random_uuid());
 result:=private.manage_subject_import('stage',bank_id,target,payload||jsonb_build_object('expectedRevision',staged.revision));
 if coalesce((result->>'duplicate')::boolean,false) then raise exception 'Source candidate already exists and requires its own explicit review' using errcode='23505'; end if;
 target:=(result->>'id')::uuid;
 if staged.id is null and existing is not null then
  if exists(select 1 from private.question_import_staging s where s.id=target and s.linked_question_id is not null and s.linked_question_id<>existing) then
   raise exception 'Source already belongs to another question' using errcode='23505'; end if;
  update private.question_import_staging set linked_question_id=existing where id=target;
 end if;
 result:=private.manage_subject_import('approve',bank_id,target,jsonb_build_object('expectedRevision',(result->>'revision')::integer));
 result:=private.manage_subject_import('import',bank_id,target,jsonb_build_object('expectedRevision',(result->>'revision')::integer));
 return result;
end $function$
;

-- Existing public SQL wrappers remain unchanged. The private functions
-- enforce active ADMIN role before returning records or changing any data.

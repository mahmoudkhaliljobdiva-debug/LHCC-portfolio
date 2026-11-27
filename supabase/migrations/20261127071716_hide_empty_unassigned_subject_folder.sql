-- Show the virtual "Unassigned specialty" folder only when at least one
-- subject lacks a specialty. Does not delete or modify learning data.
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
   (select count(*) from public.question_banks b where b.material_kind='SUBJECT' and b.specialty_id is null)
  where exists (select 1 from public.question_banks b where b.material_kind='SUBJECT' and b.specialty_id is null)) f));
end $function$;

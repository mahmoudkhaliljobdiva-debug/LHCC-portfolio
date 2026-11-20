-- Additive Subject administration. Existing IDs, keys, attempts and grants are retained.
set lock_timeout='5s';
set statement_timeout='60s';
do $$ begin
 if to_regclass('private.question_import_sources') is null or to_regclass('private.question_import_staging') is null
 or to_regclass('private.question_source_links') is null or to_regclass('private.question_answer_reviews') is null then
  raise exception 'Existing import provenance schema must be reconciled first';
 end if;
end $$;

alter table private.question_import_sources add column source_kind text not null default 'PDF' check(source_kind in ('PDF','ADMIN'));
alter table private.question_import_staging add column revision integer not null default 1;
alter table private.question_import_staging add column reviewed_by uuid references public.profiles(id);
alter table private.question_import_staging add column reviewed_at timestamptz;
alter table private.question_import_staging add column imported_at timestamptz;
alter table private.question_import_staging drop constraint question_import_staging_review_status_check;
alter table private.question_import_staging add constraint question_import_staging_review_status_check check(review_status in ('PENDING','REVIEWED','NEEDS_REVIEW','APPROVED','REJECTED'));
alter table private.question_import_staging drop constraint question_import_staging_answer_status_check;
alter table private.question_import_staging add constraint question_import_staging_answer_status_check check(answer_status in ('UNVERIFIED','MISSING_IN_SOURCE','SOURCE_VERIFIED','AMBIGUOUS','MEDICALLY_REVIEWED'));
alter table private.question_answer_reviews add column approval_status text not null default 'PENDING' check(approval_status in ('PENDING','APPROVED','REJECTED'));
alter table private.question_answer_reviews add column explanation_origin text not null default 'UNKNOWN' check(explanation_origin in ('UNKNOWN','SOURCE','ADMIN'));

create table private.question_import_events (
 id uuid primary key default gen_random_uuid(), staging_id uuid references private.question_import_staging(id),
 question_id text, actor_id uuid not null references public.profiles(id), operation text not null,
 revision integer not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index question_import_events_staging_idx on private.question_import_events(staging_id,created_at);
create index question_import_events_actor_idx on private.question_import_events(actor_id);
create index question_import_staging_reviewer_idx on private.question_import_staging(reviewed_by);
create index question_answer_reviews_reviewer_idx on private.question_answer_reviews(reviewed_by);
create table private.question_import_pages (
 source_id uuid not null references private.question_import_sources(id), page_number integer not null check(page_number>0),
 status text not null check(status in ('EXTRACTED','NEEDS_REVIEW')), text_content text not null,
 warnings jsonb not null default '[]', processed_by uuid not null references public.profiles(id), processed_at timestamptz not null default now(),
 primary key(source_id,page_number)
);
create index question_import_pages_actor_idx on private.question_import_pages(processed_by);
alter table private.question_import_sources enable row level security;
alter table private.question_import_staging enable row level security;
alter table private.question_source_links enable row level security;
alter table private.question_answer_reviews enable row level security;
alter table private.question_import_events enable row level security;
alter table private.question_import_pages enable row level security;
revoke all on private.question_import_sources,private.question_import_staging,private.question_source_links,private.question_answer_reviews,
 private.question_import_events,private.question_import_pages from public,anon,authenticated,service_role;

create function private.subject_question_eligible(qid text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.question_answer_reviews r join private.question_solutions s on s.question_id=r.question_id
  where r.question_id=qid and r.approval_status='APPROVED' and r.reviewed_by is not null and r.reviewed_at is not null
  and r.correct_option_id=s.correct_option_id);
$$;
revoke all on function private.subject_question_eligible(text) from public,anon;
grant execute on function private.subject_question_eligible(text) to authenticated;
-- Restrictive policy intersects existing access checks; never grants a new bank.
create policy subject_approved_questions_only on public.bank_questions as restrictive for select to authenticated using (
 private.is_active_role('ADMIN') or exists(select 1 from public.question_banks b where b.id=question_bank_id and b.material_kind='EXAM_TRACK')
 or (status='active' and private.subject_question_eligible(id))
);

create function private.admin_subject_materials(specialty_filter text,page_number integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if page_number is null or page_number not between 0 and 100000 or specialty_filter is null
  or (specialty_filter<>'unassigned' and not exists(select 1 from public.specialties where id::text=specialty_filter)) then raise exception 'Invalid Subject folder' using errcode='23514'; end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(m) order by m."displayOrder",m.id) from (
  select b.id,b.name,b.description,b.specialty_id as "specialtyId",b.material_kind as "materialKind",b.exam_category as "examCategory",
   b.publication_status as "publicationStatus",b.material_icon as icon,b.content_language as language,b.display_order as "displayOrder",b.status,
   (select count(*) from public.bank_questions q where q.question_bank_id=b.id) as "questionCount"
  from public.question_banks b where b.material_kind='SUBJECT' and coalesce(b.specialty_id::text,'unassigned')=specialty_filter
  order by b.display_order,b.id limit 20 offset page_number*20) m),'[]'),
 'total',(select count(*) from public.question_banks b where b.material_kind='SUBJECT' and coalesce(b.specialty_id::text,'unassigned')=specialty_filter),
 'folders',(select coalesce(jsonb_agg(f order by f."displayOrder",f.name),'[]') from (
  select s.id::text id,case when s.slug='medical' then 'Medicine' else s.name end name,s.display_order as "displayOrder",
   (select count(*) from public.question_banks b where b.material_kind='SUBJECT' and b.specialty_id=s.id) total
  from public.specialties s union all select 'unassigned','Unassigned specialty',2147483647,
   (select count(*) from public.question_banks b where b.material_kind='SUBJECT' and b.specialty_id is null)) f));
end $$;
create function public.admin_subject_materials(specialty_filter text,page_number integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$ select private.admin_subject_materials(specialty_filter,page_number) $$;

create function private.admin_subject_questions(bank_id text,page_number integer default 0,search_text text default '',view_kind text default 'questions',chapter_filter uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if page_number is null or page_number not between 0 and 100000 or length(search_text)>200 or view_kind not in ('questions','review') then raise exception 'Invalid question query' using errcode='23514'; end if;
 if not exists(select 1 from public.question_banks where id=bank_id and material_kind='SUBJECT') then raise exception 'Subject not found' using errcode='23514'; end if;
 select jsonb_build_object('bank',jsonb_build_object('id',b.id,'name',b.name,'specialtyName',case when sp.slug='medical' then 'Medicine' else sp.name end),
  'questionCount',(select count(*) from public.bank_questions q where q.question_bank_id=b.id),
  'pendingCount',(select count(*) from private.question_import_staging st join private.question_import_sources s on s.id=st.source_id where s.question_bank_id=b.id and st.review_status in ('PENDING','REVIEWED','NEEDS_REVIEW')),
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
    (select count(*) from public.bank_questions q where q.question_bank_id=bank_id and q.id is distinct from st.linked_question_id
      and lower(regexp_replace(q.text,'\s+',' ','g'))=lower(regexp_replace(coalesce(st.draft_payload->>'text',st.draft_payload->>'question',''),'\s+',' ','g'))) as "possibleDuplicates"
   from private.question_import_staging st join private.question_import_sources s on s.id=st.source_id
   where s.question_bank_id=bank_id and (search_text='' or st.draft_payload::text ilike '%'||search_text||'%')
   order by st.created_at,st.id limit 20 offset page_number*20) t),'[]'),
   'total',(select count(*) from private.question_import_staging st join private.question_import_sources s on s.id=st.source_id where s.question_bank_id=bank_id and (search_text='' or st.draft_payload::text ilike '%'||search_text||'%')));
 end if;
 return result||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(t) order by t."displayOrder" nulls last,t.id) from (
  select q.id,q.text,q.options,q.status,q.display_order as "displayOrder",sol.correct_option_id as "correctOptionId",
   coalesce(r.approval_status,'PENDING') as "approvalStatus",r.explanation,r.source_evidence as evidence,r.answer_status as "answerStatus",r.explanation_origin as "explanationOrigin",r.source_answer_page as "answerPage",
   sec.title as "caseTitle",sec.description as "caseDescription",
   s.original_filename as filename,s.drive_file_id as "driveFileId",ln.page_start as "pageStart",ln.page_end as "pageEnd",ln.original_question_no as "sourceNumber",
   (select st.id from private.question_import_staging st where st.linked_question_id=q.id) as "stagingId",
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
end $$;
create function public.admin_subject_questions(bank_id text,page_number integer default 0,search_text text default '',view_kind text default 'questions',chapter_filter uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.admin_subject_questions(bank_id,page_number,search_text,view_kind,chapter_filter) $$;

create function private.manage_subject_import(operation text,bank_id text,item_id uuid,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare st private.question_import_staging; src private.question_import_sources; d jsonb; qid text; key text; fp text;
 expected integer; answer_state text; chapter uuid; existing_bank text; linked text; duplicate boolean;
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if not exists(select 1 from public.question_banks where id=bank_id and material_kind='SUBJECT') then raise exception 'Subject required' using errcode='23514'; end if;
 if item_id is null or jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>800000 then raise exception 'Invalid import payload' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended('subject-import:'||bank_id,0));
 if operation='source' then
  if payload->>'sha256' !~ '^[a-f0-9]{64}$' or length(payload->>'filename') not between 1 and 500
   or payload->>'pages' !~ '^[0-9]+$' or (payload->>'pages')::integer not between 1 and 2000
   or payload->>'driveFileId' !~ '^[A-Za-z0-9_-]{10,200}$' then raise exception 'Valid PDF identity/hash/page count required' using errcode='23514'; end if;
  select * into src from private.question_import_sources where drive_file_id=payload->>'driveFileId' for update;
  if found then
   if src.question_bank_id<>bank_id or src.sha256<>payload->>'sha256' or src.page_count<>(payload->>'pages')::integer then raise exception 'Source identity or version conflict; preserve the original import' using errcode='23514'; end if;
   return jsonb_build_object('id',src.id);
  end if;
  insert into private.question_import_sources(id,question_bank_id,drive_file_id,drive_url,original_filename,page_count,sha256)
   values(item_id,bank_id,payload->>'driveFileId','https://drive.google.com/file/d/'||(payload->>'driveFileId')||'/view',payload->>'filename',(payload->>'pages')::integer,payload->>'sha256');
  return jsonb_build_object('id',item_id);
 end if;
 if operation in ('stage','page') then
  if payload->>'sourceId' is null then
   if operation='page' then raise exception 'PDF source required' using errcode='23514'; end if;
   insert into private.question_import_sources(question_bank_id,drive_file_id,drive_url,original_filename,page_count,sha256,source_kind)
    values(bank_id,'manual:'||bank_id,'','Admin authored (no PDF)',1,encode(extensions.digest(bank_id,'sha256'),'hex'),'ADMIN')
    on conflict(drive_file_id) do nothing;
   select * into src from private.question_import_sources where drive_file_id='manual:'||bank_id;
  else select * into src from private.question_import_sources where id=(payload->>'sourceId')::uuid and question_bank_id=bank_id for update;
  end if;
  if src.id is null then raise exception 'Source does not belong to this Subject' using errcode='23514'; end if;
  if operation='page' then
   if (payload->>'page')::integer not between 1 and src.page_count or length(payload->>'text')>200000
    or payload->>'status' not in ('EXTRACTED','NEEDS_REVIEW') or jsonb_typeof(payload->'warnings') is distinct from 'array' then raise exception 'Invalid source page' using errcode='23514'; end if;
   insert into private.question_import_pages(source_id,page_number,status,text_content,warnings,processed_by)
    values(src.id,(payload->>'page')::integer,payload->>'status',coalesce(payload->>'text',''),payload->'warnings',auth.uid())
    on conflict(source_id,page_number) do update set status=excluded.status,text_content=excluded.text_content,warnings=excluded.warnings,processed_by=auth.uid(),processed_at=now();
   update private.question_import_sources set import_status='PARTIAL',updated_at=now() where id=src.id;
   return jsonb_build_object('id',src.id);
  end if;
  d:=payload->'draft'; answer_state:=payload->>'answerStatus';
  if jsonb_typeof(d) is distinct from 'object' or jsonb_typeof(d->'options') is distinct from 'array'
   or length(coalesce(d->>'text',''))>10000 or jsonb_array_length(d->'options')>10
   or answer_state not in ('UNVERIFIED','MISSING_IN_SOURCE','SOURCE_VERIFIED','AMBIGUOUS','MEDICALLY_REVIEWED')
   or (payload->>'pageStart')::integer not between 1 and src.page_count or (payload->>'pageEnd')::integer not between (payload->>'pageStart')::integer and src.page_count then raise exception 'Invalid staged question' using errcode='23514'; end if;
  fp:=encode(extensions.digest(jsonb_build_object('text',d->>'text','options',d->'options','pageStart',payload->'pageStart','pageEnd',payload->'pageEnd','number',payload->>'sourceNumber')::text,'sha256'),'hex');
  select * into st from private.question_import_staging where id=item_id for update;
  if found then
   if st.source_id<>src.id or st.revision is distinct from (payload->>'expectedRevision')::integer then raise exception 'Draft changed; reload before saving' using errcode='40001'; end if;
   insert into private.question_import_events(staging_id,question_id,actor_id,operation,revision,details)
    values(st.id,st.linked_question_id,auth.uid(),'superseded_draft',st.revision,jsonb_build_object('sourceId',st.source_id,'fingerprint',st.content_fingerprint,'draft',st.draft_payload));
   update private.question_import_staging set draft_payload=d,answer_status=answer_state,page_start=(payload->>'pageStart')::integer,page_end=(payload->>'pageEnd')::integer,
    original_question_no=nullif(payload->>'sourceNumber',''),content_fingerprint=fp,review_status='PENDING',review_notes=payload->>'notes',reviewed_by=null,reviewed_at=null,imported_at=null,revision=revision+1 where id=item_id returning * into st;
  else
   select * into st from private.question_import_staging where source_id=src.id and (content_fingerprint=fp or
    (nullif(payload->>'sourceNumber','') is not null and original_question_no=payload->>'sourceNumber' and page_start=(payload->>'pageStart')::integer and page_end=(payload->>'pageEnd')::integer)) limit 1;
   if found then return jsonb_build_object('id',st.id,'revision',st.revision,'duplicate',true); end if;
   insert into private.question_import_staging(id,source_id,page_start,page_end,original_question_no,content_fingerprint,draft_payload,answer_status,review_notes)
    values(item_id,src.id,(payload->>'pageStart')::integer,(payload->>'pageEnd')::integer,nullif(payload->>'sourceNumber',''),fp,d,answer_state,payload->>'notes') returning * into st;
  end if;
 elsif operation in ('approve','reject','needs_review','import') then
  select stg.* into st from private.question_import_staging stg join private.question_import_sources s on s.id=stg.source_id
   where stg.id=item_id and s.question_bank_id=bank_id for update of stg;
  if st.id is null then raise exception 'Draft not found in this Subject' using errcode='23514'; end if;
  if st.revision is distinct from (payload->>'expectedRevision')::integer then raise exception 'Draft changed; reload before continuing' using errcode='40001'; end if;
  if operation in ('reject','needs_review') then
   update private.question_import_staging set review_status=case when operation='reject' then 'REJECTED' else 'NEEDS_REVIEW' end,
    review_notes=payload->>'notes',reviewed_by=auth.uid(),reviewed_at=now(),imported_at=null,revision=revision+1 where id=item_id returning * into st;
   update private.question_answer_reviews set approval_status=case when operation='reject' then 'REJECTED' else 'PENDING' end
    where question_id=st.linked_question_id;
  else
   d:=st.draft_payload; key:=coalesce(d->>'correctOptionId',d->>'answer_from_source');
   if length(btrim(coalesce(d->>'text',d->>'question',''))) not between 1 and 10000
    or jsonb_typeof(d->'options') is distinct from 'array' or jsonb_array_length(d->'options') not between 2 and 10
    or exists(select 1 from jsonb_array_elements(d->'options') o where jsonb_typeof(o) is distinct from 'object'
      or length(btrim(coalesce(o->>'text',''))) not between 1 and 5000 or length(coalesce(o->>'id','')) not between 1 and 200
      or exists(select 1 from jsonb_object_keys(o) k(field) where field not in ('id','text')))
    or (select count(distinct o->>'id') from jsonb_array_elements(d->'options') o)<>jsonb_array_length(d->'options')
    or key is null or not exists(select 1 from jsonb_array_elements(d->'options') o where o->>'id'=key)
    or st.answer_status not in ('SOURCE_VERIFIED','MEDICALLY_REVIEWED')
    or length(btrim(coalesce(d->>'explanation',''))) = 0 or length(btrim(coalesce(d->>'evidence','')))=0
    or coalesce(d->>'explanationOrigin','') not in ('SOURCE','ADMIN')
    or coalesce(d->>'visualsReviewed','false')<>'true' then raise exception 'Complete options, answer evidence, explanation and visual review are required; source verification is not approval' using errcode='23514'; end if;
   if d->>'answerPage' is not null and ((d->>'answerPage')::integer not between 1 and (select page_count from private.question_import_sources where id=st.source_id)) then raise exception 'Answer source page is outside the PDF' using errcode='23514'; end if;
   chapter:=nullif(d->>'chapterId','')::uuid;
   if chapter is not null and not exists(select 1 from public.bank_chapters where id=chapter and question_bank_id=bank_id) then raise exception 'Chapter belongs to another Subject' using errcode='23514'; end if;
   if exists(select 1 from public.bank_questions q where q.question_bank_id=bank_id and q.id is distinct from st.linked_question_id
    and lower(regexp_replace(q.text,'\s+',' ','g'))=lower(regexp_replace(coalesce(d->>'text',d->>'question'),'\s+',' ','g'))
    and (select jsonb_agg(lower(btrim(o->>'text'))) from jsonb_array_elements(q.options) o)=(select jsonb_agg(lower(btrim(o->>'text'))) from jsonb_array_elements(d->'options') o)) then
    raise exception 'An identical question and options already exist; reject the duplicate candidate and retain the existing record' using errcode='23505';
   end if;
   duplicate:=exists(select 1 from public.bank_questions q where q.question_bank_id=bank_id and q.id is distinct from st.linked_question_id
    and lower(regexp_replace(q.text,'\s+',' ','g'))=lower(regexp_replace(coalesce(d->>'text',d->>'question'),'\s+',' ','g')))
    or exists(select 1 from private.question_import_staging other join private.question_import_sources os on os.id=other.source_id where other.id<>st.id
     and os.question_bank_id=bank_id and lower(coalesce(other.draft_payload->>'text',other.draft_payload->>'question',''))=lower(coalesce(d->>'text',d->>'question','')));
   if duplicate and coalesce(d->>'duplicatesReviewed','false')<>'true' then raise exception 'Review possible duplicates before approval' using errcode='23514'; end if;
   if operation='approve' then
    update private.question_import_staging set review_status='APPROVED',reviewed_by=auth.uid(),reviewed_at=now(),revision=revision+1 where id=item_id returning * into st;
   else
    if st.review_status<>'APPROVED' or st.reviewed_by is null or st.reviewed_at is null then raise exception 'Explicit administrative approval required before import' using errcode='42501'; end if;
    if st.imported_at is not null and st.linked_question_id is not null then return jsonb_build_object('id',st.id,'questionId',st.linked_question_id,'revision',st.revision,'alreadyImported',true); end if;
    qid:=coalesce(st.linked_question_id,gen_random_uuid()::text);
    perform private.lock_learning_content_identities(array[qid]);
    if exists(select 1 from private.lesson_question_owners where question_id=qid) or exists(select 1 from private.imported_question_owners where question_id=qid) then raise exception 'Use the owning lesson or examination editor' using errcode='23514'; end if;
    if exists(select 1 from public.bank_questions where id=qid and question_bank_id<>bank_id) then raise exception 'Cross-Subject question reference denied' using errcode='23514'; end if;
    insert into public.bank_questions(id,question_bank_id,text,options,status)
     values(qid,bank_id,coalesce(d->>'text',d->>'question'),
      (select jsonb_agg(jsonb_build_object('id',o->>'id','text',o->>'text')) from jsonb_array_elements(d->'options') o),'active')
     on conflict(id) do update set text=excluded.text,options=excluded.options,status=excluded.status where bank_questions.question_bank_id=bank_id;
    insert into private.question_solutions(question_id,correct_option_id) values(qid,key) on conflict(question_id) do update set correct_option_id=excluded.correct_option_id;
    insert into private.question_answer_reviews(question_id,answer_status,correct_option_id,source_evidence,explanation,reviewed_by,reviewed_at,approval_status,explanation_origin,source_answer_page)
     values(qid,st.answer_status,key,d->>'evidence',d->>'explanation',st.reviewed_by,st.reviewed_at,'APPROVED',d->>'explanationOrigin',(d->>'answerPage')::integer)
     on conflict(question_id) do update set answer_status=excluded.answer_status,correct_option_id=excluded.correct_option_id,source_evidence=excluded.source_evidence,
      explanation=excluded.explanation,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,approval_status='APPROVED',explanation_origin=excluded.explanation_origin,source_answer_page=excluded.source_answer_page;
    insert into private.question_source_links(question_id,source_id,page_start,page_end,original_question_no,content_fingerprint)
     values(qid,st.source_id,st.page_start,st.page_end,st.original_question_no,st.content_fingerprint)
     on conflict(question_id) do update set page_start=excluded.page_start,page_end=excluded.page_end,original_question_no=excluded.original_question_no,content_fingerprint=excluded.content_fingerprint
      where question_source_links.source_id=excluded.source_id;
    if chapter is not null then insert into public.chapter_questions(chapter_id,question_id,question_bank_id) values(chapter,qid,bank_id) on conflict do nothing; end if;
    update private.question_import_staging set linked_question_id=qid,imported_at=now(),revision=revision+1 where id=item_id returning * into st;
    update private.question_import_sources s set imported_count=(select count(*) from private.question_import_staging a where a.source_id=s.id and a.imported_at is not null),updated_at=now() where s.id=st.source_id;
   end if;
  end if;
 else raise exception 'Unsupported import operation' using errcode='23514';
 end if;
 insert into private.question_import_events(staging_id,question_id,actor_id,operation,revision,details)
  values(st.id,st.linked_question_id,auth.uid(),operation,st.revision,jsonb_build_object('answerStatus',st.answer_status,'reviewStatus',st.review_status,
    'fingerprint',st.content_fingerprint,'sourceId',st.source_id,'pageStart',st.page_start,'pageEnd',st.page_end,'sourceNumber',st.original_question_no,'draft',st.draft_payload));
 return jsonb_build_object('id',st.id,'questionId',st.linked_question_id,'revision',st.revision);
end $$;
create function public.manage_subject_import(operation text,bank_id text,item_id uuid,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select private.manage_subject_import(operation,bank_id,item_id,payload) $$;

create function private.delete_subject_question(bank_id text,question_id text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 perform private.lock_learning_content_identities(array[question_id]);
 perform 1 from public.bank_questions q join public.question_banks b on b.id=q.question_bank_id where q.id=question_id and b.id=bank_id and b.material_kind='SUBJECT' for update of q;
 if not found then raise exception 'Subject question not found' using errcode='23514'; end if;
 if exists(select 1 from public.question_attempt_questions q where q.question_id=delete_subject_question.question_id)
  or exists(select 1 from public.lesson_questions q where q.question_id=delete_subject_question.question_id)
  or exists(select 1 from public.past_exam_questions q where q.question_id=delete_subject_question.question_id) then raise exception 'Question has protected learning history; preserve it' using errcode='23503'; end if;
 insert into private.question_import_events(staging_id,question_id,actor_id,operation,revision)
  values((select st.id from private.question_import_staging st where st.linked_question_id=delete_subject_question.question_id),question_id,auth.uid(),'delete',1);
 delete from public.bank_questions q where q.id=delete_subject_question.question_id and q.question_bank_id=bank_id;
end $$;
create function public.delete_subject_question(bank_id text,question_id text) returns void language sql security invoker set search_path='' as $$ select private.delete_subject_question(bank_id,question_id) $$;

create function private.save_subject_metadata(payload jsonb) returns text language plpgsql security definer set search_path='' as $$
declare b public.question_banks; key text;
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 select * into b from public.question_banks where id=payload->>'id' and material_kind='SUBJECT' for update;
 if not found or payload->>'materialKind' is distinct from 'SUBJECT' or payload->>'publicationStatus' is distinct from b.publication_status
  or payload->>'status' is distinct from b.status or payload->>'specialtyId' is distinct from b.specialty_id::text or payload->>'examCategory' is not null then
  raise exception 'Subject identity/publication/access cannot be changed through metadata editing' using errcode='23514'; end if;
 if exists(select 1 from jsonb_object_keys(payload) as fields(field) where field not in ('id','name','description','specialtyId','materialKind','examCategory','publicationStatus','icon','language','displayOrder','status')) then raise exception 'Invalid Subject metadata' using errcode='23514'; end if;
 foreach key in array array['name','description','icon','language'] loop
  if jsonb_typeof(payload->key) is distinct from 'string' then raise exception 'Invalid metadata type' using errcode='23514'; end if;
 end loop;
 if length(btrim(payload->>'name')) not between 1 and 200 or length(btrim(payload->>'description')) not between 1 and 3000
  or coalesce(payload->>'displayOrder','') !~ '^[0-9]{1,5}$' or (payload->>'displayOrder')::integer>10000
  or payload->>'icon' not in ('book','brain','stethoscope','nursing','dentistry','graduation','clipboard','other')
  or payload->>'language' not in ('auto','ar','en','mixed') then raise exception 'Invalid Subject metadata' using errcode='23514'; end if;
 update public.question_banks set name=btrim(payload->>'name'),description=btrim(payload->>'description'),material_icon=payload->>'icon',content_language=payload->>'language',display_order=(payload->>'displayOrder')::integer where id=b.id;
 return b.id;
end $$;
create function public.save_subject_metadata(payload jsonb) returns text language sql security invoker set search_path='' as $$ select private.save_subject_metadata(payload) $$;
revoke all on function private.save_subject_metadata(jsonb),public.save_subject_metadata(jsonb) from public,anon;
grant execute on function private.save_subject_metadata(jsonb),public.save_subject_metadata(jsonb) to authenticated;

revoke all on function public.admin_subject_materials(text,integer),public.admin_subject_questions(text,integer,text,text,uuid),public.manage_subject_import(text,text,uuid,jsonb),public.delete_subject_question(text,text) from public,anon;
revoke all on function private.admin_subject_materials(text,integer),private.admin_subject_questions(text,integer,text,text,uuid),private.manage_subject_import(text,text,uuid,jsonb),private.delete_subject_question(text,text) from public,anon;
grant execute on function public.admin_subject_materials(text,integer),public.admin_subject_questions(text,integer,text,text,uuid),public.manage_subject_import(text,text,uuid,jsonb),public.delete_subject_question(text,text) to authenticated;
grant execute on function private.admin_subject_materials(text,integer),private.admin_subject_questions(text,integer,text,text,uuid),private.manage_subject_import(text,text,uuid,jsonb),private.delete_subject_question(text,text) to authenticated;

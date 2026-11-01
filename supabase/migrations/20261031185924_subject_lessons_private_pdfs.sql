-- Phase 3 Admin-only lesson authoring. No content seeds, student access, commerce,
-- existing exam changes, or automatic Subject publication are introduced.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.lessons (
 id uuid primary key,
 question_bank_id text not null references public.question_banks(id),
 chapter_id uuid not null,
 title text not null check(length(btrim(title)) between 1 and 300),
 description text not null default '' check(length(description)<=5000),
 display_order integer not null default 0 check(display_order between 0 and 100000),
 content_language text not null default 'auto' check(content_language in ('auto','ar','en','mixed')),
 status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','ARCHIVED')),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,question_bank_id),
 foreign key(chapter_id,question_bank_id) references public.bank_chapters(id,question_bank_id)
);
create index lessons_bank_chapter_order_idx on public.lessons(question_bank_id,chapter_id,display_order,id);

create table private.lesson_drafts (
 lesson_id uuid primary key references public.lessons(id),
 content jsonb not null check(jsonb_typeof(content)='object' and octet_length(content::text)<=2500000)
);
create table public.lesson_documents (
 id uuid primary key, lesson_id uuid not null, question_bank_id text not null,
 storage_path text not null unique,
 filename text not null check(length(btrim(filename)) between 1 and 500),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 size_bytes bigint not null check(size_bytes between 1 and 20971520),
 document_role text not null check(document_role in ('ORIGINAL','STUDENT_SAFE')),
 provenance text not null check(length(btrim(provenance)) between 1 and 3000),
 approved_for_students boolean not null default false,
 reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
 uploaded_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 unique(id,lesson_id,question_bank_id),
 foreign key(lesson_id,question_bank_id) references public.lessons(id,question_bank_id),
 check(storage_path=lesson_id::text||'/'||id::text||'.pdf'),
 check(not approved_for_students or (reviewed_by is not null and reviewed_at is not null))
);
create index lesson_documents_lesson_bank_idx on public.lesson_documents(lesson_id,question_bank_id);
create index lesson_documents_bank_idx on public.lesson_documents(question_bank_id);
create index lesson_documents_uploader_idx on public.lesson_documents(uploaded_by);
create index lesson_documents_reviewer_idx on public.lesson_documents(reviewed_by);

create table public.lesson_questions (
 lesson_id uuid not null, question_id text not null, question_bank_id text not null,
 document_id uuid, source_page integer check(source_page between 1 and 200),
 source_number text not null default '' check(length(source_number)<=100),
 position integer not null check(position between 1 and 1000),
 primary key(lesson_id,question_id), unique(lesson_id,position),
 foreign key(lesson_id,question_bank_id) references public.lessons(id,question_bank_id),
 foreign key(question_id,question_bank_id) references public.bank_questions(id,question_bank_id),
 foreign key(document_id,lesson_id,question_bank_id) references public.lesson_documents(id,lesson_id,question_bank_id),
 check(source_page is null or document_id is not null)
);
create index lesson_questions_question_bank_idx on public.lesson_questions(question_id,question_bank_id);
create index lesson_questions_bank_idx on public.lesson_questions(question_bank_id);
create index lesson_questions_document_idx on public.lesson_questions(document_id,lesson_id,question_bank_id);
create table private.lesson_question_owners (
 question_id text primary key references public.bank_questions(id),
 lesson_id uuid not null references public.lessons(id)
);
create index lesson_question_owners_lesson_idx on private.lesson_question_owners(lesson_id);
create table private.lesson_case_owners (
 section_id text primary key references public.question_sections(id),
 lesson_id uuid not null references public.lessons(id)
);
create index lesson_case_owners_lesson_idx on private.lesson_case_owners(lesson_id);
-- Explanations, like keys and unverified extraction drafts, are never catalog data.
-- They survive unlinking, and are lesson-specific even for explicitly reused questions.
create table private.lesson_question_explanations (
 lesson_id uuid not null references public.lessons(id), question_id text not null references public.bank_questions(id),
 explanation text not null check(length(explanation)<=10000), primary key(lesson_id,question_id)
);
create index lesson_question_explanations_question_idx on private.lesson_question_explanations(question_id);

alter table public.lessons enable row level security;
alter table public.lesson_documents enable row level security;
alter table public.lesson_questions enable row level security;
alter table private.lesson_drafts enable row level security;
alter table private.lesson_question_owners enable row level security;
alter table private.lesson_case_owners enable row level security;
alter table private.lesson_question_explanations enable row level security;
revoke all on public.lessons,public.lesson_documents,public.lesson_questions,
 private.lesson_drafts,private.lesson_question_owners,private.lesson_case_owners,private.lesson_question_explanations
 from public,anon,authenticated;
grant select on public.lessons,public.lesson_documents,public.lesson_questions to authenticated;
grant all on public.lessons,public.lesson_documents,public.lesson_questions,
 private.lesson_drafts,private.lesson_question_owners,private.lesson_case_owners,private.lesson_question_explanations to service_role;
create policy lesson_admin_read on public.lessons for select to authenticated using((select private.is_active_role('ADMIN')));
create policy lesson_document_admin_read on public.lesson_documents for select to authenticated using((select private.is_active_role('ADMIN')));
create policy lesson_question_admin_read on public.lesson_questions for select to authenticated using((select private.is_active_role('ADMIN')));
create policy deny_lesson_drafts on private.lesson_drafts for all using(false) with check(false);
create policy deny_lesson_question_owners on private.lesson_question_owners for all using(false) with check(false);
create policy deny_lesson_case_owners on private.lesson_case_owners for all using(false) with check(false);
create policy deny_lesson_explanations on private.lesson_question_explanations for all using(false) with check(false);

-- FK KEY SHARE is insufficient to serialize material-kind changes. A real SHARE
-- lock also protects direct trusted writes; populated materials stay immutable.
create function private.guard_lesson_subject() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.question_banks where id=new.question_bank_id and material_kind='SUBJECT' for share;
 if not found then raise exception 'Subject required' using errcode='23514'; end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.question_bank_id<>old.question_bank_id) then
  raise exception 'Lesson identity is immutable' using errcode='23514'; end if;
 return new;
end $$;
create trigger lesson_subject_guard before insert or update on public.lessons for each row execute function private.guard_lesson_subject();
create function private.guard_lesson_document_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (to_jsonb(new)-array['approved_for_students','reviewed_by','reviewed_at']) is distinct from
    (to_jsonb(old)-array['approved_for_students','reviewed_by','reviewed_at']) then
  raise exception 'Lesson document identity and provenance are immutable' using errcode='23514'; end if;
 return new;
end $$;
create trigger lesson_document_identity before update on public.lesson_documents for each row execute function private.guard_lesson_document_identity();
-- Preserve the existing trigger function OID and every legacy dependency check.
create or replace function private.guard_material_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.material_kind is distinct from old.material_kind and (
  exists(select 1 from public.bank_questions where question_bank_id=old.id)
  or exists(select 1 from public.question_sections where question_bank_id=old.id)
  or exists(select 1 from public.bank_chapters where question_bank_id=old.id)
  or exists(select 1 from public.bank_generation_settings where question_bank_id=old.id)
  or exists(select 1 from public.user_bank_access where question_bank_id=old.id)
  or exists(select 1 from public.user_bank_access_requests where question_bank_id=old.id)
  or exists(select 1 from public.question_attempts where question_bank_id=old.id)
  or exists(select 1 from public.exam_sources where question_bank_id=old.id)
  or exists(select 1 from public.past_exams where question_bank_id=old.id)
  or exists(select 1 from public.shared_exams where question_bank_id=old.id)
  or exists(select 1 from public.teacher_bank_assignments where question_bank_id=old.id)
  or exists(select 1 from public.wallet_transactions where question_bank_id=old.id)
  or exists(select 1 from public.lessons where question_bank_id=old.id)) then
  raise exception 'A populated material cannot change type' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function private.guard_lesson_subject(),private.guard_lesson_document_identity(),private.guard_material_identity() from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('lesson-source-pdfs','lesson-source-pdfs',false,20971520,array['application/pdf']);
create policy lesson_pdf_admin_read on storage.objects for select to authenticated using(
 bucket_id='lesson-source-pdfs' and (select private.is_active_role('ADMIN')));
create policy lesson_pdf_admin_insert on storage.objects for insert to authenticated with check(
 bucket_id='lesson-source-pdfs' and (select private.is_active_role('ADMIN'))
 and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
 and exists(select 1 from public.lessons l where l.id::text=split_part(name,'/',1)));
-- Restrictive policies prevent a pre-existing broad Storage policy from granting
-- students access or permitting replacement/deletion of an original in this bucket.
create policy lesson_pdf_boundary on storage.objects as restrictive for all to authenticated
 using(bucket_id<>'lesson-source-pdfs' or (select private.is_active_role('ADMIN')))
 with check(bucket_id<>'lesson-source-pdfs' or ((select private.is_active_role('ADMIN'))
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  and exists(select 1 from public.lessons l where l.id::text=split_part(name,'/',1))));
create policy lesson_pdf_anon_boundary on storage.objects as restrictive for all to anon
 using(bucket_id<>'lesson-source-pdfs') with check(bucket_id<>'lesson-source-pdfs');
create policy lesson_pdf_no_replace on storage.objects as restrictive for update to authenticated,anon
 using(bucket_id<>'lesson-source-pdfs') with check(bucket_id<>'lesson-source-pdfs');
create policy lesson_pdf_no_delete on storage.objects as restrictive for delete to authenticated,anon using(bucket_id<>'lesson-source-pdfs');

-- Strict JSON boundary helpers are private and have no client EXECUTE privileges.
-- Validation is duplicated at SQL because callers may bypass application schemas.
-- Match JavaScript String.trim, including non-ASCII whitespace. A rationale
-- containing only tabs, line breaks or NBSP is not a reviewed explanation.
create function private.lesson_trim(value text) returns text language sql immutable strict set search_path='' as $$
 select btrim(value,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
$$;
revoke all on function private.lesson_trim(text) from public,anon,authenticated;
create function private.lesson_json_object(value jsonb,keys text[]) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(value)='object' and value ?& keys and (value-keys)='{}'::jsonb,false)
$$;
create function private.lesson_json_string(value jsonb,min_length integer,max_length integer) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(value)='string' and length(value#>>'{}') between min_length and max_length,false)
$$;
create function private.lesson_json_integer(value jsonb,minimum bigint,maximum bigint) returns boolean language sql immutable set search_path='' as $$
 select case when jsonb_typeof(value)='number' and (value#>>'{}') ~ '^[0-9]+$'
  then (value#>>'{}')::numeric between minimum and maximum else false end
$$;
create function private.lesson_json_id(value jsonb,nullable boolean default false) returns boolean language sql immutable set search_path='' as $$
 select coalesce((nullable and value='null'::jsonb) or
  (private.lesson_json_string(value,1,200) and length(private.lesson_trim(value#>>'{}'))>0),false)
$$;
create function private.lesson_json_uuid(value jsonb,nullable boolean default false) returns boolean language sql immutable set search_path='' as $$
 select coalesce((nullable and value='null'::jsonb) or (jsonb_typeof(value)='string'
  and (value#>>'{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),false)
$$;
revoke all on function private.lesson_json_object(jsonb,text[]),private.lesson_json_string(jsonb,integer,integer),
 private.lesson_json_integer(jsonb,bigint,bigint),private.lesson_json_id(jsonb,boolean),private.lesson_json_uuid(jsonb,boolean) from public,anon,authenticated;

-- Serialize initially-absent global question/case IDs across the legacy and
-- lesson authoring flows. Identity locks are always sorted and acquired before
-- material rows; real material row locks still guard type conversion/revisions.
create function private.lock_learning_content_identities(ids text[]) returns void language plpgsql set search_path='' as $$
declare identity text;
begin
 for identity in select distinct value from unnest(ids) value where value is not null order by value loop
  perform pg_advisory_xact_lock(hashtextextended('lhcc-learning-content:'||identity,0));
 end loop;
end $$;
revoke all on function private.lock_learning_content_identities(text[]) from public,anon,authenticated;

-- Close the legacy content editor bypass without changing its OID or any
-- Exam Track behavior. The renamed old implementation remains client-revoked.
create or replace function private.manage_bank_content(operation text,item_id text,payload jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
declare material record; bank_ids text[];
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if operation in ('save_question','delete_question','save_section','delete_section') then
  perform private.lock_learning_content_identities(array[item_id,payload->>'sectionId']);
 end if;
 select array_agg(distinct bank_id) into bank_ids from (
  select payload->>'bankId' as bank_id
  union all select b.question_bank_id from public.bank_questions b where b.id=item_id and operation in ('save_question','delete_question')
  union all select s.question_bank_id from public.question_sections s where s.id=item_id and operation in ('save_section','delete_section')
  union all select s.question_bank_id from public.question_sections s where s.id=payload->>'sectionId'
  union all select item_id where operation in ('save_bank','delete_bank')) targets where bank_id is not null;
 for material in select id,material_kind from public.question_banks where id=any(bank_ids) order by id for share loop
  if material.material_kind='SUBJECT' then raise exception 'Use verified lesson authoring for Subject content' using errcode='23514'; end if;
 end loop;
 if operation='save_bank' and (payload ?| array['materialKind','examCategory','publicationStatus','icon','language','specialtyId']
  or not exists(select 1 from public.question_banks where id=item_id and material_kind='EXAM_TRACK')) then
  raise exception 'Use typed material management' using errcode='23514'; end if;
 perform private.pretyped_manage_bank_content(operation,item_id,payload);
end $$;
revoke all on function private.manage_bank_content(text,text,jsonb) from public,anon;
grant execute on function private.manage_bank_content(text,text,jsonb) to authenticated;

create function private.save_lesson(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare lid uuid; bid text; old_lesson public.lessons; next_revision integer; q jsonb; opt jsonb;
 qid text; cid text; answer text; position integer:=0; seen text[]:='{}'; resolved text[]:='{}'; case_order integer;
 reuse boolean; existing_case public.question_sections;
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if not private.lesson_json_object(payload,array['id','bankId','chapterId','title','description','displayOrder','language','status','expectedRevision','questions'])
  or octet_length(payload::text)>2500000 then raise exception 'Invalid lesson payload' using errcode='23514'; end if;
 if not private.lesson_json_uuid(payload->'id') or not private.lesson_json_id(payload->'bankId')
  or not private.lesson_json_uuid(payload->'chapterId') or not private.lesson_json_string(payload->'title',1,300)
  or nullif(private.lesson_trim(payload->>'title'),'') is null or not private.lesson_json_string(payload->'description',0,5000)
  or not private.lesson_json_integer(payload->'displayOrder',0,100000)
  or not private.lesson_json_integer(payload->'expectedRevision',0,2147483646)
  or coalesce(payload->>'language','') not in ('auto','ar','en','mixed')
  or coalesce(payload->>'status','') not in ('DRAFT','PUBLISHED','ARCHIVED')
  or jsonb_typeof(payload->'questions') is distinct from 'array' then raise exception 'Invalid lesson metadata' using errcode='23514'; end if;
 if jsonb_array_length(payload->'questions')>1000 then raise exception 'Too many lesson questions' using errcode='23514'; end if;
 lid:=(payload->>'id')::uuid; bid:=payload->>'bankId';
 perform private.lock_learning_content_identities((select array_agg(identity) from (
  select coalesce(item.value->>'reuseQuestionId',item.value->>'id') as identity from jsonb_array_elements(payload->'questions') item
  union all select item.value->>'caseId' from jsonb_array_elements(payload->'questions') item) ids));
 -- One lock order across all write RPCs: Subject, lesson, documents/questions/cases.
 -- A row lock, rather than an advisory hash, serializes new IDs and revisions.
 perform 1 from public.question_banks where id=bid and material_kind='SUBJECT' for update;
 if not found then raise exception 'Subject required' using errcode='23514'; end if;
 select * into old_lesson from public.lessons where id=lid for update;
 if found then
  if old_lesson.question_bank_id<>bid then raise exception 'Cannot move a lesson to another Subject' using errcode='23514'; end if;
  if old_lesson.revision<>(payload->>'expectedRevision')::integer then raise exception 'Lesson changed; reload before saving' using errcode='40001'; end if;
  next_revision:=old_lesson.revision+1;
 else
  if (payload->>'expectedRevision')::integer<>0 then raise exception 'Lesson changed; reload before saving' using errcode='40001'; end if;
  next_revision:=1;
 end if;
 perform 1 from public.bank_chapters where id=(payload->>'chapterId')::uuid and question_bank_id=bid for share;
 if not found then raise exception 'Choose a chapter in this Subject' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(payload->'questions') item where item.value->>'caseId' is not null
  group by item.value->>'caseId' having count(distinct jsonb_build_array(item.value->'caseTitle',item.value->'caseDescription'))>1) then
  raise exception 'Questions sharing a case ID must use identical reviewed case metadata' using errcode='23514'; end if;
 -- Validate drafts as well as publications, without activating any draft question.
 for q in select value from jsonb_array_elements(payload->'questions') loop
  if not private.lesson_json_object(q,array['id','reuseQuestionId','duplicateReviewed','sourceNumber','text','options','correctOptionId','verified','includeInBank','caseId','caseTitle','caseDescription','warnings','explanation','documentId','sourcePage'])
   or not private.lesson_json_id(q->'id') or not private.lesson_json_id(q->'reuseQuestionId',true)
   or jsonb_typeof(q->'duplicateReviewed') is distinct from 'boolean' or jsonb_typeof(q->'verified') is distinct from 'boolean'
   or jsonb_typeof(q->'includeInBank') is distinct from 'boolean'
   or not private.lesson_json_string(q->'sourceNumber',0,100) or not private.lesson_json_string(q->'text',0,10000)
   or not private.lesson_json_id(q->'correctOptionId',true) or not private.lesson_json_id(q->'caseId',true)
   or not private.lesson_json_string(q->'caseTitle',0,500) or not private.lesson_json_string(q->'caseDescription',0,10000)
   or not private.lesson_json_string(q->'explanation',0,10000) or not private.lesson_json_uuid(q->'documentId',true)
   or not (q->'sourcePage'='null'::jsonb or private.lesson_json_integer(q->'sourcePage',1,200))
   or jsonb_typeof(q->'options') is distinct from 'array' or jsonb_typeof(q->'warnings') is distinct from 'array'
   then raise exception 'Invalid lesson question' using errcode='23514'; end if;
  if jsonb_array_length(q->'options')>10 or jsonb_array_length(q->'warnings')>20
   or exists(select 1 from jsonb_array_elements(q->'warnings') w where not private.lesson_json_string(w,0,500))
   then raise exception 'Invalid question options or warnings' using errcode='23514'; end if;
  for opt in select value from jsonb_array_elements(q->'options') loop
   if not private.lesson_json_object(opt,array['id','text']) or not private.lesson_json_id(opt->'id')
    or not private.lesson_json_string(opt->'text',0,3000) then raise exception 'Invalid option' using errcode='23514'; end if;
  end loop;
  if (select count(distinct o->>'id') from jsonb_array_elements(q->'options') o)<>jsonb_array_length(q->'options') then
   raise exception 'Option IDs must be unique' using errcode='23514'; end if;
  if q->>'id'=any(seen) then raise exception 'Question IDs must be unique' using errcode='23514'; end if;
  seen:=array_append(seen,q->>'id'); qid:=coalesce(q->>'reuseQuestionId',q->>'id');
  if qid=any(resolved) then raise exception 'Duplicate question association' using errcode='23514'; end if;
  resolved:=array_append(resolved,qid);
  if q->>'documentId' is not null then
   perform 1 from public.lesson_documents where id=(q->>'documentId')::uuid and lesson_id=lid and question_bank_id=bid for share;
   if not found then raise exception 'Document must belong to this lesson' using errcode='23514'; end if;
  elsif q->>'sourcePage' is not null then raise exception 'Source page requires a document' using errcode='23514'; end if;
  if (q->>'verified')::boolean or payload->>'status'='PUBLISHED' then
   if not (q->>'verified')::boolean or nullif(private.lesson_trim(q->>'text'),'') is null or jsonb_array_length(q->'options')<2
    or not exists(select 1 from jsonb_array_elements(q->'options') o where o->>'id'=q->>'correctOptionId')
    or exists(select 1 from jsonb_array_elements(q->'options') o where nullif(private.lesson_trim(o->>'text'),'') is null)
    or (nullif(private.lesson_trim(q->>'caseTitle'),'') is null)<>(nullif(private.lesson_trim(q->>'caseDescription'),'') is null)
    or (q->>'caseId' is null and (nullif(q->>'caseTitle','') is not null or nullif(q->>'caseDescription','') is not null))
    or (q->>'caseId' is not null and nullif(private.lesson_trim(q->>'caseTitle'),'') is null)
    or (payload->>'status'='PUBLISHED' and (jsonb_array_length(q->'warnings')<>0 or nullif(private.lesson_trim(q->>'explanation'),'') is null))
    then raise exception 'Verify complete questions, cases and keys and resolve publication warnings' using errcode='23514'; end if;
  end if;
  -- IDs are checked even for drafts; a draft must not imply cross-Subject reuse.
  if q->>'reuseQuestionId' is not null then
   perform 1 from public.bank_questions where id=qid and question_bank_id=bid and status='active' for share;
   if not found then raise exception 'Reuse requires an active question in this Subject' using errcode='23514'; end if;
  elsif exists(select 1 from public.bank_questions where id=qid) and not exists(
   select 1 from private.lesson_question_owners where question_id=qid and lesson_id=lid) then
   raise exception 'Use explicit reuse for existing questions' using errcode='23514'; end if;
  if q->>'caseId' is not null and exists(select 1 from public.question_sections where id=q->>'caseId' and question_bank_id<>bid) then
   raise exception 'Case belongs to another Subject' using errcode='23514'; end if;
 end loop;
 if payload->>'status'='PUBLISHED' and jsonb_array_length(payload->'questions')=0 then
  perform 1 from public.lesson_documents where lesson_id=lid and question_bank_id=bid and approved_for_students for share;
  if not found then raise exception 'Reading-only lessons require an explicitly approved PDF' using errcode='23514'; end if;
 end if;
 insert into public.lessons(id,question_bank_id,chapter_id,title,description,display_order,content_language,status,revision)
 values(lid,bid,(payload->>'chapterId')::uuid,private.lesson_trim(payload->>'title'),payload->>'description',(payload->>'displayOrder')::integer,
  payload->>'language',payload->>'status',next_revision)
 on conflict(id) do update set chapter_id=excluded.chapter_id,title=excluded.title,description=excluded.description,
  display_order=excluded.display_order,content_language=excluded.content_language,status=excluded.status,revision=excluded.revision,updated_at=now()
 where public.lessons.question_bank_id=bid and public.lessons.revision=(payload->>'expectedRevision')::integer;
 if not found then
  if exists(select 1 from public.lessons where id=lid and question_bank_id<>bid) then
   raise exception 'Lesson identity was concurrently claimed by another Subject' using errcode='23514'; end if;
  raise exception 'Lesson changed; reload before saving' using errcode='40001';
 end if;
 if payload->>'status'='PUBLISHED' then
  -- Unlinking never deletes canonical questions, cases, keys, explanations or attempts.
  delete from public.lesson_questions where lesson_id=lid;
  for q in select value from jsonb_array_elements(payload->'questions') loop
   position:=position+1; qid:=coalesce(q->>'reuseQuestionId',q->>'id'); cid:=q->>'caseId'; answer:=q->>'correctOptionId'; reuse:=q->>'reuseQuestionId' is not null;
   if reuse then
    -- Never mutate the original question, its key or its clinical case on reuse.
    perform 1 from public.bank_questions b join private.question_solutions s on s.question_id=b.id
     left join public.question_sections c on c.id=b.section_id
     where b.id=qid and b.question_bank_id=bid and b.status='active' and b.text=q->>'text' and b.options=q->'options'
      and s.correct_option_id=answer and b.section_id is not distinct from cid
      and coalesce(c.title,'')=q->>'caseTitle' and coalesce(c.description,'')=q->>'caseDescription' for share of b,s;
    if not found then raise exception 'Reused question, key and case must match the approved original' using errcode='23514'; end if;
   else
    -- Ownership permits correction only while this canonical question is not
    -- reused elsewhere. Otherwise an owner edit would silently alter another
    -- lesson's reviewed content/key/case. Explanation remains lesson-specific.
    if exists(select 1 from public.lesson_questions where question_id=qid and lesson_id<>lid)
     and not exists(select 1 from public.bank_questions b join private.question_solutions s on s.question_id=b.id
      where b.id=qid and b.question_bank_id=bid and b.text=q->>'text' and b.options=q->'options'
       and b.section_id is not distinct from cid and s.correct_option_id=answer) then
     raise exception 'A question reused by another lesson must remain unchanged; create a distinct reviewed question' using errcode='23514'; end if;
    if not (q->>'duplicateReviewed')::boolean and exists(select 1 from public.bank_questions
     where question_bank_id=bid and id<>qid and lower(btrim(text))=lower(btrim(q->>'text'))) then
     raise exception 'Review duplicates: explicitly reuse or confirm a distinct record' using errcode='23514'; end if;
    if cid is not null then
     select * into existing_case from public.question_sections where id=cid for update;
     if not found then
      select coalesce(max(display_order),0)+1 into case_order from public.question_sections where question_bank_id=bid;
      insert into public.question_sections(id,question_bank_id,title,description,display_order)
       values(cid,bid,q->>'caseTitle',q->>'caseDescription',case_order);
      insert into private.lesson_case_owners(section_id,lesson_id) values(cid,lid);
     elsif existing_case.question_bank_id<>bid then
      raise exception 'Case belongs to another Subject' using errcode='23514';
     elsif existing_case.title<>q->>'caseTitle' or existing_case.description<>q->>'caseDescription' then
      if not exists(select 1 from private.lesson_case_owners where section_id=cid and lesson_id=lid)
       or exists(select 1 from public.bank_questions b where b.section_id=cid and not exists(
        select 1 from private.lesson_question_owners o where o.question_id=b.id and o.lesson_id=lid))
       or exists(select 1 from public.lesson_questions lq join public.bank_questions b on b.id=lq.question_id where b.section_id=cid and lq.lesson_id<>lid) then
       raise exception 'Existing or reused cases must be preserved' using errcode='23514'; end if;
      update public.question_sections set title=q->>'caseTitle',description=q->>'caseDescription',updated_at=now() where id=cid;
     end if;
    end if;
    -- Subject questions cannot be enrolled into any legacy exam pool by this flow.
    insert into public.bank_questions(id,question_bank_id,text,status,options,section_id,display_order,include_in_complete_bank)
     values(qid,bid,q->>'text','active',q->'options',cid,position,false)
     on conflict(id) do update set text=excluded.text,options=excluded.options,section_id=excluded.section_id,
      include_in_complete_bank=false,updated_at=now()
     where public.bank_questions.question_bank_id=bid and exists(
      select 1 from private.lesson_question_owners owner where owner.question_id=qid and owner.lesson_id=lid);
    if not found then raise exception 'Question identity was concurrently claimed; use explicit reuse' using errcode='23514'; end if;
    insert into private.question_solutions(question_id,correct_option_id) values(qid,answer)
     on conflict(question_id) do update set correct_option_id=excluded.correct_option_id;
    insert into private.lesson_question_owners(question_id,lesson_id) values(qid,lid) on conflict(question_id) do nothing;
   end if;
   insert into public.lesson_questions(lesson_id,question_id,question_bank_id,document_id,source_page,source_number,position)
    values(lid,qid,bid,(q->>'documentId')::uuid,(q->>'sourcePage')::integer,q->>'sourceNumber',position);
   insert into private.lesson_question_explanations(lesson_id,question_id,explanation) values(lid,qid,q->>'explanation')
    on conflict(lesson_id,question_id) do update set explanation=excluded.explanation;
  end loop;
 end if;
 -- Return the revision that the next edit must submit, not the just-consumed token.
 insert into private.lesson_drafts(lesson_id,content) values(lid,payload||jsonb_build_object('expectedRevision',next_revision))
  on conflict(lesson_id) do update set content=excluded.content;
 return jsonb_build_object('id',lid,'revision',next_revision);
end $$;

create function private.register_lesson_document(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare did uuid; lid uuid; bid text; object_metadata jsonb; object_size numeric;
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if not private.lesson_json_object(payload,array['id','lessonId','filename','storagePath','sha256','sizeBytes','documentRole','provenance'])
  or not private.lesson_json_uuid(payload->'id') or not private.lesson_json_uuid(payload->'lessonId')
  or not private.lesson_json_string(payload->'filename',1,500) or nullif(private.lesson_trim(payload->>'filename'),'') is null
  or not private.lesson_json_string(payload->'storagePath',1,300) or coalesce(payload->>'sha256','') !~ '^[a-f0-9]{64}$'
  or not private.lesson_json_integer(payload->'sizeBytes',1,20971520)
  or coalesce(payload->>'documentRole','') not in ('ORIGINAL','STUDENT_SAFE')
  or not private.lesson_json_string(payload->'provenance',1,3000) or nullif(private.lesson_trim(payload->>'provenance'),'') is null
  then raise exception 'Invalid lesson document' using errcode='23514'; end if;
 did:=(payload->>'id')::uuid; lid:=(payload->>'lessonId')::uuid;
 if payload->>'storagePath'<>lid::text||'/'||did::text||'.pdf' then raise exception 'Invalid document path' using errcode='23514'; end if;
 select question_bank_id into bid from public.lessons where id=lid;
 perform 1 from public.question_banks where id=bid and material_kind='SUBJECT' for update;
 if not found then raise exception 'Subject lesson required' using errcode='23514'; end if;
 perform 1 from public.lessons where id=lid and question_bank_id=bid for update;
 if not found then raise exception 'Lesson not found' using errcode='23514'; end if;
 select metadata into object_metadata from storage.objects where bucket_id='lesson-source-pdfs' and name=payload->>'storagePath' for share;
 if not found then raise exception 'Upload the private PDF first' using errcode='23514'; end if;
 if coalesce(object_metadata->>'size','') !~ '^[0-9]+$' or coalesce(object_metadata->>'mimetype','')<>'application/pdf' then
  raise exception 'Uploaded object must have a PDF MIME type and verified size' using errcode='23514'; end if;
 object_size:=(object_metadata->>'size')::numeric;
 if object_size<>(payload->>'sizeBytes')::bigint or object_size not between 1 and 20971520 then
  raise exception 'Uploaded object size does not match' using errcode='23514'; end if;
 insert into public.lesson_documents(id,lesson_id,question_bank_id,storage_path,filename,sha256,size_bytes,document_role,provenance,uploaded_by)
  values(did,lid,bid,payload->>'storagePath',private.lesson_trim(payload->>'filename'),payload->>'sha256',(payload->>'sizeBytes')::bigint,
   payload->>'documentRole',private.lesson_trim(payload->>'provenance'),auth.uid());
 return did;
end $$;

create function private.approve_lesson_document(document_id uuid,approved boolean) returns void language plpgsql security definer set search_path='' as $$
declare doc public.lesson_documents;
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if document_id is null or approved is null then raise exception 'Document and review decision required' using errcode='23514'; end if;
 select * into doc from public.lesson_documents where id=document_id;
 if not found then raise exception 'Document not found' using errcode='23514'; end if;
 perform 1 from public.question_banks where id=doc.question_bank_id and material_kind='SUBJECT' for update;
 if not found then raise exception 'Subject required' using errcode='23514'; end if;
 perform 1 from public.lessons where id=doc.lesson_id for update;
 perform 1 from public.lesson_documents where id=document_id for update;
 if not approved and exists(select 1 from public.lessons l where l.id=doc.lesson_id and l.status='PUBLISHED')
  and not exists(select 1 from public.lesson_questions where lesson_id=doc.lesson_id)
  and not exists(select 1 from public.lesson_documents where lesson_id=doc.lesson_id and id<>document_id and approved_for_students) then
  raise exception 'Unpublish the reading-only lesson or approve another PDF first' using errcode='23514'; end if;
 update public.lesson_documents set approved_for_students=approved,reviewed_by=auth.uid(),reviewed_at=now() where id=document_id;
end $$;

create function private.admin_subject_lessons(bank_id text,lesson_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if not exists(select 1 from public.question_banks where id=bank_id and material_kind='SUBJECT') then
  raise exception 'Subject required' using errcode='23514'; end if;
 if lesson_id is not null and not exists(select 1 from public.lessons l where l.id=lesson_id and l.question_bank_id=bank_id) then
  raise exception 'Lesson not found in this Subject' using errcode='23514'; end if;
 return jsonb_build_object(
  'bank',(select jsonb_build_object('id',b.id,'name',b.name,'specialtyName',s.name,'icon',b.material_icon,'language',b.content_language)
   from public.question_banks b left join public.specialties s on s.id=b.specialty_id where b.id=bank_id),
  'chapters',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'description',c.description,'displayOrder',c.display_order,'published',c.published)
   order by c.display_order,c.id) from public.bank_chapters c where c.question_bank_id=bank_id),'[]'::jsonb),
  'lessons',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'chapterId',l.chapter_id,'title',l.title,'description',l.description,
   'displayOrder',l.display_order,'language',l.content_language,'status',l.status,'revision',l.revision,
   'questionCount',coalesce(jsonb_array_length(d.content->'questions'),0)) order by l.display_order,l.id)
   from public.lessons l left join private.lesson_drafts d on d.lesson_id=l.id where l.question_bank_id=bank_id),'[]'::jsonb),
  'draft',(select d.content from private.lesson_drafts d join public.lessons l on l.id=d.lesson_id where l.id=$2 and l.question_bank_id=$1),
  'documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'lessonId',d.lesson_id,'filename',d.filename,'sha256',d.sha256,
   'documentRole',d.document_role,'approvedForStudents',d.approved_for_students,'provenance',d.provenance,'createdAt',d.created_at)
   order by d.created_at,d.id) from public.lesson_documents d where d.question_bank_id=$1 and d.lesson_id=$2),'[]'::jsonb));
end $$;

create function public.save_lesson(payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.save_lesson(payload) $$;
create function public.register_lesson_document(payload jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.register_lesson_document(payload) $$;
create function public.approve_lesson_document(document_id uuid,approved boolean) returns void language sql security invoker set search_path='' as $$ select private.approve_lesson_document(document_id,approved) $$;
create function public.admin_subject_lessons(bank_id text,lesson_id uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$ select private.admin_subject_lessons(bank_id,lesson_id) $$;
revoke all on function private.save_lesson(jsonb),public.save_lesson(jsonb),private.register_lesson_document(jsonb),public.register_lesson_document(jsonb),
 private.approve_lesson_document(uuid,boolean),public.approve_lesson_document(uuid,boolean),private.admin_subject_lessons(text,uuid),public.admin_subject_lessons(text,uuid)
 from public,anon,authenticated;
grant execute on function private.save_lesson(jsonb),public.save_lesson(jsonb),private.register_lesson_document(jsonb),public.register_lesson_document(jsonb),
 private.approve_lesson_document(uuid,boolean),public.approve_lesson_document(uuid,boolean),private.admin_subject_lessons(text,uuid),public.admin_subject_lessons(text,uuid)
 to authenticated;

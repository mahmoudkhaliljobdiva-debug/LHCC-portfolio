-- Isolated local rollback-only tests. No production data or real PDF fixture.
begin;
-- Local metadata-only rollback fixtures; permit the DELETE statement so the
-- actual restrictive RLS policy (not Storage's statement guard) is exercised.
set local storage.allow_delete_query = 'true';
create temp table lesson_checks(label text);
grant select,insert on lesson_checks to authenticated,anon;
create function pg_temp.assert_lesson(ok boolean,label text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL %',label; end if;
 insert into lesson_checks values(label); end $$;
create function pg_temp.deny_lesson(command text,label text,expected_state text default null) returns void language plpgsql as $$ begin
 begin execute command; exception when others then
  if (expected_state is null and sqlstate in ('42501','23514','23503','23505','40001')) or sqlstate=expected_state then
   perform pg_temp.assert_lesson(true,label); return; end if; raise;
 end; raise exception 'Expected denial %',label; end $$;
create function pg_temp.lesson_question(qid text) returns jsonb language sql as $$
 select jsonb_build_object('id',qid,'reuseQuestionId',null,'duplicateReviewed',true,'sourceNumber','1','text','[TEST] Reviewed question',
  'options',jsonb_build_array(jsonb_build_object('id','a','text','[TEST] First'),jsonb_build_object('id','b','text','[TEST] Second')),
  'correctOptionId','a','verified',true,'includeInBank',true,'caseId',null,'caseTitle','','caseDescription','',
  'warnings','[]'::jsonb,'explanation','[TEST] Private explanation','documentId',null,'sourcePage',null) $$;
create function pg_temp.lesson_payload(lid uuid,revision integer,questions jsonb default '[]',status text default 'DRAFT') returns jsonb language sql as $$
 select jsonb_build_object('id',lid,'bankId',current_setting('lt.subject'),'chapterId',current_setting('lt.chapter'),
  'title','[TEST] Lesson','description','Rollback-only lesson','displayOrder',0,'language','mixed','status',status,
  'expectedRevision',revision,'questions',questions) $$;
create function pg_temp.lesson_document(did uuid,lid uuid) returns jsonb language sql as $$
 select jsonb_build_object('id',did,'lessonId',lid,'filename','[TEST] Private.pdf','storagePath',lid::text||'/'||did::text||'.pdf',
  'sha256',repeat('a',64),'sizeBytes',1024,'documentRole','ORIGINAL','provenance','[TEST] Authorized rollback fixture') $$;
create function pg_temp.legacy_lesson_question(bid text) returns jsonb language sql as $$
 select jsonb_build_object('bankId',bid,'text','[TEST] Legacy attempt','status','active','sectionId',null,'displayOrder',1,
  'answers',jsonb_build_array(jsonb_build_object('id','a','text','[TEST] First','isCorrect',true),jsonb_build_object('id','b','text','[TEST] Second','isCorrect',false))) $$;
select set_config('lt.admin',(select id::text from public.profiles where role='ADMIN' and status='ACTIVE' limit 1),true),
 set_config('lt.student',gen_random_uuid()::text,true),set_config('lt.teacher',gen_random_uuid()::text,true),
 set_config('lt.disabled',gen_random_uuid()::text,true),set_config('lt.specialty',gen_random_uuid()::text,true),
 set_config('lt.subject','lt-subject-'||gen_random_uuid(),true),set_config('lt.other','lt-other-'||gen_random_uuid(),true),
 set_config('lt.track','lt-track-'||gen_random_uuid(),true),set_config('lt.chapter',gen_random_uuid()::text,true),
 set_config('lt.otherChapter',gen_random_uuid()::text,true),set_config('lt.lesson',gen_random_uuid()::text,true),
 set_config('lt.reading',gen_random_uuid()::text,true),set_config('lt.reuse',gen_random_uuid()::text,true),
 set_config('lt.otherLesson',gen_random_uuid()::text,true),set_config('lt.document',gen_random_uuid()::text,true),
 set_config('lt.derivative',gen_random_uuid()::text,true),set_config('lt.otherDocument',gen_random_uuid()::text,true),
 set_config('lt.q','lt-question-'||gen_random_uuid(),true),set_config('lt.otherq','lt-other-question-'||gen_random_uuid(),true),
 set_config('lt.case','lt-case-'||gen_random_uuid(),true);
select pg_temp.assert_lesson(current_setting('lt.admin')<>'','active local Admin fixture exists');
insert into auth.users(id,email,raw_user_meta_data)
 select current_setting('lt.'||v)::uuid,current_setting('lt.'||v)||'@example.invalid','{"full_name":"Lesson rollback","role":"ADMIN"}'
 from unnest(array['student','teacher','disabled'])v;
update public.profiles set status='ACTIVE' where id in(current_setting('lt.student')::uuid,current_setting('lt.teacher')::uuid);
update public.profiles set role='TEACHER',activation_start=now(),activation_months=1,expiration_date=now()+interval '1 month'
 where id=current_setting('lt.teacher')::uuid;
update public.profiles set role='ADMIN',status='INACTIVE' where id=current_setting('lt.disabled')::uuid;
insert into public.specialties(id,slug,name,icon,published)
 values(current_setting('lt.specialty')::uuid,'test-'||current_setting('lt.specialty'),'[TEST] Lesson specialty','other',false);
insert into public.question_banks(id,name,description,specialty_id,material_kind,exam_category,status,publication_status,price)
 select current_setting('lt.'||v),'[TEST] Subject','Rollback fixture',current_setting('lt.specialty')::uuid,'SUBJECT',null,'inactive','DRAFT',0
 from unnest(array['subject','other'])v;
insert into public.question_banks(id,name,description,status) values(current_setting('lt.track'),'[TEST] Track','Rollback fixture','active');
insert into public.bank_chapters(id,question_bank_id,title) values
 (current_setting('lt.chapter')::uuid,current_setting('lt.subject'),'[TEST] Chapter'),
 (current_setting('lt.otherChapter')::uuid,current_setting('lt.other'),'[TEST] Other chapter');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('lt.admin'),'role','authenticated')::text,true);
select pg_temp.deny_lesson($q$select public.save_lesson('[]')$q$,'non-object lesson rejected','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0)||'{"extra":true}')$q$,'unknown lesson key rejected','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0)-'description')$q$,'missing lesson key rejected','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0)||'{"expectedRevision":"0"}')$q$,'string revision rejected','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0)||'{"displayOrder":1.1}')$q$,'fractional order rejected','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0)||'{"displayOrder":100001}')$q$,'excessive order rejected','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0)||'{"title":" "}')$q$,'blank lesson title rejected','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0)||jsonb_build_object('title',E'\t\n'||chr(160)))$q$,'non-ASCII and newline blank title rejected','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0)||'{"language":"fr"}')$q$,'invalid language rejected','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0)||'{"status":"active"}')$q$,'invalid lesson status rejected','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0)||jsonb_build_object('bankId',current_setting('lt.track')))$q$,'exam track cannot host lesson','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0)||jsonb_build_object('chapterId',current_setting('lt.otherChapter')))$q$,'cross-Subject chapter rejected','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),1))$q$,'new lesson stale revision rejected','40001');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0,'[]','PUBLISHED'))$q$,'reading-only lesson needs reviewed PDF','23514');
select pg_temp.deny_lesson($q$select public.manage_bank_content('save_question','new-subject-question',pg_temp.legacy_lesson_question(current_setting('lt.subject')))$q$,'public legacy editor cannot create unverified Subject question','23514');
select pg_temp.deny_lesson($q$select private.manage_bank_content('save_question','new-private-subject-question',pg_temp.legacy_lesson_question(current_setting('lt.subject')))$q$,'private legacy editor cannot bypass lesson verification','23514');
select pg_temp.deny_lesson($q$select public.manage_bank_content('save_section','new-subject-case',jsonb_build_object('bankId',current_setting('lt.subject'),'title','[TEST] Case','description','[TEST] Case description'))$q$,'legacy editor cannot create Subject case','23514');
select pg_temp.deny_lesson($q$select public.manage_bank_content('delete_bank',current_setting('lt.subject'))$q$,'legacy editor cannot delete Subject backing pool','23514');
select set_config('lt.saved',public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,0,
 jsonb_build_array(pg_temp.lesson_question(current_setting('lt.q'))||'{"verified":false,"correctOptionId":null,"warnings":["Review source"]}')))::text,true);
select pg_temp.assert_lesson(current_setting('lt.saved')::jsonb=jsonb_build_object('id',current_setting('lt.lesson'),'revision',1),'save returns exact id and revision');
select pg_temp.assert_lesson(public.admin_subject_lessons(current_setting('lt.subject'),current_setting('lt.lesson')::uuid)->'draft'->>'expectedRevision'='1','returned draft has current optimistic token');
select pg_temp.assert_lesson((select status='DRAFT' and revision=1 from public.lessons where id=current_setting('lt.lesson')::uuid),'draft metadata persisted');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,0))$q$,'stale update rejected exactly','40001');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1)||jsonb_build_object('bankId',current_setting('lt.other'),'chapterId',current_setting('lt.otherChapter')))$q$,'existing lesson cannot move Subject','23514');
reset role;
select pg_temp.assert_lesson(not exists(select 1 from public.bank_questions where id=current_setting('lt.q')),'draft never writes active canonical question');
select pg_temp.assert_lesson((select content->'questions'->0->>'correctOptionId' is null from private.lesson_drafts where lesson_id=current_setting('lt.lesson')::uuid),'unverified draft retains private missing key');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('lt.admin'),'role','authenticated')::text,true);
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('x')||'{"unknown":true}')))$q$,'unknown question key rejected','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('x')||'{"verified":"true"}')))$q$,'non-boolean verification rejected','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('x'),pg_temp.lesson_question('x'))))$q$,'duplicate draft question IDs rejected','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('x')||'{"options":[{"id":"a","text":"A"},{"id":"a","text":"B"}]}')))$q$,'duplicate option IDs rejected','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('x')||'{"correctOptionId":"missing"}')))$q$,'verified question requires valid answer key','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('x')||'{"sourcePage":201}')))$q$,'maximum 200 source pages enforced','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('x')||'{"sourcePage":1}')))$q$,'page requires document','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,(select jsonb_agg(pg_temp.lesson_question('x'||v)) from generate_series(1,1001)v)))$q$,'maximum 1000 questions enforced','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,(select jsonb_agg(pg_temp.lesson_question('large'||v)||jsonb_build_object('explanation',repeat('x',10000))) from generate_series(1,260)v)))$q$,'maximum 2.5MB payload enforced','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('x')||'{"warnings":["Review"]}'),'PUBLISHED'))$q$,'publication warnings denied','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('x')||'{"verified":false}'),'PUBLISHED'))$q$,'publication unverified questions denied','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('x')||'{"explanation":""}'),'PUBLISHED'))$q$,'published question requires explanation of correct answer','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('x')||'{"explanation":"   "}'),'PUBLISHED'))$q$,'whitespace explanation cannot publish','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('x')||jsonb_build_object('explanation',E'\t\n\r')),'PUBLISHED'))$q$,'tab and newline explanation cannot publish','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('x')||jsonb_build_object('explanation',chr(160)||chr(65279))),'PUBLISHED'))$q$,'NBSP and BOM explanation cannot publish','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('x')||jsonb_build_object('text',E'\t\n')),'PUBLISHED'))$q$,'verified question cannot contain whitespace text only','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('x')||jsonb_build_object('options',jsonb_build_array(jsonb_build_object('id','a','text',chr(160)),jsonb_build_object('id','b','text','Second')))),'PUBLISHED'))$q$,'verified option cannot contain whitespace text only','23514');
select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0,jsonb_build_array(pg_temp.lesson_question('empty-explanation-draft')||'{"explanation":""}')));
select pg_temp.assert_lesson(exists(select 1 from public.lessons where question_bank_id=current_setting('lt.subject') and revision=1 and status='DRAFT'),'draft may retain unanswered explanation for manual review');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,jsonb_build_array(
 pg_temp.lesson_question('same-case-a')||jsonb_build_object('caseId',current_setting('lt.case'),'caseTitle','[TEST] First case','caseDescription','[TEST] Case text'),
 pg_temp.lesson_question('same-case-b')||jsonb_build_object('caseId',current_setting('lt.case'),'caseTitle','[TEST] Different case','caseDescription','[TEST] Case text')),'PUBLISHED'))$q$,'same case ID cannot have inconsistent reviewed metadata','23514');
select pg_temp.deny_lesson($q$select public.register_lesson_document(pg_temp.lesson_document(current_setting('lt.document')::uuid,current_setting('lt.lesson')::uuid))$q$,'register requires uploaded object','23514');
select pg_temp.deny_lesson($q$select public.register_lesson_document(pg_temp.lesson_document(gen_random_uuid(),current_setting('lt.lesson')::uuid)||'{"approvedForStudents":true}')$q$,'registration cannot self-approve document','23514');
select pg_temp.deny_lesson($q$select public.register_lesson_document(pg_temp.lesson_document(gen_random_uuid(),current_setting('lt.lesson')::uuid)||'{"storagePath":"../escape.pdf"}')$q$,'document traversal path denied','23514');
select pg_temp.deny_lesson($q$select public.register_lesson_document(pg_temp.lesson_document(gen_random_uuid(),current_setting('lt.lesson')::uuid)||'{"sizeBytes":20971521}')$q$,'20MB document limit enforced','23514');
select pg_temp.deny_lesson($q$select public.register_lesson_document(pg_temp.lesson_document(gen_random_uuid(),current_setting('lt.lesson')::uuid)||'{"sha256":"bad"}')$q$,'document SHA format enforced','23514');
select pg_temp.deny_lesson($q$select public.register_lesson_document(pg_temp.lesson_document(gen_random_uuid(),current_setting('lt.lesson')::uuid)||'{"provenance":" "}')$q$,'document provenance required','23514');
select pg_temp.deny_lesson($q$select public.register_lesson_document(pg_temp.lesson_document(gen_random_uuid(),current_setting('lt.lesson')::uuid)||jsonb_build_object('filename',E'\t\n'||chr(160)))$q$,'PDF filename cannot contain whitespace only','23514');
select pg_temp.deny_lesson($q$select public.register_lesson_document(pg_temp.lesson_document(gen_random_uuid(),current_setting('lt.lesson')::uuid)||jsonb_build_object('provenance',E'\t\n'||chr(160)))$q$,'PDF provenance cannot contain whitespace only','23514');
insert into storage.objects(bucket_id,name,metadata) values('lesson-source-pdfs',current_setting('lt.lesson')||'/'||current_setting('lt.document')||'.pdf','{"size":1024,"mimetype":"application/pdf"}');
select public.register_lesson_document(pg_temp.lesson_document(current_setting('lt.document')::uuid,current_setting('lt.lesson')::uuid));
select pg_temp.assert_lesson((select not approved_for_students and reviewed_by is null and document_role='ORIGINAL' from public.lesson_documents where id=current_setting('lt.document')::uuid),'original private and unapproved by default');
select pg_temp.deny_lesson($q$select public.register_lesson_document(pg_temp.lesson_document(current_setting('lt.document')::uuid,current_setting('lt.lesson')::uuid))$q$,'duplicate registration does not overwrite immutable document','23505');
select pg_temp.assert_lesson(not (public.admin_subject_lessons(current_setting('lt.subject'),current_setting('lt.lesson')::uuid)->'documents'->0 ?| array['storagePath','url','signedUrl','correctOptionId','explanation']),'admin document metadata has no URL or key fields');
select pg_temp.assert_lesson(public.admin_subject_lessons(current_setting('lt.subject'))->'draft'='null'::jsonb and public.admin_subject_lessons(current_setting('lt.subject'))->'documents'='[]'::jsonb,'unselected list omits draft and documents');
select pg_temp.deny_lesson($q$select public.admin_subject_lessons(current_setting('lt.track'))$q$,'admin list requires Subject','23514');
select pg_temp.deny_lesson($q$select public.admin_subject_lessons(current_setting('lt.other'),current_setting('lt.lesson')::uuid)$q$,'admin list rejects cross-Subject lesson','23514');
select pg_temp.deny_lesson($q$insert into public.lesson_documents(id,lesson_id,question_bank_id,storage_path,filename,sha256,size_bytes,document_role,provenance,uploaded_by) values(gen_random_uuid(),current_setting('lt.lesson')::uuid,current_setting('lt.subject'),'bypass','x',repeat('a',64),1,'ORIGINAL','x',current_setting('lt.admin')::uuid)$q$,'Admin direct document insert denied','42501');
select pg_temp.deny_lesson($q$update public.lesson_documents set approved_for_students=true where id=current_setting('lt.document')::uuid$q$,'Admin direct document approval denied','42501');
select pg_temp.deny_lesson($q$insert into public.lessons(id,question_bank_id,chapter_id,title) values(gen_random_uuid(),current_setting('lt.subject'),current_setting('lt.chapter')::uuid,'bypass')$q$,'Admin direct lesson insert denied','42501');
select pg_temp.deny_lesson($q$insert into storage.objects(bucket_id,name,metadata) values('lesson-source-pdfs','../bad.pdf','{}')$q$,'storage upload rejects non-UUID lesson/document path','42501');
select pg_temp.assert_lesson((select count(*)=1 from storage.objects where bucket_id='lesson-source-pdfs' and name like current_setting('lt.lesson')||'/%'),'Admin can read private upload');
with changed as (update storage.objects set metadata='{}' where bucket_id='lesson-source-pdfs' and name=current_setting('lt.lesson')||'/'||current_setting('lt.document')||'.pdf' returning 1)
 select pg_temp.assert_lesson(not exists(select 1 from changed),'Admin cannot overwrite source PDF');
with removed as (delete from storage.objects where bucket_id='lesson-source-pdfs' and name=current_setting('lt.lesson')||'/'||current_setting('lt.document')||'.pdf' returning 1)
 select pg_temp.assert_lesson(not exists(select 1 from removed),'Admin cannot delete source PDF');
select public.approve_lesson_document(current_setting('lt.document')::uuid,true);
select pg_temp.assert_lesson((select approved_for_students and reviewed_by=current_setting('lt.admin')::uuid and reviewed_at is not null from public.lesson_documents where id=current_setting('lt.document')::uuid),'explicit original review records Admin and timestamp');
select public.approve_lesson_document(current_setting('lt.document')::uuid,false);
select pg_temp.assert_lesson((select not approved_for_students from public.lesson_documents where id=current_setting('lt.document')::uuid),'explicit unapproval available for unpublished lesson');
reset role;
select pg_temp.deny_lesson($q$update public.lesson_documents set storage_path='changed' where id=current_setting('lt.document')::uuid$q$,'trusted document identity mutation denied','23514');
select pg_temp.deny_lesson($q$update public.lesson_documents set provenance='changed' where id=current_setting('lt.document')::uuid$q$,'trusted document provenance mutation denied','23514');
select pg_temp.deny_lesson($q$insert into public.lessons(id,question_bank_id,chapter_id,title) values(gen_random_uuid(),current_setting('lt.track'),current_setting('lt.chapter')::uuid,'bypass')$q$,'trusted exam-track lesson insert denied','23514');
update storage.objects set metadata='{"size":2048,"mimetype":"application/pdf"}' where bucket_id='lesson-source-pdfs' and name=current_setting('lt.lesson')||'/'||current_setting('lt.document')||'.pdf';
set local role authenticated;
select pg_temp.deny_lesson($q$select public.register_lesson_document(pg_temp.lesson_document(current_setting('lt.document')::uuid,current_setting('lt.lesson')::uuid))$q$,'registration verifies storage size','23514');
reset role;
update storage.objects set metadata='{"size":1024,"mimetype":"text/plain"}' where bucket_id='lesson-source-pdfs' and name=current_setting('lt.lesson')||'/'||current_setting('lt.document')||'.pdf';
set local role authenticated;
select pg_temp.deny_lesson($q$select public.register_lesson_document(pg_temp.lesson_document(current_setting('lt.document')::uuid,current_setting('lt.lesson')::uuid))$q$,'registration verifies storage MIME','23514');
reset role;
update storage.objects set metadata='{"size":1024,"mimetype":"application/pdf"}' where bucket_id='lesson-source-pdfs' and name=current_setting('lt.lesson')||'/'||current_setting('lt.document')||'.pdf';
set local role authenticated;
select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question(current_setting('lt.q'))||
 jsonb_build_object('documentId',current_setting('lt.document'),'sourcePage',2,'caseId',current_setting('lt.case'),'caseTitle','[TEST] Case','caseDescription','[TEST] Case description')),'PUBLISHED'));
select pg_temp.assert_lesson((select status='PUBLISHED' and revision=2 from public.lessons where id=current_setting('lt.lesson')::uuid),'verified question lesson may publish without approved PDF');
select pg_temp.assert_lesson((select source_page=2 and source_number='1' and position=1 from public.lesson_questions where lesson_id=current_setting('lt.lesson')::uuid),'question source document page number order stored');
select pg_temp.assert_lesson((select not include_in_complete_bank from public.bank_questions where id=current_setting('lt.q')),'lesson import never auto-enrolls in legacy complete bank');
select pg_temp.deny_lesson($q$select public.manage_bank_content('save_question',current_setting('lt.q'),pg_temp.legacy_lesson_question(current_setting('lt.subject')))$q$,'legacy editor cannot change published Subject question or key','23514');
select pg_temp.deny_lesson($q$select private.manage_bank_content('save_question',current_setting('lt.q'),pg_temp.legacy_lesson_question(current_setting('lt.track')))$q$,'legacy payload bank spoof cannot edit existing Subject question','23514');
select pg_temp.deny_lesson($q$select public.manage_bank_content('delete_question',current_setting('lt.q'))$q$,'legacy editor cannot delete published Subject question','23514');
select pg_temp.deny_lesson($q$select private.manage_bank_content('delete_question',current_setting('lt.q'))$q$,'private legacy editor cannot delete Subject question','23514');
select pg_temp.deny_lesson($q$select public.manage_bank_content('save_section',current_setting('lt.case'),jsonb_build_object('bankId',current_setting('lt.track'),'title','[TEST] Changed','description','[TEST] Changed'))$q$,'legacy bank spoof cannot change existing Subject clinical case','23514');
select pg_temp.deny_lesson($q$select private.manage_bank_content('delete_section',current_setting('lt.case'))$q$,'private legacy editor cannot delete Subject clinical case','23514');
select pg_temp.deny_lesson($q$select public.manage_bank_content('save_question','new-track-spoof',pg_temp.legacy_lesson_question(current_setting('lt.track'))||jsonb_build_object('sectionId',current_setting('lt.case')))$q$,'legacy track payload cannot reference Subject case','23514');
select public.manage_bank_content('save_section',current_setting('lt.track')||'-case',jsonb_build_object('bankId',current_setting('lt.track'),'title','[TEST] Track case','description','[TEST] Track case description','displayOrder',0));
select public.manage_bank_content('save_question',current_setting('lt.track')||'-q',pg_temp.legacy_lesson_question(current_setting('lt.track'))||jsonb_build_object('sectionId',current_setting('lt.track')||'-case'));
select pg_temp.assert_lesson(exists(select 1 from public.bank_questions where id=current_setting('lt.track')||'-q' and section_id=current_setting('lt.track')||'-case'),'legacy Exam Track question and case creation preserved');
select public.manage_bank_content('delete_question',current_setting('lt.track')||'-q');
select public.manage_bank_content('delete_section',current_setting('lt.track')||'-case');
select pg_temp.assert_lesson(not exists(select 1 from public.bank_questions where id=current_setting('lt.track')||'-q') and not exists(select 1 from public.question_sections where id=current_setting('lt.track')||'-case'),'legacy Exam Track question and case deletion preserved');
reset role;
select pg_temp.assert_lesson((select correct_option_id='a' from private.question_solutions where question_id=current_setting('lt.q')),'verified key written only at publication');
select pg_temp.assert_lesson((select explanation='[TEST] Private explanation' from private.lesson_question_explanations where question_id=current_setting('lt.q')),'published explanation stored privately');
set local role authenticated;
select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,2,jsonb_build_array(pg_temp.lesson_question(current_setting('lt.q'))||'{"text":"[TEST] Owned correction"}'),'PUBLISHED'));
select pg_temp.assert_lesson((select text='[TEST] Owned correction' from public.bank_questions where id=current_setting('lt.q')),'owned import question may update on verified publication');
select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.reuse')::uuid,0,jsonb_build_array(pg_temp.lesson_question('reuse-local-id')||
 jsonb_build_object('reuseQuestionId',current_setting('lt.q'),'text','[TEST] Owned correction')),'PUBLISHED'));
select pg_temp.assert_lesson((select question_id=current_setting('lt.q') from public.lesson_questions where lesson_id=current_setting('lt.reuse')::uuid),'explicit same-Subject reuse links existing question');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,3,jsonb_build_array(pg_temp.lesson_question(current_setting('lt.q'))||'{"text":"[TEST] Silent owner mutation"}'),'PUBLISHED'))$q$,'owner cannot silently mutate question reused by another lesson','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,3,jsonb_build_array(pg_temp.lesson_question(current_setting('lt.q'))||'{"text":"[TEST] Owned correction","correctOptionId":"b"}'),'PUBLISHED'))$q$,'owner cannot silently mutate answer key reused by another lesson','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,3,jsonb_build_array(pg_temp.lesson_question(current_setting('lt.q'))||jsonb_build_object('text','[TEST] Owned correction','caseId',current_setting('lt.case'),'caseTitle','[TEST] Case','caseDescription','[TEST] Case description')),'PUBLISHED'))$q$,'owner cannot silently change clinical case of reused question','23514');
select pg_temp.assert_lesson((select text='[TEST] Owned correction' and section_id is null from public.bank_questions where id=current_setting('lt.q')),'rejected owner edits preserve reused canonical question');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.reuse')::uuid,1,jsonb_build_array(pg_temp.lesson_question('reuse-local-id')||jsonb_build_object('reuseQuestionId',current_setting('lt.q'),'text','[TEST] Mutated original')),'PUBLISHED'))$q$,'reuse cannot mutate original question','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.reuse')::uuid,1,jsonb_build_array(pg_temp.lesson_question('reuse-local-id')||jsonb_build_object('reuseQuestionId',current_setting('lt.q'),'text','[TEST] Owned correction','correctOptionId','b')),'PUBLISHED'))$q$,'reuse cannot mutate original key','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.reuse')::uuid,1,jsonb_build_array(pg_temp.lesson_question(current_setting('lt.q')))) )$q$,'existing question ID requires explicit reuse','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.reuse')::uuid,1,jsonb_build_array(pg_temp.lesson_question('reuse-a')||jsonb_build_object('reuseQuestionId',current_setting('lt.q')),pg_temp.lesson_question('reuse-b')||jsonb_build_object('reuseQuestionId',current_setting('lt.q')))))$q$,'duplicate resolved reused question IDs denied','23514');
select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.otherLesson')::uuid,0)||jsonb_build_object('bankId',current_setting('lt.other'),'chapterId',current_setting('lt.otherChapter')));
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.otherLesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('cross-reuse')||jsonb_build_object('reuseQuestionId',current_setting('lt.q'))))||jsonb_build_object('bankId',current_setting('lt.other'),'chapterId',current_setting('lt.otherChapter')))$q$,'cross-Subject reuse rejected even in draft','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.otherLesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('cross-document')||jsonb_build_object('documentId',current_setting('lt.document'))))||jsonb_build_object('bankId',current_setting('lt.other'),'chapterId',current_setting('lt.otherChapter')))$q$,'cross-lesson document rejected in draft','23514');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.otherLesson')::uuid,1,jsonb_build_array(pg_temp.lesson_question('cross-case')||jsonb_build_object('caseId',current_setting('lt.case'),'caseTitle','[TEST] Case','caseDescription','[TEST] Case description')))||jsonb_build_object('bankId',current_setting('lt.other'),'chapterId',current_setting('lt.otherChapter')))$q$,'cross-Subject case rejected in draft','23514');
select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.reading')::uuid,0));
insert into storage.objects(bucket_id,name,metadata) values('lesson-source-pdfs',current_setting('lt.reading')||'/'||current_setting('lt.derivative')||'.pdf','{"size":1024,"mimetype":"application/pdf"}');
select public.register_lesson_document(pg_temp.lesson_document(current_setting('lt.derivative')::uuid,current_setting('lt.reading')::uuid)||'{"documentRole":"STUDENT_SAFE"}');
select pg_temp.assert_lesson((select not approved_for_students from public.lesson_documents where id=current_setting('lt.derivative')::uuid),'Student-safe role does not automatically approve PDF');
select public.approve_lesson_document(current_setting('lt.derivative')::uuid,true);
select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.reading')::uuid,1,'[]','PUBLISHED'));
select pg_temp.assert_lesson((select status='PUBLISHED' from public.lessons where id=current_setting('lt.reading')::uuid),'reading-only lesson publishes after explicit PDF review');
select pg_temp.deny_lesson($q$select public.approve_lesson_document(current_setting('lt.derivative')::uuid,false)$q$,'cannot remove last approved PDF from published reading lesson','23514');
select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.reading')::uuid,2,'[]','ARCHIVED'));
select public.approve_lesson_document(current_setting('lt.derivative')::uuid,false);
select pg_temp.assert_lesson((select status='ARCHIVED' from public.lessons where id=current_setting('lt.reading')::uuid),'archive retains lesson and allows approval revocation');
select public.approve_lesson_document(current_setting('lt.document')::uuid,true);
select public.save_lesson(pg_temp.lesson_payload(current_setting('lt.lesson')::uuid,3,'[]','PUBLISHED'));
select pg_temp.assert_lesson(not exists(select 1 from public.lesson_questions where lesson_id=current_setting('lt.lesson')::uuid),'removed questions are unlinked');
select pg_temp.assert_lesson(exists(select 1 from public.bank_questions where id=current_setting('lt.q')) and exists(select 1 from public.question_sections where id=current_setting('lt.case')),'unlink preserves canonical question and case history');
reset role;
select pg_temp.assert_lesson(exists(select 1 from private.question_solutions where question_id=current_setting('lt.q')) and exists(select 1 from private.lesson_question_explanations where question_id=current_setting('lt.q')),'unlink preserves private key and explanation history');
select pg_temp.assert_lesson((select status='inactive' and publication_status='DRAFT' from public.question_banks where id=current_setting('lt.subject')),'lesson publication never publishes or activates Subject');
select pg_temp.deny_lesson($q$update public.question_banks set material_kind='EXAM_TRACK',exam_category='OTHER' where id=current_setting('lt.subject')$q$,'populated lesson Subject cannot change type','23514');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('lt.student'),'role','authenticated','user_metadata',jsonb_build_object('role','ADMIN'))::text,true);
select pg_temp.assert_lesson(not private.can_open_bank(current_setting('lt.subject')),'Subject remains fail-closed for Student access');
select pg_temp.assert_lesson(not exists(select 1 from public.lessons where question_bank_id=current_setting('lt.subject')),'Student RLS hides lesson metadata');
select pg_temp.assert_lesson(not exists(select 1 from public.lesson_documents where question_bank_id=current_setting('lt.subject')),'Student RLS hides document identity path and approval');
select pg_temp.assert_lesson(not exists(select 1 from public.lesson_questions where question_bank_id=current_setting('lt.subject')),'Student RLS hides source question mappings');
select pg_temp.assert_lesson(not exists(select 1 from storage.objects where bucket_id='lesson-source-pdfs'),'Student cannot list or read private PDFs even after ORIGINAL explicit approval');
select pg_temp.deny_lesson($q$select public.admin_subject_lessons(current_setting('lt.subject'),current_setting('lt.lesson')::uuid)$q$,'Student cannot obtain draft keys or explanations via RPC','42501');
select pg_temp.deny_lesson($q$select private.admin_subject_lessons(current_setting('lt.subject'))$q$,'Student cannot bypass invoker read wrapper','42501');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0))$q$,'Student cannot save lessons despite spoofed metadata','42501');
select pg_temp.deny_lesson($q$select private.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0))$q$,'Student cannot bypass invoker save wrapper','42501');
select pg_temp.deny_lesson($q$select public.register_lesson_document(pg_temp.lesson_document(gen_random_uuid(),current_setting('lt.lesson')::uuid))$q$,'Student cannot register documents','42501');
select pg_temp.deny_lesson($q$select public.approve_lesson_document(current_setting('lt.document')::uuid,true)$q$,'Student cannot approve PDFs','42501');
select pg_temp.deny_lesson($q$select * from private.lesson_drafts$q$,'Student cannot directly read unverified draft keys','42501');
select pg_temp.deny_lesson($q$select * from private.lesson_question_explanations$q$,'Student cannot directly read explanations','42501');
select pg_temp.deny_lesson($q$select * from private.question_solutions$q$,'Student cannot directly read canonical keys','42501');
select pg_temp.deny_lesson($q$insert into storage.objects(bucket_id,name) values('lesson-source-pdfs',current_setting('lt.lesson')||'/'||gen_random_uuid()||'.pdf')$q$,'Student PDF upload denied','42501');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('lt.teacher'),'role','authenticated')::text,true);
select pg_temp.assert_lesson(not exists(select 1 from public.lessons where question_bank_id=current_setting('lt.subject')),'Teacher RLS hides lessons');
select pg_temp.deny_lesson($q$select public.admin_subject_lessons(current_setting('lt.subject'))$q$,'Teacher lesson administration denied','42501');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0))$q$,'Teacher lesson mutation denied','42501');
select pg_temp.deny_lesson($q$select public.approve_lesson_document(current_setting('lt.document')::uuid,true)$q$,'Teacher PDF approval denied','42501');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('lt.disabled'),'role','authenticated')::text,true);
select pg_temp.deny_lesson($q$select public.admin_subject_lessons(current_setting('lt.subject'))$q$,'disabled Admin read denied','42501');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0))$q$,'disabled Admin write denied','42501');
reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true);
select pg_temp.deny_lesson($q$select * from public.lessons$q$,'anon lesson table denied','42501');
select pg_temp.deny_lesson($q$select * from public.lesson_documents$q$,'anon document table denied','42501');
select pg_temp.deny_lesson($q$select * from private.lesson_drafts$q$,'anon draft table denied','42501');
select pg_temp.deny_lesson($q$select public.admin_subject_lessons(current_setting('lt.subject'))$q$,'anon lesson RPC denied','42501');
select pg_temp.deny_lesson($q$select public.save_lesson(pg_temp.lesson_payload(gen_random_uuid(),0))$q$,'anon save RPC denied','42501');
reset role;
select pg_temp.assert_lesson((select not prosecdef from pg_proc where oid='public.save_lesson(jsonb)'::regprocedure),'public save wrapper is invoker');
select pg_temp.assert_lesson((select not prosecdef from pg_proc where oid='public.admin_subject_lessons(text,uuid)'::regprocedure),'public read wrapper is invoker');
select pg_temp.assert_lesson(not has_function_privilege('anon','private.save_lesson(jsonb)','EXECUTE'),'anon lacks private mutation execute');
select pg_temp.assert_lesson(not has_function_privilege('authenticated','private.lesson_json_object(jsonb,text[])','EXECUTE'),'internal validation helpers are not callable by clients');
select pg_temp.assert_lesson(not has_table_privilege('authenticated','private.lesson_drafts','SELECT') and not has_table_privilege('authenticated','private.lesson_question_explanations','SELECT'),'private draft and explanation table ACLs are explicit');
select pg_temp.assert_lesson((select not public and file_size_limit=20971520 and allowed_mime_types=array['application/pdf'] from storage.buckets where id='lesson-source-pdfs'),'private PDF bucket size and MIME settings fixed');
select count(*) as lesson_checks_passed from lesson_checks;
rollback;

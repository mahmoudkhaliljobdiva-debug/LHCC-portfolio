-- Local, rollback-only security and compatibility checks. Never run as seed data.
begin;
create temp table material_checks(label text);
grant select,insert on material_checks to authenticated,anon;
create function pg_temp.assert_material(ok boolean,label text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL %',label; end if;
 insert into material_checks values(label); end $$;
create function pg_temp.deny_material(command text,label text) returns void language plpgsql as $$ begin
 begin execute command; exception when others then
  if sqlstate in ('42501','23514','23503') then perform pg_temp.assert_material(true,label); return; end if; raise;
 end; raise exception 'Expected denial %',label; end $$;
create function pg_temp.material_payload(bid text,kind text default 'EXAM_TRACK') returns jsonb language sql as $$
 select jsonb_build_object('id',bid,'name','[TEST] Material','description','Rollback-only material',
  'specialtyId',current_setting('mt.specialty'),'materialKind',kind,'examCategory',case when kind='EXAM_TRACK' then 'OTHER' end,
  'publicationStatus','DRAFT','icon','book','language','auto','displayOrder',0,'status','inactive') $$;
select set_config('mt.admin',(select id::text from public.profiles where role='ADMIN' and status='ACTIVE' limit 1),true),
 set_config('mt.one',gen_random_uuid()::text,true),set_config('mt.two',gen_random_uuid()::text,true),
 set_config('mt.teacher',gen_random_uuid()::text,true),set_config('mt.specialty',gen_random_uuid()::text,true),
 set_config('mt.track','mt-track-'||gen_random_uuid(),true),set_config('mt.subject','mt-subject-'||gen_random_uuid(),true),
 set_config('mt.draft','mt-draft-'||gen_random_uuid(),true),set_config('mt.empty','mt-empty-'||gen_random_uuid(),true),
 set_config('mt.request',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data)
 select current_setting('mt.'||v)::uuid,current_setting('mt.'||v)||'@example.invalid','{"full_name":"Material rollback"}'
 from unnest(array['one','two','teacher'])v;
update public.profiles set role='TEACHER',activation_start=now(),activation_months=1,expiration_date=now()+interval '1 month'
 where id=current_setting('mt.teacher')::uuid;
insert into public.specialties(id,slug,name,icon,published)
 values(current_setting('mt.specialty')::uuid,'test-'||current_setting('mt.specialty'),'[TEST] Specialty','other',true);
-- Explicit legacy fixture: migration defaults must retain pre-existing access.
insert into public.question_banks(id,name,description,status,specialty_id,price,image_url)
 values(current_setting('mt.track'),'[TEST] Legacy track','Existing metadata','active',current_setting('mt.specialty')::uuid,25,'https://example.invalid/original.png');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('mt.admin'),'role','authenticated')::text,true);
select public.save_learning_material(pg_temp.material_payload(current_setting('mt.subject'),'SUBJECT'));
select public.save_learning_material(pg_temp.material_payload(current_setting('mt.draft')));
select public.save_learning_material(pg_temp.material_payload(current_setting('mt.empty')));
select pg_temp.assert_material((select material_kind='EXAM_TRACK' and publication_status='PUBLISHED' and exam_category='OTHER' from public.question_banks where id=current_setting('mt.track')),'legacy defaults remain published exam track');
select pg_temp.assert_material((select price=0 and status='inactive' and publication_status='DRAFT' and exam_category is null from public.question_banks where id=current_setting('mt.subject')),'subject starts draft inactive free');
select pg_temp.deny_material($q$select public.save_learning_material(pg_temp.material_payload('bad-create')||'{"publicationStatus":"PUBLISHED","status":"active"}')$q$,'new materials cannot start published');
select pg_temp.deny_material($q$select public.save_learning_material(pg_temp.material_payload(current_setting('mt.subject'),'SUBJECT')||'{"publicationStatus":"PUBLISHED","status":"active"}')$q$,'subject cannot be published or active');
select pg_temp.deny_material($q$select public.save_learning_material(pg_temp.material_payload(current_setting('mt.subject'),'SUBJECT')||'{"specialtyId":null}')$q$,'subject requires specialty');
select pg_temp.deny_material($q$select public.save_learning_material(pg_temp.material_payload(current_setting('mt.subject'),'SUBJECT')||'{"examCategory":"OTHER"}')$q$,'subject rejects exam category');
select pg_temp.deny_material($q$select public.save_learning_material(pg_temp.material_payload('bad-key')||'{"price":4}')$q$,'commercial fields cannot enter typed payload');
select pg_temp.deny_material($q$select public.save_learning_material(pg_temp.material_payload('bad-lang')||'{"language":"fr"}')$q$,'invalid language denied');
select pg_temp.deny_material($q$select public.save_learning_material(pg_temp.material_payload('bad-icon')||'{"icon":"medical"}')$q$,'invalid material icon denied');
select pg_temp.deny_material($q$select public.save_learning_material(pg_temp.material_payload('bad-order')||'{"displayOrder":"2"}')$q$,'string display order denied');
select pg_temp.deny_material($q$select public.save_learning_material(pg_temp.material_payload('bad-order')||'{"displayOrder":-1}')$q$,'negative display order denied');
select pg_temp.deny_material($q$select public.save_learning_material(pg_temp.material_payload('bad-name')||'{"name":" "}')$q$,'empty name denied');
select pg_temp.deny_material($q$select public.save_learning_material(pg_temp.material_payload('bad-type')||'{"materialKind":"BOOK"}')$q$,'unknown material type denied');
select pg_temp.deny_material($q$select public.save_learning_material(pg_temp.material_payload('bad-category')||'{"examCategory":null}')$q$,'exam track requires category');
select pg_temp.deny_material($q$select public.save_learning_material(pg_temp.material_payload('bad-specialty')||'{"specialtyId":"not-uuid"}')$q$,'invalid specialty ID denied');
select pg_temp.deny_material($q$select public.save_learning_material(pg_temp.material_payload('missing-field')-'language')$q$,'missing field denied');
select pg_temp.deny_material($q$select public.save_learning_material('[]')$q$,'non-object payload denied');
select pg_temp.deny_material($q$select public.admin_learning_materials('BOOK')$q$,'invalid list type denied');
select pg_temp.deny_material($q$select public.admin_learning_materials('SUBJECT',-1)$q$,'invalid page denied');
select pg_temp.deny_material($q$select public.manage_bank_content('save_bank','generic-create','{"name":"Bypass","description":"No","status":"active"}')$q$,'generic editor cannot create unreviewed material');
select pg_temp.deny_material($q$select public.manage_bank_content('save_bank',current_setting('mt.track'),'{"materialKind":"SUBJECT"}')$q$,'generic editor cannot reclassify');
select pg_temp.deny_material($q$select public.manage_bank_content('save_bank',current_setting('mt.subject'),'{"name":"Bypass","description":"No","status":"active"}')$q$,'generic editor cannot activate subject');
-- Metadata updates do not touch legacy price, image, creator, ID or history.
select public.save_learning_material(pg_temp.material_payload(current_setting('mt.track'))||'{"name":"[TEST] Updated track","publicationStatus":"PUBLISHED","status":"active","examCategory":"COLLOQUIUM","icon":"nursing","language":"mixed"}');
select pg_temp.assert_material((select price=25 and image_url='https://example.invalid/original.png' and material_kind='EXAM_TRACK' from public.question_banks where id=current_setting('mt.track')),'typed update preserves price image and bank identity');
select pg_temp.assert_material(exists(select 1 from jsonb_array_elements(public.learning_catalog())s cross join lateral jsonb_array_elements(s->'materials')m
 where m->>'id'=current_setting('mt.track') and m->>'materialKind'='EXAM_TRACK' and m->>'examCategory'='COLLOQUIUM' and m->>'icon'='nursing' and m->>'language'='mixed'),'catalog includes only safe typed material fields');
select public.save_learning_material(pg_temp.material_payload(current_setting('mt.empty'),'SUBJECT'));
select pg_temp.assert_material((select material_kind='SUBJECT' from public.question_banks where id=current_setting('mt.empty')),'empty free draft can be explicitly reclassified');
select public.save_learning_material(pg_temp.material_payload('mt-page-'||current_setting('mt.specialty')||'-'||i)) from generate_series(1,23)i;
select set_config('mt.page0',public.admin_learning_materials('EXAM_TRACK',0)::text,true),
 set_config('mt.page1',public.admin_learning_materials('EXAM_TRACK',1)::text,true);
select pg_temp.assert_material(jsonb_array_length(current_setting('mt.page0')::jsonb->'items')=20,'admin list bounded to twenty');
select pg_temp.assert_material((current_setting('mt.page0')::jsonb->>'total')::integer=(select count(*) from public.question_banks where material_kind='EXAM_TRACK'),'admin total matches filtered type');
select pg_temp.assert_material(not exists(select 1 from jsonb_array_elements(current_setting('mt.page0')::jsonb->'items')a join jsonb_array_elements(current_setting('mt.page1')::jsonb->'items')b on a->>'id'=b->>'id'),'deterministic pages do not repeat IDs');
select pg_temp.assert_material(current_setting('mt.page0') not like '%correct_option_id%' and current_setting('mt.page0') not like '%correctOptionId%','admin metadata does not include question keys');
reset role;
select pg_temp.deny_material($q$update public.question_banks set status='active' where id=current_setting('mt.subject')$q$,'database check forbids active subject');
select pg_temp.deny_material($q$update public.question_banks set publication_status='ARCHIVED' where id=current_setting('mt.subject')$q$,'database check keeps subject strictly draft');
select pg_temp.deny_material($q$update public.question_banks set price=1 where id=current_setting('mt.subject')$q$,'database check forbids subject price');
select pg_temp.deny_material($q$update public.question_banks set exam_category='OTHER' where id=current_setting('mt.subject')$q$,'database check forbids subject exam category');
insert into public.question_sections(id,question_bank_id,title,description,display_order)
 select current_setting('mt.'||v)||'-case',current_setting('mt.'||v),'[TEST] Case','Rollback-only clinical context',0
 from unnest(array['track','subject','draft'])v;
insert into public.bank_questions(id,question_bank_id,text,status,options,section_id)
 select current_setting('mt.'||v)||'-q',current_setting('mt.'||v),'[TEST] Question','active','[{"id":"a","text":"First"},{"id":"b","text":"Second"}]',current_setting('mt.'||v)||'-case'
 from unnest(array['track','subject','draft'])v;
insert into private.question_solutions select current_setting('mt.'||v)||'-q','a' from unnest(array['track','subject','draft'])v;
insert into public.teacher_bank_assignments(teacher_id,question_bank_id,assigned_by)
 values(current_setting('mt.teacher')::uuid,current_setting('mt.track'),current_setting('mt.admin')::uuid);
select pg_temp.deny_material($q$update public.question_banks set material_kind='SUBJECT',exam_category=null,status='inactive',publication_status='DRAFT',price=0 where id=current_setting('mt.track')$q$,'populated bank type immutable even direct database update');
select pg_temp.deny_material($q$insert into public.user_bank_access(user_id,question_bank_id,granted_by) values(current_setting('mt.one')::uuid,current_setting('mt.subject'),current_setting('mt.admin')::uuid)$q$,'subject grant rejected at database boundary');
select pg_temp.deny_material($q$insert into public.wallet_transactions(transaction_type,name,description,amount,user_id,question_bank_id,created_by,transaction_date) values('BANK_SALE','No','No',1,current_setting('mt.one')::uuid,current_setting('mt.subject'),current_setting('mt.admin')::uuid,current_date)$q$,'subject sale rejected at database boundary');
select pg_temp.deny_material($q$insert into public.exam_sources(id,question_bank_id,filename,storage_path,sha256,uploaded_by) values(gen_random_uuid(),current_setting('mt.subject'),'No.pdf','rollback/'||gen_random_uuid(),repeat('a',64),current_setting('mt.admin')::uuid)$q$,'direct subject source record denied');
-- Model an unexpected historical rogue grant without weakening production DDL.
-- The named trigger is disabled and re-enabled inside this rolled-back fixture.
alter table public.user_bank_access disable trigger material_access_guard;
insert into public.user_bank_access(user_id,question_bank_id,granted_by)
 values(current_setting('mt.one')::uuid,current_setting('mt.subject'),current_setting('mt.admin')::uuid),
 (current_setting('mt.one')::uuid,current_setting('mt.draft'),current_setting('mt.admin')::uuid);
alter table public.user_bank_access enable trigger material_access_guard;
alter table public.user_bank_access_requests disable trigger material_request_guard;
insert into public.user_bank_access_requests(id,user_id,question_bank_id)
 values(current_setting('mt.request')::uuid,current_setting('mt.two')::uuid,current_setting('mt.subject'));
alter table public.user_bank_access_requests enable trigger material_request_guard;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('mt.one'),'role','authenticated')::text,true);
select pg_temp.assert_material(not private.can_open_bank(current_setting('mt.subject')),'rogue subject grant cannot open material');
select pg_temp.assert_material(not private.can_open_bank(current_setting('mt.draft')),'draft track grant cannot open material');
select pg_temp.assert_material(not exists(select 1 from public.question_banks where id in (current_setting('mt.subject'),current_setting('mt.draft'))),'student bank RLS hides subject and draft');
select pg_temp.assert_material(not exists(select 1 from public.bank_questions where question_bank_id in(current_setting('mt.subject'),current_setting('mt.draft'))),'student question RLS hides rogue subject and draft grant');
select pg_temp.deny_material($q$select public.admin_learning_materials('SUBJECT')$q$,'student cannot list admin materials');
select pg_temp.deny_material($q$select private.admin_learning_materials('SUBJECT')$q$,'student cannot bypass public list wrapper');
select pg_temp.deny_material($q$select public.save_learning_material(pg_temp.material_payload('student-write'))$q$,'student cannot save material');
select pg_temp.deny_material($q$select public.request_bank_access(current_setting('mt.subject'))$q$,'subject request RPC denied');
select pg_temp.deny_material($q$insert into public.user_bank_access_requests(question_bank_id) values(current_setting('mt.subject'))$q$,'direct subject request INSERT denied');
select pg_temp.deny_material($q$select public.request_bank_access(current_setting('mt.draft'))$q$,'draft track request denied');
select pg_temp.deny_material($q$insert into public.user_bank_access_requests(question_bank_id) values(current_setting('mt.draft'))$q$,'direct draft request INSERT denied');
select pg_temp.deny_material($q$select public.start_exam(current_setting('mt.subject'))$q$,'legacy start denies subject despite grant');
select pg_temp.deny_material($q$select public.start_learning_exam(jsonb_build_object('bankId',current_setting('mt.subject'),'source','RANDOM','mode','EXAM','count',1))$q$,'learning start denies subject despite grant');
select pg_temp.deny_material($q$select public.start_learning_exam(jsonb_build_object('bankId',current_setting('mt.draft'),'source','RANDOM','mode','PRACTICE','count',1))$q$,'draft practice denied despite grant');
select pg_temp.deny_material($q$select public.exam_bank_data(current_setting('mt.subject'))$q$,'subject exam metadata denied');
select pg_temp.deny_material($q$select * from private.question_solutions$q$,'private answer keys remain inaccessible');
select set_config('mt.approval',public.request_bank_access(current_setting('mt.track'))::text,true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('mt.admin'),'role','authenticated')::text,true);
do $$ begin perform set_config('mt.legacyAdmin',public.admin_bank_data()::text,true); end $$;
select pg_temp.assert_material(not exists(select 1 from jsonb_array_elements(current_setting('mt.legacyAdmin')::jsonb->'banks')b where b->>'id'=current_setting('mt.subject'))
 and (select count(*)=2 from jsonb_array_elements(current_setting('mt.legacyAdmin')::jsonb->'banks')b where b->>'id' in(current_setting('mt.track'),current_setting('mt.draft'))),'legacy bank editor lists only Exam Tracks including drafts');
select pg_temp.assert_material(not exists(select 1 from jsonb_array_elements(current_setting('mt.legacyAdmin')::jsonb->'sections')s where s->>'bankId'=current_setting('mt.subject'))
 and (select count(*)=2 from jsonb_array_elements(current_setting('mt.legacyAdmin')::jsonb->'sections')s where s->>'bankId' in(current_setting('mt.track'),current_setting('mt.draft'))),'legacy bank editor excludes Subject cases without dropping Exam Track cases');
select pg_temp.assert_material(not exists(select 1 from jsonb_array_elements(current_setting('mt.legacyAdmin')::jsonb->'questions')q where q->>'bankId'=current_setting('mt.subject'))
 and (select count(*)=2 from jsonb_array_elements(current_setting('mt.legacyAdmin')::jsonb->'questions')q where q->>'bankId' in(current_setting('mt.track'),current_setting('mt.draft'))),'legacy bank editor excludes Subject question pools without dropping Exam Track questions');
select pg_temp.assert_material(exists(select 1 from jsonb_array_elements(public.admin_learning_materials('SUBJECT')->'items')m where m->>'id'=current_setting('mt.subject')),'Subject remains available in typed Subject management');
select pg_temp.deny_material($q$select public.review_bank_access(current_setting('mt.request')::uuid,'APPROVED')$q$,'subject approval denied even pre-existing request');
select pg_temp.deny_material($q$select public.save_learning_material(pg_temp.material_payload(current_setting('mt.track'),'SUBJECT'))$q$,'typed RPC cannot reclassify populated bank');
select pg_temp.deny_material($q$select public.generate_shared_exam(jsonb_build_object('id',gen_random_uuid(),'bankId',current_setting('mt.subject'),'title','No','count',1))$q$,'subject shared generation denied');
select pg_temp.deny_material($q$select public.generate_shared_exam(jsonb_build_object('id',gen_random_uuid(),'bankId',current_setting('mt.draft'),'title','No','count',1))$q$,'draft track shared generation denied');
select pg_temp.deny_material($q$select public.save_past_exam(jsonb_build_object('id',gen_random_uuid(),'bankId',current_setting('mt.subject'),'title','No','status','DRAFT','questions','[]'::jsonb,'provenance','Rollback'))$q$,'subject historical management denied');
select pg_temp.deny_material($q$select public.exam_bank_data(current_setting('mt.subject'),current_setting('mt.one')::uuid)$q$,'admin student preview cannot bypass subject guard');
select public.review_bank_access(current_setting('mt.approval')::uuid,'APPROVED');
reset role;
select pg_temp.assert_material((select count(*)=1 from public.wallet_transactions where question_bank_id=current_setting('mt.track') and transaction_type='BANK_SALE' and amount=25),'legacy approved track retains priced sale');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('mt.one'),'role','authenticated')::text,true);
select pg_temp.assert_material(private.can_open_bank(current_setting('mt.track')),'legacy approved track remains usable');
select set_config('mt.attempt',public.start_learning_exam(jsonb_build_object('bankId',current_setting('mt.track'),'source','RANDOM','mode','EXAM','count',1,'timeLimitMinutes',null))::text,true);
select public.submit_exam(current_setting('mt.attempt')::uuid);
select pg_temp.assert_material(public.exam_data(current_setting('mt.attempt')::uuid)->>'status'='COMPLETED','legacy track attempt completes');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('mt.teacher'),'role','authenticated')::text,true);
select pg_temp.assert_material(exists(select 1 from public.bank_questions where question_bank_id=current_setting('mt.track')),'assigned teacher retains question visibility');
select pg_temp.deny_material($q$select public.admin_learning_materials('EXAM_TRACK')$q$,'teacher cannot list admin materials');
select pg_temp.deny_material($q$select private.save_learning_material(pg_temp.material_payload('teacher-write'))$q$,'teacher cannot bypass typed write wrapper');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('mt.admin'),'role','authenticated')::text,true);
select public.save_learning_material(pg_temp.material_payload(current_setting('mt.track'))||'{"publicationStatus":"ARCHIVED"}');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('mt.one'),'role','authenticated')::text,true);
select pg_temp.assert_material(not private.can_open_bank(current_setting('mt.track')),'archived track blocks new access despite grant');
select pg_temp.assert_material(public.exam_data(current_setting('mt.attempt')::uuid)->>'status'='COMPLETED','completed results survive material archival');
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select pg_temp.assert_material(public.learning_catalog()::text not like '%'||current_setting('mt.subject')||'%' and public.learning_catalog()::text not like '%'||current_setting('mt.draft')||'%','anonymous catalog excludes subject and draft');
select pg_temp.deny_material($q$select public.admin_learning_materials('SUBJECT')$q$,'anonymous admin list denied');
select pg_temp.deny_material($q$select public.save_learning_material(pg_temp.material_payload('anon-write'))$q$,'anonymous save denied');
reset role;
select pg_temp.assert_material(not has_schema_privilege('anon','private','USAGE'),'anonymous has no private schema usage');
select pg_temp.assert_material(not has_function_privilege('authenticated','private.pretyped_manage_bank_content(text,text,jsonb)','EXECUTE'),'renamed old bank editor is not executable');
select pg_temp.assert_material(not has_function_privilege('authenticated','private.pretyped_exam_bank_data(text,uuid)','EXECUTE'),'renamed old exam metadata is not executable');
select pg_temp.assert_material((select not prosecdef from pg_proc where oid='public.save_learning_material(jsonb)'::regprocedure),'typed public save remains security invoker');
select pg_temp.assert_material((select not prosecdef from pg_proc where oid='public.admin_learning_materials(text,integer)'::regprocedure),'typed public list remains security invoker');
select pg_temp.assert_material((select proconfig @> array['search_path=""'] from pg_proc where oid='private.save_learning_material(jsonb)'::regprocedure),'typed privileged write has fixed empty search path');
select count(*) as passed_checks from material_checks;
rollback;

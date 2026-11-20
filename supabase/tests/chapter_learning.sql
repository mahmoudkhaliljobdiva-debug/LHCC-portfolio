-- Rollback-only local checks. Run through scripts/chapter-db.mjs.
begin;
create temp table chapter_checks(label text); grant select,insert on chapter_checks to authenticated,anon;
create function pg_temp.assert_chapter(ok boolean,label text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL %',label; end if; insert into chapter_checks values(label); end $$;
create function pg_temp.deny_chapter(command text,label text) returns void language plpgsql as $$ begin
 begin execute command; exception when others then if sqlstate in ('42501','23514','23503') then perform pg_temp.assert_chapter(true,label);return;end if;raise;end;
 raise exception 'Expected denial %',label;end $$;
select set_config('ch.admin',(select id::text from public.profiles where role='ADMIN' and status='ACTIVE' limit 1),true),
 set_config('ch.one',gen_random_uuid()::text,true),set_config('ch.two',gen_random_uuid()::text,true),set_config('ch.locked',gen_random_uuid()::text,true),
 set_config('ch.bank','chapter-'||gen_random_uuid(),true),set_config('ch.other','other-'||gen_random_uuid(),true),
 set_config('ch.c1','00000000-0000-4000-8000-000000000001',true),set_config('ch.c2','00000000-0000-4000-8000-000000000002',true),
 set_config('ch.draft','00000000-0000-4000-8000-000000000003',true);
insert into auth.users(id,email,raw_user_meta_data) select current_setting('ch.'||v)::uuid,current_setting('ch.'||v)||'@example.invalid','{"full_name":"Chapter rollback"}' from unnest(array['one','two','locked'])v;
insert into public.question_banks(id,name,description,status) values(current_setting('ch.bank'),'[TEST] Colloquium','Rollback fixture','active'),(current_setting('ch.other'),'[TEST] Other','Rollback fixture','active');
insert into public.question_sections(id,question_bank_id,title,description,display_order) values(current_setting('ch.bank')||'-case',current_setting('ch.bank'),'Original case','Original clinical context',1);
insert into public.bank_questions(id,question_bank_id,text,status,options,section_id,display_order)
 select current_setting('ch.bank')||'-q'||i,current_setting('ch.bank'),'Question '||i,'active','[{"id":"a","text":"First"},{"id":"b","text":"Second"}]',current_setting('ch.bank')||'-case',i from generate_series(1,12)i;
insert into private.question_solutions select current_setting('ch.bank')||'-q'||i,'a' from generate_series(1,12)i;
select set_config('ch.pdf1',gen_random_uuid()::text,true),set_config('ch.pdf2',gen_random_uuid()::text,true),set_config('ch.pdf3',gen_random_uuid()::text,true);
insert into public.past_exams(id,question_bank_id,title,exam_year,session,status,provenance)
 select current_setting('ch.pdf'||i)::uuid,current_setting('ch.bank'),'[TEST] Source session '||i,
 case when i=2 then 2025 else 2024 end,'Session '||i,'PUBLISHED','Rollback-only verified source' from generate_series(1,3)i;
insert into public.past_exam_questions(exam_id,question_id,position,source_number)
 select current_setting(case when i<=6 then 'ch.pdf1' else 'ch.pdf2' end)::uuid,current_setting('ch.bank')||'-q'||i,
 case when i<=6 then 7-i else 13-i end,'Source '||i from generate_series(1,12)i;
insert into public.past_exam_questions values(current_setting('ch.pdf3')::uuid,current_setting('ch.bank')||'-q2',1,'42'),(current_setting('ch.pdf3')::uuid,current_setting('ch.bank')||'-q1',2,'43');
insert into public.user_bank_access(user_id,question_bank_id,status,granted_by) select current_setting('ch.'||v)::uuid,current_setting('ch.bank'),'ACTIVE',current_setting('ch.admin')::uuid from unnest(array['one','two'])v;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('ch.admin'),'role','authenticated')::text,true);
select public.manage_chapters('save_chapter',jsonb_build_object('id',current_setting('ch.'||v),'bankId',current_setting('ch.bank'),'title',v,'description','Actual reviewed chapter','displayOrder',n,'published',v<>'draft')) from unnest(array['c1','c2','draft']) with ordinality t(v,n);
select public.manage_chapters('assign_question',jsonb_build_object('bankId',current_setting('ch.bank'),'questionId',current_setting('ch.bank')||'-q'||i,
 'chapterIds',jsonb_build_array(current_setting(case when i<=6 then 'ch.c1' else 'ch.c2' end)),
 'difficulty',case when i%6 in (1,2) then 'EASY' when i%6 in (3,4) then 'MEDIUM' else 'HARD' end)) from generate_series(1,12)i;
select public.manage_chapters('assign_question',jsonb_build_object('bankId',current_setting('ch.bank'),'questionId',current_setting('ch.bank')||'-q1','chapterIds',jsonb_build_array(current_setting('ch.c1'),current_setting('ch.c2')),'difficulty','EASY'));
select public.manage_chapters('save_generation',jsonb_build_object('bankId',current_setting('ch.bank'),'defaultCount',6,'prioritizeIncorrect',true));
select pg_temp.assert_chapter((public.admin_chapters(current_setting('ch.bank'))->>'defaultCount')::integer=6,'Admin generation defaults saved');
select pg_temp.assert_chapter(jsonb_array_length(public.admin_chapters(current_setting('ch.bank'))->'questions')=12,'Admin questions bounded page');
select pg_temp.assert_chapter(jsonb_array_length(public.admin_chapters(current_setting('ch.bank'),1)->'questions')=0,'Admin paging does not duplicate pool');
select pg_temp.deny_chapter($q$select public.manage_chapters('save_chapter',jsonb_build_object('id',current_setting('ch.c1'),'bankId',current_setting('ch.other'),'title','Wrong','displayOrder',0,'published',true))$q$,'chapter cannot move across banks');
select pg_temp.deny_chapter($q$select public.manage_chapters('assign_question',jsonb_build_object('bankId',current_setting('ch.other'),'questionId',current_setting('ch.bank')||'-q1','chapterIds',jsonb_build_array(current_setting('ch.c1')),'difficulty',null))$q$,'cross-bank assignment denied');
reset role;
select pg_temp.assert_chapter((select count(*)=12 from public.bank_questions where question_bank_id=current_setting('ch.bank')),'multi-chapter membership never duplicates questions');
select pg_temp.assert_chapter((select count(*)=2 from public.chapter_questions where question_id=current_setting('ch.bank')||'-q1'),'many-to-many assignment retained');
select pg_temp.assert_chapter((select description='Original clinical context' from public.question_sections where id=current_setting('ch.bank')||'-case'),'chapter edit preserves clinical case');
set local role anon;
select pg_temp.deny_chapter($q$select public.admin_chapters(current_setting('ch.bank'))$q$,'anonymous admin metadata denied');
select pg_temp.deny_chapter($q$select * from public.bank_chapters$q$,'anonymous chapters denied');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('ch.locked'),'role','authenticated')::text,true);
select pg_temp.assert_chapter((select count(*)=0 from public.bank_chapters),'unapproved Student cannot list chapters');
select pg_temp.deny_chapter($q$select public.start_learning_exam(jsonb_build_object('bankId',current_setting('ch.bank'),'source','CHAPTER','sourceId',current_setting('ch.c1'),'mode','EXAM','count',6,'timeLimitMinutes',null))$q$,'unapproved Student cannot start chapter');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('ch.one'),'role','authenticated')::text,true);
select pg_temp.deny_chapter($q$select public.manage_chapters('save_generation','{}')$q$,'Student cannot manage chapters/settings');
select pg_temp.deny_chapter($q$select public.admin_chapters(current_setting('ch.bank'))$q$,'Student cannot fetch Admin question pool');
select pg_temp.assert_chapter((select count(*)=2 from public.bank_chapters),'approved Student sees published chapters only');
select pg_temp.assert_chapter((select count(*)=0 from public.chapter_questions),'Student cannot read raw question mappings');
select set_config('ch.metadata',public.exam_bank_data(current_setting('ch.bank'))::text,true);
select pg_temp.assert_chapter(jsonb_array_length(current_setting('ch.metadata')::jsonb->'chapters')=2,'authorized chapter catalog omits drafts');
select pg_temp.assert_chapter(current_setting('ch.metadata')::jsonb->'chapters'->0->>'questionCount'='6','chapter count deduplicated');
select pg_temp.assert_chapter(current_setting('ch.metadata') not like '%correct_option_id%','chapter catalog has no answer keys');
select pg_temp.deny_chapter($q$select public.start_learning_exam(jsonb_build_object('bankId',current_setting('ch.bank'),'source','CHAPTER','sourceId',current_setting('ch.draft'),'mode','EXAM','count',6,'timeLimitMinutes',null))$q$,'draft chapter cannot start');
select set_config('ch.config',jsonb_build_object('bankId',current_setting('ch.bank'),'source','CHAPTER','sourceId',current_setting('ch.c1'),'mode','EXAM','count',6,'timeLimitMinutes',null)::text,true);
select set_config('ch.attempt',public.start_learning_exam(current_setting('ch.config')::jsonb)::text,true);
select pg_temp.assert_chapter(public.start_learning_exam(current_setting('ch.config')::jsonb)::text=current_setting('ch.attempt'),'chapter resume keeps same attempt');
select set_config('ch.data',public.exam_data(current_setting('ch.attempt')::uuid)::text,true);
select pg_temp.assert_chapter(current_setting('ch.data')::jsonb->>'source'='CHAPTER','attempt source preserved');
select pg_temp.assert_chapter(current_setting('ch.data')::jsonb->>'totalQuestions'='6','chapter contains its full assigned eligible set');
select pg_temp.assert_chapter(not exists(select 1 from jsonb_array_elements(current_setting('ch.data')::jsonb->'questions')q where substring(q->>'text' from '[0-9]+')::integer>6),'chapter has no questions from other chapters');
select pg_temp.assert_chapter(current_setting('ch.data')::jsonb->'questions'->0->>'caseDescription'='Original clinical context','chapter question retains clinical context');
select pg_temp.assert_chapter(current_setting('ch.data') not like '%correctOptionId%' and current_setting('ch.data')::jsonb->'result'='null'::jsonb,'active Exam hides correctness');
select pg_temp.deny_chapter($q$select public.check_practice_answer(current_setting('ch.attempt')::uuid,current_setting('ch.bank')||'-q1')$q$,'Exam cannot request Practice feedback');
select public.save_exam_answer_versioned(current_setting('ch.attempt')::uuid,current_setting('ch.bank')||'-q1','b',0);
select public.submit_exam(current_setting('ch.attempt')::uuid);
select pg_temp.assert_chapter((public.exam_bank_data(current_setting('ch.bank'))->'chapters'->0->>'completed')::integer=1,'chapter progress includes completed attempt');
select set_config('ch.generatedConfig',jsonb_build_object('bankId',current_setting('ch.bank'),'source','RANDOM','sourceId',null,'mode','EXAM','count',6,'timeLimitMinutes',null,'prioritizeIncorrect',true)::text,true);
select set_config('ch.generated',public.start_learning_exam(current_setting('ch.generatedConfig')::jsonb)::text,true);
select set_config('ch.generatedData',public.exam_data(current_setting('ch.generated')::uuid)::text,true);
select pg_temp.assert_chapter(jsonb_array_length(current_setting('ch.generatedData')::jsonb->'questions')=6,'generated configurable count');
select pg_temp.assert_chapter((select count(distinct q->>'id')=6 from jsonb_array_elements(current_setting('ch.generatedData')::jsonb->'questions')q),'generated questions unique');
select pg_temp.assert_chapter(exists(select 1 from jsonb_array_elements(current_setting('ch.generatedData')::jsonb->'questions')q where q->>'id'=current_setting('ch.bank')||'-q1'),'incorrect answer prioritized within its group');
select pg_temp.assert_chapter(public.start_learning_exam(current_setting('ch.generatedConfig')::jsonb)::text=current_setting('ch.generated'),'generated resume idempotent');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('ch.two'),'role','authenticated')::text,true);
select set_config('ch.second',public.start_learning_exam(current_setting('ch.generatedConfig')::jsonb)::text,true);
select pg_temp.assert_chapter((public.exam_data(current_setting('ch.second')::uuid)->'questions') is distinct from (current_setting('ch.generatedData')::jsonb->'questions'),'different students receive independently generated sets');
reset role;
select pg_temp.assert_chapter((select count(distinct b.difficulty)=3 from public.question_attempt_questions q join public.bank_questions b on b.id=q.question_id where attempt_id=current_setting('ch.generated')::uuid),'generated set balances reviewed difficulty');
select pg_temp.assert_chapter((select count(*)=3 from public.question_attempt_questions q join public.bank_questions b on b.id=q.question_id where attempt_id=current_setting('ch.generated')::uuid and b.display_order<=6),'generated set balances chapters');
select pg_temp.assert_chapter((select count(*)=3 from public.question_attempt_questions q join public.past_exam_questions p on p.question_id=q.question_id where q.attempt_id=current_setting('ch.generated')::uuid and p.exam_id=current_setting('ch.pdf2')::uuid),'generated set balances actual historical years');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('ch.two'),'role','authenticated')::text,true);
select public.submit_exam(current_setting('ch.second')::uuid);
select set_config('ch.past',public.start_learning_exam(jsonb_build_object('bankId',current_setting('ch.bank'),'source','PAST','sourceId',current_setting('ch.pdf3'),'mode','EXAM','count',30,'timeLimitMinutes',null))::text,true);
select pg_temp.assert_chapter((public.exam_data(current_setting('ch.past')::uuid)->'questions'->0->>'id')=current_setting('ch.bank')||'-q2','historical session keeps original order, not generated order');
select pg_temp.assert_chapter((public.exam_data(current_setting('ch.past')::uuid)->'questions'->0->>'sourceNumber')='42','historical session retains original source numbering');
select pg_temp.assert_chapter((public.exam_data(current_setting('ch.past')::uuid)->>'totalQuestions')='2','same-year sessions remain distinct');
reset role;
update public.bank_questions set text='Later revision' where question_bank_id=current_setting('ch.bank');
update public.bank_chapters set published=false where id=current_setting('ch.c1')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('ch.one'),'role','authenticated')::text,true);
select pg_temp.assert_chapter(public.exam_data(current_setting('ch.generated')::uuid)::text=current_setting('ch.generatedData'),'source edits/publication never change frozen attempt');
reset role;
update public.user_bank_access set status='REVOKED',revoked_at=now() where user_id=current_setting('ch.one')::uuid and question_bank_id=current_setting('ch.bank');
set local role authenticated;
select pg_temp.deny_chapter($q$select public.exam_data(current_setting('ch.generated')::uuid)$q$,'revoked access denies loaded chapter/generated attempt');
reset role;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('ch.admin'),'role','authenticated')::text,true);
select public.manage_chapters('save_chapter',jsonb_build_object('id',gen_random_uuid(),'bankId',current_setting('ch.other'),'title','Unused bank chapter','description','','displayOrder',0,'published',false));
select public.manage_chapters('save_generation',jsonb_build_object('bankId',current_setting('ch.other'),'defaultCount',2,'prioritizeIncorrect',false));
select pg_temp.deny_chapter($q$select public.manage_bank_content('delete_bank',current_setting('ch.other'))$q$,'bank deletion cannot cascade into configured chapter metadata');
select pg_temp.assert_chapter(exists(select 1 from public.bank_chapters where question_bank_id=current_setting('ch.other')),'chapter metadata retained after denied bank deletion');
select pg_temp.assert_chapter(exists(select 1 from public.bank_generation_settings where question_bank_id=current_setting('ch.other')),'generation settings retained after denied bank deletion');
reset role;
select count(*) as passed_checks,true as all_passed from chapter_checks;
rollback;

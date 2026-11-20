-- Authoritative backend tests; all accounts, questions and results roll back.
begin;
create temporary table exam_test_results(label text,passed boolean);
grant select,insert on exam_test_results to authenticated,anon;
create function pg_temp.check_exam(ok boolean,label text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAILED: %',label; end if;
 insert into exam_test_results values(label,true);
end $$;
create function pg_temp.denied(command text,label text) returns void language plpgsql as $$ begin
 begin execute command; exception when others then
  if sqlstate in ('42501','23514','P0002') then perform pg_temp.check_exam(true,label); return; end if; raise;
 end; raise exception 'Expected denial: %',label;
end $$;
select set_config('exam.a',gen_random_uuid()::text,true),set_config('exam.b',gen_random_uuid()::text,true),set_config('exam.prefix','exam-'||gen_random_uuid(),true);
select set_config('exam.admin',(select id::text from public.profiles where role='ADMIN' and status='ACTIVE' limit 1),true);
insert into auth.users(id,email,raw_user_meta_data) values
 (current_setting('exam.a')::uuid,current_setting('exam.a')||'@example.invalid','{"full_name":"Exam rollback A"}'),
 (current_setting('exam.b')::uuid,current_setting('exam.b')||'@example.invalid','{"full_name":"Exam rollback B"}');
insert into public.question_banks(id,name,description,status) select current_setting('exam.prefix')||'-'||n,'[TEST] Exam '||n,'Rollback fixture','active' from unnest(array[40,30,12,0]) n;
insert into public.question_sections(id,question_bank_id,title,description,display_order) values
  (current_setting('exam.prefix')||'-case',current_setting('exam.prefix')||'-40','[TEST] Clinical case','Frozen clinical description',1);
insert into public.bank_questions(id,question_bank_id,text,status,options)
 select current_setting('exam.prefix')||'-'||n||'-q'||i,current_setting('exam.prefix')||'-'||n,'Question '||i,'active','[{"id":"a","text":"First"},{"id":"b","text":"Second"}]'::jsonb
 from unnest(array[40,30,12]) n cross join lateral generate_series(1,n) i;
insert into private.question_solutions(question_id,correct_option_id) select id,'a' from public.bank_questions where id like current_setting('exam.prefix')||'%';
update public.bank_questions set section_id=current_setting('exam.prefix')||'-case',display_order=1
  where question_bank_id=current_setting('exam.prefix')||'-40';
insert into public.user_bank_access(user_id,question_bank_id,status,granted_by) select current_setting('exam.a')::uuid,id,'ACTIVE',current_setting('exam.admin')::uuid from public.question_banks where id like current_setting('exam.prefix')||'%';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('exam.a'),'role','authenticated')::text,true);
select set_config('exam.attempt',public.start_exam(current_setting('exam.prefix')||'-40')::text,true);
select pg_temp.check_exam((select total_questions=30 from public.question_attempts where id=current_setting('exam.attempt')::uuid),'more than 30 selects 30');
select pg_temp.check_exam((select count(*)=30 and count(distinct display_order)=30 from public.question_attempt_questions where attempt_id=current_setting('exam.attempt')::uuid),'fixed unique question order');
select pg_temp.check_exam((select bool_and(question_id like current_setting('exam.prefix')||'-40-q%') from public.question_attempt_questions where attempt_id=current_setting('exam.attempt')::uuid),'bank isolation');
select pg_temp.check_exam(public.start_exam(current_setting('exam.prefix')||'-40')=current_setting('exam.attempt')::uuid,'duplicate start resumes same attempt');
select set_config('exam.original',public.exam_data(current_setting('exam.attempt')::uuid)::text,true);
select pg_temp.check_exam(current_setting('exam.original')::jsonb=public.exam_data(current_setting('exam.attempt')::uuid),'refresh freezes payload');
select pg_temp.check_exam(current_setting('exam.original') !~ 'is_correct|correct_option_id|answer_key|outcome','no pre-submit correctness');
select pg_temp.check_exam((public.exam_data(current_setting('exam.attempt')::uuid)->'questions'->0->>'caseDescription')='Frozen clinical description','case context frozen at start');
select pg_temp.check_exam((public.exam_bank_data(current_setting('exam.prefix')||'-40')->'examCount')::integer=30,'bank count capped');
select pg_temp.check_exam(public.exam_bank_data(current_setting('exam.prefix')||'-40')->'cases'->0->>'description'='Frozen clinical description','bank case details visible');
select set_config('exam.question',(select question_id from public.question_attempt_questions where attempt_id=current_setting('exam.attempt')::uuid order by display_order limit 1),true);
select public.save_exam_answer(current_setting('exam.attempt')::uuid,current_setting('exam.question'),'b');
select public.save_exam_answer(current_setting('exam.attempt')::uuid,current_setting('exam.question'),'a');
select pg_temp.check_exam((select count(*)=1 and bool_and(selected_option_id='a') and bool_and(is_correct is null) from public.question_attempt_answers where attempt_id=current_setting('exam.attempt')::uuid),'single mutable ungraded answer');
select pg_temp.check_exam(public.exam_data(current_setting('exam.attempt')::uuid)->'questions'->0->>'selectedOptionId'='a','saved answer restored');
select pg_temp.denied('select public.save_exam_answer(current_setting(''exam.attempt'')::uuid,current_setting(''exam.question''),''bad'')','invalid option denied');
select pg_temp.denied('select public.save_exam_answer(current_setting(''exam.attempt'')::uuid,current_setting(''exam.prefix'')||''-12-q1'',''a'')','foreign bank answer denied');
select pg_temp.denied('select * from private.exam_question_solutions','private frozen keys denied');
select pg_temp.denied('select * from private.question_solutions','live keys denied');
select pg_temp.denied('select public.submit_bank_answer(current_setting(''exam.question''),''a'')','legacy correctness oracle disabled');
select pg_temp.denied('update public.question_attempts set score_percentage=100 where id=current_setting(''exam.attempt'')::uuid','direct scoring denied');
select pg_temp.denied('delete from public.question_attempt_questions where attempt_id=current_setting(''exam.attempt'')::uuid','question set immutable');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('exam.b'),'role','authenticated')::text,true);
select pg_temp.denied('select public.start_exam(current_setting(''exam.prefix'')||''-40'')','locked bank start denied');
select pg_temp.denied('select public.exam_data(current_setting(''exam.attempt'')::uuid)','student isolation read');
select pg_temp.denied('select public.submit_exam(current_setting(''exam.attempt'')::uuid)','student isolation submit');
select pg_temp.check_exam((select count(*)=0 from public.question_attempt_questions),'RLS snapshot isolation');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('exam.admin'),'role','authenticated')::text,true);
select pg_temp.check_exam(public.exam_data(current_setting('exam.attempt')::uuid,current_setting('exam.a')::uuid)->>'id'=current_setting('exam.attempt'),'admin selected-student read');
select pg_temp.denied('select public.start_exam(current_setting(''exam.prefix'')||''-40'')','admin cannot start as student');
select pg_temp.denied('select public.save_exam_answer(current_setting(''exam.attempt'')::uuid,current_setting(''exam.question''),''a'')','admin cannot answer as student');
reset role;
update public.question_sections set title='Edited case',description='Edited after start' where id=current_setting('exam.prefix')||'-case';
update public.bank_questions set text='Edited after start',options='[{"id":"x","text":"Changed"},{"id":"y","text":"Changed"}]',status='inactive' where id=current_setting('exam.question');
update private.question_solutions set correct_option_id='y' where question_id=current_setting('exam.question');
update public.user_bank_access set status='REVOKED',revoked_at=now() where user_id=current_setting('exam.a')::uuid and question_bank_id=current_setting('exam.prefix')||'-40';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('exam.a'),'role','authenticated')::text,true);
select pg_temp.denied('select public.exam_data(current_setting(''exam.attempt'')::uuid)','revoked access blocks resume');
select pg_temp.denied('select public.submit_exam(current_setting(''exam.attempt'')::uuid)','revoked access blocks submit');
reset role;
update public.user_bank_access set status='ACTIVE',revoked_at=null where user_id=current_setting('exam.a')::uuid and question_bank_id=current_setting('exam.prefix')||'-40';
set local role authenticated;
select pg_temp.check_exam(public.exam_data(current_setting('exam.attempt')::uuid)->'questions'->0->>'text'<>'Edited after start','frozen question survives edit and deactivation');
select pg_temp.check_exam(public.exam_data(current_setting('exam.attempt')::uuid)->'questions'->0->>'caseDescription'='Frozen clinical description','case edit does not alter attempt snapshot');
select public.submit_exam(current_setting('exam.attempt')::uuid);
select pg_temp.check_exam((select status='COMPLETED' and correct_answers=1 and incorrect_answers=29 and score_percentage=3.33 from public.question_attempts where id=current_setting('exam.attempt')::uuid),'frozen grading and unanswered count');
select set_config('exam.result',public.exam_data(current_setting('exam.attempt')::uuid)::text,true);
select public.submit_exam(current_setting('exam.attempt')::uuid);
select pg_temp.check_exam(current_setting('exam.result')::jsonb=public.exam_data(current_setting('exam.attempt')::uuid),'submit idempotent stable result');
select pg_temp.denied('select public.save_exam_answer(current_setting(''exam.attempt'')::uuid,current_setting(''exam.question''),''b'')','completed answers immutable');
select pg_temp.check_exam(public.exam_data(current_setting('exam.attempt')::uuid)->'questions'->0->>'outcome'='true','completed review only');
select set_config('exam.next',public.start_exam(current_setting('exam.prefix')||'-40')::text,true);
select pg_temp.check_exam(current_setting('exam.next')<>current_setting('exam.attempt'),'new completed retake creates new attempt');
select pg_temp.check_exam(public.exam_data(current_setting('exam.next')::uuid)->'questions'<>current_setting('exam.original')::jsonb->'questions','new random order differs');
select set_config('exam.thirty',public.start_exam(current_setting('exam.prefix')||'-30')::text,true);
select pg_temp.check_exam((select total_questions=30 from public.question_attempts where id=current_setting('exam.thirty')::uuid),'exactly 30');
select public.save_exam_answer(current_setting('exam.thirty')::uuid,question_id,'a') from public.question_attempt_questions where attempt_id=current_setting('exam.thirty')::uuid and display_order<=20;
select public.submit_exam(current_setting('exam.thirty')::uuid);
select pg_temp.check_exam((select score_percentage=66.67 from public.question_attempts where id=current_setting('exam.thirty')::uuid),'two-decimal grading');
select set_config('exam.twelve',public.start_exam(current_setting('exam.prefix')||'-12')::text,true);
select pg_temp.check_exam((select total_questions=12 from public.question_attempts where id=current_setting('exam.twelve')::uuid),'fewer than 30 uses all');
select public.submit_exam(current_setting('exam.twelve')::uuid);
select pg_temp.check_exam((select correct_answers=0 and incorrect_answers=12 and score_percentage=0 from public.question_attempts where id=current_setting('exam.twelve')::uuid),'all unanswered may submit');
select pg_temp.check_exam((public.exam_bank_data(current_setting('exam.prefix')||'-0')->'examCount')::integer=0,'zero count');
select pg_temp.denied('select public.start_exam(current_setting(''exam.prefix'')||''-0'')','zero no half-created attempt');
select pg_temp.check_exam((select count(*)=0 from public.question_attempts where question_bank_id=current_setting('exam.prefix')||'-0'),'zero atomic');
reset role;
update public.user_bank_access set status='REVOKED',revoked_at=now() where user_id=current_setting('exam.a')::uuid and question_bank_id=current_setting('exam.prefix')||'-30';
set local role authenticated;
select pg_temp.check_exam(public.exam_data(current_setting('exam.thirty')::uuid)->>'status'='COMPLETED','own completed result retained after revocation');
set local role anon;
select pg_temp.denied('select public.start_exam(current_setting(''exam.prefix'')||''-40'')','anonymous start denied');
select count(*) passed_checks,bool_and(passed) all_passed from exam_test_results;
rollback;

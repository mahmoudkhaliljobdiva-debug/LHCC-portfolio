-- Current rollback-only provisioning/access/ledger/CMS regression.
-- Fixtures have unique IDs: no historical demo seeds or empty-database assumptions.
begin;
create temporary table course_checks(label text primary key);
create function pg_temp.check_test(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',label; end if; insert into course_checks values(label); end; $$;
create function pg_temp.denied(command text,label text) returns void language plpgsql as $$
begin
  begin execute command; exception when insufficient_privilege then insert into course_checks values(label); return; end;
  raise exception 'Expected denial: %',label;
end; $$;
grant select,insert on course_checks to authenticated,anon;
select set_config('lhcc.student',gen_random_uuid()::text,true),set_config('lhcc.other',gen_random_uuid()::text,true),
 set_config('lhcc.admin',gen_random_uuid()::text,true),set_config('lhcc.teacher',gen_random_uuid()::text,true),
 set_config('lhcc.bank',gen_random_uuid()::text,true),set_config('lhcc.rejected_bank',gen_random_uuid()::text,true),
 set_config('lhcc.question',gen_random_uuid()::text,true),set_config('lhcc.question_two',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) values
 (current_setting('lhcc.student')::uuid,'course-'||current_setting('lhcc.student')||'@example.invalid','{"full_name":"[TEST] Course Student","phone":"+96171056331","country_code":"LB","role":"ADMIN"}'),
 (current_setting('lhcc.other')::uuid,'course-'||current_setting('lhcc.other')||'@example.invalid','{"full_name":"[TEST] Other Student"}'),
 (current_setting('lhcc.admin')::uuid,'course-'||current_setting('lhcc.admin')||'@example.invalid','{"full_name":"[TEST] Course Admin"}'),
 (current_setting('lhcc.teacher')::uuid,'course-'||current_setting('lhcc.teacher')||'@example.invalid','{"full_name":"[TEST] Course Teacher"}');
update public.profiles set role='ADMIN' where id=current_setting('lhcc.admin')::uuid;
update public.profiles set role='TEACHER',activation_start=statement_timestamp(),activation_months=12,expiration_date=statement_timestamp()+interval '12 months' where id=current_setting('lhcc.teacher')::uuid;
select pg_temp.check_test((select role='STUDENT' and status='ACTIVE' and phone='+96171056331' and country_code='LB' and expiration_date is null from public.profiles where id=current_setting('lhcc.student')::uuid),'signup cannot grant a metadata role');
select pg_temp.check_test(public.is_profile_access_active('ACTIVE','STUDENT',null),'student activation independent of courses');
select pg_temp.check_test(not public.is_profile_access_active('INACTIVE','STUDENT',null),'inactive denied');
select pg_temp.check_test(not public.is_profile_access_active('EXPIRED','STUDENT',null),'expired denied');
select pg_temp.check_test(not public.is_profile_access_active('ACTIVE','TEACHER',statement_timestamp()-interval '1 day'),'expired teacher denied');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('lhcc.admin'),true),set_config('request.jwt.claims',json_build_object('sub',current_setting('lhcc.admin'),'role','authenticated')::text,true);
select public.manage_bank_content('save_bank',current_setting('lhcc.bank'),'{"name":"[TEST] Paid rollback bank","description":"Isolated verification","status":"active","price":25}');
select public.manage_bank_content('save_bank',current_setting('lhcc.rejected_bank'),'{"name":"[TEST] Rejected rollback bank","description":"Isolated verification","status":"active","price":0}');
select public.manage_bank_content('save_question',current_setting('lhcc.question'),jsonb_build_object('bankId',current_setting('lhcc.bank'),'text','[TEST] Rollback question one','status','active','answers','[{"id":"a","text":"First","isCorrect":true},{"id":"b","text":"Second","isCorrect":false}]'::jsonb));
select public.manage_bank_content('save_question',current_setting('lhcc.question_two'),jsonb_build_object('bankId',current_setting('lhcc.bank'),'text','[TEST] Rollback question two','status','active','answers','[{"id":"a","text":"First","isCorrect":true},{"id":"b","text":"Second","isCorrect":false}]'::jsonb));
select pg_temp.check_test((select count(*)=2 from public.bank_questions where question_bank_id=current_setting('lhcc.bank')),'Admin manages canonical questions');
select set_config('request.jwt.claim.sub',current_setting('lhcc.student'),true),set_config('request.jwt.claims',json_build_object('sub',current_setting('lhcc.student'),'role','authenticated')::text,true);
select pg_temp.check_test((select count(*)=2 from public.question_banks where id in(current_setting('lhcc.bank'),current_setting('lhcc.rejected_bank'))),'real active catalog visible');
select pg_temp.check_test((select count(*)=0 from public.bank_questions where question_bank_id=current_setting('lhcc.bank')),'locked bank questions hidden');
select pg_temp.denied('select * from private.question_solutions','private keys denied');
select pg_temp.denied('select public.admin_bank_data()','student Admin RPC denied');
select pg_temp.denied('select * from public.wallet_transactions','student ledger reads denied');
select pg_temp.denied('update public.profiles set role=''ADMIN'' where id=auth.uid()','self promotion denied');
select set_config('lhcc.request',public.request_bank_access(current_setting('lhcc.bank'))::text,true),set_config('lhcc.reject',public.request_bank_access(current_setting('lhcc.rejected_bank'))::text,true);
select pg_temp.check_test((select count(*)=2 from public.user_bank_access_requests where user_id=auth.uid() and status='PENDING'),'requests persist');
do $$ begin begin perform public.request_bank_access(current_setting('lhcc.bank')); exception when unique_violation then insert into course_checks values('pending request idempotency'); return; end; raise exception 'Duplicate request'; end; $$;
select pg_temp.denied('select public.review_bank_access(current_setting(''lhcc.request'')::uuid,''APPROVED'')','student cannot approve');
select set_config('request.jwt.claim.sub',current_setting('lhcc.other'),true),set_config('request.jwt.claims',json_build_object('sub',current_setting('lhcc.other'),'role','authenticated')::text,true);
select pg_temp.check_test((select count(*)=0 from public.user_bank_access_requests where user_id=current_setting('lhcc.student')::uuid),'requests isolated');
select set_config('request.jwt.claim.sub',current_setting('lhcc.admin'),true),set_config('request.jwt.claims',json_build_object('sub',current_setting('lhcc.admin'),'role','authenticated')::text,true);
select public.review_bank_access(current_setting('lhcc.request')::uuid,'APPROVED');
do $$ begin begin perform public.review_bank_access(current_setting('lhcc.request')::uuid,'APPROVED'); exception when raise_exception then insert into course_checks values('approved retry denied'); return; end; raise exception 'Duplicate review'; end; $$;
select public.review_bank_access(current_setting('lhcc.reject')::uuid,'REJECTED','[TEST] Prerequisite');
select pg_temp.check_test((select count(*)=1 from public.user_bank_access where user_id=current_setting('lhcc.student')::uuid),'only approved course granted');
select pg_temp.check_test((select count(*)=1 from jsonb_array_elements(public.admin_wallet_data()) item where item->>'userId'=current_setting('lhcc.student') and item->>'type'='bank_sale' and (item->>'amount')::numeric=25),'paid approval one atomic ledger entry');
select pg_temp.check_test((select reviewed_by=auth.uid() and reviewed_at is not null and rejection_reason is not null from public.user_bank_access_requests where id=current_setting('lhcc.reject')::uuid),'rejection audit preserved');
select set_config('lhcc.wallet',gen_random_uuid()::text,true);
select public.manage_wallet_transaction('create',current_setting('lhcc.wallet')::uuid,'{"type":"manual_income","name":"[TEST] Rollback entry","amount":12.50,"transactionDate":"2026-10-11"}');
select pg_temp.check_test(exists(select 1 from jsonb_array_elements(public.admin_wallet_data()) i where i->>'id'=current_setting('lhcc.wallet') and (i->>'amount')::numeric=12.50),'manual income signed correctly');
select public.manage_wallet_transaction('update',current_setting('lhcc.wallet')::uuid,'{"type":"manual_expense","name":"[TEST] Rollback entry","amount":5,"transactionDate":"2026-10-11"}');
select pg_temp.check_test(exists(select 1 from jsonb_array_elements(public.admin_wallet_data()) i where i->>'id'=current_setting('lhcc.wallet') and (i->>'amount')::numeric=-5),'manual expense signed correctly');
select public.manage_wallet_transaction('delete',current_setting('lhcc.wallet')::uuid);
select pg_temp.check_test(not exists(select 1 from jsonb_array_elements(public.admin_wallet_data()) i where i->>'id'=current_setting('lhcc.wallet')),'manual ledger deletion authorized');
select set_config('lhcc.portfolio',(select jsonb_object_agg(section_key,content)::text from public.portfolio_content),true);
select public.save_portfolio_content(current_setting('lhcc.portfolio')::jsonb || jsonb_build_object('about',(current_setting('lhcc.portfolio')::jsonb->'about') || '{"title":"[TEST] Rollback CMS"}'));
select pg_temp.check_test((select content->>'title'='[TEST] Rollback CMS' from public.portfolio_content where section_key='about'),'CMS save persists');
select set_config('request.jwt.claim.sub',current_setting('lhcc.student'),true),set_config('request.jwt.claims',json_build_object('sub',current_setting('lhcc.student'),'role','authenticated')::text,true);
select pg_temp.check_test((select count(*)=2 from public.bank_questions where question_bank_id=current_setting('lhcc.bank')),'approved canonical questions visible');
select pg_temp.check_test((select bool_and(not o ? 'isCorrect' and not o ? 'is_correct') from public.bank_questions q cross join lateral jsonb_array_elements(q.options) o where q.question_bank_id=current_setting('lhcc.bank')),'no client option answer keys');
select pg_temp.denied('select public.submit_bank_answer(current_setting(''lhcc.question''),''a'')','retired correctness oracle stays denied');
select set_config('lhcc.attempt',public.start_learning_exam(jsonb_build_object('bankId',current_setting('lhcc.bank'),'source','RANDOM','sourceId',null,'mode','PRACTICE','count',2,'timeLimitMinutes',null))::text,true);
select public.save_exam_answer(current_setting('lhcc.attempt')::uuid,current_setting('lhcc.question'),'a');
select pg_temp.check_test(public.check_practice_answer(current_setting('lhcc.attempt')::uuid,current_setting('lhcc.question'))->>'outcome'='true','trusted practice grade');
select pg_temp.check_test(public.check_practice_answer(current_setting('lhcc.attempt')::uuid,current_setting('lhcc.question'))->>'outcome'='true','answer retry stable');
select public.save_exam_answer(current_setting('lhcc.attempt')::uuid,current_setting('lhcc.question_two'),'b');
select pg_temp.check_test(public.check_practice_answer(current_setting('lhcc.attempt')::uuid,current_setting('lhcc.question_two'))->>'outcome'='false','wrong answer trusted grade');
select public.submit_exam(current_setting('lhcc.attempt')::uuid);
select pg_temp.check_test((select status='COMPLETED' and correct_answers=1 and incorrect_answers=1 and score_percentage=50 from public.question_attempts where student_id=auth.uid() and question_bank_id=current_setting('lhcc.bank')),'attempt score 50 persists');
select pg_temp.check_test((select count(*)=2 from public.question_attempt_answers a join public.question_attempts t on t.id=a.attempt_id where t.student_id=auth.uid() and t.question_bank_id=current_setting('lhcc.bank')),'answer retry cannot duplicate');
select set_config('request.jwt.claim.sub',current_setting('lhcc.other'),true),set_config('request.jwt.claims',json_build_object('sub',current_setting('lhcc.other'),'role','authenticated')::text,true);
select pg_temp.check_test((select count(*)=0 from public.question_attempts where student_id=current_setting('lhcc.student')::uuid),'attempt ownership enforced');
reset role;
insert into public.teacher_bank_assignments(teacher_id,question_bank_id,assigned_by) values(current_setting('lhcc.teacher')::uuid,current_setting('lhcc.bank'),current_setting('lhcc.admin')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('lhcc.teacher'),true),set_config('request.jwt.claims',json_build_object('sub',current_setting('lhcc.teacher'),'role','authenticated')::text,true);
select pg_temp.check_test((select count(*)=2 from public.bank_questions where question_bank_id=current_setting('lhcc.bank')),'assigned teacher views questions');
select pg_temp.check_test((select count(*)=0 from public.question_attempts where student_id=current_setting('lhcc.student')::uuid),'teacher cannot read student-owned attempts directly');
select pg_temp.denied('select * from private.question_solutions','teacher private keys denied');
reset role;
set local role anon;
select pg_temp.check_test(exists(select 1 from public.portfolio_content where section_key='about'),'published CMS readable anonymously');
select pg_temp.denied('select default_content from public.portfolio_content','CMS defaults private');
reset role;
select count(*) as passed_checks,true as all_passed from course_checks;
rollback;

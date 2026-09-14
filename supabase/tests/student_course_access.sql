-- Run in a transaction and always ROLLBACK. Tests create no lasting users or grants.
-- Run after all migrations to verify the complete backend contract.
begin;
create function pg_temp.check_test(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', label; end if; end; $$;
create function pg_temp.expect_denied(command text) returns void language plpgsql as $$
begin
  begin execute command; exception when insufficient_privilege then return; end;
  raise exception 'Expected permission denial: %', command;
end; $$;

select set_config('lhcc.test_student', gen_random_uuid()::text, true);
select set_config('lhcc.test_other', gen_random_uuid()::text, true);
select set_config('lhcc.test_admin', gen_random_uuid()::text, true);
select set_config('lhcc.test_teacher', gen_random_uuid()::text, true);
insert into auth.users(id, email, raw_user_meta_data) values
 (current_setting('lhcc.test_student')::uuid, 'course-test-' || current_setting('lhcc.test_student') || '@example.invalid', '{"full_name":"Course test student","age":25,"gender":"MALE","home_address":"Beirut","phone":"+96171056331","country_code":"LB","role":"ADMIN","status":"ACTIVE"}'),
 (current_setting('lhcc.test_other')::uuid, 'course-test-' || current_setting('lhcc.test_other') || '@example.invalid', '{"full_name":"Other test student"}'),
 (current_setting('lhcc.test_admin')::uuid, 'course-test-' || current_setting('lhcc.test_admin') || '@example.invalid', '{"full_name":"Temporary test admin"}'),
 (current_setting('lhcc.test_teacher')::uuid, 'course-test-' || current_setting('lhcc.test_teacher') || '@example.invalid', '{"full_name":"Temporary test teacher"}');
update public.profiles set role='ADMIN' where id=current_setting('lhcc.test_admin')::uuid;
update public.profiles set role='TEACHER', activation_start=statement_timestamp(), activation_months=12,
  expiration_date=statement_timestamp()+interval '12 months' where id=current_setting('lhcc.test_teacher')::uuid;
update public.question_banks set price=25 where id='anatomy';
select pg_temp.check_test((select role='STUDENT' and status='ACTIVE' and age=25 and gender='MALE' and home_address='Beirut' and phone='+96171056331' and country_code='LB' and expiration_date is null from public.profiles where id=current_setting('lhcc.test_student')::uuid), 'signup profile and privilege enforcement');
select pg_temp.check_test(public.is_profile_access_active('ACTIVE','STUDENT',null), 'enabled student without expiration');
select pg_temp.check_test(not public.is_profile_access_active('INACTIVE','STUDENT',null), 'disabled student');
select pg_temp.check_test(not public.is_profile_access_active('EXPIRED','STUDENT',null), 'explicitly expired student');
select pg_temp.check_test(public.is_profile_access_active('ACTIVE','ADMIN',null), 'admin unchanged');
select pg_temp.check_test(not public.is_profile_access_active('ACTIVE','TEACHER',statement_timestamp()-interval '1 day'), 'expired teacher unchanged');

set local role anon;
select pg_temp.check_test((select count(*)=4 from public.portfolio_content), 'anonymous visitors can read published portfolio content');
select pg_temp.expect_denied('select default_content from public.portfolio_content');
select pg_temp.expect_denied('update public.portfolio_content set revision=revision+1');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('lhcc.test_student'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('lhcc.test_student'),'role','authenticated')::text,true);
select pg_temp.check_test((select count(*)=5 from public.question_banks), 'only active catalog visible');
select pg_temp.check_test((select count(*)=0 from public.bank_questions), 'locked student receives no questions');
select pg_temp.expect_denied('select * from private.question_solutions');
select pg_temp.expect_denied('select * from public.wallet_transactions');
select pg_temp.expect_denied('insert into public.question_attempts(student_id,question_bank_id,total_questions) values(auth.uid(),''anatomy'',2)');
select pg_temp.expect_denied('select public.admin_bank_data()');
select pg_temp.expect_denied('select public.list_bank_access_requests()');
select pg_temp.expect_denied('select public.manage_bank_content(''delete_bank'',''anatomy'')');
select pg_temp.expect_denied('select public.submit_bank_answer(''question-anatomy-heart'',''answer-heart-heart'')');
select pg_temp.expect_denied('insert into public.user_bank_access(user_id,question_bank_id,granted_by) values(auth.uid(),''anatomy'',auth.uid())');
select pg_temp.expect_denied('insert into public.user_bank_access_requests(question_bank_id,status) values(''anatomy'',''APPROVED'')');
select pg_temp.expect_denied('select public.request_bank_access(''microbiology'')');
select set_config('lhcc.request_one',public.request_bank_access('anatomy')::text,true);
select set_config('lhcc.request_two',public.request_bank_access('physiology')::text,true);
select pg_temp.check_test((select count(*)=2 from public.user_bank_access_requests where status='PENDING'), 'requests persisted');
do $$ begin
  begin perform public.request_bank_access('anatomy'); exception when unique_violation then return; end;
  raise exception 'Duplicate pending request accepted';
end; $$;
select pg_temp.expect_denied('update public.user_bank_access_requests set status=''APPROVED''');
select pg_temp.expect_denied('update public.user_bank_access_requests set reviewed_by=auth.uid()');
select pg_temp.expect_denied('select public.review_bank_access(current_setting(''lhcc.request_one'')::uuid,''APPROVED'')');

select set_config('request.jwt.claim.sub',current_setting('lhcc.test_other'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('lhcc.test_other'),'role','authenticated')::text,true);
select pg_temp.check_test((select count(*)=0 from public.user_bank_access_requests), 'other student cannot read requests');

select set_config('request.jwt.claim.sub',current_setting('lhcc.test_admin'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('lhcc.test_admin'),'role','authenticated')::text,true);
select pg_temp.check_test(
  exists(select 1 from jsonb_array_elements(public.list_bank_access_requests()) item where item->>'id'=current_setting('lhcc.request_one'))
  and exists(select 1 from jsonb_array_elements(public.list_bank_access_requests()) item where item->>'id'=current_setting('lhcc.request_two')),
  'admin sees test requests'
);
select public.review_bank_access(current_setting('lhcc.request_one')::uuid,'APPROVED');
select public.review_bank_access(current_setting('lhcc.request_two')::uuid,'REJECTED','Complete the prerequisite first.');
select pg_temp.check_test((select count(*)=1 from public.user_bank_access where user_id=current_setting('lhcc.test_student')::uuid), 'approval grants exactly one access');
select pg_temp.check_test(exists(select 1 from jsonb_array_elements(public.admin_wallet_data()) item where item->>'type'='bank_sale' and (item->>'amount')::numeric=25), 'paid approval records one sale atomically');
select pg_temp.check_test((select reviewed_by=auth.uid() and reviewed_at is not null and rejection_reason is not null from public.user_bank_access_requests where id=current_setting('lhcc.request_two')::uuid), 'rejection audited');
select pg_temp.check_test(exists(select 1 from jsonb_array_elements(public.admin_wallet_data()) item where item->>'userId'=current_setting('lhcc.test_student') and item->>'type'='bank_sale'), 'admin wallet RPC returns the paid approval');
select set_config('lhcc.wallet_item',gen_random_uuid()::text,true);
select public.manage_wallet_transaction('create',current_setting('lhcc.wallet_item')::uuid,'{"type":"manual_income","name":"Training materials","amount":12.50,"transactionDate":"2026-09-13","category":"Education"}'::jsonb);
select pg_temp.check_test(exists(select 1 from jsonb_array_elements(public.admin_wallet_data()) item where item->>'id'=current_setting('lhcc.wallet_item') and (item->>'amount')::numeric=12.50), 'admin creates a manual wallet transaction');
select public.manage_wallet_transaction('update',current_setting('lhcc.wallet_item')::uuid,'{"type":"manual_expense","name":"Training materials","amount":5,"transactionDate":"2026-09-13"}'::jsonb);
select pg_temp.check_test(exists(select 1 from jsonb_array_elements(public.admin_wallet_data()) item where item->>'id'=current_setting('lhcc.wallet_item') and item->>'type'='manual_expense' and (item->>'amount')::numeric=-5), 'admin updates a manual wallet transaction');
select public.manage_wallet_transaction('delete',current_setting('lhcc.wallet_item')::uuid);
select pg_temp.check_test(not exists(select 1 from jsonb_array_elements(public.admin_wallet_data()) item where item->>'id'=current_setting('lhcc.wallet_item')), 'admin deletes a manual wallet transaction');
select set_config('lhcc.portfolio', (select jsonb_object_agg(section_key,content)::text from public.portfolio_content), true);
select public.save_portfolio_content((current_setting('lhcc.portfolio')::jsonb || jsonb_build_object('about',current_setting('lhcc.portfolio')::jsonb->'about' || '{"title":"Updated test title"}'::jsonb)));
select pg_temp.check_test((select content->>'title'='Updated test title' from public.portfolio_content where section_key='about'), 'admin updates portfolio content');
select public.reset_portfolio_content();
select pg_temp.check_test((select content->>'title'='Better learning creates better care.' from public.portfolio_content where section_key='about'), 'admin resets portfolio content');

select set_config('request.jwt.claim.sub',current_setting('lhcc.test_student'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('lhcc.test_student'),'role','authenticated')::text,true);
select pg_temp.check_test((select count(*)=2 from public.bank_questions), 'approved student sees only anatomy questions');
select pg_temp.check_test((select count(*)=1 from public.user_bank_access), 'student sees own grant');
select pg_temp.expect_denied('select * from private.question_solutions');
select pg_temp.check_test((select bool_and(not o ? 'isCorrect' and not o ? 'is_correct') from public.bank_questions q cross join lateral jsonb_array_elements(q.options) o), 'options contain no answer keys');
select pg_temp.check_test((public.submit_bank_answer('question-anatomy-heart','answer-heart-heart')->>'correct')::boolean, 'correct answer evaluated after submission');
select pg_temp.check_test(not (public.submit_bank_answer('question-anatomy-bones','answer-bones-186')->>'correct')::boolean, 'wrong answer evaluated after submission');
select pg_temp.check_test((select status='COMPLETED' and correct_answers=1 and incorrect_answers=1 and score_percentage=50 from public.question_attempts where student_id=auth.uid()), 'attempt completion and score persisted');
select pg_temp.check_test((select count(*)=2 from public.question_attempt_answers), 'individual answers persisted once');
select public.request_bank_access('physiology');
select pg_temp.check_test((select count(*)=2 from public.user_bank_access_requests where question_bank_id='physiology'), 're-request preserves rejection history');
select pg_temp.expect_denied('select public.request_bank_access(''anatomy'')');
reset role;
update public.question_banks set status='inactive' where id='anatomy';
set local role authenticated;
select pg_temp.check_test((select count(*)=0 from public.bank_questions), 'inactive bank blocks existing grant');
select pg_temp.expect_denied('select public.submit_bank_answer(''question-anatomy-heart'',''answer-heart-heart'')');
reset role;
update public.question_banks set status='active' where id='anatomy';
update public.profiles set status='INACTIVE' where id=current_setting('lhcc.test_student')::uuid;
set local role authenticated;
select pg_temp.check_test((select count(*)=0 from public.bank_questions), 'suspended account loses question access');
select pg_temp.expect_denied('select public.request_bank_access(''pathology'')');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('lhcc.test_teacher'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('lhcc.test_teacher'),'role','authenticated')::text,true);
select pg_temp.check_test((select count(*)=3 from public.bank_questions), 'active teacher can read published questions without student grants');
select pg_temp.check_test((select count(*)=1 from public.question_attempts where student_id=current_setting('lhcc.test_student')::uuid), 'teacher reporting can read persisted attempts');
select pg_temp.expect_denied('select * from private.question_solutions');
reset role;
select 'PASS: provisioning, role enforcement, catalog, locks, requests, atomic paid approval, wallet ledger, portfolio CMS, attempts, analytics visibility, suspension and answer isolation' as result;
rollback;

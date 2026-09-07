-- Run in a transaction and always ROLLBACK. Tests create no lasting users or grants.
-- Can be appended to the new migration before its COMMIT for a full dry run.
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
insert into auth.users(id, email, raw_user_meta_data) values
 (current_setting('lhcc.test_student')::uuid, 'course-test-' || current_setting('lhcc.test_student') || '@example.invalid', '{"full_name":"Course test student","age":25,"gender":"MALE","home_address":"Beirut","phone":"+96171056331","country_code":"LB","role":"ADMIN","status":"ACTIVE"}'),
 (current_setting('lhcc.test_other')::uuid, 'course-test-' || current_setting('lhcc.test_other') || '@example.invalid', '{"full_name":"Other test student"}'),
 (current_setting('lhcc.test_admin')::uuid, 'course-test-' || current_setting('lhcc.test_admin') || '@example.invalid', '{"full_name":"Temporary test admin"}');
update public.profiles set role='ADMIN' where id=current_setting('lhcc.test_admin')::uuid;
select pg_temp.check_test((select role='STUDENT' and status='ACTIVE' and age=25 and gender='MALE' and home_address='Beirut' and phone='+96171056331' and country_code='LB' and expiration_date is null from public.profiles where id=current_setting('lhcc.test_student')::uuid), 'signup profile and privilege enforcement');
select pg_temp.check_test(public.is_profile_access_active('ACTIVE','STUDENT',null), 'enabled student without expiration');
select pg_temp.check_test(not public.is_profile_access_active('INACTIVE','STUDENT',null), 'disabled student');
select pg_temp.check_test(not public.is_profile_access_active('EXPIRED','STUDENT',null), 'explicitly expired student');
select pg_temp.check_test(public.is_profile_access_active('ACTIVE','ADMIN',null), 'admin unchanged');
select pg_temp.check_test(not public.is_profile_access_active('ACTIVE','TEACHER',statement_timestamp()-interval '1 day'), 'expired teacher unchanged');

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('lhcc.test_student'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('lhcc.test_student'),'role','authenticated')::text,true);
select pg_temp.check_test((select count(*)=5 from public.question_banks), 'only active catalog visible');
select pg_temp.check_test((select count(*)=0 from public.bank_questions), 'locked student receives no questions');
select pg_temp.expect_denied('select * from private.question_solutions');
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
select pg_temp.check_test(jsonb_array_length(public.list_bank_access_requests())=2,'admin sees requests');
select public.review_bank_access(current_setting('lhcc.request_one')::uuid,'APPROVED');
select public.review_bank_access(current_setting('lhcc.request_two')::uuid,'REJECTED','Complete the prerequisite first.');
select pg_temp.check_test((select count(*)=1 from public.user_bank_access where user_id=current_setting('lhcc.test_student')::uuid), 'approval grants exactly one access');
select pg_temp.check_test((select reviewed_by=auth.uid() and reviewed_at is not null and rejection_reason is not null from public.user_bank_access_requests where id=current_setting('lhcc.request_two')::uuid), 'rejection audited');

select set_config('request.jwt.claim.sub',current_setting('lhcc.test_student'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('lhcc.test_student'),'role','authenticated')::text,true);
select pg_temp.check_test((select count(*)=2 from public.bank_questions), 'approved student sees only anatomy questions');
select pg_temp.check_test((select count(*)=1 from public.user_bank_access), 'student sees own grant');
select pg_temp.expect_denied('select * from private.question_solutions');
select pg_temp.check_test((select bool_and(not o ? 'isCorrect' and not o ? 'is_correct') from public.bank_questions q cross join lateral jsonb_array_elements(q.options) o), 'options contain no answer keys');
select pg_temp.check_test(public.submit_bank_answer('question-anatomy-heart','answer-heart-heart'), 'answer evaluated after submission');
select pg_temp.check_test(not public.submit_bank_answer('question-anatomy-heart','answer-heart-liver'), 'wrong answer evaluated');
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
select 'PASS: provisioning, role tampering, catalog, locks, requests, duplicates, admin review, grants, rejection history, ownership, suspension and answer isolation' as result;

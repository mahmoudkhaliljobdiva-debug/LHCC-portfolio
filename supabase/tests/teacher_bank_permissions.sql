-- Transaction-only fixtures. Nothing persists, including Auth accounts.
begin;
create temporary table teacher_test_results(label text, passed boolean);
grant select,insert on teacher_test_results to authenticated, anon;
create function pg_temp.check_test(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAILED: %',label; end if;
  insert into teacher_test_results values(label,true);
end; $$;
create function pg_temp.expect_error(command text,code text,label text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when others then
    if sqlstate=code then perform pg_temp.check_test(true,label); return; end if;
    raise;
  end;
  raise exception 'Expected error: %',label;
end; $$;
select set_config('lhcc.teacher',gen_random_uuid()::text,true);
select set_config('lhcc.student',gen_random_uuid()::text,true);
select set_config('lhcc.admin',(select id::text from public.profiles where role='ADMIN' and status='ACTIVE' order by id limit 1),true);
select set_config('lhcc.bank','teacher-test-'||gen_random_uuid(),true);
select set_config('lhcc.otherbank','teacher-test-'||gen_random_uuid(),true);
select set_config('lhcc.question',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) values
  (current_setting('lhcc.teacher')::uuid,'teacher-'||current_setting('lhcc.teacher')||'@example.invalid','{"full_name":"Transactional teacher"}'),
  (current_setting('lhcc.student')::uuid,'student-'||current_setting('lhcc.student')||'@example.invalid','{"full_name":"Transactional student"}');
insert into public.question_banks(id,name,description,status,price) values
 (current_setting('lhcc.bank'),'Transactional bank','Rollback fixture','active',0),
 (current_setting('lhcc.otherbank'),'Unassigned bank','Rollback fixture','active',0);
select set_config('lhcc.profile_payload',jsonb_build_object('id',current_setting('lhcc.teacher'),'full_name','Transactional teacher','role','TEACHER','status','ACTIVE','activation_start',now(),'activation_months',1,'expiration_date',now()+interval '1 month','teacherBankIds',jsonb_build_array(current_setting('lhcc.bank')))::text,true);
select set_config('lhcc.question_payload',jsonb_build_object('bankId',current_setting('lhcc.bank'),'text','Transactional question','status','active','answers',jsonb_build_array(jsonb_build_object('id','a','text','First','isCorrect',true),jsonb_build_object('id','b','text','Second','isCorrect',false)))::text,true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('lhcc.admin'),'role','authenticated')::text,true);
select public.admin_update_managed_profile(current_setting('lhcc.profile_payload')::jsonb);
select pg_temp.check_test((select count(*)=1 from public.teacher_bank_assignments where teacher_id=current_setting('lhcc.teacher')::uuid),'admin assigns bank atomically');
select pg_temp.expect_error('select public.admin_update_managed_profile(current_setting(''lhcc.profile_payload'')::jsonb || ''{"teacherBankIds":[]}''::jsonb)','P0001','teacher requires a bank');
select pg_temp.expect_error('select public.admin_update_managed_profile(current_setting(''lhcc.profile_payload'')::jsonb || ''{"full_name":"Invalid changed","teacherBankIds":["missing-bank"]}''::jsonb)','P0001','invalid assignment rejected');
select pg_temp.check_test((select role='ADMIN' from public.profiles where id=current_setting('lhcc.admin')::uuid),'admin identity unchanged');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('lhcc.teacher'),'role','authenticated')::text,true);
select pg_temp.check_test((select role='TEACHER' and full_name='Transactional teacher' from public.profiles where id=auth.uid()),'promotion and failed update atomic');
select pg_temp.check_test((select count(*)=1 from public.question_banks),'teacher sees only assigned bank');
select pg_temp.check_test((select count(*)=1 from public.teacher_bank_assignments),'teacher sees only own assignments');
select public.teacher_add_question(current_setting('lhcc.question'),current_setting('lhcc.question_payload')::jsonb);
select pg_temp.check_test((select count(*)=1 from public.bank_questions where question_bank_id=current_setting('lhcc.bank')),'teacher can insert and read');
select pg_temp.check_test((select not exists(select 1 from jsonb_array_elements(options) o where o ? 'isCorrect') from public.bank_questions where id=current_setting('lhcc.question')),'answer keys not serialized');
select pg_temp.expect_error('select * from private.question_solutions','42501','private answer keys denied');
select pg_temp.expect_error('select public.teacher_add_question(gen_random_uuid()::text,current_setting(''lhcc.question_payload'')::jsonb || jsonb_build_object(''bankId'',current_setting(''lhcc.otherbank'')))','42501','unassigned bank insert denied');
select pg_temp.expect_error('select public.teacher_add_question(current_setting(''lhcc.question''),current_setting(''lhcc.question_payload'')::jsonb)','23505','existing question cannot be overwritten');
select pg_temp.expect_error('delete from public.bank_questions where id=current_setting(''lhcc.question'')','42501','direct delete denied');
select pg_temp.expect_error('update public.bank_questions set text=''Altered'' where id=current_setting(''lhcc.question'')','42501','direct edit denied');
select pg_temp.expect_error('select public.manage_bank_content(''delete_question'',current_setting(''lhcc.question''))','42501','admin delete RPC denied');
select pg_temp.expect_error('select public.request_bank_access(current_setting(''lhcc.bank''))','42501','teacher cannot request student access');
select pg_temp.expect_error('select public.admin_update_managed_profile(current_setting(''lhcc.profile_payload'')::jsonb)','42501','teacher cannot assign roles or banks');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('lhcc.student'),'role','authenticated')::text,true);
select pg_temp.expect_error('select public.teacher_add_question(gen_random_uuid()::text,current_setting(''lhcc.question_payload'')::jsonb)','42501','student cannot author questions');
select pg_temp.check_test((select count(*)=0 from public.teacher_bank_assignments),'student cannot read teacher assignments');
select pg_temp.check_test((select count(*)=0 from public.bank_questions),'student without grant cannot read questions');
select public.request_bank_access(current_setting('lhcc.bank'));
select pg_temp.check_test((select count(*)=1 from public.user_bank_access_requests where user_id=auth.uid() and question_bank_id=current_setting('lhcc.bank')),'student can request bank');
reset role;
update public.profiles set status='INACTIVE' where id=current_setting('lhcc.teacher')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('lhcc.teacher'),'role','authenticated')::text,true);
select pg_temp.check_test((select count(*)=0 from public.question_banks),'inactive teacher loses bank access');
select pg_temp.expect_error('select public.teacher_add_question(gen_random_uuid()::text,current_setting(''lhcc.question_payload'')::jsonb)','42501','inactive teacher cannot add');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('lhcc.admin'),'role','authenticated')::text,true);
select public.admin_update_managed_profile(current_setting('lhcc.profile_payload')::jsonb || '{"role":"STUDENT","activation_start":null,"activation_months":null,"expiration_date":null,"teacherBankIds":[]}'::jsonb);
select pg_temp.check_test((select count(*)=0 from public.teacher_bank_assignments where teacher_id=current_setting('lhcc.teacher')::uuid),'demotion removes teacher assignments');
set local role anon;
select pg_temp.expect_error('select public.teacher_add_question(gen_random_uuid()::text,current_setting(''lhcc.question_payload'')::jsonb)','42501','anonymous teacher RPC denied');
reset role;
select count(*) as passed_checks,bool_and(passed) as all_passed from teacher_test_results;
rollback;

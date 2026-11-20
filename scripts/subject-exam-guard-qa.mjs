// LOCAL archive-db only. Reproduce the prior definer/RLS gap, then verify the
// corrected endpoints in one ROLLBACK transaction. No production credentials/data.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const container='supabase_db_archive-db';
const info=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.equal(info.Config.Labels['com.supabase.cli.project'],'archive-db');assert(info.State.Running);
const baseline=await readFile('supabase/migrations/20260928173425_student_bank_exams.sql','utf8');
const start=baseline.indexOf('create function private.lock_exam_access('),end=baseline.indexOf('revoke all on function private.lock_exam_access',start);
assert(start>=0&&end>start);
const oldGuard=baseline.slice(start,end).replace('create function','create or replace function');
const fixed=await readFile('supabase/migrations/20261115130827_subject_legacy_exam_guard.sql','utf8');
const sql=`begin;
create temporary table subject_exam_checks(label text);
grant select,insert on subject_exam_checks to authenticated;
create function pg_temp.assert_guard(ok boolean,label text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL %',label; end if;
 insert into subject_exam_checks values(label);
end $$;
create function pg_temp.deny_guard(command text,label text) returns void language plpgsql as $$ begin
 begin execute command; exception when insufficient_privilege then
  if sqlerrm<>'Published exam track required' then raise; end if;
  perform pg_temp.assert_guard(true,label);return;
 end;raise exception 'Expected denial: %',label;
end $$;
select set_config('sg.student',(select id::text from public.profiles where role='STUDENT' and status='ACTIVE' limit 1),true),
 set_config('sg.bank','subject-guard-'||gen_random_uuid()::text,true);
select pg_temp.assert_guard(nullif(current_setting('sg.student'),'') is not null,'active isolated Student fixture exists');
insert into public.question_banks(id,name,description,specialty_id,material_kind,exam_category,publication_status,status)
 values(current_setting('sg.bank'),'[TEST] Legacy Subject guard','Rollback-only regression',(select id from public.specialties where slug='medical'),'SUBJECT',null,'PUBLISHED','active');
insert into public.bank_questions(id,question_bank_id,text,status,options)
 values(current_setting('sg.bank')||'-q',current_setting('sg.bank'),'[TEST] Unapproved fixture','active','[{"id":"a","text":"First"},{"id":"b","text":"Second"}]');
insert into private.question_solutions(question_id,correct_option_id) values(current_setting('sg.bank')||'-q','a');
${oldGuard}
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('sg.student'),'role','authenticated')::text,true);
select pg_temp.assert_guard(private.can_open_bank(current_setting('sg.bank')),'free Subject catalog access exists');
select pg_temp.assert_guard(not exists(select 1 from public.bank_questions where question_bank_id=current_setting('sg.bank')),'RLS hides unapproved Subject question');
select set_config('sg.attempt',public.start_learning_exam(jsonb_build_object('bankId',current_setting('sg.bank'),'source','RANDOM','sourceId',null,'mode','PRACTICE','count',1,'timeLimitMinutes',null))::text,true);
reset role;
select pg_temp.assert_guard((select total_questions=1 from public.question_attempts where id=current_setting('sg.attempt')::uuid),'prior definer selector reproduced RLS bypass locally');
select set_config('sg.snapshot',(select md5(to_jsonb(a)::text) from public.question_attempts a where id=current_setting('sg.attempt')::uuid),true);
${fixed}
set local role authenticated;
select pg_temp.deny_guard($q$select public.start_exam(current_setting('sg.bank'))$q$,'legacy start_exam denies Subjects');
do $$ declare mode text; source text; begin
 foreach mode in array array['EXAM','PRACTICE'] loop foreach source in array array['RANDOM','ALL','CASE','CHAPTER','PAST','SHARED'] loop
  perform pg_temp.deny_guard(format('select public.start_learning_exam(%L::jsonb)',jsonb_build_object('bankId',current_setting('sg.bank'),'source',source,'sourceId',gen_random_uuid(),'mode',mode,'count',1,'timeLimitMinutes',null)::text),mode||'/'||source||' denies Subjects');
 end loop;end loop;
end $$;
select pg_temp.deny_guard($q$select public.save_exam_answer(current_setting('sg.attempt')::uuid,current_setting('sg.bank')||'-q','a')$q$,'legacy answer save denies Subject attempt');
select pg_temp.deny_guard($q$select public.save_exam_answer_versioned(current_setting('sg.attempt')::uuid,current_setting('sg.bank')||'-q','a',0)$q$,'versioned answer save denies Subject attempt');
select pg_temp.deny_guard($q$select public.check_practice_answer(current_setting('sg.attempt')::uuid,current_setting('sg.bank')||'-q')$q$,'practice correctness check denies Subject attempt');
select pg_temp.deny_guard($q$select public.submit_exam(current_setting('sg.attempt')::uuid)$q$,'legacy grading denies Subject attempt');
reset role;
select pg_temp.assert_guard((select count(*)=1 from public.question_attempts where question_bank_id=current_setting('sg.bank')),'denials create no additional attempts');
select pg_temp.assert_guard((select md5(to_jsonb(a)::text)=current_setting('sg.snapshot') from public.question_attempts a where id=current_setting('sg.attempt')::uuid),'denials preserve existing attempt row');
select pg_temp.assert_guard(not exists(select 1 from public.question_attempt_answers where attempt_id=current_setting('sg.attempt')::uuid),'denials write no answers');
select pg_temp.assert_guard(not has_function_privilege('authenticated','public.submit_bank_answer(text,text)','EXECUTE'),'retired answer oracle stays denied');
select pg_temp.assert_guard(not has_function_privilege('authenticated','private.lock_exam_access(text)','EXECUTE'),'private lock helper stays uncallable');
select count(*) as passed from subject_exam_checks;rollback;
`;
const output=execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:30000}).trim();
console.log('PASS Subject legacy endpoint rollback regression: '+output.split('\n').at(-1)+' checks; prior gap reproduced locally; all fixtures and temporary function replacements rolled back.');

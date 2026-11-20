-- Rollback-only archive + practice + timer + access verification.
begin;
create temporary table archive_checks(label text);
grant select,insert on archive_checks to authenticated;
create function pg_temp.archive_assert(ok boolean,label text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAILED: %',label; end if; insert into archive_checks values(label);
end $$;
create function pg_temp.archive_denied(command text,label text) returns void language plpgsql as $$ begin
 begin execute command; exception when others then if sqlstate in ('42501','23514') then perform pg_temp.archive_assert(true,label); return; end if; raise; end;
 raise exception 'Expected denial: %',label;
end $$;
select set_config('archive.admin',(select id::text from public.profiles where role='ADMIN' and status='ACTIVE' limit 1),true),
 set_config('archive.student',gen_random_uuid()::text,true),set_config('archive.other',gen_random_uuid()::text,true),
 set_config('archive.bank','archive-'||gen_random_uuid(),true),set_config('archive.exam',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) values
 (current_setting('archive.student')::uuid,current_setting('archive.student')||'@example.invalid','{"full_name":"Archive rollback"}'),
 (current_setting('archive.other')::uuid,current_setting('archive.other')||'@example.invalid','{"full_name":"Archive isolation"}');
insert into public.question_banks(id,name,description,status) values(current_setting('archive.bank'),'[TEST] Archive','Rollback','active');
insert into public.user_bank_access(user_id,question_bank_id,status,granted_by) values(current_setting('archive.student')::uuid,current_setting('archive.bank'),'ACTIVE',current_setting('archive.admin')::uuid);
select set_config('archive.payload',jsonb_build_object('id',current_setting('archive.exam'),'bankId',current_setting('archive.bank'),
 'sourceId',null,'title','[TEST] 2025 Session A','year',2025,'session','A','timeLimitMinutes',null,'provenance','Rollback fixture','status','DRAFT',
 'questions',(select jsonb_agg(jsonb_build_object('id',current_setting('archive.bank')||'-q'||i,'reuseQuestionId',null,'sourceNumber',i::text,'text','Question '||i,
 'options','[{"id":"a","text":"First"},{"id":"b","text":"Second"}]'::jsonb,'correctOptionId','a','verified',true,'includeInBank',true,
 'caseId',null,'caseTitle','','caseDescription','','warnings','[]'::jsonb) order by i) from generate_series(1,35) i))::text,true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('archive.admin'),'role','authenticated')::text,true);
select public.save_past_exam(current_setting('archive.payload')::jsonb);
select pg_temp.archive_assert((select count(*)=0 from public.bank_questions where question_bank_id=current_setting('archive.bank')),'draft import does not create business questions');
select pg_temp.archive_denied('select public.save_past_exam(jsonb_set(jsonb_set(current_setting(''archive.payload'')::jsonb,''{status}'',''"PUBLISHED"''),''{year}'',''null''))','missing year blocked');
select pg_temp.archive_denied('select public.save_past_exam(jsonb_set(jsonb_set(current_setting(''archive.payload'')::jsonb,''{status}'',''"PUBLISHED"''),''{questions,0,verified}'',''false''))','unverified key blocked');
select public.save_past_exam(jsonb_set(current_setting('archive.payload')::jsonb,'{status}','"PUBLISHED"'));
select pg_temp.archive_assert((select count(*)=35 from public.bank_questions where question_bank_id=current_setting('archive.bank')),'published reusable questions');
select public.save_past_exam(jsonb_set(current_setting('archive.payload')::jsonb,'{status}','"PUBLISHED"'));
select pg_temp.archive_assert((select count(*)=35 from public.bank_questions where question_bank_id=current_setting('archive.bank')),'repeat publish does not duplicate');
select pg_temp.archive_denied('select public.save_past_exam(jsonb_set(jsonb_set(jsonb_set(current_setting(''archive.payload'')::jsonb,''{id}'',to_jsonb(gen_random_uuid()::text)),''{status}'',''"PUBLISHED"''),''{questions}'',jsonb_build_array(current_setting(''archive.payload'')::jsonb->''questions''->0)))','draft cannot claim another exam question ownership');
select public.save_past_exam(jsonb_set(jsonb_set(jsonb_set(current_setting('archive.payload')::jsonb,'{id}',to_jsonb(gen_random_uuid()::text)),'{status}','"PUBLISHED"'),'{questions}',
 jsonb_build_array(jsonb_set(current_setting('archive.payload')::jsonb->'questions'->0,'{reuseQuestionId}',to_jsonb(current_setting('archive.bank')||'-q1')))));
select pg_temp.archive_assert((select count(*)=35 from public.bank_questions where question_bank_id=current_setting('archive.bank')),'explicit reuse across same-year sessions preserves canonical question');
-- Excluded historical questions must not inflate complete-bank case setup counts.
reset role;
insert into public.question_sections(id,question_bank_id,title,description,display_order)
 values(current_setting('archive.bank')||'-case',current_setting('archive.bank'),'Eligibility fixture','Original context',1);
update public.bank_questions set section_id=current_setting('archive.bank')||'-case',include_in_complete_bank=(id<>current_setting('archive.bank')||'-q35')
 where question_bank_id=current_setting('archive.bank');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('archive.student'),'role','authenticated')::text,true);
select pg_temp.archive_assert(public.exam_bank_data(current_setting('archive.bank'))->'cases'->0->>'questionCount'='34','case setup counts eligible questions only');
select pg_temp.archive_assert(public.exam_bank_data(current_setting('archive.bank'))->'pastExams'->0->>'year'='2025','published archive year visible');
select pg_temp.archive_denied('select public.admin_past_exams(current_setting(''archive.bank''))','student cannot read draft keys');
select pg_temp.archive_denied('select public.save_past_exam(current_setting(''archive.payload'')::jsonb)','student cannot publish');
select set_config('archive.config',jsonb_build_object('bankId',current_setting('archive.bank'),'source','PAST','sourceId',current_setting('archive.exam'),'mode','EXAM','count',30,'timeLimitMinutes',null)::text,true);
select set_config('archive.attempt',public.start_learning_exam(current_setting('archive.config')::jsonb)::text,true);
select pg_temp.archive_assert(public.start_learning_exam(current_setting('archive.config')::jsonb)::text=current_setting('archive.attempt'),'duplicate start idempotent');
select pg_temp.archive_assert(public.exam_data(current_setting('archive.attempt')::uuid)->>'totalQuestions'='35','past exam not truncated to 30');
select pg_temp.archive_assert(public.exam_data(current_setting('archive.attempt')::uuid)->'questions'->0->>'text'='Question 1','original order preserved');
select pg_temp.archive_assert(public.exam_data(current_setting('archive.attempt')::uuid)::text !~ 'correctOptionId|outcome','exam keys hidden');
select pg_temp.archive_denied('select public.check_practice_answer(current_setting(''archive.attempt'')::uuid,current_setting(''archive.bank'')||''-q1'')','exam feedback forbidden');
select public.save_exam_answer(current_setting('archive.attempt')::uuid,current_setting('archive.bank')||'-q1','a');
select public.submit_exam(current_setting('archive.attempt')::uuid);
select pg_temp.archive_assert(public.exam_data(current_setting('archive.attempt')::uuid)->>'unanswered'='34','unanswered persisted result');
select pg_temp.archive_assert(public.exam_data(current_setting('archive.attempt')::uuid)->>'year'='2025','year snapshot result');
select pg_temp.archive_assert(public.exam_data(current_setting('archive.attempt')::uuid)->'questions'->0->>'correctOptionId'='a','completed authorized review');
select pg_temp.archive_assert(public.submit_exam(current_setting('archive.attempt')::uuid)::text=current_setting('archive.attempt'),'repeat submit idempotent');
select set_config('archive.attempt',public.start_learning_exam(jsonb_build_object('bankId',current_setting('archive.bank'),'source','ALL','sourceId',null,'mode','PRACTICE','count',30,'timeLimitMinutes',null))::text,true);
select pg_temp.archive_assert(public.exam_data(current_setting('archive.attempt')::uuid)::text !~ 'correctOptionId|outcome','practice keys hidden before check');
select public.save_exam_answer(current_setting('archive.attempt')::uuid,current_setting('archive.bank')||'-q1','b');
select pg_temp.archive_assert(public.check_practice_answer(current_setting('archive.attempt')::uuid,current_setting('archive.bank')||'-q1')->>'outcome'='false','practice authorized feedback');
select pg_temp.archive_denied('select public.save_exam_answer(current_setting(''archive.attempt'')::uuid,current_setting(''archive.bank'')||''-q1'',''a'')','checked answer immutable');
select pg_temp.archive_assert(public.exam_data(current_setting('archive.attempt')::uuid)->'questions'->1 ? 'correctOptionId'=false,'unchecked keys remain hidden');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('archive.other'),'role','authenticated')::text,true);
select pg_temp.archive_denied('select public.exam_data(current_setting(''archive.attempt'')::uuid)','other student isolated');
select pg_temp.archive_denied('select public.start_learning_exam(current_setting(''archive.config'')::jsonb)','bank approval required');
select pg_temp.archive_assert((select count(*)=0 from public.past_exams),'archive RLS isolated');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('archive.admin'),'role','authenticated')::text,true);
select pg_temp.archive_denied('select public.start_learning_exam(current_setting(''archive.config'')::jsonb)','admin view-as cannot start');
select pg_temp.archive_assert(public.exam_data(current_setting('archive.attempt')::uuid,current_setting('archive.student')::uuid)->>'id'=current_setting('archive.attempt'),'admin readonly preview');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('archive.student'),'role','authenticated')::text,true);
select public.submit_exam(current_setting('archive.attempt')::uuid);
select set_config('archive.attempt',public.start_learning_exam(jsonb_build_object('bankId',current_setting('archive.bank'),'source','RANDOM','sourceId',null,'mode','EXAM','count',30,'timeLimitMinutes',1))::text,true);
select pg_temp.archive_assert(public.exam_data(current_setting('archive.attempt')::uuid)->>'totalQuestions'='30','random capped 30');
reset role;
update public.question_attempts set deadline_at=now()-interval '1 second' where id=current_setting('archive.attempt')::uuid;
set local role authenticated;
select pg_temp.archive_denied('select public.save_exam_answer(current_setting(''archive.attempt'')::uuid,current_setting(''archive.bank'')||''-q1'',''a'')','server rejects late answers');
select public.submit_exam(current_setting('archive.attempt')::uuid);
select pg_temp.archive_assert(public.exam_data(current_setting('archive.attempt')::uuid)->>'status'='COMPLETED','expired exam can finalize');
select count(*) as passed,array_agg(label) as checks from archive_checks;
rollback;

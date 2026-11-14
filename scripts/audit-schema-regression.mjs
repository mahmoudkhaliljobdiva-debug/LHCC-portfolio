// Reproduce the observed hosted schema drift and pending correction in ONE local rollback.
// Does not read credentials, connect to hosted databases or apply migration history.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

assert.equal(process.argv.length, 2, 'No flags or remote targets are accepted.');
const container = 'supabase_db_archive-db';
const info = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8', windowsHide: true }))[0];
assert.equal(info.Config.Labels['com.supabase.cli.project'], 'archive-db');
assert.equal(info.State.Running, true);
const sql = async path => readFile(path, 'utf8');
const histories = [
  '20261108160939_medical_question_import_provenance_and_assets',
  '20261108170538_medical_subject_import_pipeline_20261108',
  '20261109184236_allow_free_medical_subjects_in_student_catalog',
  '20261109184330_permit_published_free_medical_subjects_only',
];
const migration = await sql('supabase/migrations/20261111183838_audit_import_defense_and_fk_indexes.sql');
const source = `begin;
set local statement_timeout='60s';
${(await Promise.all(histories.map(name => sql(`docs/audit/production-history/${name}.sql`)))).join('\n')}
create function pg_temp.audit_assert(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL %',label; end if; end $$;
select pg_temp.audit_assert((select count(*)=4 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('question_import_sources','question_import_staging','question_source_links','question_answer_reviews') and not c.relrowsecurity),'reproduced four missing RLS flags');
select pg_temp.audit_assert(not exists(select 1 from pg_attribute where attrelid='private.question_import_staging'::regclass and attname='question_bank_id'),'second CREATE IF NOT EXISTS did not reconcile the first schema');
select pg_temp.audit_assert((select pg_get_constraintdef(oid) like '%REVIEWED%' and pg_get_constraintdef(oid) not like '%APPROVED%' from pg_constraint where conrelid='private.question_import_staging'::regclass and conname='question_import_staging_review_status_check'),'actual staging enum differs from later intended definition');
${migration}
select pg_temp.audit_assert((select count(*)=4 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('question_import_sources','question_import_staging','question_source_links','question_answer_reviews') and c.relrowsecurity),'all four private tables now have RLS');
select pg_temp.audit_assert(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join unnest(array['anon','authenticated','service_role']) r where n.nspname='private' and c.relname in ('question_import_sources','question_import_staging','question_source_links','question_answer_reviews') and (has_any_column_privilege(r,c.oid,'SELECT') or has_table_privilege(r,c.oid,'INSERT,UPDATE,DELETE'))),'raw import/key privileges remain denied');
select pg_temp.audit_assert((select count(*)=4 from pg_class c join pg_index i on i.indexrelid=c.oid where c.relname in ('lessons_chapter_bank_fk_idx','lesson_questions_lesson_bank_fk_idx','bank_questions_group_fk_idx','question_answer_reviews_reviewer_fk_idx') and i.indisvalid),'four FK indexes valid');
insert into public.question_banks(id,name,description,material_kind,exam_category,specialty_id,status,publication_status)
select 'audit-free-subject','[TEST] Free Subject','Local drift reproduction only','SUBJECT',null,id,'active','PUBLISHED' from public.specialties where slug='medical';
insert into public.bank_questions(id,question_bank_id,text,options) values('audit-free-question','audit-free-subject','[TEST] Synthetic option choice','[{"id":"a","text":"First"},{"id":"b","text":"Second"}]');
insert into private.question_solutions(question_id,correct_option_id) values('audit-free-question','a');
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='STUDENT' and status='ACTIVE' limit 1),true);
set local role authenticated;
select pg_temp.audit_assert(private.can_open_bank('audit-free-subject'),'hosted access helper allows the free Medical subject');
select pg_temp.audit_assert(exists(select 1 from public.bank_questions where id='audit-free-question'),'hosted RLS exposes authorized subject question');
select pg_temp.audit_assert(public.learning_catalog()::text like '%audit-free-subject%','published subject appears in catalog');
do $$ begin
  begin perform public.exam_bank_data('audit-free-subject'); raise exception 'Expected exam entry denial';
  exception when insufficient_privilege then null; end;
end $$;
do $$ begin
  begin perform private.save_learning_material(jsonb_build_object('id','audit-free-subject','name','[TEST] Renamed','description','Drift reproduction','specialtyId',(select id from public.specialties where slug='medical'),'materialKind','SUBJECT','examCategory',null,'publicationStatus','PUBLISHED','icon','book','language','auto','displayOrder',0,'status','active')); raise exception 'Expected Student editor denial';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='ADMIN' and status='ACTIVE' limit 1),true);
set local role authenticated;
do $$ begin
  begin perform public.save_learning_material(jsonb_build_object('id','audit-free-subject','name','[TEST] Renamed','description','Drift reproduction','specialtyId',(select id from public.specialties where slug='medical'),'materialKind','SUBJECT','examCategory',null,'publicationStatus','PUBLISHED','icon','book','language','auto','displayOrder',0,'status','active')); raise exception 'Expected inconsistent Admin publication guard';
  exception when check_violation then null; end;
end $$;
reset role;
select 'PASS 12 schema/drift/security checks; all schema/data changes rolled back';
rollback;`;
try {
  const output = execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: source, encoding: 'utf8', windowsHide: true, timeout: 90000, maxBuffer: 2 * 1024 * 1024 });
  console.log(output.trim().split('\n').at(-1));
} catch (error) {
  console.error(error.stderr?.toString() ?? error.message);
  process.exitCode = 1;
}

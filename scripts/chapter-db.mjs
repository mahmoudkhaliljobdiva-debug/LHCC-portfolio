// Isolated local database only. No hosted credentials, resets or production data.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const container='supabase_db_archive-db';
const info=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
if(info.Config.Labels['com.supabase.cli.project']!=='archive-db')throw Error('Isolated database required');
let sql=await readFile(process.argv.includes('--apply')||process.argv.includes('--refresh')?'supabase/migrations/20261021172927_chapter_learning_modes.sql':'supabase/tests/chapter_learning.sql','utf8');
if(process.argv.includes('--refresh'))sql="alter table public.question_attempt_questions add column if not exists source_number_snapshot text; do $$ begin if to_regprocedure('private.prechapter_exam_data(uuid,uuid)') is null then alter function private.exam_data(uuid,uuid) rename to prechapter_exam_data; revoke all on function private.prechapter_exam_data(uuid,uuid) from public,anon,authenticated; end if; end $$;\n"+[...sql.matchAll(/create(?: or replace)? function[^$;]*?as \$\$[\s\S]+?\$\$;/gi)].map(m=>m[0].replace(/^create function/,'create or replace function')).join('\n');
try{const result=execFileSync('docker',['exec','-i',container,'psql','-X','-q','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:process.argv.includes('--apply')||process.argv.includes('--refresh')?'begin;\n'+sql+'\ncommit;':sql,encoding:'utf8',stdio:['pipe','pipe','pipe']});console.log(result.slice(-2500)||'Local chapter migration applied.');}
catch(e){console.error(e.stderr?.toString()??'Local SQL failed');process.exitCode=1;}

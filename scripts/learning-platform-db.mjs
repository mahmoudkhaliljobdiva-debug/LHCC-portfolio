// Explicit isolated container only. Does not connect to production.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const container='supabase_db_archive-db';
if(execFileSync('docker',['inspect','--format','{{ index .Config.Labels "com.supabase.cli.project" }}',container],{encoding:'utf8'}).trim()!=='archive-db')throw Error('Isolated database required.');
const file=['apply','refresh','historical'].includes(process.argv[2])?'supabase/migrations/20261011161422_learning_catalog_shared_exams.sql':'supabase/tests/learning_platform.sql';
let sql=await readFile(file,'utf8');
if(process.argv[2]==='historical')sql=sql.slice(sql.indexOf('create table private.past_exam_snapshots'),sql.indexOf('alter function private.start_learning_exam'));
if(process.argv[2]==='refresh')sql='drop function if exists public.admin_shared_exams(text); drop function if exists private.admin_shared_exams(text);\n'+[...sql.matchAll(/create(?: or replace)? function[^$;]*?(?:as\s\$\$[\s\S]+?\$\$;|begin atomic[\s\S]+?end;)/gi)].map(x=>x[0].replace(/^create function/,'create or replace function')).join('\n')+'\n'+[...sql.matchAll(/^(?:revoke all|grant)[^;]+;/gm)].map(x=>x[0]).join('\n');
const output=execFileSync('docker',['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-P','pager=off'],{input:sql,encoding:'utf8',maxBuffer:8*1024*1024});
console.log(output.slice(-4000));

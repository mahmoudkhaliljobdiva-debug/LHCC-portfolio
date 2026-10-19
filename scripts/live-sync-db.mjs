// Applies/tests only the explicitly identified isolated local Docker database.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const container='supabase_db_archive-db';
const info=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
if(info.Config.Labels['com.supabase.cli.project']!=='archive-db')throw Error('Isolated database required');
const migration='supabase/migrations/20261019173647_live_synchronization.sql';
const source=await readFile(migration,'utf8');
const refresh=['live_change','live_practice_change'].map(name=>{
 const match=source.match(new RegExp('create function private\\.'+name+'\\(\\)[\\s\\S]+?end \\$\\$;'));
 if(!match)throw Error('Missing local function '+name);return match[0].replace('create function','create or replace function');
}).join('\n')+"\nrevoke all on function private.live_practice_change() from public,anon,authenticated; do $$ begin if not exists(select 1 from pg_trigger where tgname='lhcc_live_practice') then create trigger lhcc_live_practice after insert on private.practice_checks for each row execute function private.live_practice_change(); end if; end $$;";
const sql=process.argv.includes('--refresh-functions') ? refresh : process.argv.includes('--apply') ? 'begin;\n'+source+'\ncommit;'
  : (await readFile('supabase/tests/student_course_access.sql','utf8')).replace(/select count\(\*\) as passed_checks,true as all_passed from course_checks;\s*rollback;/,'')
    +'\n'+await readFile('supabase/tests/live_synchronization.sql','utf8');
try {
 const output=execFileSync('docker',['exec','-i',container,'psql','-X','-q','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:8*1024*1024});
 console.log(process.argv.includes('--apply')?'Local additive migration applied.':output.slice(-350));
}catch(error){console.error(error.stderr?.toString()??'Local SQL check failed');process.exitCode=1;}

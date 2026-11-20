// Rollback-only checks against the explicitly named isolated local container.
import { execFileSync } from 'node:child_process';
import { readFile,writeFile } from 'node:fs/promises';
const container='supabase_db_archive-db';
const identity=execFileSync('docker',['inspect','--format','{{ index .Config.Labels "com.supabase.cli.project" }}',container],{encoding:'utf8'}).trim();
if(identity!=='archive-db')throw Error('Refuse database tests outside isolated archive-db.');
for(const name of ['student_course_access','student_exams','teacher_bank_permissions','clinical_cases','yearly_exams']) {
 const sql=await readFile('supabase/tests/'+name+'.sql','utf8');
 const output=execFileSync('docker',['exec','-i',container,'psql','-X','-q','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-P','pager=off'],{input:sql,encoding:'utf8',maxBuffer:8*1024*1024});
 await writeFile('.test-artifacts/'+name+'-local.log',output);
 console.log('PASS '+name+' transaction rolled back. '+output.slice(-1700).replace(/\n/g,' '));
}

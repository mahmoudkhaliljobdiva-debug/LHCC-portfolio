// Validate the complete generated batch twice, in a rollback-only LOCAL transaction.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const container='supabase_db_archive-db';
const info=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.equal(info.Config.Labels['com.supabase.cli.project'],'archive-db');
const args=['exec','-i',container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'];
const run=sql=>execFileSync('docker',args,{input:sql,encoding:'utf8',maxBuffer:8*1024*1024,timeout:90000}).trim();
const admin=run("select id from public.profiles where role='ADMIN' and status='ACTIVE' limit 1;");assert(/^[0-9a-f-]{36}$/.test(admin));
const sources=JSON.parse(await readFile('.test-artifacts/medical-source-manifest.json','utf8'));
const files=JSON.parse(await readFile('.test-artifacts/medical-staging-sql/manifest.json','utf8'));
let sql="begin; create temp table preserved_questions as select md5(coalesce(string_agg(to_jsonb(q)::text,'' order by to_jsonb(q)::text),'')) value from public.bank_questions q;\n";
for(const s of sources)sql+=`insert into public.question_banks(id,name,description,specialty_id,material_kind,exam_category,publication_status,status) values('${s.bankId}','[TEST] Medical staging ${s.name.replaceAll("'","''")}','Local rollback source batch',(select id from public.specialties where slug='medical'),'SUBJECT',null,'DRAFT','inactive');\ninsert into private.question_import_sources(id,question_bank_id,drive_file_id,drive_url,original_filename,page_count,sha256) values('${s.id}','${s.bankId}','${s.driveFileId}','','${s.filename.replaceAll("'","''")}',${s.pages},'${s.sha256}');\n`;
const bodies=[];for(const f of files){const input=await readFile('.test-artifacts/medical-staging-sql/'+f.file,'utf8');bodies.push(input.replace(/^begin;\s*/,'').replace(/commit;\s*select jsonb_build_object[\s\S]*$/,'').replace(/aid uuid:='[0-9a-f-]+'/g,`aid uuid:='${admin}'`));}
sql+=bodies.join('\n')+'\n'+bodies.join('\n');
const ids=sources.map(s=>"'"+s.id+"'").join(',');
sql+=`do $$ begin
 if exists(select 1 from private.question_import_staging where source_id in (${ids}) and (review_status<>'NEEDS_REVIEW' or reviewed_by is not null or linked_question_id is not null)) then raise exception 'Batch must not approve/import/link'; end if;
 if (select count(*) from private.question_import_pages where source_id in (${ids}))<>1827 then raise exception 'Full source coverage required'; end if;
 if (select value from preserved_questions) is distinct from (select md5(coalesce(string_agg(to_jsonb(q)::text,'' order by to_jsonb(q)::text),'')) from public.bank_questions q) then raise exception 'Canonical questions changed'; end if;
end $$;
select jsonb_build_object('pages',(select count(*) from private.question_import_pages where source_id in (${ids})),'candidates',(select count(*) from private.question_import_staging where source_id in (${ids})),'approved',0,'canonicalWrites',0,'replayedTwice',true); rollback;`;
console.log(run(sql));console.log('PASS full source staging SQL twice; rollback complete; canonical questions unchanged.');

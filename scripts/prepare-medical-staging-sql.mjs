// Offline, owner-reviewed PENDING-only SQL preparation. Does not connect to a DB.
// Never creates Auth sessions, impersonates JWTs, approves, imports or overwrites.
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
const actor=process.argv[2];
assert(/^[0-9a-f-]{36}$/.test(actor??''),'Supply the initiating active Admin profile ID. This is extraction attribution, NOT medical review.');
const bundle=JSON.parse(await readFile('.test-artifacts/medical-pending-bundle.json','utf8'));
assert.equal(bundle.length,12);assert(bundle.every(s=>s.complete&&s.processedPages===s.source.pages),'All 12 entire sources must be processed first.');
const folder='.test-artifacts/medical-staging-sql';await mkdir(folder,{recursive:true});
let index=0;const batches=[];
for(const subject of bundle)for(let first=1;first<=subject.source.pages;first+=30){
 const last=Math.min(first+29,subject.source.pages);
 const payload={source:subject.source,pages:subject.pages.filter(p=>p.page>=first&&p.page<=last),questions:subject.questions.filter(q=>q.pageStart>=first&&q.pageStart<=last)};
 for(const q of payload.questions){assert(!q.draft.visualsReviewed);assert(!q.draft.duplicatesReviewed);assert.equal(q.draft.explanation,'');assert.equal(q.draft.evidence,'');}
 const json=JSON.stringify(payload).replaceAll("'","''");
 const sql=`begin;
set local lock_timeout='5s'; set local statement_timeout='60s';
do $staging$
declare batch jsonb:='${json}'::jsonb; src private.question_import_sources; p jsonb; q jsonb; d jsonb; fp text; sid uuid; aid uuid:='${actor}';
begin
 if not exists(select 1 from public.profiles where id=aid and role='ADMIN' and status='ACTIVE') then raise exception 'Active initiating Admin required'; end if;
 select * into src from private.question_import_sources where id=(batch->'source'->>'id')::uuid for update;
 if src.id is null or src.source_kind<>'PDF' or src.question_bank_id is distinct from batch->'source'->>'bankId'
  or src.drive_file_id is distinct from batch->'source'->>'driveFileId' or src.sha256 is distinct from batch->'source'->>'sha256'
  or src.page_count is distinct from (batch->'source'->>'pages')::integer
  or not exists(select 1 from public.question_banks where id=src.question_bank_id and material_kind='SUBJECT') then raise exception 'Source/Subject/version mismatch'; end if;
 perform pg_advisory_xact_lock(hashtextextended('subject-import:'||src.question_bank_id,0));
 for p in select value from jsonb_array_elements(batch->'pages') loop
  if (p->>'page')::integer not between 1 and src.page_count then raise exception 'Page out of bounds'; end if;
  insert into private.question_import_pages(source_id,page_number,status,text_content,warnings,processed_by)
   values(src.id,(p->>'page')::integer,'NEEDS_REVIEW',p->>'text',p->'warnings',aid) on conflict do nothing;
 end loop;
 for q in select value from jsonb_array_elements(batch->'questions') loop
  d:=q->'draft';
  if (q->>'pageStart')::integer not between 1 and src.page_count or (q->>'pageEnd')::integer not between (q->>'pageStart')::integer and src.page_count
   or d->>'visualsReviewed'<>'false' or d->>'duplicatesReviewed'<>'false' or d->>'explanation'<>'' or d->>'evidence'<>'' then raise exception 'Only unreviewed extraction drafts permitted'; end if;
  fp:=encode(extensions.digest(jsonb_build_object('text',d->>'text','options',d->'options','pageStart',q->'pageStart','pageEnd',q->'pageEnd','number',q->>'sourceNumber')::text,'sha256'),'hex');
  if exists(select 1 from private.question_import_staging where source_id=src.id and (content_fingerprint=fp or
   (nullif(q->>'sourceNumber','') is not null and original_question_no=q->>'sourceNumber' and page_start=(q->>'pageStart')::integer and page_end=(q->>'pageEnd')::integer))) then continue; end if;
  sid:=gen_random_uuid();
  insert into private.question_import_staging(id,source_id,page_start,page_end,original_question_no,content_fingerprint,draft_payload,answer_status,review_status,review_notes)
   values(sid,src.id,(q->>'pageStart')::integer,(q->>'pageEnd')::integer,nullif(q->>'sourceNumber',''),fp,d,q->>'answerStatus','NEEDS_REVIEW',q->>'notes');
  insert into private.question_import_events(staging_id,actor_id,operation,revision,details)
   values(sid,aid,'automated_extraction_requested',1,jsonb_build_object('automation',true,'medicalApproval',false,'sourceId',src.id,'fingerprint',fp,'draft',d));
 end loop;
 update private.question_import_sources set import_status='PARTIAL',updated_at=now() where id=src.id;
end $staging$;
commit;
select jsonb_build_object('batch',${index},'source','${subject.source.name.replaceAll("'","''")}','firstPage',${first},'lastPage',${last}) as staged_coverage;
`;
 const file=String(index++).padStart(3,'0')+'.sql';await writeFile(folder+'/'+file,sql);batches.push({file,subject:subject.source.name,first,last,questions:payload.questions.length});
}
await writeFile(folder+'/manifest.json',JSON.stringify(batches,null,2));
console.log(JSON.stringify({batches:batches.length,pages:bundle.reduce((n,s)=>n+s.processedPages,0),candidates:bundle.reduce((n,s)=>n+s.questions.length,0),approved:0,canonicalWrites:0}));

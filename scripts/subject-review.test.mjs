import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks={}){const exports={};const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',code)(name=>name in mocks?mocks[name]:name.startsWith('@/')?load(resolve('src',name.slice(2)+'.ts'),mocks):require(name),exports);return exports;}
const {extractSubjectPages,completeSubjectText}=load(resolve('scripts/lib/subject-extraction.ts'));
const {subjectDraftSchema,subjectStageInputSchema}=load(resolve('src/lib/validation/subject-question.ts'));
test('Subject extraction preserves cross-page text/options, source number and exact page range',()=>{
 const result=extractSubjectPages([{page:4,text:'7. Original source question\nA. First option',hasImages:false},{page:5,text:'B. Second option\n8. Another question\nA. One\nB. Two',hasImages:true},{page:6,text:'Answer key\n7. A\n8. B',hasImages:false}]);
 assert.equal(result.questions.length,2);const first=result.questions[0];assert.equal(first.question.sourceNumber,'7');assert.equal(first.pageStart,4);assert.equal(first.pageEnd,5);assert.equal(first.question.options[1].text,'Second option');assert.equal(first.question.correctOptionId,'A');assert.equal(first.question.verified,false);assert(first.warnings.some(value=>value.includes('images')));
});
test('scans and absent answer keys never invent source text or a correct answer',()=>{
 assert.equal(extractSubjectPages([{page:1,text:'',hasImages:true}]).questions.length,0);
 const q=extractSubjectPages([{page:2,text:'1. Text\nA. One\nB. Two',hasImages:false}]).questions[0];assert.equal(q.question.correctOptionId,null);assert.equal(q.question.verified,false);
});
test('OCR missing whitespace and unreadable source numbers retain all identifiable MCQs without guessed numbers',()=>{
 const result=extractSubjectPages([{page:1,text:'27.Original stem\nA) First\nB) Second',hasImages:true},{page:2,text:'Unnumbered source stem\nO A) One\nO B) Two',hasImages:true}]);
 assert.equal(result.questions.length,2);assert.equal(result.questions[0].question.sourceNumber,'27');assert.equal(result.questions[1].question.sourceNumber,'');assert.equal(result.questions[1].question.correctOptionId,null);assert.equal(result.questions[1].question.options.length,2);
});
test('identified independent exam-player screenshots cannot merge unrelated questions across pages',()=>{
 const result=extractSubjectPages([{page:1,text:'1. Original question\nA. One\nB. Two',hasImages:true,independentPage:true},{page:2,text:'Unnumbered second question\nA. Three\nB. Four',hasImages:true,independentPage:true}]);
 assert.equal(result.questions.length,2);assert.equal(result.questions[0].pageEnd,1);assert.equal(result.questions[1].pageStart,2);assert(!result.questions[0].question.options[1].text.includes('second'));
});
test('clinical case title and full description are retained in standalone Subject question text',()=>{
 assert.equal(completeSubjectText({caseTitle:'Clinical case',caseDescription:'Full original case context.',text:'Original question?'}),'Clinical case\n\nFull original case context.\n\nOriginal question?');
});

test('explicit shared response sets before a numbered stem retain printed options and instructions',()=>{
 const result=extractSubjectPages([{page:2,text:'The response options for the next 2 items are the same.\nFor each patient select a response.\n© A) Printed first response\nO B) Printed second response\n25. Original stem',hasImages:true}]);
 const q=result.questions[0];assert.equal(q.question.options.length,2);assert.equal(q.question.options[1].text,'Printed second response');assert(q.question.text.includes('For each patient'));assert.equal(q.question.correctOptionId,null);assert(q.warnings.some(w=>w.includes('Shared response')));
});
test('drafts allow incompleteness but reject injected status, answer leaks and malformed provenance',()=>{
 const draft={text:'',options:[],correctOptionId:null,explanation:'',evidence:'',chapterId:null,visualsReviewed:false,duplicatesReviewed:false,explanationOrigin:'SOURCE'};
 assert(subjectDraftSchema.safeParse(draft).success);assert(!subjectDraftSchema.safeParse({...draft,approvalStatus:'APPROVED'}).success);
 const p={sourceId:null,expectedRevision:null,pageStart:1,pageEnd:1,sourceNumber:'1',answerStatus:'UNVERIFIED',notes:'',draft};assert(subjectStageInputSchema.safeParse(p).success);
 assert(!subjectStageInputSchema.safeParse({...p,pageEnd:0}).success);assert(!subjectStageInputSchema.safeParse({...p,linkedQuestionId:'other-bank'}).success);
});
test('all Subject mutations authorize before creating a client',async()=>{
 let reached=false;const actions=load(resolve('src/actions/subject-questions.ts'),{'@/lib/auth/admin':{authorizeActiveAdmin:async()=>({ok:false,error:{code:'FORBIDDEN',message:'Denied'}})},'@/lib/supabase/server':{createClient:async()=>{reached=true;throw Error('Must not query');}},'next/cache':{revalidatePath(){}}});
 assert.equal((await actions.saveReviewedSubjectQuestion('bank',null,{})).ok,false);assert.equal((await actions.deleteSubjectQuestion('bank','qid')).ok,false);assert.equal(reached,false);
});
test('migration preserves IDs and requires explicit revision-bound approval before canonical writes',()=>{
 const sql=readFileSync('supabase/migrations/20261114165153_subject_question_review.sql','utf8');
 assert(sql.includes("st.review_status<>'APPROVED'"));assert(sql.includes("st.revision is distinct from"));assert(sql.includes("coalesce(st.linked_question_id,gen_random_uuid()::text)"));assert(sql.includes("as restrictive for select"));assert(sql.includes("'draft',st.draft_payload"));assert(!/truncate|drop table|disable row level security/i.test(sql));assert(!/set\s+material_kind\s*=\s*'EXAM_TRACK'/i.test(sql));
});

test('indexed duplicate checks still recheck exact text and preserve legacy import counts',()=>{
 const sql=readFileSync('supabase/migrations/20261114171408_subject_duplicate_lookup_indexes.sql','utf8');
 assert(sql.includes('subject_question_text_lookup_idx'));assert(sql.includes('subject_staging_text_lookup_idx'));
 assert(sql.includes('md5(lower(regexp_replace(q.text'));assert(sql.includes('and lower(regexp_replace(q.text'));
 assert(sql.includes('a.linked_question_id is not null'));assert(!sql.includes('os.question_bank_id=bank_id'));
});

test('shared legacy exam access guard checks material kind before grants and selectors',()=>{
 const sql=readFileSync('supabase/migrations/20261115130827_subject_legacy_exam_guard.sql','utf8');
 assert(sql.includes("material_kind='EXAM_TRACK' and publication_status='PUBLISHED' for share"));
 assert(sql.indexOf("if not found then raise exception 'Published exam track required'")<sql.indexOf('private.can_open_bank(bank_id)'));
 assert(!/grant |delete |update |truncate|drop /i.test(sql));
});

test('Subject website has direct question controls, not PDF extraction or import queues',()=>{
 const ui=readFileSync('src/features/learning/admin-subject-questions.tsx','utf8');
 assert(!existsSync('src/features/learning/subject-pdf-import.tsx'));assert(!existsSync('src/lib/learning/subject-pdf-reader.ts'));
 assert(!/Import review|Import approved|Extract to staging|type="file"|SubjectPdfImport/.test(ui));
 assert(ui.includes('data.chapters.length ? <Link'));assert(ui.includes('Save reviewed question'));assert(ui.includes('I explicitly approve'));
 const sql=readFileSync('supabase/migrations/20261115140100_subject_direct_question_management.sql','utf8');
 assert(sql.includes("payload->'approvalConfirmed' is distinct from 'true'::jsonb"));assert(sql.includes("staged.revision is distinct from"));
});

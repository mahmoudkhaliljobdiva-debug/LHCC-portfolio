// Read-only source preparation. Produces ignored pending drafts; never calls a backend.
import { readFile,writeFile,readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path){const exports={};const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',code)(name=>name.startsWith('@/')?load(resolve('src',name.slice(2)+'.ts')):require(name),exports);return exports;}
const {extractSubjectPages,completeSubjectText}=load(resolve('src/lib/learning/subject-extraction.ts'));
const sources=JSON.parse(await readFile('.test-artifacts/medical-source-manifest.json','utf8')),bundle=[];
for(const source of sources){
 const folder='.test-artifacts/medical-sources/'+source.driveFileId;
 let files;try{files=await readdir(folder);}catch{files=[];}
 const pages=[];for(let page=1;page<=source.pages;page++){
  if(!files.includes(page+'.json'))break;
  const value=JSON.parse(await readFile(folder+'/'+page+'.json','utf8'));
  value.independentPage=(value.blocks??[]).some(block=>block.text.replace(/[^a-z]/gi,'').toLowerCase().includes('nationalboardofmedical'));
  pages.push(value);
 }
 // These scanned exam-player captures contain one screen per page. When the
 // repeated NBME header identifies the source format, even a header missed by
 // OCR must not concatenate unrelated screens into one enormous option/stem.
 const screenSource=process.argv.includes('--screen-pages')||pages.filter(p=>p.independentPage).length>pages.length*.2;
 if(screenSource)for(const page of pages)page.independentPage=true;
 const extracted=extractSubjectPages(pages);
 const questions=extracted.questions.map(item=>({id:item.question.id,sourceId:source.id,expectedRevision:null,pageStart:item.pageStart,pageEnd:item.pageEnd,sourceNumber:item.question.sourceNumber,
  answerStatus:item.question.correctOptionId?'SOURCE_VERIFIED':'UNVERIFIED',notes:['Automated OCR draft, not administrative or medical approval.',...item.warnings].join('\n'),
  draft:{text:completeSubjectText(item.question),options:item.question.options,correctOptionId:item.question.correctOptionId,explanation:'',evidence:'',chapterId:null,visualsReviewed:false,duplicatesReviewed:false,explanationOrigin:'SOURCE'}}));
 const valid=questions.filter(q=>q.draft.text.length<=10000&&q.draft.options.length<=10&&q.draft.options.every(o=>o.text.length<=5000));
 bundle.push({source,processedPages:pages.length,complete:pages.length===source.pages,screenSource,pages:pages.map(p=>({sourceId:source.id,page:p.page,text:p.text,status:'NEEDS_REVIEW',warnings:p.warnings})),questions:valid,oversizedCandidates:questions.length-valid.length,unreadablePages:pages.filter(p=>!p.text.trim()).map(p=>p.page)});
}
await writeFile('.test-artifacts/medical-pending-bundle.json',JSON.stringify(bundle,null,2));
console.log(JSON.stringify(bundle.map(item=>({subject:item.source.name,pages:item.processedPages,expectedPages:item.source.pages,extracted:item.questions.length,complete:item.complete,oversized:item.oversizedCandidates,unreadable:item.unreadablePages.length})),null,2));

// Read-only production smoke: no users, answers, exams, CMS edits or TEST data.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {startBrowser,pause} from './qa-browser.mjs';
const settings=Object.fromEntries((await readFile('.env.local','utf8')).split(/\r?\n/).flatMap(line=>{const m=line.match(/^(NEXT_PUBLIC_SUPABASE_(?:URL|PUBLISHABLE_KEY|ANON_KEY))=(.*)$/);return m?[[m[1],m[2].replace(/^['"]|['"]$/g,'')]]:[];}));
const key=settings.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??settings.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.equal(new URL(settings.NEXT_PUBLIC_SUPABASE_URL).hostname,'lcazjsmmegwwnmuupsko.supabase.co');assert(key,'Public API key required');
const db=createClient(settings.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
const result=await db.rpc('learning_catalog');assert(!result.error,result.error?.message);const catalog=result.data;
const bank='d7e37b48-8afc-4df0-ad5e-a1c08dc65eb4';
for(const slug of ['nursing','medical','dentistry'])assert(catalog.some(s=>s.slug===slug),'Published specialty '+slug);
const materialIds=catalog.flatMap(s=>s.materials.map(m=>m.id));assert.equal(new Set(materialIds).size,materialIds.length,'Each configured material belongs to one specialty');
assert(!/correct_option_id|answer_key|storage_path|options|questionId/.test(JSON.stringify(catalog)));
assert((await db.rpc('admin_shared_exams',{bank_id:bank})).error);
assert((await db.from('bank_questions').select('id').limit(1)).error);
assert((await db.from('shared_exams').select('id').limit(1)).error);
for(const table of ['bank_chapters','chapter_questions','bank_generation_settings'])assert((await db.from(table).select('*').limit(1)).error,'Anonymous chapter table denied: '+table);
assert((await db.rpc('admin_chapters',{bank_id:bank})).error);
if(process.argv.includes('--backend-only')){console.log('PASS anonymous production catalog allowlist, independent specialties, protected question/definition denial; no mutations.');process.exit(0);}
const base='https://lhcc-lb.com',browser=await startBrowser(base,{port:9345}),checks=[];
try{const p=await browser.page();
 for(const path of ['/','/services','/programs/nursing','/programs/medical','/programs/dentistry']){
  const response=await fetch(base+path);assert.equal(response.status,200,path);
  await p.goto(path);if(path==='/services')assert((await p.text()).includes('Explore Our Learning Programs'));
  const specialty=catalog.find(s=>path==='/programs/'+s.slug);
  if(specialty){for(const material of specialty.materials)assert((await p.text()).includes(material.name));if(!specialty.materials.length)assert((await p.text()).includes('No materials published yet.'));}
  for(const dark of [false,true])for(const width of [320,375,390,430,768,1024,1366,1440,1920]){await p.resize(width);await p.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);await pause(250);await p.healthy(path+' '+width+' '+dark);}
  checks.push(path+': HTTP 200, nine widths, both themes');
 }
 for(const path of ['/admin/specialties',`/admin/question-banks/${bank}/shared-exams`,`/admin/question-banks/${bank}/chapters`,'/student/specialties/nursing',`/student/banks/${bank}/shared-exams`,`/student/banks/${bank}/chapters`,`/student/banks/${bank}/setup?source=RANDOM`]){await p.goto(path);assert.equal(await p.evaluate('location.pathname'),'/login');checks.push(path+': anonymous redirects to login');}
 const favicon=await fetch(base+'/favicon.ico');assert.equal(favicon.status,200);assert(/image\//.test(favicon.headers.get('content-type')));const ico=new Uint8Array(await favicon.arrayBuffer());assert.deepEqual([...ico.slice(0,4)],[0,0,1,0]);
 assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.failedResponses,[]);
 await writeFile('.test-artifacts/learning-production.json',JSON.stringify({passed:true,checks,backend:'anonymous allowlist and protected data denial',favicon:'HTTP 200 valid ICO',mutations:false,physicalSamsung:false},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await browser.close();}

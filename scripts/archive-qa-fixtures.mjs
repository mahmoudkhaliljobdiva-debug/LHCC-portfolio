// Isolated LOCAL Supabase only. Never accepts a production URL or production credentials.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes,randomUUID } from 'node:crypto';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
const folder='.test-artifacts'; const manifestPath=folder+'/archive-qa.private.json';
const status=JSON.parse(execFileSync('cmd.exe',['/d','/s','/c','npx.cmd supabase status --workdir .test-artifacts/archive-db -o json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const url=status.API_URL; assert(['localhost','127.0.0.1'].includes(new URL(url).hostname));
const db=createClient(url,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
async function checked(result,label) { if(result.error)throw Error(label+': '+result.error.message); return result.data; }
if(process.argv[2]==='setup') {
 await mkdir(folder,{recursive:true});
 let existing; try{existing=JSON.parse(await readFile(manifestPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(existing){assert.equal(existing.url,url);if(!process.argv.includes('--fresh')){console.log('Local QA fixture already exists; retained.');process.exit(0);}}
 const manifest={url,anonKey:status.ANON_KEY,prefix:'archive-qa-'+randomUUID(),users:{},bankId:randomUUID()};
 for(const role of ['admin','student','locked']) {
  const account={email:manifest.prefix+'-'+role+'@example.com',password:randomBytes(24).toString('base64url'),name:'[TEST] Archive '+role};
  const auth=await checked(await db.auth.admin.createUser({email:account.email,password:account.password,email_confirm:true,user_metadata:{full_name:account.name}}),'Local user');
  account.id=auth.user.id;manifest.users[role]=account;
  if(role==='admin')await checked(await db.from('profiles').update({role:'ADMIN',status:'ACTIVE'}).eq('id',account.id),'Local QA admin');
 }
 await checked(await db.from('question_banks').insert({id:manifest.bankId,name:'[TEST] Archive Bank',description:'Non-medical local verification fixture',status:'active',price:0}),'Local bank');
 await checked(await db.from('user_bank_access').insert({user_id:manifest.users.student.id,question_bank_id:manifest.bankId,status:'ACTIVE',granted_by:manifest.users.admin.id}),'Local bank approval');
 const admin=createClient(url,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});await checked(await admin.auth.signInWithPassword(manifest.users.admin),'Local admin login');
 const sectionId=randomUUID();manifest.sectionId=sectionId;
 await checked(await admin.rpc('manage_bank_content',{operation:'save_section',item_id:sectionId,payload:{bankId:manifest.bankId,title:'[TEST] Existing case',description:'Original fixture context; must remain intact.',displayOrder:1}}),'Local case');
 for(let i=1;i<=40;i++)await checked(await admin.rpc('manage_bank_content',{operation:'save_question',item_id:manifest.prefix+'-q'+i,payload:{bankId:manifest.bankId,text:'[TEST] Original question '+i,status:'active',sectionId,displayOrder:i,answers:[{id:'a',text:'First fixture option',isCorrect:true},{id:'b',text:'Second fixture option',isCorrect:false}]}}),'Local question');
 await writeFile(manifestPath,JSON.stringify(manifest),{mode:0o600});
 await writeFile(folder+'/archive-qa.env',`NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${status.ANON_KEY}\nSUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}\nSUPABASE_SECRET_KEY=${status.SERVICE_ROLE_KEY}\nNEXT_PUBLIC_SITE_URL=http://localhost:3100\n`,{mode:0o600});
 // Minimal real PDF with explicit source keys. No invented healthcare teaching material.
 const lines=['[TEST] Archive 2025 Session A','Clinical case 1','Controlled fixture narrative, not medical advice.','1. First imported fixture question','A. First option','B. Second option','2. Second imported fixture question','A. Yes','B. No','Answer key','1: B','2: A'];
 const stream='BT /F1 12 Tf 50 750 Td 20 TL\n'+lines.map((l,i)=>(i?'T* ':'')+'('+l.replace(/[()\\]/g,'\\$&')+') Tj').join('\n')+'\nET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 await writeFile(folder+'/archive-2025-fixture.pdf',pdf);
 console.log('PASS isolated local admin/student/locked users, forty original questions and PDF fixture created. No production data touched.');
}else throw Error('Use setup; local fixtures are retained for repeatable QA, not production.');

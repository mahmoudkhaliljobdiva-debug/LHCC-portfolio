// Complements archive fixtures; never accepts production Supabase URLs.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const file='.test-artifacts/archive-qa.private.json';
const m=JSON.parse(await readFile(file,'utf8'));
assert(['localhost','127.0.0.1'].includes(new URL(m.url).hostname));
const env=Object.fromEntries((await readFile('.test-artifacts/archive-qa.env','utf8')).trim().split('\n').map(line=>{const n=line.indexOf('=');return[line.slice(0,n),line.slice(n+1).trim()];}));
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,m.url);
const db=createClient(m.url,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
if(!m.users.teacher){
 const account={email:m.prefix+'-teacher@example.com',password:randomBytes(24).toString('base64url')};
 const listed=await db.auth.admin.listUsers({perPage:1000});assert.ifError(listed.error);
 const existing=listed.data.users.find(u=>u.email===account.email);
 const {data,error}=existing?await db.auth.admin.updateUserById(existing.id,{password:account.password}):await db.auth.admin.createUser({...account,email_confirm:true,user_metadata:{full_name:'[TEST] Teacher with an intentionally very long display name to verify narrow navigation'}});
 assert.ifError(error);account.id=data.user.id;
 const today=new Date(),expiry=new Date(today);expiry.setUTCFullYear(expiry.getUTCFullYear()+1);
 assert.ifError((await db.from('profiles').update({role:'TEACHER',status:'ACTIVE',activation_start:today.toISOString(),activation_months:12,expiration_date:expiry.toISOString()}).eq('id',account.id)).error);
 assert.ifError((await db.from('teacher_bank_assignments').upsert({teacher_id:account.id,question_bank_id:m.bankId,assigned_by:m.users.admin.id})).error);
 m.users.teacher=account;await writeFile(file,JSON.stringify(m),{mode:0o600});
}
const student=createClient(m.url,m.anonKey,{auth:{persistSession:false}});
assert.ifError((await student.auth.signInWithPassword(m.users.student)).error);
const running=await student.from('question_attempts').select('id').eq('question_bank_id',m.bankId).eq('status','IN_PROGRESS');assert.ifError(running.error);
if(!running.data.length)assert.ifError((await student.rpc('start_learning_exam',{config:{bankId:m.bankId,source:'RANDOM',mode:'EXAM',count:30,timeLimitMinutes:null}})).error);
console.log('PASS isolated local teacher assignment and active attempt fixture; production untouched.');

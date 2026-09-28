// Explicit TEST accounts only. Credentials stay in ignored .test-artifacts.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { getAdmin, checked, projectRef, loginAccount } from './backend-qa-data.mjs';
const path = '.test-artifacts/exam-qa.private.json';
const db = getAdmin();
if (process.argv[2] === 'setup') {
  let m;
  try { m=JSON.parse(await readFile(path,'utf8')); assert.equal(m.projectRef,projectRef); assert(!m.cleanedAt,'Cleaned manifest must be archived before a new run'); }
  catch(error) { if(error.code!=='ENOENT') throw error; m={ projectRef, prefix: 'exam-qa-'+randomUUID(), users: [], banks: [] }; }
  async function persist() { await mkdir('.test-artifacts',{recursive:true}); await writeFile(path,JSON.stringify(m),{mode:0o600}); }
  await persist();
  for (const suffix of ['approved','locked']) {
    if(m.users.some(user=>user.email.endsWith('-'+suffix+'@example.com'))) continue;
    const account = { email: `${m.prefix}-${suffix}@example.com`, password: randomBytes(24).toString('base64url'), name: `[TEST] Exam ${suffix}` };
    const result = await checked(db.auth.admin.createUser({email:account.email,password:account.password,email_confirm:true,user_metadata:{full_name:account.name}}),'Create TEST student');
    m.users.push({...account,id:result.user.id}); await persist();
  }
  for(const count of [40,30,12,0]) {
    const bank = { id: `${m.prefix}-${count}`, count };
    if(!m.banks.some(b=>b.id===bank.id)) {m.banks.push(bank); await persist();}
    await checked(db.from('question_banks').upsert({id:bank.id,name:`[TEST] Exam ${count}`,description:'Controlled exam verification; not educational content.',status:'active',price:0}),'TEST bank');
    const admins=await checked(db.from('profiles').select('id').eq('role','ADMIN').eq('status','ACTIVE').limit(1),'QA operator');
    await checked(db.from('user_bank_access').upsert({user_id:m.users[0].id,question_bank_id:bank.id,status:'ACTIVE',granted_by:admins[0].id}),'TEST grant');
  }
  console.log(JSON.stringify({prefix:m.prefix,users:m.users.map(({id})=>id),banks:m.banks}));
} else if(process.argv[2] === 'cleanup') {
  const m=JSON.parse(await readFile(path,'utf8')); assert.equal(m.projectRef,projectRef); assert.match(m.prefix,/^exam-qa-[a-f0-9-]{36}$/);
  for(const user of m.users) {
    const auth=await checked(db.auth.admin.getUserById(user.id),'Check TEST identity');
    assert.equal(auth.user.email,user.email); assert.equal(auth.user.user_metadata.full_name,user.name);
    const profile=await checked(db.from('profiles').select('role').eq('id',user.id).single(),'Check TEST role'); assert.equal(profile.role,'STUDENT');
    const session=await loginAccount(user);
    await checked(session.auth.signOut({scope:'global'}),'Revoke TEST sessions');
    await checked(db.auth.admin.deleteUser(user.id),'Remove TEST account');
  }
  for(const bank of m.banks) {
    assert(bank.id.startsWith(m.prefix+'-'));
    await checked(db.from('bank_questions').delete().eq('question_bank_id',bank.id),'Remove TEST questions');
    await checked(db.from('question_banks').delete().eq('id',bank.id).like('name','[TEST] Exam %'),'Remove TEST bank');
  }
  // Retain only a credential-free audit marker, not reusable test passwords.
  await writeFile(path,JSON.stringify({projectRef,prefix:m.prefix,cleanedAt:new Date().toISOString()}),{mode:0o600});
  console.log('PASS TEST accounts/banks/questions/attempts removed; real records untouched');
} else throw new Error('Choose setup or cleanup');

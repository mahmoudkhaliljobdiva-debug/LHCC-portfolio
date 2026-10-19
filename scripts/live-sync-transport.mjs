// Checks actual private-channel policy and committed database broadcasts locally.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {assertLocalQaTarget} from './qa-safety.mjs';
const m=JSON.parse(await readFile('.test-artifacts/archive-qa.private.json','utf8'));assertLocalQaTarget(m.url);
const db=createClient(m.url,m.anonKey,{auth:{persistSession:false}});
assert.ifError((await db.auth.signInWithPassword(m.users.student)).error);
const channels=[];
try{
 const topic='lhcc:user:'+m.users.student.id,channel=db.channel(topic,{config:{private:true}});channels.push(channel);
 let resolveMessage;const received=new Promise(resolve=>{resolveMessage=resolve;});
 channel.on('broadcast',{event:'invalidate'},message=>resolveMessage(message.payload));
 const status=await new Promise(resolve=>{const timer=setTimeout(()=>resolve('TIMEOUT'),10000);channel.subscribe(s=>{if(['SUBSCRIBED','CHANNEL_ERROR'].includes(s)){clearTimeout(timer);resolve(s);}});});
 assert.equal(status,'SUBSCRIBED');
 const container='supabase_db_archive-db',info=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
 assert.equal(info.Config.Labels['com.supabase.cli.project'],'archive-db');
 // IDs come from the validated UUID manifest, not arbitrary SQL input.
 assert.match(m.users.student.id,/^[0-9a-f-]{36}$/);
 execFileSync('docker',['exec','-i',container,'psql','-X','-q','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{
  input:`select private.emit_live('lhcc:user:${m.users.student.id}','profile');`,encoding:'utf8',stdio:['pipe','pipe','pipe']});
 const message=await Promise.race([received,new Promise(resolve=>setTimeout(()=>resolve(null),10000))]);
 assert.equal(message?.kind,'profile');
 assert.deepEqual(Object.keys(message).filter(key=>key!=='id'),['kind']); // Realtime may attach its own message UUID.
 const forbidden=db.channel('lhcc:user:'+m.users.admin.id,{config:{private:true}});channels.push(forbidden);
 const denied=await new Promise(resolve=>{const timer=setTimeout(()=>resolve('TIMEOUT'),10000);forbidden.subscribe(s=>{if(['SUBSCRIBED','CHANNEL_ERROR'].includes(s)){clearTimeout(timer);resolve(s);}});});
 assert.equal(denied,'CHANNEL_ERROR');
 console.log('PASS actual private own-topic join, committed database hint delivery, payload minimization and other-user topic denial.');
}finally{for(const channel of channels)await db.removeChannel(channel);}

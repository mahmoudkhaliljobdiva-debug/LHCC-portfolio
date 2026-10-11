import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { themeBootstrap, setTheme, subscribeTheme } from '../src/lib/theme.ts';

function environment(saved=null,systemDark=false,blocked=false){
 let dark=false,preference=saved,meta='';
 const listeners=new Map(),mediaListeners=new Map();
 const root={classList:{toggle(_name,value){dark=value;}},style:{},dataset:{}};
 const media={matches:systemDark,addEventListener(k,cb){mediaListeners.set(k,cb);},removeEventListener(k){mediaListeners.delete(k);}};
 const document={documentElement:root,querySelector(){return{setAttribute(_name,value){meta=value;}};}};
 const localStorage={getItem(){if(blocked)throw Error('blocked');return preference;},setItem(_k,v){if(blocked)throw Error('blocked');preference=v;}};
 const window={matchMedia:()=>media,addEventListener(k,cb){listeners.set(k,cb);},removeEventListener(k){listeners.delete(k);},dispatchEvent(event){listeners.get(event.type)?.(event);}};
 return {document,localStorage,window,matchMedia:()=>media,Event,root,media,listeners,mediaListeners,get dark(){return dark;},get meta(){return meta;},set preference(v){preference=v;}};
}
test('prepaint respects explicit light even with system dark and declares only light',()=>{
 const e=environment('light',true);runInNewContext(themeBootstrap,e);assert.equal(e.dark,false);assert.equal(e.root.style.colorScheme,'only light');assert.equal(e.meta,'#f8f7f2');
});
test('prepaint follows system dark when storage is blocked',()=>{
 const e=environment(null,true,true);runInNewContext(themeBootstrap,e);assert.equal(e.dark,true);assert.equal(e.root.style.colorScheme,'dark');
});
test('manual toggle works with blocked storage, and listeners clean up',()=>{
 const e=environment(null,false,true);Object.assign(globalThis,{document:e.document,window:e.window,localStorage:e.localStorage});
 let changes=0;const cleanup=subscribeTheme(()=>changes++);setTheme('dark');assert.equal(e.dark,true);assert.equal(changes,1);
 e.media.matches=false;e.mediaListeners.get('change')();assert.equal(e.dark,true,'Explicit choice survives system events without storage');
 cleanup();assert.equal(e.listeners.size,0);assert.equal(e.mediaListeners.size,0);
});
test('cross-tab preference and system changes apply to the document, not just the icon',()=>{
 const e=environment();Object.assign(globalThis,{document:e.document,window:e.window,localStorage:e.localStorage});
 const cleanup=subscribeTheme(()=>{});e.preference='dark';e.listeners.get('storage')({key:'lhcc-theme'});assert.equal(e.dark,true);
 e.preference='light';e.media.matches=true;e.mediaListeners.get('change')();assert.equal(e.dark,false);
 e.preference=null;e.listeners.get('storage')({key:null});assert.equal(e.dark,true);cleanup();
});

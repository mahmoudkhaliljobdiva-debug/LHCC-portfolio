// Read-only UI regression against isolated local fixtures, never production.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertLocalQaTarget} from './qa-safety.mjs';
import {startBrowser,login,pause,waitFor} from './qa-browser.mjs';
const fixture=JSON.parse(await readFile('.test-artifacts/archive-qa.private.json','utf8'));
assertLocalQaTarget(fixture.url);
const browser=await startBrowser('http://localhost:3100',{port:9365});
const state=`(()=>{const root=document.querySelector('.lhcc-portal-shell'),side=document.querySelector('aside');return {collapsed:root.dataset.sidebarCollapsed,preview:root.dataset.sidebarPreview,width:side.getBoundingClientRect().width,padding:parseFloat(getComputedStyle(document.querySelector('.portal-workspace')).paddingLeft),scrollbar:getComputedStyle(side).scrollbarWidth,overflow:getComputedStyle(side).overflowY};})()`;
const button=label=>`document.querySelector(${JSON.stringify(`button[aria-label="${label}"]`)}).click()`;
let cases=0;
try {
 const page=await browser.page();await login(page,fixture.users.admin,'/admin');
 for(const dark of [false,true])for(const width of [1024,1366,1440,1920]){
  await page.resize(width);await page.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
  if((await page.evaluate(state)).collapsed==='false')await page.evaluate(button('Collapse navigation'));
  await page.hover('.portal-header');await pause(250);
  let value=await page.evaluate(state);assert.equal(value.collapsed,'true');assert.equal(value.preview,'false');assert.equal(Math.round(value.width),96);
  await page.hover('aside');await pause(100);
  value=await page.evaluate(state);assert.equal(value.preview,'true');assert.equal(Math.round(value.width),268);assert.equal(value.padding,96,'Hover never shifts the page');
  assert(await page.evaluate(`getComputedStyle(document.querySelector('.lhcc-sidebar-label')).display!=='none'`));
  if(width===1440)await page.screenshot('sidebar-hover-'+(dark?'dark':'light'));
  await page.hover('.portal-header');await pause(250);
  value=await page.evaluate(state);assert.equal(value.preview,'false');assert.equal(Math.round(value.width),96);assert.equal(value.scrollbar,'none');assert.equal(value.overflow,'auto');
  await page.healthy('sidebar '+width);cases++;
 }
 await page.resize(1440,460);await page.hover('aside');await pause(100);
 assert(await page.evaluate('document.querySelector("aside").scrollHeight>document.querySelector("aside").clientHeight'));
 await page.cdp('Input.dispatchMouseEvent',{type:'mouseWheel',x:48,y:180,deltaX:0,deltaY:320});
 await waitFor(()=>page.evaluate('document.querySelector("aside").scrollTop>0'),'Wheel scrolling works without a scrollbar');
 await page.hover('.portal-header');await pause(250);
 await page.cdp('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9});
 await page.cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9});
 await page.evaluate(`document.querySelector('aside nav a').focus()`);await pause(250);
 assert.equal((await page.evaluate(state)).preview,'true','Keyboard focus can preview labels');
 await page.evaluate(`[...document.querySelectorAll('aside nav a')].at(-1).focus()`);
 assert(await page.evaluate('document.querySelector("aside").scrollTop>0'),'Keyboard focus scrolls the last link into view');
 await page.evaluate(`document.querySelector('.portal-header input').focus()`);await pause(250);
 assert.equal((await page.evaluate(state)).preview,'false','Leaving keyboard focus restores the compact rail');
 await page.hover('aside');await pause(100);await page.evaluate(button('Keep navigation expanded'));await page.hover('.portal-header');await pause(250);
 assert.equal((await page.evaluate(state)).collapsed,'false');assert.equal(Math.round((await page.evaluate(state)).width),268,'Explicit expand stays expanded after leaving');
 await page.evaluate(button('Collapse navigation'));await page.hover('.portal-header');await pause(250);
 await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await page.hover('aside');await pause(100);assert.equal((await page.evaluate(state)).preview,'false','Touch devices do not get sticky hover');
 for(const width of [320,375,390,430,768]){
  await page.resize(width,600);await page.evaluate(`document.querySelector('button[aria-label="Open navigation"]').click()`);await pause(250);
  await page.healthy('mobile drawer '+width);assert.equal((await page.evaluate(state)).preview,'false');assert.equal((await page.evaluate(state)).scrollbar,'none');
  await page.evaluate('document.querySelector("aside").scrollTop=0');
  await page.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:100,y:450}]});
  for(const y of [400,350,300,250,200]){await page.cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:100,y}]});await pause(40);}
  await page.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await waitFor(()=>page.evaluate('document.querySelector("aside").scrollTop>0'),'Touch scrolling '+width);
  await page.evaluate(`document.querySelector('button[aria-label="Close sidebar"]').click()`);await pause(250);assert(await page.evaluate('document.querySelector("aside").inert'));cases++;
 }
 await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:false});await page.resize(1440);
 await page.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await page.hover('aside');
 assert.equal((await page.evaluate(state)).preview,'true');assert.equal(await page.evaluate('getComputedStyle(document.querySelector("aside")).transitionDuration'),'0s');
 assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.failedResponses,[]);
 console.log(JSON.stringify({passed:true,viewportThemeCases:cases,checks:['hover expands','leave restores rail','no content shift','keyboard preview','explicit pin','wheel scrolling','touch scrolling','hidden scrollbar','mobile drawer','reduced motion'],production:false}));
}finally{await browser.close();}

// Isolated local QA only. No production accounts, requests or business writes.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {assertLocalQaTarget} from './qa-safety.mjs';
import {startBrowser,login,waitFor,pause} from './qa-browser.mjs';
const fixture=JSON.parse(await readFile('.test-artifacts/archive-qa.private.json','utf8'));
const subjects=JSON.parse(await readFile('.test-artifacts/subject-qa.private.json','utf8'));
assertLocalQaTarget(fixture.url);
const browser=await startBrowser('http://localhost:3100',{port:9362}),checks=[];
const widths=[320,375,390,430,768,1024,1366,1440,1920];
async function escape(page){await page.cdp('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await page.cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});}
async function check(page,name){for(const dark of [false,true])for(const width of widths){await page.resize(width);await page.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);await page.healthy(name);if([390,768,1440].includes(width))await page.screenshot('motion-'+name+'-'+width+'-'+dark);}for(const [w,h]of[[844,390],[1024,768]]){await page.resize(w,h);await page.healthy(name+' landscape');}checks.push({screen:name,checks:20});}
try {
 const publicPage=await browser.page();await publicPage.goto('/');await publicPage.resize(390);
 await publicPage.evaluate(`document.querySelector('button[aria-label="Open menu"]').click()`);await waitFor(()=>publicPage.evaluate('document.querySelector("#public-mobile-navigation").getBoundingClientRect().height>100'),'mobile menu opens');
 await check(publicPage,'public-menu');await publicPage.resize(390);
 await escape(publicPage);await pause(250);
 assert(await publicPage.evaluate('document.querySelector("#public-mobile-navigation").inert&&document.querySelector("#public-mobile-navigation").getBoundingClientRect().height<1&&document.activeElement.getAttribute("aria-label")==="Open menu"'));
 await publicPage.evaluate(`document.querySelector('button[aria-label="Open menu"]').click()`);await publicPage.click('About','document.querySelector("#public-mobile-navigation")');
 await waitFor(()=>publicPage.evaluate('location.pathname==="/about"'),'public navigation works');
 const admin=await browser.page();await login(admin,fixture.users.admin,'/admin');await admin.resize(1440);
 await admin.hover('.lhcc-nav-link[href="/admin/subjects"]');await pause(250);
 assert(await admin.evaluate(`(()=>{const a=document.querySelector('.lhcc-nav-link[href="/admin/subjects"]').getBoundingClientRect(),b=document.querySelector('.lhcc-navigation-indicator').getBoundingClientRect();return Math.abs(a.top-b.top)<1})()`));
 await admin.evaluate(`document.querySelector('button[aria-label="Collapse navigation"]').click()`);await pause(250);
 assert(await admin.evaluate('Math.abs(document.querySelector("aside").getBoundingClientRect().width-96)<1'));
 await check(admin,'compact-sidebar');await admin.resize(1440);
 await admin.click('Users','document.querySelector("aside nav")');await waitFor(()=>admin.evaluate('location.pathname==="/admin/users"'),'compact navigation works');
 assert(await admin.evaluate('document.querySelector(".lhcc-portal-shell").dataset.sidebarCollapsed==="true"&&document.querySelector("a[aria-current=page]").getAttribute("href")==="/admin/users"'));
 await admin.evaluate(`document.querySelector('button[aria-label="Expand navigation"]').click()`);await pause(250);
 await admin.resize(320);await admin.evaluate(`(()=>{const control=document.querySelector('button[aria-label="Open navigation"]');control.focus();control.click()})()`);
 await waitFor(()=>admin.evaluate('document.querySelector("aside").getAttribute("aria-modal")==="true"'),'drawer is modal');
 assert(await admin.evaluate('document.querySelector("aside").contains(document.activeElement)&&document.body.style.overflow==="hidden"'));
 await admin.healthy('drawer');await admin.screenshot('motion-mobile-drawer');
 await escape(admin);await pause(250);
 assert(await admin.evaluate('document.querySelector("aside").inert&&document.activeElement.getAttribute("aria-label")==="Open navigation"'));
 await admin.goto('/admin/subjects/'+subjects.bankId+'/questions');
 assert(await admin.evaluate('document.querySelector("a[aria-current=page]").getAttribute("href")==="/admin/subjects"'));
 await admin.evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Add question')).focus()`);await admin.click('Add question');await waitFor(()=>admin.evaluate('Boolean(document.querySelector("dialog[open]"))'),'question sheet opens');
 await check(admin,'question-dialog');await admin.resize(390);await pause(250);
 assert(await admin.evaluate('(()=>{const r=document.querySelector("dialog").getBoundingClientRect();return Math.abs(r.bottom-innerHeight)<2&&r.left>=0&&r.right<=innerWidth})()'));
 assert(await admin.evaluate('document.querySelector("dialog").contains(document.activeElement)'));
 await admin.evaluate('document.querySelector("dialog").scrollTop=10000');
 assert(await admin.evaluate(`(()=>{const r=document.querySelector('button[aria-label="Close dialog"]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()`),'Mobile close remains reachable after scrolling');
 await admin.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 assert(await admin.evaluate('getComputedStyle(document.querySelector("dialog")).animationName==="none"&&getComputedStyle(document.querySelector(".lhcc-navigation-indicator")).transitionDuration==="0s"'));
 await escape(admin);await waitFor(()=>admin.evaluate('!document.querySelector("dialog")'),'native dialog cancels with Escape');
 assert(await admin.evaluate('document.activeElement.textContent.includes("Add question")'),'Dialog restores opener focus');
 await admin.goto('/account/settings');await admin.resize(390);
 await admin.fill('input[name=fullName]','[TEST] Motion pending '+Date.now());
 await admin.cdp('Network.emulateNetworkConditions',{offline:false,latency:300,downloadThroughput:500000,uploadThroughput:500000});
 await admin.click('Save Changes');await waitFor(()=>admin.evaluate('Boolean(document.querySelector("button[aria-busy=true]:disabled"))'),'real saving feedback');
 assert(await admin.evaluate('getComputedStyle(document.querySelector(".lhcc-spinner")).animationName==="none"'));
 await waitFor(async()=>(await admin.text()).includes('Your profile has been updated.'),'save completes after real response');
 await admin.cdp('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await check(admin,'profile-saved');
 for(const role of ['student','teacher']){const page=await browser.page();await login(page,fixture.users[role],'/'+role);await check(page,role+'-portal');}
 assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.failedResponses,[]);
 const report={passed:true,production:false,physicalDevice:false,checks,workflows:['menu navigation/Escape/focus','sidebar hover/collapse/route state','nested active route','mobile drawer focus/inert/Escape','responsive native question sheet','reduced motion','real pending save','student and teacher navigation']};
 await writeFile('.test-artifacts/motion-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}

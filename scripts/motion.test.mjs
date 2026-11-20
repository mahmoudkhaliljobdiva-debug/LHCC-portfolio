import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('src/lib/navigation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};new Function('exports',code)(exports);
const {activeNavigationIndex}=exports;
test('navigation chooses the closest child without treating dashboard as a prefix',()=>{
 const paths=['/admin','/admin/subjects','/admin/users'];
 assert.equal(activeNavigationIndex('/admin/subjects/bank/questions',paths),1);
 assert.equal(activeNavigationIndex('/admin',paths),0);
 assert.equal(activeNavigationIndex('/admin/unknown',paths),-1);
 assert.equal(activeNavigationIndex('/admin/users-old',paths),-1);
 assert.equal(activeNavigationIndex('/admin/users/edit',['/admin/users','/admin/users/edit']),1);
 assert.equal(activeNavigationIndex('/student/banks/id/setup',['/student','/student/question-banks']),1);
});
test('motion is event-driven, supports reduced motion, and adds no animation dependency',()=>{
 const css=readFileSync('src/app/globals.css','utf8');
 assert(css.includes('@media (prefers-reduced-motion: reduce)'));
 assert(css.includes('.lhcc-public-menu { grid-template-rows: 0fr;'));
 assert(css.includes('.lhcc-navigation-indicator'));
 assert(css.includes('.lhcc-modal[open]'));
 assert(css.includes('animation: none !important'));
 const navigation=readFileSync('src/layouts/dashboard-layout/portal-navigation.tsx','utf8');
 assert(!/setTimeout|setInterval|requestAnimationFrame|prefetch=\{true\}/.test(navigation));
 assert(navigation.includes('aria-current'));assert(navigation.includes('NavigationPending'));
 const button=readFileSync('src/components/ui/pending-button.tsx','utf8');
 assert(button.includes('aria-busy={pending}'));assert(button.includes('disabled={pending || disabled}'));
});
test('revalidated save UIs do not issue a redundant router refresh',()=>{
 for(const path of ['users/profile-editor.tsx','learning/admin-materials.tsx','learning/admin-subject-questions.tsx'])
  assert(!readFileSync('src/features/'+path,'utf8').includes('router.refresh()'),path);
 for(const path of ['profile.ts','materials.ts','subject-questions.ts'])
  assert(readFileSync('src/actions/'+path,'utf8').includes('revalidatePath('),path);
});

test('compact sidebar previews without changing its preference or disabling scrolling',()=>{
 const shell=readFileSync('src/layouts/dashboard-layout/dashboard-shell.tsx','utf8');
 const css=readFileSync('src/app/globals.css','utf8');
 assert(shell.includes('data-sidebar-collapsed={collapsed} data-sidebar-preview={previewing}'));
 assert(shell.includes('onPointerLeave={() => setPeeking(false)}'));
 assert(shell.includes('(hover: hover) and (pointer: fine)'));
 assert(shell.includes('onFocusCapture'));assert(shell.includes('onBlurCapture'));
 assert(shell.includes('overflow-y-auto'));
 assert(css.includes('.portal-sidebar::-webkit-scrollbar { display: none;'));
 assert(css.includes('scrollbar-width: none;'));
 assert(css.includes('Preview overlays the workspace'));
});

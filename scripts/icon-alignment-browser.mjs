// Layout regression fixtures use real TSX control classes and Lucide SVGs,
// rendered with the built app stylesheet; no authenticated data or writes.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as icons from 'lucide-react';
import { startBrowser } from './qa-browser.mjs';

const controls = [];
function walk(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) { walk(path); continue; }
    if (!path.endsWith('.tsx')) continue;
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxElement(node) && ['button', 'Link', 'NavigationLink', 'a'].includes(node.openingElement.tagName.getText(source))) {
        const children = node.children.filter(child => !ts.isJsxText(child) || child.text.trim());
        const attributes = node.openingElement.attributes.properties;
        const cls = attributes.find(prop => prop.name?.getText(source) === 'className')?.initializer;
        if (children.length === 1 && ts.isJsxSelfClosingElement(children[0]) && cls && ts.isStringLiteral(cls)) {
          const icon = icons[children[0].tagName.getText(source)];
          if (icon) controls.push({ path, classes: cls.text, svg: renderToStaticMarkup(React.createElement(icon, { className: 'size-4' })) });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
walk('src');
assert(controls.length >= 16, 'inventory covers app icon-only actions');
const browser = await startBrowser('http://localhost:3100');
try {
  const page = await browser.page();
  await page.goto('/signup');
  const html = controls.map((control, index) => `<button type="button" aria-label="Layout fixture ${index}" data-fixture="${index}" class="${control.classes}">${control.svg}</button>`).join('');
  await page.evaluate(`(() => {const fixture=document.createElement('section');fixture.id='icon-layout-fixtures';fixture.className='flex flex-wrap items-center gap-4 p-5';fixture.innerHTML=${JSON.stringify(html)};document.body.prepend(fixture);})()`);
  for (const dark of [false, true]) for (const width of [390, 768, 1366]) {
    await page.resize(width);
    await page.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
    const results = await page.evaluate(`Array.from(document.querySelectorAll('[data-fixture]')).filter(button=>getComputedStyle(button).display!=='none').map(button=>{const box=button.getBoundingClientRect();const icon=button.querySelector('svg').getBoundingClientRect();return {index:button.dataset.fixture,width:box.width,height:box.height,dx:Math.abs(box.left+box.width/2-icon.left-icon.width/2),dy:Math.abs(box.top+box.height/2-icon.top-icon.height/2)};})`);
    for (const result of results) {
      assert(result.dx <= 1 && result.dy <= 1, JSON.stringify({ ...result, path: controls[result.index].path, width, dark }));
      assert(result.width >= 44 && result.height >= 44, 'touch target');
    }
    console.log(`PASS ${width}px ${dark ? 'dark' : 'light'}: ${results.length} visible icon controls centered`);
  }
  await page.screenshot('icon-alignment-fixtures');
  assert.deepEqual(browser.failedResponses, []);
  assert.deepEqual(browser.errors, []);
} finally { await browser.close(); }

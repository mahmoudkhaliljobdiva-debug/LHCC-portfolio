// Read-only deployed audit and same-domain before/after lab measurements.
// Does not log in, submit forms, or create/change/delete any backend data.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { startBrowser, pause } from './qa-browser.mjs';

const phase = process.argv[2] ?? 'after';
assert(['before', 'after'].includes(phase));
const base = 'https://lhcc-lb.com';
const routes = ['/', '/about', '/services', '/platform', '/contact', '/login', '/signup'];
const headers = {};
for (const path of routes) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  headers[path] = Object.fromEntries(['x-content-type-options', 'referrer-policy', 'x-frame-options',
    'content-security-policy', 'x-powered-by', 'cache-control'].map(key => [key, response.headers.get(key)]));
  if (phase === 'after') {
    assert.equal(headers[path]['x-content-type-options'], 'nosniff', path);
    assert.equal(headers[path]['referrer-policy'], 'strict-origin-when-cross-origin', path);
    assert.equal(headers[path]['x-frame-options'], 'DENY', path);
    assert.equal(headers[path]['content-security-policy'], "frame-ancestors 'none'; object-src 'none'; base-uri 'self'", path);
    assert.equal(headers[path]['x-powered-by'], null, path);
  }
}
const exposure = [];
for (const path of ['/.env.local', '/.env', '/scripts/backend-qa-data.mjs', '/.test-artifacts/backend-qa.private.json',
  '/next.config.ts', '/qa', '/debug', '/api/debug', '/api/qa']) {
  const response = await fetch(base + path, { redirect: 'manual' });
  const html = await response.text();
  // App Router may have streamed a parent layout before notFound() executes.
  // A 200 alone is not exposure: verify its actual noindex not-found document.
  const streamedNotFound = response.status === 200 && response.headers.get('content-type')?.startsWith('text/html')
    && /<meta[^>]*name="robots"[^>]*content="noindex"/.test(html) && html.includes('Page not found');
  assert([403, 404].includes(response.status) || streamedNotFound, 'Internal artifact unavailable: ' + path);
  assert(!/sb_secret_[A-Za-z0-9_-]{20,}|^NEXT_PUBLIC_SUPABASE_URL=/m.test(html), 'No secret/config payload: ' + path);
  exposure.push({ path, status: response.status, streamedNotFound: Boolean(streamedNotFound) });
}
const browser = await startBrowser(base, { port: 9346 }), performance = [], checks = [];
try {
  const page = await browser.page();
  await page.cdp('Network.setCacheDisabled', { cacheDisabled: true });
  for (const width of [390, 1366]) {
    await page.resize(width);
    for (const path of ['/', '/services', '/login']) {
      await page.goto(path);
      const samples = [];
      for (let i = 0; i < 5; i++) {
        await page.goto(path); await page.healthy(path);
        samples.push(await page.evaluate("(()=>{const n=performance.getEntriesByType('navigation')[0];return {ttfb:n.responseStart,dom:n.domContentLoadedEventEnd,jsBytes:performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.endsWith('.js')).reduce((sum,r)=>sum+r.encodedBodySize,0)};})()"));
      }
      const median = key => samples.map(sample => sample[key]).sort((a, b) => a - b)[2];
      performance.push({ path, width, ttfb: median('ttfb'), dom: median('dom'), jsBytes: median('jsBytes'), samples });
    }
  }
  if (phase === 'after') for (const path of routes) {
    await page.goto(path);
    for (const dark of [false, true]) for (const width of [320, 375, 390, 430, 768, 1024, 1366, 1440, 1920]) {
      await page.resize(width); await page.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
      await pause(250); await page.healthy(path + ' ' + width + ' ' + dark);
    }
    checks.push(path + ': nine widths, light/dark');
  }
  assert.deepEqual(browser.errors, []); assert.deepEqual(browser.failedResponses, []);
} finally { await browser.close(); }
await mkdir('.test-artifacts', { recursive: true });
await writeFile(`.test-artifacts/production-cleanup-${phase}.json`, JSON.stringify({ phase, headers, exposure, performance, checks,
  measurement: 'Edge, same production domain, cache disabled, five samples after warmup; variable network, not Core Web Vitals.', mutations: false }, null, 2));
console.log(JSON.stringify({ passed: true, phase, exposure, checks,
  performance: performance.map(({ path, width, ttfb, dom, jsBytes }) => ({ path, width, ttfb, dom, jsBytes })) }));

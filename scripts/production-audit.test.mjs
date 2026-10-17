import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { assertLocalQaTarget } from './qa-safety.mjs';

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
}
const sources = files('src').filter(file => /\.tsx?$/.test(file));

test('local QA accepts only isolated loopback endpoints', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.equal(assertLocalQaTarget(`http://${host}:55431`, {}), `http://${host}:55431`);
  }
  for (const value of [undefined, '', 'https://lcazjsmmegwwnmuupsko.supabase.co',
    'https://localhost.example.com', 'file:///localhost', 'http://user:password@localhost']) {
    assert.throws(() => assertLocalQaTarget(value, {}));
  }
});

test('QA mutations and instrumentation are forbidden on Vercel', () => {
  for (const environment of [{ VERCEL: '1' }, { VERCEL_ENV: 'production' }, { VERCEL_ENV: 'preview' }]) {
    assert.throws(() => assertLocalQaTarget('http://localhost:55431', environment));
  }
});

test('legacy QA import refuses production before initializing clients', () => {
  const output = execFileSync(process.execPath, ['--input-type=module', '-e',
    "try { await import('./scripts/backend-qa-data.mjs'); process.exit(1); } catch(error) { if(!error.message.includes('refuse remote')) throw error; console.log('blocked'); }"],
  { encoding: 'utf8', env: { ...process.env, VERCEL: '', VERCEL_ENV: '', NEXT_PUBLIC_SUPABASE_URL: 'https://lcazjsmmegwwnmuupsko.supabase.co' } });
  assert.equal(output.trim(), 'blocked');
});

test('metrics preload refuses production without replacing global fetch', () => {
  const output = execFileSync(process.execPath, ['--input-type=module', '-e',
    "const original=fetch;try { await import('./scripts/local-fetch-metrics.mjs'); process.exit(1); } catch(error) { if(!error.message.includes('refuse remote') || fetch !== original) throw error; console.log('blocked'); }"],
  { encoding: 'utf8', env: { ...process.env, VERCEL: '', VERCEL_ENV: '', NEXT_PUBLIC_SUPABASE_URL: 'https://lcazjsmmegwwnmuupsko.supabase.co' } });
  assert.equal(output.trim(), 'blocked');
});

test('cleanup tool contains no mutation/deletion capability', () => {
  const code = readFileSync('scripts/backend-qa-cleanup.mjs', 'utf8');
  assert(!/\.(?:delete|update|insert|upsert|deleteUser|signOut)\s*\(/.test(code));
  assert(code.includes('assert.equal(process.argv.length, 2'));
  assert(code.includes('READ ONLY'));
});

test('opt-in auth browser checks validate the database, not only the app hostname', () => {
  const code = readFileSync('scripts/course-browser-test.mjs', 'utf8');
  assert(code.includes('assertLocalQaTarget(process.env.NEXT_PUBLIC_SUPABASE_URL)'));
  assert(code.indexOf('assertLocalQaTarget(process.env.') < code.indexOf('const browser = spawn'));
});

test('production imports cannot depend on QA scripts, fixtures or mock business data', () => {
  for (const file of sources) {
    const code = readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
    function inspect(node) {
      const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
        : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : null;
      if (specifier && ts.isStringLiteral(specifier)) {
        assert(!/(?:scripts\/|test-artifacts|\.mock\b|fixtures\/)/.test(specifier.text), file);
      }
      ts.forEachChild(node, inspect);
    }
    inspect(source);
  }
});

test('production code has no debugging statements or public secret variables', () => {
  for (const file of sources) {
    const code = readFileSync(file, 'utf8');
    assert(!/NEXT_PUBLIC_\w*(?:SECRET|SERVICE_ROLE|PASSWORD|PRIVATE_KEY)/.test(code), file);
    const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
    function inspect(node) {
      assert(node.kind !== ts.SyntaxKind.DebuggerStatement, file);
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        assert(!(node.expression.expression.getText(source) === 'console'
          && ['log', 'debug'].includes(node.expression.name.text)), file);
      }
      ts.forEachChild(node, inspect);
    }
    inspect(source);
  }
});

test('basic security headers do not restrict Next scripts, PDF workers or requests', async () => {
  const exports = {};
  const code = ts.transpileModule(readFileSync('next.config.ts', 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('exports', code)(exports);
  const config = exports.default;
  assert.equal(config.poweredByHeader, false);
  assert.equal(config.productionBrowserSourceMaps, false);
  assert.equal(config.logging.serverFunctions, false);
  const rule = (await config.headers())[0];
  assert.equal(rule.source, '/:path*');
  const headers = Object.fromEntries(rule.headers.map(header => [header.key, header.value]));
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['Content-Security-Policy'], "frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
});

test('public assets contain no QA documents, manifests or source maps', () => {
  assert(files('public').every(file => !/(?:\.(?:pdf|map|env|log)$|qa.private|test-artifacts)/i.test(file)));
});

test('production dependencies omit confirmed unused libraries', () => {
  const { dependencies } = JSON.parse(readFileSync('package.json', 'utf8'));
  assert(!('class-variance-authority' in dependencies));
  assert(!('date-fns' in dependencies));
  assert.equal(dependencies.next, '16.3.8');
});

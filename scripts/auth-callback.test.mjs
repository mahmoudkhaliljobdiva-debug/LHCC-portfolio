import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function load(result = { error: null }) {
  const calls = [], exports = {};
  const code = ts.transpileModule(readFileSync('src/app/auth/callback/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', code)(name => name === 'next/server' ? {
    NextResponse: { redirect: url => new Response(null, { status: 307, headers: { location: url.toString() } }) },
  } : { createClient: async () => ({ auth: {
    exchangeCodeForSession: async code => { calls.push(['pkce', code]); return result; },
    verifyOtp: async input => { calls.push(['otp', input]); return result; },
  } }) }, exports);
  return { calls, run: path => { const url = new URL(path, 'https://lhcc-lb.com'); return exports.GET({ url: url.href, nextUrl: url }); } };
}
test('existing recovery PKCE callback still uses the code exchange and allowlisted destination', async () => {
  const { calls, run } = load();
  const response = await run('/auth/callback?code=fixture&next=/login/update-password');
  assert.deepEqual(calls, [['pkce', 'fixture']]);
  assert.equal(response.headers.get('location'), 'https://lhcc-lb.com/login/update-password');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});
test('an invitation hash is verified by Supabase before session setup', async () => {
  const { calls, run } = load();
  const response = await run('/auth/callback?token_hash=fixture&type=invite&next=https://untrusted.invalid');
  assert.deepEqual(calls, [['otp', { token_hash: 'fixture', type: 'invite' }]]);
  assert.equal(response.headers.get('location'), 'https://lhcc-lb.com/login/update-password');
});
test('malformed, unsupported or ambiguous callbacks never invoke Auth', async () => {
  for (const path of ['/auth/callback', '/auth/callback?token_hash=fixture&type=ADMIN', '/auth/callback?token_hash=fixture&type=recovery', '/auth/callback?code=x&token_hash=y&type=invite', '/auth/callback?token_hash=' + 'x'.repeat(2049) + '&type=invite']) {
    const { calls, run } = load();
    const response = await run(path);
    assert.deepEqual(calls, []);
    assert.equal(response.headers.get('location'), 'https://lhcc-lb.com/login?reason=recovery-error');
  }
});
test('expired/replayed invitation errors are neutral and cannot redirect externally', async () => {
  const { run } = load({ error: { message: 'Private provider details' } });
  const response = await run('/auth/callback?token_hash=fixture&type=invite');
  assert.equal(response.headers.get('location'), 'https://lhcc-lb.com/login?reason=recovery-error');
});

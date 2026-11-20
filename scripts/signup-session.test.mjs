import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, mocks) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', js)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(resolve('src', name.slice(2) + '.ts'), mocks) : require(name), exports);
  return exports;
}
const input = { fullName: 'Signup Test', email: 'signup@example.com', password: 'Valid-password-123', confirmPassword: 'Valid-password-123', countryCode: 'LB', phone: '71056331', age: 30, gender: 'male', homeAddress: 'Beirut' };
function fixture({ ready = true, session = true, error = null } = {}) {
  let signouts = 0, calls = 0, payload;
  const exports = load(resolve('src/actions/auth.ts'), {
    'next/headers': {}, 'next/navigation': {}, '@/lib/auth/server': {},
    '@/lib/supabase/auth-settings': { passwordSignupReady: async () => ready },
    '@/lib/supabase/server': { createClient: async () => ({ auth: {
      signUp: async value => { calls++; payload = value; return { data: { user: { id: 'new-student' }, session: session ? { access_token: 'test-session' } : null }, error }; },
      signOut: async () => { signouts++; },
    } }) },
  });
  return { ...exports, counts: () => ({ signouts, calls, payload }) };
}
test('successful signup retains session and returns homepage', async () => {
  const f = fixture(); const result = await f.registerAccount(input);
  assert.equal(result.ok, true); assert.equal(result.data.destination, '/');
  assert.equal(f.counts().signouts, 0);
  assert.equal(f.counts().payload.options.data.phone, '+96171056331');
  assert.equal('role' in f.counts().payload.options.data, false);
});
test('no-session registration never claims authenticated navigation', async () => {
  const f = fixture({ session: false }); const result = await f.registerAccount(input);
  assert.equal(result.ok, true); assert.equal(result.data.destination, null); assert.equal(f.counts().signouts, 0);
});
test('configuration mismatch prevents account creation', async () => {
  const f = fixture({ ready: false }); assert.equal((await f.registerAccount(input)).ok, false); assert.equal(f.counts().calls, 0);
});
test('signup error does not return a destination', async () => {
  const f = fixture({ error: { message: 'Signup failed' } }); const result = await f.registerAccount(input);
  assert.equal(result.ok, false); assert.equal('data' in result, false);
});
test('invalid registration does not call signup', async () => {
  const f = fixture(); assert.equal((await f.registerAccount({ ...input, fullName: '' })).ok, false); assert.equal(f.counts().calls, 0);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', js)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(resolve('src', name.slice(2) + '.ts'), mocks) : require(name), exports);
  return exports;
}
const valid = { fullName: 'Profile Test', countryCode: 'LB', phone: '71056331', age: 30, gender: 'male', homeAddress: 'Beirut' };
function fixture(role = 'STUDENT', authenticated = true, databaseError = false) {
  const updates = [], filters = [], revalidations = [];
  const row = { id: 'signed-in-user', role, status: 'ACTIVE', expiration_date: '2030-01-01', full_name: 'Original' };
  const chain = {
    update(value) { updates.push(value); Object.assign(row, value); return chain; },
    eq(column, id) { filters.push([column, id]); return chain; },
    select() { return chain; },
    async maybeSingle() { return { data: databaseError ? null : row, error: databaseError ? { message: 'failure' } : null }; },
  };
  const action = load(resolve('src/actions/profile.ts'), {
    'next/cache': { revalidatePath: (...args) => revalidations.push(args) },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: row.id } : null }, error: null }) } }) },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: table => { assert.equal(table, 'profiles'); return chain; } }) },
  });
  return { ...action, updates, filters, row, revalidations };
}
for (const role of ['ADMIN', 'TEACHER', 'STUDENT']) test(`${role} edits only own personal fields`, async () => {
  const f = fixture(role);
  const result = await f.saveOwnProfile(valid);
  assert.equal(result.ok, true);
  assert.equal(result.data.phone, '+96171056331');
  assert.deepEqual(f.filters, [['id', 'signed-in-user']]);
  assert.deepEqual(Object.keys(f.updates[0]).sort(), ['age', 'country_code', 'full_name', 'gender', 'home_address', 'phone']);
  assert.equal(f.row.role, role); assert.equal(f.row.status, 'ACTIVE'); assert.equal(f.row.expiration_date, '2030-01-01');
  assert.deepEqual(f.revalidations, [['/', 'layout']]);
});
for (const extra of [{ id: 'other-user' }, { role: 'ADMIN' }, { status: 'ACTIVE' }, { expiration_date: '2099-01-01' }]) test(`rejects protected input: ${Object.keys(extra)[0]}`, async () => {
  const f = fixture(); const result = await f.saveOwnProfile({ ...valid, ...extra });
  assert.equal(result.ok, false); assert.equal(result.error.code, 'VALIDATION_ERROR'); assert.equal(f.updates.length, 0);
});
test('anonymous cannot write', async () => {
  const f = fixture('STUDENT', false); const result = await f.saveOwnProfile(valid);
  assert.equal(result.error.code, 'UNAUTHENTICATED'); assert.equal(f.updates.length, 0);
});
test('invalid personal fields cannot write', async () => {
  for (const input of [{ ...valid, fullName: '' }, { ...valid, age: 121 }, { ...valid, countryCode: 'XX' }, { ...valid, phone: '123' }]) {
    const f = fixture(); assert.equal((await f.saveOwnProfile(input)).ok, false); assert.equal(f.updates.length, 0);
  }
});
test('legacy profiles may leave optional details empty', async () => {
  const f = fixture(); const result = await f.saveOwnProfile({ fullName: 'Legacy Profile', countryCode: null, phone: null, age: null, gender: null, homeAddress: null });
  assert.equal(result.ok, true);
});
test('database errors return safe feedback', async () => {
  const f = fixture('STUDENT', true, true); const result = await f.saveOwnProfile(valid);
  assert.equal(result.ok, false); assert.equal(result.error.code, 'INTERNAL_ERROR'); assert.equal(f.revalidations.length, 0);
});

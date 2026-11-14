import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
test('security fixes stay pinned with matching Next runtime and lint configuration', () => {
  assert.equal(manifest.dependencies.next, '16.4.6');
  assert.equal(manifest.devDependencies['eslint-config-next'], manifest.dependencies.next);
  assert.equal(manifest.dependencies.zod, '4.6.7');
  assert.equal(manifest.overrides['@typescript-eslint/typescript-estree'].minimatch, '11.0.1');
});
test('pending import defense migration never changes rows, grants or published access', () => {
  const sql = readFileSync('supabase/migrations/20261111183838_audit_import_defense_and_fk_indexes.sql', 'utf8')
    .replace(/--[^\n]*/g, '');
  assert.equal((sql.match(/enable row level security/gi) ?? []).length, 4);
  assert.equal((sql.match(/create index/gi) ?? []).length, 4);
  assert(!/\b(?:grant|revoke|insert|update|delete|truncate|drop|create\s+policy)\b/i.test(sql));
  assert(sql.includes("raise exception 'Reconcile the existing production import schema"));
});
test('production structural audit is read-only and checks missing evidence rather than accepting NULL', () => {
  const sql = readFileSync('supabase/tests/full_project_audit_readonly.sql', 'utf8').replace(/--[^\n]*/g, '');
  assert(sql.includes('begin read only;'));
  assert(sql.includes('query_to_xml(check_sql,false,false'));
  assert(!/\b(?:insert|update|delete|truncate|drop|alter|create)\b/i.test(sql));
});

test('CMS reset retains the Admin guard and narrows the update for PostgREST safeupdate', () => {
  const sql = readFileSync('supabase/migrations/20261111195537_fix_portfolio_reset_safeupdate.sql', 'utf8');
  assert(sql.includes("private.is_active_role('ADMIN')"));
  assert(sql.includes("where section_key in ('about','services','platform','contact')"));
  assert(sql.includes('if affected <> 4 then'));
  assert(!/\b(?:grant|revoke|truncate|drop|disable)\b/i.test(sql.replace(/--[^\n]*/g, '')));
  assert(!/safeupdate\s*=\s*(?:off|false)/i.test(sql));
});

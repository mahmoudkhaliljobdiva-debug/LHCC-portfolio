// Read-only local default/content schema comparison. Does not print content or contact details.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
const require = createRequire(import.meta.url);
function load(path) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', js)(name => name.startsWith('@/') ? load(resolve('src', name.slice(2) + '.ts')) : require(name), exports);
  return exports;
}
const container = 'supabase_db_archive-db';
const info = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' }))[0];
assert.equal(info.Config.Labels['com.supabase.cli.project'], 'archive-db');
assert(process.argv.length === 2 || (process.argv.length === 3 && ['--probe-reset','--probe-rest-reset'].includes(process.argv[2])));
const defaults = JSON.parse(execFileSync('docker', ['exec', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-c', 'select jsonb_object_agg(section_key,default_content) from public.portfolio_content;'], { encoding: 'utf8' }));
if (process.argv.includes('--probe-reset')) {
  const m = JSON.parse(readFileSync('.test-artifacts/archive-qa.private.json', 'utf8'));
  assert.match(m.users.admin.id, /^[a-f0-9-]{36}$/);
  const query = `begin; select set_config('request.jwt.claim.sub','${m.users.admin.id}',true);
    set local role authenticated;
    do $$ begin begin perform public.reset_portfolio_content(); raise notice 'RESET_SUCCESS';
    exception when others then raise notice 'RESET_ERROR % %',SQLSTATE,SQLERRM; end; end $$;
    rollback;`;
  execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: query, stdio: ['pipe', 'inherit', 'inherit'] });
}
if (process.argv.includes('--probe-rest-reset')) {
  const m = JSON.parse(readFileSync('.test-artifacts/archive-qa.private.json', 'utf8'));
  assert(['localhost','127.0.0.1'].includes(new URL(m.url).hostname));
  const db = createClient(m.url,m.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  assert.ifError((await db.auth.signInWithPassword(m.users.admin)).error);
  const original = await db.from('portfolio_content').select('section_key,content');
  assert.ifError(original.error);
  try {
    const reset = await db.rpc('reset_portfolio_content');
    console.log(JSON.stringify({resetStatus:reset.status,errorCode:reset.error?.code,message:reset.error?.message}));
    assert.ifError(reset.error);
    const saved = await db.from('portfolio_content').select('section_key,content');
    assert.ifError(saved.error);
    assert.deepEqual(Object.fromEntries(saved.data.map(row=>[row.section_key,row.content])), defaults);
    const student = createClient(m.url,m.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
    assert.ifError((await student.auth.signInWithPassword(m.users.student)).error);
    assert((await student.rpc('reset_portfolio_content')).error, 'Student reset denied');
    const anon = createClient(m.url,m.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
    assert((await anon.rpc('reset_portfolio_content')).error, 'Anonymous reset denied');
    await student.auth.signOut();
    console.log('PASS real local PostgREST reset, exact default readback and Student/anonymous denials');
  } finally {
    assert.ifError((await db.rpc('save_portfolio_content',{payload:Object.fromEntries(original.data.map(row=>[row.section_key,row.content]))})).error);
    await db.auth.signOut();
  }
}
const result = load(resolve('src/lib/validation/portfolio.ts')).portfolioContentSchema.safeParse(defaults);
console.log(JSON.stringify(result.success ? { valid: true } : { valid: false, issues: result.error.issues.map(issue => ({ path: issue.path, code: issue.code, message: issue.message })) }));

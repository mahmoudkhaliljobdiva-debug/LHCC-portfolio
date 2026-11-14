// Read-only CLI status adapter. Pin the fallback; never auto-install the changing latest CLI.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { assertLocalQaTarget } from './qa-safety.mjs';

export function localQaStatus() {
  const cli = process.env.LHCC_QA_SUPABASE_CLI;
  const args = ['status', '--workdir', '.test-artifacts/archive-db', '-o', 'json'];
  const status = JSON.parse(execFileSync(cli || 'cmd.exe', cli ? args :
    ['/d', '/s', '/c', 'npx.cmd --offline supabase@2.120.0 ' + args.join(' ')],
  { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }));
  assertLocalQaTarget(status.API_URL);
  assert(status.ANON_KEY && status.SERVICE_ROLE_KEY, 'The isolated CLI must return local test credentials.');
  return status;
}

// Test tooling only; never imported by application code.
import assert from 'node:assert/strict';

export function assertLocalQaTarget(value, environment = process.env) {
  assert(environment.VERCEL !== '1' && !environment.VERCEL_ENV,
    'QA mutation/instrumentation tools must not run on Vercel.');
  let url;
  try { url = new URL(value); } catch { throw new Error('Configure an isolated local Supabase URL for QA.'); }
  assert(['http:', 'https:'].includes(url.protocol)
    && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    && !url.username && !url.password,
  'QA mutation/instrumentation tools refuse remote Supabase targets.');
  return url.origin;
}

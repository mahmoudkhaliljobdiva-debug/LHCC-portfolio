# QA infrastructure and production safety

Current policy (2026-10-11): mutation tests run against isolated local Supabase,
never the hosted production project. Do not remove valuable tests just because
the application is live. Production/public smoke runners are read-only.

## Retained infrastructure

- `archive-db-tests.mjs` / `learning-platform-db.mjs`: rollback tests restricted
  to the Docker container labelled `archive-db`.
- `archive-qa-fixtures.mjs`, `mobile-qa-fixtures.mjs`: loopback-only browser fixtures.
- Archive, learning-platform, mobile, auth/profile, navigation and RLS regression
  tests remain in `scripts/` / `supabase/tests/`.
- `backend-qa-data.mjs` and its legacy consumers are retained but now reject
  remote backend URLs **before** client initialization. They cannot run on Vercel.
  Local manifests use `.test-artifacts/backend-qa-local.private.json`, store the
  exact backend origin, and cannot reuse the old production manifest.
- `backend-qa-cleanup.mjs` is a read-only inventory, not a deletion tool. Passing
  the former `--confirm-run` arguments fails. Database/storage cleanup needs a
  separately reviewed plan, explicit approval and tested recovery.
- `course-browser-test.mjs` opt-in mutation mode validates the backend URL as well
  as the app URL; localhost frontend alone is not proof of isolated Supabase.
- `local-fetch-metrics.mjs` rejects remote backends and Vercel before installing
  instrumentation. It is not configured in application startup or deployed envs.

Use the current archive instructions in [learning-platform.md](learning-platform.md)
for repeatable end-to-end tests. Legacy browser expectations are preserved as
test infrastructure, not claimed to be a maintained replacement for that suite.
Never copy QA credentials into public files or Git; ignored manifests/evidence
are private and not application dependencies.

## Historical production run, not active fixtures

The archived ignored manifest describes `20260917-0b33a4`. The production audit
matched exact recorded IDs: its seven Auth/profile identities and four banks no
longer exist. No QA question/account/bank should be recreated from this history.
The obsolete `exam-qa-fixtures.mjs` generator was removed: its manifest is a
credential-free cleanup marker, and `exam-browser-test.mjs` already delegates to
the current local archive suite.

One published About description still contains the exact historical CMS marker:
`[TEST] QA 20260917-0b33a4 CMS persistence verified.`
This is reported in [production-cleanup-audit.md](production-cleanup-audit.md).
It was **not** edited or deleted automatically. Only the marker should be removed
after approval and a fresh exact-row backup/recovery plan, preserving all other
content and concurrent edits. This audit made no production writes.

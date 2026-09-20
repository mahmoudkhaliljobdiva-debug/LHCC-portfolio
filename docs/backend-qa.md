# Backend QA data

The production-backed QA run is recorded privately in
`.test-artifacts/backend-qa.private.json`. That ignored file contains generated
credentials and exact database IDs; never commit or share it.

Current retained run: `20260917-0b33a4`. Its records use the prefix
`[TEST] QA 20260917-0b33a4` and include seven Auth/profile identities, four
question banks, ten QCU questions, access request/grant states, two completed
attempts with six answers, five wallet ledger rows, and one published About-page
verification marker. They remain in Supabase for manual testing.

The scripts are test infrastructure only and are never imported by the app:

- `backend-qa-data.mjs`: creates a run once and stores random credentials only
  in the ignored manifest.
- `backend-qa-verify.mjs`: checks Auth/profile linkage, RLS boundaries, answer
  security, retry idempotency, persistence, and ledger arithmetic.
- `backend-qa-browser.mjs`: exercises the real UI and Server Actions.
- `backend-qa-cleanup.mjs`: prints an exact dry-run cleanup plan by default.

Inspect cleanup without changing Supabase:

```bash
node --env-file=.env.local scripts/backend-qa-cleanup.mjs
```

The output provides the exact `--confirm-run` command. Execution validates the
project, tag, Auth emails, profile names, bank names, question text, and CMS
marker before deleting only recorded/related IDs in foreign-key order. It revokes
QA sessions before deleting Auth users. Do not run it while manual QA is needed.

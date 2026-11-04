# Learning foundation release — 2026-11-04

## Scope and authorization

The user authorized development, Supabase migrations, normal Git pushes and
release through the existing Vercel Git integration. Application source checkpoint:
`babe31ee7c483ebee5a0a7682862abdfdb604453`.

Release the completed typed Subjects/Exam Tracks and Admin chapter/lesson/private
PDF authoring workflow. Publication requires verified questions, resolved warnings
and an Admin-reviewed why-correct explanation. Originals remain private; explicit
Student-safe review is separate. Subjects remain Draft/Inactive: Student lesson
reading/practice and new subject entitlements are not enabled by this release.

No medical content import, invented rationale, new offer/payment, existing grant
change, Nursing reassignment, production fixture or historical migration replay
is included. Existing exams and portfolios retain their real Supabase data.

## Targets

- GitHub: `mahmoudkhaliljobdiva-debug/LHCC-portfolio`, production branch `main`.
- Working branch: `feat/learning-material-foundation`.
- Supabase: `lcazjsmmegwwnmuupsko` (`LHCCPortfolio`).
- Vercel: `prj_Up6LYAgO1zgaWUHmhzPsmVHsFuu7` / team
  `team_z8SV4GezVqNXVEvFQEsLskvl`, Node 22.x.
- Production: https://lhcc-lb.com.
- Pre-release production application: `9abc258`, READY deployment
  `dpl_HpzRfNFc4rJ6moBAZ1cNhkDWJbyQ`.

## Verification

Fresh verification on Node 22.23.2:

- Typecheck: PASS.
- Lint: PASS.
- Production build: PASS (isolated local environment; `.env.local` not changed).
- Node tests: 133/133 PASS.
- Rollback/concurrency SQL: 519 distinct checks PASS in isolated `archive-db`;
  no production tests creating users, attempts, grants or sales.
- Responsive/browser rerun: PASS, 144 material-management combinations and
  160 lesson/PDF combinations, plus 44 focused captures. Actual UI/actions/RPC/
  persisted readback and private approval/revocation passed; local fixtures cleaned.
- Production migration checks: PASS. All 28 pre-existing application-table
  counts/fingerprints match before/after both migrations. Auth identities (5) and
  existing Storage objects (0) also remain unchanged; new lesson/document rows=0.
- All 44 final migration function bodies match the reviewed source; new public
  wrappers remain invoker. Production Admin catalog/question reads, Student Admin
  RPC denial (including spoofed user metadata), private metadata boundaries and
  anonymous catalog checks passed in read-only, rolled-back role sessions.
- All seven new tables have RLS; private draft/explanation ACLs and anonymous
  function/schema denials verified; the PDF bucket is private with a 20 MB limit.
- Production advisors: no new findings. Existing Auth leaked-password-protection
  WARN remains; see [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
  Existing private `live_revisions` no-policy INFO is unchanged. Do not report a
  fully clean production security-advisor result or silently change Auth settings.
- Production HTTP checks: PASS for all public portfolio/specialty/auth pages,
  generated favicon URLs and crawler rules. Anonymous protected paths redirect
  server-side to `/login`, including the new material/lesson routes.
- Production browser: PASS, 10 public pages × 3 widths (390/768/1366) × both
  themes = 60 combinations, plus 15 anonymous portal-route guards. No browser
  exceptions or HTTP 5xx were observed. No live forms or user data were mutated.
- Exact protected deployment HTTP fetch: 200, LHCC HTML confirmed through the
  existing Vercel connection; Deployment Protection was not disabled.
- Post-deployment integrity: all 28 baseline application-table fingerprints
  still match. Production release tests remained read-only.
- Runtime observation: no matching error/fatal logs for the deployment and no
  project runtime-error clusters in the checked 30-minute window. This is bounded
  observation, not proof of no future errors. No log drains are configured;
  external monitoring remains a gap, not a newly installed integration.

Existing module-type/CRLF notices remain non-failing. Physical Samsung Internet
and representative Arabic/mixed selectable-text PDF extraction are not verified.

## Migration and preservation plan

Apply only the reviewed new SQL, in order, to the verified project. Use named
Supabase migrations; never blindly push/replay the historical directory because
[documented timestamp drift](../migration-history-reconciliation.md) remains.

1. `20261031173818_typed_learning_materials.sql` — production service version
   `20261104174628`, name `typed_learning_materials`: APPLIED.
2. `20261031185924_subject_lessons_private_pdfs.sql` — production service version
   `20261104174656`, name `subject_lessons_private_pdfs`: APPLIED.

Both are additive, transaction-scoped by the migration service, with short lock
timeouts. Existing question-bank columns/identities, prices, content, keys,
profiles, attempts/results, access/ledger rows and CMS data are not rewritten.
The only existing-row addition is explicit default material metadata. New tables
start empty. Record actual server-assigned migration versions after application.

Before migration, capture counts and stable row fingerprints for all 28 existing
public/private application tables; exclude only the five intentionally added
question-bank metadata columns from comparison. Baseline: 5 profiles, 1 bank,
100 questions, 20 cases, 4 attempts, 3 grants and 2 wallet rows. Repeat the exact
query after migration and after release. Hash comparisons are integrity checks,
not a database backup or evidence that every browser journey was tested live.

If a migration errors, inspect actual state before retrying; transactional failure
must not be followed by blind replay. If application release fails, keep existing
production code live or use a normal forward Git revert/release. Leave additive
schema/data intact; do not drop lesson tables, delete new content, rewrite grants,
restore an entire database or reverse historical migrations as an automatic
rollback. Any corrective database change must be independently reviewed.

## Current release state

Both production migrations applied successfully, with business data preserved.
The initial Git-integrated production release is **READY**:

- Git commit: `1d2d1c69615a58857bc44952c3ab772bfa1481a9`.
- Deployment: `dpl_E4CctvU4xCH4WWZTjREMRVgeE9Mz`, source `git`, branch `main`.
- Exact URL: https://lhcc-portfolio-je06n11ow-mahmoudkhaliljobdiva-8508.vercel.app.
- Public domain: https://lhcc-lb.com, assigned to that deployment.
- Vercel build: PASS, approximately 48 seconds after build start.
- No separate manual deployment or protection/configuration change was made.

This verification record and reusable read-only smoke scripts are a follow-up
commit with unchanged application source. Their normal Git push can create a
new deployment; verify its final SHA/READY/domain mapping rather than assuming
this initial deployment remains the latest release forever.

Release verification tooling: `scripts/release-http-smoke.mjs` and
`scripts/release-public-smoke.mjs`. Both default to read-only checks; the latter
must receive `QA_BASE_URL=https://lhcc-lb.com` for production. Neither creates
accounts, submits forms or writes backend data. Authenticated authoring/exam
mutations were tested in isolated local Supabase, not through live production
accounts. Production role/RPC checks were read-only transactions.

Favicon regression check: `/favicon.ico` and its generated query URL returned
200 `image/vnd.microsoft.icon`, 48×48; `/icon.png` and its generated query URL
returned 200 `image/png`, 192×192. Private portal robots rules remain unchanged.
This does not assert that an external search engine refreshed its cached icon.

## Remaining implementation

The supplied Psychiatry PDF is 98 image-only pages (about 80.8 MiB) with flattened
visual keys and some existing written explanations. It was inspected locally,
not imported/published. It needs manual transcription or an optional reviewed OCR
workflow and parts below the current 20 MB upload limit; do not infer answer keys
from highlighted stems/title or invent medical explanations.

Student lessons/completion/practice, full track navigation, versioned packages/
quotes, separate manual payment confirmation, source-specific entitlements,
Student purchase interfaces and their Realtime integration remain unfinished.
See the [phase checklist](../learning-architecture-implementation.md). Do not claim
the entire approved platform is complete merely because this increment is live.

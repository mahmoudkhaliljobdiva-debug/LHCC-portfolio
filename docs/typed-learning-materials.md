# Typed learning materials — Phase 2 checkpoint

Production update (2026-11-04): the verified foundation is being released under
the user's explicit authorization. See [the release record](releases/2026-11-04-learning-foundation.md)
for applied migration versions and deployment status. The original October 31
verification below is retained as historical evidence, not current release state.

Verified locally on 2026-10-31 with Node 22.23.2. **Not a production release.**
See the [approved decisions](learning-architecture-implementation.md) and
[migration reconciliation](migration-history-reconciliation.md).

## Implemented

Existing `question_banks` remain stable material/question-pool identities. Additive
material type, exam category, publication, curated icon and language fields
separate Subjects from Exam Tracks without inferring categories from names.
`/admin/subjects` and `/admin/exam-tracks` provide authorized, paged management.
New records start Draft/Inactive. Subjects remain draft-only by database CHECK,
not just disabled UI, until lesson and group access implementations exist.

Public and Student hubs share typed catalog grouping. Only real published active
tracks appear. Subjects cannot use legacy bank requests/grants/sales, question
reads or exam starts. There are no seeded lessons, Psychiatry placeholders or
invented free offers. Existing bank editing remains; new creation uses typed
management. The legacy bank editor excludes Subject backing pools.

Authorization is repeated in actions and RPCs; publication checks cover RLS,
direct request inserts, approval, metadata and exam-source operations. Existing
policy-bound function OIDs remain intact; renamed implementations are revoked.
Populated materials cannot change kind. Reference locks prevent concurrent type
conversion from racing requests, grants or inserted question dependencies.
Arabic/mixed metadata uses `dir=auto`; existing themes/modals/safe areas remain.

## Migration and preservation

`supabase/migrations/20261031173818_typed_learning_materials.sql` was CLI-created
and applied **only** to isolated Docker `archive-db`. Local default privileges
and timestamp defaults were aligned using the local-only reconciliation script.
No migration-history repair or historical migration edit occurred.

The migration seeds no content, grants or sales and performs no specialty
reassignment. Existing banks retain their IDs, prices, images, questions/cases,
grants, frozen attempts, financial history and legacy publication semantics.
Production Nursing's Medical assignment and the unpublished empty draft remain
untouched. No push, production migration or deployment occurred.

Subjects/lessons, PDFs, reading, entitlements, offers, orders, payments, refunds
and purchase synchronization are not completed by this foundation. **Do not
deploy this branch or apply its migration to production without release approval.**

## Verification

- Typecheck, lint and production build: PASS on Node 22.23.2. Build/browser runs
  use isolated local environment overrides, without overwriting `.env.local`.
- Node tests: **105/105 PASS** (14 new material/catalog checks).
- Existing rollback SQL: **263 distinct checks PASS** (course38, exams44,
  teacher25, cases11, archive32, catalog/shared49, live20, chapters44).
- New material rollback SQL: **80/80 PASS**.
- Actual two-session concurrency: **16 PASS**, five observed lock races with
  unsafe operations denied and exact generated fixtures cleaned.
- Combined database checks: **359**, excluding duplicated course checks.
- Local security advisors at WARN/ERROR threshold: **no issues found**. This
  does not clear the separate production leaked-password-protection warning.
- Browser/action/RPC/persistence: Subject creation/reload, track creation/edit/
  publication, grouped Student/public catalog, draft hiding, role denials PASS.
- **144 responsive screen combinations**: six screens, all eleven requested
  widths, light/dark, plus 844x390 and 1024x768 landscape. Actual create-submit
  exercised at 320/375px. No page overflow, browser exception or HTTP 5xx.
- Representative mobile/tablet/laptop/desktop screenshots visually inspected.
  Physical Samsung Internet/Safari are **not tested**. Real lesson PDF quality
  remains unverified until authorized samples are supplied.
- All browser-generated material IDs cleaned locally; no production fixtures or
  real transactions. Existing module-type/newline notices remain non-failing.

## Changed files

Application:

- `src/actions/materials.ts`
- `src/app/admin/subjects/page.tsx`, `src/app/admin/exam-tracks/page.tsx`
- `src/app/(public)/programs/[slug]/page.tsx`
- `src/app/student/specialties/[slug]/page.tsx`
- `src/components/ui/material-icon.tsx`, `src/constants/navigation.ts`
- `src/features/learning/admin-materials.tsx`
- `src/features/learning/specialty-materials.tsx`
- `src/features/learning/specialty-catalog.tsx`
- `src/features/question-banks/admin-question-bank-list.tsx`
- `src/features/question-banks/question-bank-grid.tsx`
- `src/lib/bank-access/server.ts`, `src/lib/data/server.ts`
- `src/lib/learning/materials.ts`, `src/lib/learning/material-groups.ts`
- `src/lib/supabase/database.types.ts`
- `src/lib/validation/material.ts`, `src/lib/validation/learning-catalog.ts`
- `src/types/material.ts`

Database, tests and QA compatibility:

- `supabase/migrations/20261031173818_typed_learning_materials.sql`
- `supabase/tests/typed_learning_materials.sql`
- `supabase/tests/student_course_access.sql` (typed fixture creation only)
- `scripts/materials.test.mjs`, `scripts/material-catalog.test.mjs`
- `scripts/material-db.mjs`, `scripts/material-concurrency.mjs`
- `scripts/material-browser.mjs`, `scripts/qa-materials.mjs`
- `scripts/backend-qa-data.mjs`, `scripts/backend-qa-browser.mjs`
- `scripts/chapter-browser.mjs`, `scripts/live-sync-browser.mjs`

Documentation: this file and the updated implementation checklist. Phase 1 added
the implementation record, migration reconciliation document and explicitly
local-only `supabase/reconciliation/local-production-security-baseline.sql`.

## Next

Phase 3: Admin lessons and private lesson PDF upload, extraction drafts, manual
transcription, answer verification and Student-safe document approval. Keep
historical exam PDFs distinct and Subjects fail-closed until all new publication
and entitlement boundaries pass their own tests.

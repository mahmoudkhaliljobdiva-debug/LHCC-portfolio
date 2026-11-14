# Medical Subject navigation and question review

Verified implementation checkpoint: 2026-11-14. Production site: https://lhcc-lb.com.
Based on main `17e2512`; the previous audit branch is preserved, not merged.
The verified dependency security patch is retained as `c624d56`.

## Implemented architecture

- Existing AdminMaterials now queries the selected specialty BEFORE pagination.
  Medicine contains the 12 real Subjects; empty Nursing/Dentistry and unassigned
  folders remain visible. Exam Tracks are excluded, never reclassified.
- Admin → Subjects → Medicine → Subject → Questions, with a separate optional
  Chapters & lessons link. Search, pagination, count, order, full choices,
  private correct answer/explanation, clinical context and PDF/page/number
  provenance are available. Grouping includes unassigned questions.
- Dedicated Admin-only subject read, stage, review, import and confirmed-delete
  operations. Editing creates a pending revision; it never silently publishes.
  Lesson-owned questions return to their existing owning editor.
- Explicit approval records Admin actor/time/revision. A source key alone is NOT
  approval. Complete options, private key evidence, a why-correct explanation,
  explanation origin and visual/duplicate review are mandatory before import.
- Source/version/page/number/content deduplication, global cross-Subject/source
  duplicate warnings, exact canonical duplicate rejection, immutable audit
  snapshots, stale-revision protection and serialized/idempotent imports.
- Existing canonical IDs are retained. Protected lesson/exam/attempt history
  blocks deletion. No exam-track pool, scoring, grants, pricing, wallet, Auth,
  CMS or historical-data redesign is included.
- Private source/page/staging/audit tables are not raw-API-readable. Public
  wrappers are security invoker; private definer functions verify the actual
  active profile role, never user-editable metadata.
- A restrictive Subject SELECT policy intersects the existing bank permissions.
  Active Subject questions require an explicitly approved matching private key.
  The 10 pre-existing pending canonical questions remain stored/Admin-visible,
  but are not treated as approved Student questions.

## Source and live database audit

The 12 authorized source PDFs were fetched from the supplied Drive folder,
verified against production SHA-256 and page counts, and processed across
**all 1,827 pages**. All are scanned sources: OCR is an unverified transcript,
not a medical review. Original PDFs, full page renders, raw OCR blocks and
previous OCR revisions remain private/ignored under `.test-artifacts/medical-sources`.
No medical content, credentials or source PDFs are committed to Git.

Representative pages from all 12 PDFs were visually inspected. The repeated
exam-player screen format is processed as independent pages (`--screen-pages`)
to avoid joining unrelated screenshots. Explicit shared response sets and full
clinical-case context are retained. No unreadable option marker, medical key
or explanation is guessed. Higher-resolution retry retained the 39 pages with
no readable body text as NEEDS_REVIEW; at least one verified example is a blank
exam-player screen. This is not a claim that every page was manually reviewed.

Actual extraction/database counts (2026-11-14):

| Subject | PDF Pages | Extracted | Pending | Approved | Imported | Rejected | Needs Review |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cardiology | 164 | 151 | 1 | 0 | 1 | 0 | 151 |
| Endocrinology | 160 | 145 | 1 | 0 | 0 | 0 | 145 |
| Gastroenterology | 225 | 133 | 1 | 0 | 1 | 0 | 133 |
| Gynecology | 204 | 196 | 1 | 0 | 1 | 0 | 196 |
| Hematology | 129 | 80 | 1 | 0 | 1 | 0 | 80 |
| Infectious Diseases & STDs | 68 | 60 | 1 | 0 | 1 | 0 | 60 |
| Nephrology | 198 | 155 | 1 | 0 | 1 | 0 | 155 |
| Neurology | 138 | 141 | 1 | 0 | 0 | 0 | 141 |
| Obstetrics | 177 | 161 | 1 | 0 | 1 | 0 | 161 |
| Pediatrics | 37 | 24 | 1 | 0 | 1 | 0 | 24 |
| Respiratory Medicine | 183 | 145 | 1 | 0 | 1 | 0 | 145 |
| Rheumatology | 144 | 139 | 1 | 0 | 1 | 0 | 139 |
| Total | 1827 | 1530 | 12 | 0 | 10 | 0 | 1530 |

Definitions: Extracted is NEW automated candidate drafts, not clinically validated
questions. Pending is the 12 ORIGINAL PENDING records. Imported is the 10 ORIGINAL
linked canonical records, overlapping those pending reviews; it does not mean
they are approved. Needs Review is the new unapproved extraction queue.
Total awaiting review: **1,542 staging records**. Newly approved/imported/published
in production by this release: **0 / 0 / 0**. Sources remain PARTIAL until content
review/import is actually complete, despite complete page-processing coverage.

Every page has private persisted coverage/text/warnings. The 1,530 candidates
were staged as NEEDS_REVIEW, with no reviewer, canonical link or approval.
The initiating Admin is attributed only for the owner's extraction request,
not medical review. No Auth sessions/JWTs were created or impersonated to stage
content; the owner-controlled SQL preparation writes pending records only.
Its complete batch was tested twice locally inside a rollback transaction.

Before/after row counts and full-row digests match for all 23 monitored existing
tables, including all 110 canonical questions/keys, 20 cases, profiles, grants,
requests, attempts/answers, ledger, CMS, chapters, lessons and specialty metadata.
All 12 original staging payloads/statuses/links also match their original digests.

## Applied additive migrations

- `20261114165153_subject_question_review.sql`: private audit/page tables,
  revision/reviewer/approval provenance, guarded Subject CRUD/review RPCs and
  restrictive Student eligibility. No canonical content backfill or deletion.
- `20261114170912_subject_global_duplicate_review.sql`: cross-source/Subject
  duplicate review and legacy canonical import-count preservation.
- `20261114171408_subject_duplicate_lookup_indexes.sql`: bounded-size fingerprint
  indexes with exact-text equality rechecks, not hash-only deduplication.

These version/name pairs match hosted migration history. Existing hosted/local
history drift predates this feature; no directory-wide push, history repair,
old migration replay or production reset was performed. Apply only reviewed
missing migrations. The entire new migration sequence passed local rollback replay.
The populated production review read improved from **5,699.598 ms to 24.295 ms**
in comparable EXPLAIN ANALYZE checks after the lookup indexes.

## Verification

Node **22.23.2** used for the release checks.

- Typecheck: PASS; lint: PASS; production build: PASS.
- Unit tests: **143/143 PASS**.
- Local authenticated REST/RPC: **9 workflow groups PASS**, including role/cross-bank
  denial, incomplete keys, explicit approval/actor/revision, sanitized options,
  concurrent retries, duplicate review, optional chapters and retained IDs.
- Full migration replay: PASS, rollback-only.
- Complete 1,827-page / 1,530-candidate staging batch replayed twice locally:
  PASS, no canonical writes, all fixtures rolled back.
- Existing Teacher **25**, Student exam **44**, course access **38**, lesson
  **141** SQL assertions PASS. The Teacher fixture denial is scoped to its own
  generated Exam Tracks rather than unrelated approved free Subjects.
- Local authenticated browser: **216 responsive checks PASS** across nine screens,
  eleven widths (320/360/375/390/412/430/768/1024/1366/1440/1920), both themes and
  two landscape layouts. Actual navigation, empty chapters, Add, approval,
  import/retry, edit retaining ID, deletion and Student denial were exercised.
  Representative mobile/tablet/laptop/desktop screenshots visually inspected.
- Actual browser PDF.js → Server Action → guarded RPC → private page/staging
  persistence and retry: PASS. Explicit fixture keys remain pending.
  Existing published Subject metadata-save UI: PASS, publication preserved.
- Production read-only authorized RPC checks: 12 Subjects, no tracks, all three
  requested Subjects load their real canonical/review counts. Anonymous execution
  denied. Student-role RLS: zero visible unapproved Subject questions; private
  keys/staging/audit table access denied.
- Production Admin-browser approval/import was NOT performed: no authorized
  production browser session was available. Actual authenticated UI mutations
  were tested only against isolated local Supabase. No production test users,
  exams, approvals, grants, payments or ledger records were created.
- Browser testing uses isolated Edge/Chromium emulation, not a physical Samsung.

## Changed files

Application:
`src/actions/materials.ts`, `src/actions/subject-questions.ts`,
`src/app/admin/subjects/page.tsx`,
`src/app/admin/subjects/[bankId]/questions/page.tsx`,
`src/features/learning/admin-materials.tsx`,
`src/features/learning/admin-subject-questions.tsx`,
`src/features/learning/subject-pdf-import.tsx`,
`src/features/lessons/admin-lessons.tsx`,
`src/lib/learning/materials.ts`, `src/lib/learning/subject-questions.ts`,
`src/lib/learning/subject-extraction.ts`, `src/lib/learning/subject-pdf-reader.ts`,
`src/lib/supabase/database.types.ts`, `src/lib/validation/material.ts`,
`src/lib/validation/subject-question.ts`, `src/types/material.ts`,
`src/types/subject-question.ts`.

Verification/source tools:
`scripts/materials.test.mjs`, `scripts/subject-review.test.mjs`,
`scripts/subject-review-qa.mjs`, `scripts/subject-review-browser.mjs`,
`scripts/subject-pdf-browser.mjs`, `scripts/subject-migration-check.mjs`,
`scripts/extract-medical-sources.py`, `scripts/prepare-medical-staging.mjs`,
`scripts/prepare-medical-staging-sql.mjs`, `scripts/check-medical-staging-sql.mjs`,
`supabase/tests/teacher_bank_permissions.sql`, the three migrations above,
`docs/backend-map.md` and this report.
The retained security commit changes `package.json`, `package-lock.json`
and `scripts/production-audit.test.mjs`.

## Remaining review and infrastructure notes

- A qualified Admin must compare each candidate with the original, resolve
  OCR/number/options/shared-response/case/table/diagram ambiguity and duplicates,
  supply explicit source-key evidence or a separately labeled reviewed correction,
  and provide the why-correct explanation. Then explicitly approve and import.
  Diagram-dependent drafts must remain pending until all necessary visual
  information is represented safely; an original PDF is not a Student-safe asset.
- No claim of complete medical-question approval/import is made. All source pages
  were processed, but extraction candidate counts are not an authoritative count
  of distinct, complete MCQs. Blank/ambiguous/unstructured pages need manual review.
- Private RLS-with-no-policy advisor INFO notices are intentional default denial.
  Pre-existing public assets/groups also remain default-denied.
  [Leaked-password protection is disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
  (pre-existing Auth configuration; not changed by this feature).
  Three pre-existing [unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
  and one existing [multiple-permissive-policy warning](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)
  remain separate infrastructure/performance follow-up; do not delete unused
  indexes solely because the advisor labels them unused.
- Release uses the existing main → Vercel Git integration, not a manual deploy.
  The final handoff must name the actual pushed SHA, READY deployment URL/domain
  mapping and smoke results. Production authenticated-browser acceptance remains
  explicitly separate from anonymous route and database-role verification.

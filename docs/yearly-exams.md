# Yearly archive and student learning

## Model and preservation

`question_banks` / `bank_questions` / `question_sections` remain canonical.
`past_exams` is an examination identity (bank, confirmed year, title, session,
source, status, optional timing). `past_exam_questions` associates reusable
questions in explicit original order, preserving source numbers. Multiple
sessions may share a year or source. There is no similarity-based merge.

`exam_sources` records original filename, SHA-256, private storage path and
uploader. The `exam-source-pdfs` bucket is private, admin-only, immutable to
client UPDATE/DELETE, with PDF MIME and 20 MB upload restrictions. Short-lived
admin signed links permit source review; students cannot download originals.

Private `past_exam_drafts` retains review content including unverified keys;
it is never selectable by students/teachers. Publishing atomically validates
year, options, case relationships, warning resolution, keys and explicit reuse.
Private `imported_question_owners` prevents a draft from taking ownership of
pre-existing content. Reuse must match the approved original and cannot edit it.
Exact-text candidates require explicit distinct-record acknowledgement or reuse.
Unpublishing/archiving never removes questions, cases, answers or attempts.

Production pre-migration baseline observed on 2026-10-11:

- Nursing Colloquium `d7e37b48-8afc-4df0-ad5e-a1c08dc65eb4`
- 1 bank, 20 clinical cases, 100 questions, 2 attempts
- Original-column question digest: `df4602b326c1e641745563b0e2adac9e`
- Case row digest: `8644250cb4e67aae78e21af17441ef26`

The migration is additive; it does not seed or rewrite these records.

## Admin workflow

`/admin/question-banks/[bankId]/past-exams`: create/import, private upload,
extraction review, year/session confirmation, question/option/case editing,
  explicit reuse, reordering, answer-key verification, draft save, publication,
unpublication or archive. Multiple sessions are created as separate exam
records and can attach the same original PDF. Unsaved edits prompt before
leaving/switching; publication requires confirmation.

Mozilla PDF.js is dynamically loaded in the admin browser. Text extraction
runs locally, without an external paid service or third-party processing.
The conservative parser recognizes numbered questions, lettered options,
clinical-case headings and explicit answer-key sections. Years are candidates,
never auto-assigned. Every extracted question starts unverified. Scanned,
multi-column, unusual or ambiguous PDFs require manual transcription/review;
there is no OCR or invented medical information. PDFs over 200 pages should be
split into sessions. Draft review supports up to 1000 questions per import.

## Student workflow

- Dashboard: approved banks, archive, complete bank, continue learning and progress.
- Bank details: past-year archive, all-question practice, random exam and case practice.
- `/student/banks/[bankId]/past-exams`: searchable year/session cards and prior results.
- `/student/banks/[bankId]/setup`: practice/exam, optional explicit timer, random
  count up to 30. Past exams retain their full original set/order; all-question
  practice uses the full eligible collection, not the random-exam cap.
- One-question interface: large radio cards, previous/next, numbered navigator,
  answered indicators, progress, saved selections and confirmation dialog.
- Results/history/analytics: score, correct/incorrect selections, unanswered,
  completion/time, bank/year/session/mode breakdown and clinical-case performance.

## Secure engine extension

`start_learning_exam` reuses the same attempt, answer and frozen-snapshot tables.
Legacy `mode=PRACTICE` records are preserved. New sessions retain `mode=EXAM`
for the existing ungraded-answer trigger; `learning_mode` distinguishes the new
PRACTICE and EXAM experiences. Source, title, year and deadline are persisted;
case/question/options/private keys remain frozen. Concurrent identical starts
resume one attempt; a different setup requires completing the unfinished one.

Server deadline checks reject late saves/checks regardless of browser time.
The UI countdown attempts automatic submission and offers retry after failure.
No time limit is invented: use an administrator-configured value or an explicit
student selection, or untimed mode. Final grading and repeat submission reuse
the tested atomic, idempotent engine and frozen private keys.

`check_practice_answer` requires own active approved PRACTICE session and a saved
selection. It inserts a private check marker and returns authorized feedback.
The checked selection becomes immutable, preventing answer probing. Unchecked
questions and active EXAM questions never contain keys/correctness. Completed
sessions permit frozen answer review. Explanations are not invented or displayed
when none exist. Direct table writes remain denied. Every new public table has
RLS; original sources/drafts/keys remain protected. ADMIN View-As is read-only
and cannot start, answer, check or submit as a student; teachers gain no privileges.

## Verification and release

- `supabase/tests/yearly_exams.sql`: rollback-only publication, preservation,
  ordered exams over 30, practice feedback, immutable checks, deadline, access,
  user isolation and View-As guards; existing exam/teacher/case tests remain.
- `scripts/yearly-exams.test.mjs`: parser/schema/action regressions.
- `scripts/archive-qa-fixtures.mjs setup`: isolated localhost-only fixtures.
- `scripts/archive-browser-test.mjs`: real private PDF import through browser,
  publish and student attempt; random30 and complete-bank practice; nine widths,
  both themes and landscape. No production test content is inserted.
- Migration: `20261011090748_yearly_exam_archive.sql` (created by Supabase CLI).
- Release only after migration/security/browser checks. Use normal Git history
  and Vercel Git auto-deployment; verify the deployed SHA and https://lhcc-lb.com.

## Recovery verification — 2026-10-11

Recovered the existing uncommitted feature from `180aff2` on `main`; no work was
discarded or reconstructed. The dashboard, archive, PDF review, setup, engine,
single-question interface and results already existed. Recovery completed full
production-generated types, private-source link handling, ten-question review
pagination, accurate eligible-case counts and current browser regressions.

- Node 22.23.2: typecheck, lint, build, 55/55 unit tests and diff whitespace pass.
- Isolated rollback database checks: exams 44, teacher permissions 25, clinical
  cases 11, yearly archive 32; **112/112 pass**.
- Real browser: private PDF upload/extraction/review/publish/re-publish, ordered
  past exam, saved 50% result, random 30, injected save failure/retry, refresh/
  continue, all 42-question practice and checked-answer immutability pass.
- Ten major screens checked at 320/375/390/430/768/1024/1366/1440/1920, light/dark,
  and 844×390 / 1024×768 landscape; no page overflow. Screenshots visually reviewed.
- Production migrations applied through Supabase MCP: `yearly_exam_archive`
  (`20261011112836`) and `align_archive_case_eligibility` (`20261011112854`).
  Their repository files were created earlier by CLI (`20261011090748` and
  `20261011112320`); match by name/content when reconciling migration history.
  Do not blindly reapply these already-live migrations.
- Production post-migration counts and original-column digests match the baseline
  above. Archive empty; no production QA users/questions/PDFs were inserted.
- Security advisors: no new issues; existing leaked-password protection disabled.
  [Remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
  Performance advisors only flag unused indexes, including new FK indexes before
  archive traffic; retain them. Existing dependency-audit findings need separate
  triage; no unrelated package upgrades were performed.

For repeatable isolated QA, run `archive-qa-fixtures.mjs setup --fresh` to create
a new local fixture while preserving earlier ones. Load the ignored
`.test-artifacts/archive-qa.env` into the dev-server process environment before
starting Next on port 3100; do not use production credentials for the browser test.
`exam-browser-test.mjs` now delegates to this current localhost-only journey.

Physical Samsung/iOS/Safari testing is separate from Chromium viewport emulation.
Release evidence is recorded in the implementation handoff, not inferred from
the existence of code or a successful local build.

## Changed files

- `docs/backend-map.md`
- `docs/student-exams.md`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `scripts/exam-browser-test.mjs`
- `scripts/qa-browser.mjs`
- `src/actions/exams.ts`
- `src/constants/navigation.ts`
- `src/features/dashboard/role-screen.tsx`
- `src/features/exams/bank-details.tsx`
- `src/features/exams/exam-form.tsx`
- `src/features/exams/exam-history.tsx`
- `src/features/exams/exam-result.tsx`
- `src/features/question-banks/admin-question-bank-detail.tsx`
- `src/lib/supabase/database.types.ts`
- `src/lib/validation/exam.ts`
- `docs/yearly-exams.md`
- `scripts/archive-browser-test.mjs`
- `scripts/archive-db-tests.mjs`
- `scripts/archive-qa-fixtures.mjs`
- `scripts/yearly-exams.test.mjs`
- `src/actions/past-exams.ts`
- `src/app/admin/question-banks/[bankId]/past-exams/page.tsx`
- `src/app/student/banks/[bankId]/past-exams/page.tsx`
- `src/app/student/banks/[bankId]/setup/page.tsx`
- `src/features/exams/admin-past-exams.tsx`
- `src/features/exams/exam-setup.tsx`
- `src/features/exams/import-question-editor.tsx`
- `src/features/exams/learning-progress.tsx`
- `src/features/exams/past-exam-archive.tsx`
- `src/features/exams/student-learning-overview.tsx`
- `src/lib/exams/admin-server.ts`
- `src/lib/exams/pdf-extraction.ts`
- `src/lib/exams/pdf-reader.ts`
- `src/lib/validation/past-exam.ts`
- `src/types/past-exam.ts`
- `supabase/migrations/20261011090748_yearly_exam_archive.sql`
- `supabase/migrations/20261011112320_align_archive_case_eligibility.sql`
- `supabase/tests/yearly_exams.sql`

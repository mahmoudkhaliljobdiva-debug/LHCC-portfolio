# Specialty, material and three learning modes

Implemented 2026-10-21. Extends the existing real Supabase learning platform;
does not replace authentication, access approvals, exam grading or PDF imports.

## Navigation and configuration

Nursing, Medical and Dentistry remain independent published specialties.
Each actually assigned material uses the same Student bank page with three
primary choices: AI-Generated Exams, Chapter Questions and PDF Session Exams.
Complete-bank practice, clinical cases and fixed shared exams remain accessible.
Unconfigured specialties have real empty states, never placeholder materials.

Admin: Question Banks → select material → Manage Chapters & Generated Exams.
The existing Specialties page assigns materials. Existing PDF session management
now identifies the destination specialty/material before extraction review.

**Production content configuration remains an Admin decision:** at inspection,
the single Nursing Colloquium bank had no specialty assignment. Medical and
Dentistry had no materials. No assignments, chapters or fake colloquia were
inserted to disguise these gaps. Assign the existing bank and create/publish
only legitimate material content through the existing Admin tools.

## Generated selection

`start_learning_exam` retains the existing `RANDOM` source identifier. Its new
private selector validates active approved access and uses canonical active
complete-bank questions with a private verified key matching a valid option.
It never invents questions/answers and does not call an external AI provider.

One eligible row per question is assigned to a chapter/year/difficulty stratum.
For multiple memberships, the lowest published chapter UUID is used for
selection only; all memberships are retained. For repeated historical questions,
the earliest published source year within this bank is used. Missing metadata
has an explicit unassigned/unknown bucket; difficulty is never inferred.

Rows are randomly ranked within each stratum. If requested, the current
Student's previously incorrect completed answers rank first within that stratum.
Round-robin selection across strata, with randomized ties, promotes coverage
without claiming perfectly equal marginal coverage for sparse/uneven metadata.
Requested count is configurable from 1–30, default 30, capped by eligible supply;
Admin can set the per-bank initial count and incorrect-answer preference.
Identical sets are possible by chance or when the pool is exhausted; independent
randomization does not promise a unique set for every Student.

Existing per-Student/bank locking and exact setup signatures prevent conflicting
active starts. Question text/options/order/case context and private keys are
frozen when the attempt starts, not regenerated on refresh. Existing versioned
answer saves, checked Practice answers, server deadlines and grading are reused.

## Chapters

New `bank_chapters`, `chapter_questions` and `bank_generation_settings` tables
have RLS and indexed bank/reverse/composite-FK relationships. Nullable reviewed
`bank_questions.difficulty`, `question_attempts.chapter_id` and the additive
`CHAPTER` source support chapter-specific attempts and progress.

Admin can create, rename, order, publish/unpublish chapters, set generation
defaults, and search/paginate existing questions (20/page) for multi-chapter
assignment and reviewed difficulty. Composite foreign keys reject cross-bank
assignments. No question is copied and no clinical case is converted to a chapter.
Unpublishing blocks new chapter starts without destroying attempts or results.
Banks with chapter/settings references cannot be hard-deleted: deactivate the
bank instead to retain its content. No cascading bank deletion was enabled.

Students see only published authorized chapter summaries, eligible counts,
completed sessions and best score. Chapter sessions use the full eligible
assigned collection in original case/question order, with Practice/Exam setup.
Unassigned questions remain usable in complete-bank/generated modes. Chapter
publication/assignment/settings use the existing private live synchronization;
source changes never replace an already-frozen attempt.

## Historical PDFs and fixed shared exams

Reuse the existing private PDF Storage, extraction/manual correction, provenance,
verified-key review and historical publication workflow. Missing/unverified keys
still block scored publication. Each PDF session retains its own definition,
year, actual session and original question order; same-year sessions do not merge.
Existing frozen historical/shared definitions remain authoritative, not the
generated selector. No fixed shared exam or original PDF was removed.

New historical attempts also freeze source numbering in
`question_attempt_questions.source_number_snapshot`; the Student question view
shows it. Older attempts are not backfilled or rewritten. Private solution
tables/feedback guards remain authoritative: Exam selections stay neutral until
submission; Practice reveals green/red feedback only after an authorized check.

## Migration and production preservation

Applied migration: `20261021172927_chapter_learning_modes.sql`, matching the
Supabase migration version. It adds tables/nullable fields/indexes/RLS and guarded
RPC extensions. No existing migration was changed, and no production records were
seeded, reassigned, reclassified, reset or deleted.

Before/after counts and sorted-row digests matched across all 27 existing
business/Auth-user/Storage tables, excluding only the newly added nullable
columns from comparison. This includes 100 questions, 20 cases, four attempts,
120 frozen questions/private keys, all users, approvals, wallet and portfolio.
The three new content tables remained empty. Read-only production RPC checks
returned a bounded Admin page of 20 and all four existing attempts/120 questions.

## Verification and supported limits

- Node 22.23.2: typecheck, lint and production build pass.
- Node tests: 91 pass. Rollback-only SQL: 44 new chapter checks plus existing
  course 38, exams 44, teacher 25, clinical cases 11, archive 32, shared/catalog 49
  and live-sync 20 checks pass (263 distinct checks).
- Local browser/server/RPC flow: Admin create/edit/order/publish/assignment and
  settings; live Student publication; chapter/context/progress; two independent
  generated sets and frozen refresh; Practice feedback/Exam neutrality; exact
  historical order/numbering and two sessions in one year; authorization denials.
- Major modified screens tested at 320, 375, 390, 430, 768, 1024, 1366, 1440 and
  1920px, both themes, plus 844×390 and 1024×768 landscape. Screenshot review
  includes mobile, tablet, laptop and desktop, forms, questions and feedback.
  No horizontal page overflow, browser exceptions or HTTP 5xx occurred.
  Final visual review also shortened native learning-mode labels and moved the
  feedback explanation below the select, preventing truncation at 320px.
- Reduced motion is honored. Existing lightweight LHCC/Lucide icons are reused;
  no licensed Lordicon asset or new animation dependency was introduced.
- Local QA performance samples (12-question material, not a production SLA):
  live chapter publication 424ms; bank metadata 9ms / 1903 bytes; paged Admin
  metadata 7ms / 2666 bytes; frozen exam retrieval 11ms / 1266 bytes; generated
  start 24ms; browser answer persistence 229–255ms and submission-to-result
  navigation 214–227ms (including polling/rendering). No complete question pool or
  private key set is downloaded to a Student catalog page.
- Supabase advisors after migration: no new security warning or missing-FK-index
  finding. Five new indexes are informationally unused because production chapter
  tables are empty. Existing private revision deny-by-default INFO and
  [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
  remain infrastructure notes; indexes are not dropped merely for being new.
- Browser automation uses isolated Chromium/Edge profiles, not a physical Galaxy
  S24 Ultra or Samsung Internet. Physical-device verification remains manual.
  Production verification is read-only; no new production QA users/content were
  created. Local QA artifacts/credentials stay ignored under `.test-artifacts`.

Release uses the existing Git → Vercel integration. Exact deployed SHA, READY
state, custom-domain routing and runtime smoke results are checked after push
and reported in the release handoff; this document is not evidence of a deployment
that has not yet happened.

Backend reference: [backend-map.md](backend-map.md).

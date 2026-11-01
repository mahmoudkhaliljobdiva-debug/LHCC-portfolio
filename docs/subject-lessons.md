# Subject lessons — Phase 3 checkpoint

Resumed 2026-11-01 on `feat/learning-material-foundation`, after verified local
Phase 2 commit `ad57d66`. This is **not a production release**. Do not deploy or
apply this migration to production without the user's explicit release approval.

## Recovery and scope

The interrupted work contained only lesson validation/types and an empty
CLI-created migration. Those files were preserved and completed rather than
restarting Phases 1–2. Existing exams, users, grants, transactions and content are
not replaced. Nursing's production specialty assignment remains untouched.

Admin authoring lives at `/admin/subjects/[bankId]/lessons`. It reuses existing
chapters, the question review editor, private PDF parsing and design components.
Subjects remain Draft/Inactive: lesson publication does not bypass the pending
Student reading, practice and entitlement implementation.

## Implementation

- Lesson drafts and revisions, chapter organization, publish/archive/unpublish,
  manual transcription, explanation editing and ten-question review pages.
  Every published question requires an Admin-reviewed explanation of why its
  correct answer is right. Drafts may leave it empty; extraction never generates
  a rationale. Future Student feedback must withhold it until authorized review.
- Immutable private PDF uploads (20 MB), source/provenance, SHA-256 metadata and
  separate explicit Student-safe review. Both original and derivative uploads
  start unapproved; an approved original requires the same explicit review.
- Admin-only 60-second document links, scoped to the selected lesson/document.
  No Student document URL or answer key is returned by this phase.
- Existing-question extraction adapts explicit Arabic/English labels to the
  conservative exam parser. It retains source numbering and clinical context,
  never invents keys/explanations and never marks extracted questions verified.
  Page references require manual review. Scanned/unstructured PDFs warn and
  support manual transcription; no OCR or medical question generation added.
- Draft JSON and answer keys remain private. Only fully reviewed publication
  writes canonical Subject questions, excluded from complete-bank exam pools.
  Explicit reuse is same-Subject only and cannot edit the reused question/key.
  Unlinking preserves canonical questions and history.
- Actions, strict runtime schemas, guarded RPCs, table/Storage RLS and database
  bounds repeat the authorization boundary. Optimistic revisions prevent stale
  overwrites; shared lock ordering protects document/publication decisions.
  Legacy content writes cannot bypass Subject authoring. Reused question/key/case
  content cannot be overwritten, shared-case metadata must agree, and sorted
  identity locks plus material row locks protect concurrent cross-Subject claims.
  Private-bucket access follows [Supabase Storage's access-control model](https://supabase.com/docs/guides/storage/security/access-control).

SHA-256 is supplied by the trusted Admin browser as provenance metadata, not a
server-attested content digest. The database independently verifies the object's
existence, immutable path, MIME type and size before registration.

## Migration state

`supabase/migrations/20261031185924_subject_lessons_private_pdfs.sql` is additive,
with no content seeds or historical migration edits. Local application and tests
completed against Docker `archive-db` only. Nineteen function bodies were checked
against the migration source after local iteration; Storage policy roles also
match. Production application is **not authorized**.
Local fixtures must be rollback-only or cleaned by their exact generated IDs;
never reset the isolated database or touch production for these tests.

## Local verification

- Node 22.23.2: confirmed.
- Typecheck, lint and production build: PASS, using isolated QA environment
  overrides without overwriting `.env.local`.
- Node tests: **133/133 PASS**, including 28 lesson/extraction/action checks.
- Existing rollback SQL: **263 distinct checks PASS** (course38, exams44,
  teacher25, cases11, archive32, catalog/shared49, live20, chapters44).
- Typed-material rollback SQL: **80 PASS**; five material lock races: **16 PASS**.
- Lesson rollback SQL: **141 PASS**; nine actual two-session races: **19 PASS**.
  Combined database/security checks: **519**, excluding duplicated course checks.
  This includes forged roles, direct wrapper/private calls, key/document RLS,
  source scoping, revisions, shared-case consistency, legacy bypasses, global
  identity claims, required explanations and Unicode-only whitespace denials.
- Local Supabase security advisors: **no issues found** at WARN/ERROR threshold.
  This is not a production advisor result or Auth configuration audit.
- Browser: **160 responsive combinations and 44 focused captures PASS** on the
  final rebuilt source. Admin UI to
  Server Action to RPC to persisted readback exercised, including mobile create,
  stale revisions, dirty Back/pending-save guards, private upload, extraction,
  manual transcription, required rationale, publication/archive, explicit safe
  PDF approval/revocation and role/catalog denial. Generated fixtures cleaned.
  Focused mobile/tablet/laptop/desktop controls were visually reviewed after
  theme transitions settled and captures accounted for the sticky header.
- Physical Samsung Internet/Safari: not tested.
- Existing non-failing module-type/CRLF notices and CLI update notice remain;
  no dependency upgrade was made just to silence them.

## Supplied source PDF and remaining acceptance gate

The user supplied `PSYCHIATRY QS.pdf` on 2026-11-01 and specified that yellow
marks the correct answer. Read-only local inspection found 98 pages and
84,708,601 bytes (about 80.8 MiB). All 98 pages have zero text items and zero
annotations; representative page operators contain a flattened image, not a
machine-readable highlight. No question/answer/explanation was imported or
published from it, and the original was not modified or uploaded to Supabase.

This source cannot validate the text-first extractor: it requires manual
transcription or an explicitly scoped optional OCR workflow, plus splitting into
parts under the current 20 MB upload boundary. Visual yellow answer choices must
be manually aligned to options and verified; cover/title highlighting or absent
markings are not answer keys. Representative pages were visually reviewed: the
sample contains question-only/solved-page pairs, yellow stem annotations as well
as highlighted answer options, and written explanations on solved pages. Preserve
those existing explanations for review instead of inventing medical rationales;
do not count a repeated solved page as a separate question. The parser now states
that it cannot detect visual answer markings. A source-marked answer is not
itself a reviewed explanation or confirmation of clinical accuracy.

The supplied source is not an Arabic/mixed selectable-text sample. Representative
text/PDF quality acceptance remains pending, rather than claiming extraction
success from synthetic fixtures or inferring unseen keys. No OCR dependency,
external OCR upload or automatic clinical rationale generation was introduced.

## File inventory

- `src/actions/lessons.ts`, `src/actions/chapters.ts` (Subject invalidation only).
- `src/app/admin/subjects/[bankId]/lessons/page.tsx`.
- `src/features/lessons/admin-lessons.tsx`.
- `src/features/learning/admin-materials.tsx` (authoring link and status copy).
- `src/features/exams/import-question-editor.tsx` (optional bank-inclusion control;
  existing exam behavior remains enabled by default).
- `src/lib/learning/lessons.ts`, `src/lib/learning/lesson-extraction.ts`.
- `src/lib/validation/lessons.ts`, `src/types/lesson.ts`.
- `src/lib/supabase/database.types.ts` (new public table/RPC signatures).
- `supabase/migrations/20261031185924_subject_lessons_private_pdfs.sql`.
- `supabase/tests/subject_lessons.sql`, `scripts/lesson-db.mjs`.
- `scripts/lessons.test.mjs`, `scripts/lesson-browser.mjs`.
- This checkpoint and `docs/learning-architecture-implementation.md`.

## Next phase and approvals

Finish the representative source acceptance before advancing. Phase 4 is Student lesson
reading, explicit completion independent from practice, and feedback-gated
question practice. Subject publication must remain fail-closed until its new
access model is tested. Later phases cover offers, immutable quotes, manual USD
payment confirmation and source-specific entitlements; none are completed here.

No push, production migration, production deployment, real payment or access
change is permitted without the release/real-data approvals in the
[implementation record](learning-architecture-implementation.md).

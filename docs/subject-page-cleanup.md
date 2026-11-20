# Subject page cleanup — 2026-11-15

## Scope and data boundary

The owner deferred question repopulation to the next round. This release cleans
up Subject management only. It does not approve pending records, publish source
candidates, delete questions, replace answer keys or reclassify materials.

Existing production questions, drafts, source records, private keys, audit
history, students, attempts, grants, payments and exam tracks are preserved.

## Current website workflow

- Admin → Subjects → Specialty → Subject → Questions.
- Questions show full text, options, private Admin answers/explanations and
  available source provenance. Search and pagination remain available.
- No Subject PDF uploader, browser parser, extraction controls, source-coverage
  panel, Import Review tab or multi-step import queue is displayed.
- Chapters & lessons links and chapter filters appear only for real chapters.
  Subjects with zero chapters open questions directly, including empty Subjects.
- Direct Add/Edit uses a single explicitly reviewed save. Every edit starts
  with review/approval checkboxes unchecked. A supported key, evidence,
  explanation and explicit approval are required; existing IDs are retained.
- Existing private validation, duplicate checks, revision checks and audit
  snapshots are reused transactionally. A conflict rolls the entire save back.
- Delete retains confirmation and existing history/ownership protection.
  Lesson-owned questions continue to use their owning editor.

Migration `20261115140100_subject_direct_question_management.sql` is applied.
Before/after counts and full-row fingerprints matched for all 29 monitored
production business, source, private-answer and audit tables: zero data changes.

The new `save_reviewed_subject_question` RPC is Admin-only at the server and
database boundaries. The additive migration replaces read-function definitions
and adds guarded save functions; it does not populate business data or change
RLS, authentication, grading, ledger rules or access grants.

Agent-only source tooling is outside application code. `AGENTS.md` records that
documents are processed by the agent, not through a new website import feature.

## Next source-content round

Do not reuse the earlier 1,530 candidates as a count of distinct complete MCQs.
The originals contain highlighted/explicit correct-answer and explanation pages;
the previous independent-page extraction did not reliably pair those pages with
their question stems. Some answer pages omit the repeated stem. Preserve and
verify question/answer/explanation relationships, visuals, full wording and page
references before proposing any safe, approved content population. Temporary
partial pairing output is not an authoritative dataset. No repopulation is
included in this cleanup release.

## Verification

Use repository-supported Node 22.23.2. Acceptance includes typecheck, lint, unit
tests, production build, local rollback SQL permission/regression checks, local
authenticated browser CRUD and responsive checks, plus production Git-deployment
and anonymous route checks. Local browser emulation is not a physical-device
test or a production authenticated Admin session.

The local responsive suite covers 192 screen/theme/viewport combinations,
including mobile, tablet, laptop, desktop and landscape. Separate controls
checks cover metadata saving, the retired review URL, absent upload controls
and unchecked explicit approval. Production preservation is checked with
before/after full-row digests, not merely row counts. Final execution and exact
deployment results are reported with the release handoff.

Checks completed for this release: typecheck, lint, build, all 145 unit tests,
full migration rollback replay, 11 local Subject workflow groups, the 192-case
responsive browser suite and the separate direct-controls browser regression.
Local rollback permission regressions also passed for teacher banks (25),
student exams (44), course access (38), typed materials (80) and lessons (141).
Production Admin-scoped read verification returned 12 Medicine Subjects, all
with zero chapters, and 10 existing canonical Subject questions. Anonymous
execution of the reviewed-save RPC is denied.

## Files in this cleanup

- Instructions/docs: `AGENTS.md`, `docs/backend-map.md`,
  `docs/medical-subject-review.md`, `docs/subject-page-cleanup.md`.
- Website: `src/actions/subject-questions.ts`,
  `src/app/admin/subjects/[bankId]/questions/page.tsx`,
  `src/features/learning/admin-materials.tsx`,
  `src/features/learning/admin-subject-questions.tsx`,
  `src/lib/supabase/database.types.ts`, `src/lib/validation/material.ts`,
  `src/lib/validation/subject-question.ts`.
- Removed website modules: `src/features/learning/subject-pdf-import.tsx`,
  `src/lib/learning/subject-pdf-reader.ts`.
- Moved the legacy agent parser from `src/lib/learning/subject-extraction.ts`
  to `scripts/lib/subject-extraction.ts`; updated its agent-only caller
  `scripts/prepare-medical-staging.mjs`. This is not a new extraction feature.
- QA: `scripts/subject-migration-check.mjs`,
  `scripts/subject-review-browser.mjs`, `scripts/subject-review-qa.mjs`,
  `scripts/subject-review.test.mjs`, `scripts/subject-controls-browser.mjs`;
  removed the obsolete `scripts/subject-pdf-browser.mjs`.
- Additive migration:
  `supabase/migrations/20261115140100_subject_direct_question_management.sql`.

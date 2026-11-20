# Specialty catalog and three exam experiences

Implementation and verification: 2026-10-11. Baseline commit: `0cc6cdd`.
Production: https://lhcc-lb.com. Supabase: `lcazjsmmegwwnmuupsko`.
This extends the existing application; auth, approvals, PDF review, clinical
cases, scoring, wallet rules and responsive foundations remain in place.

## Architecture and navigation

1. **Specialties:** `public.specialties` stores independent, Admin-configured
   top-level categories with name, URL slug, description, icon, publication
   state and display order. No artificial nested Medical/Nursing hierarchy.
2. **Nursing:** the existing Nursing Colloquium bank is assigned to Nursing by
   its checked name, not a generated specialty UUID. Medical and Dentistry are
   independently configured but currently have no published materials.
3. **Student catalog:** `/student` retains statistics, progress and existing
   navigation, adding specialty cards and an All Materials fallback.
   `/student/specialties/[slug]` reuses the existing approval-aware bank cards.
4. **Material details:** approved students choose personalized random questions,
   Past Year Exams or Shared Random Exams. Complete-bank and clinical-case
   practice remain available. Empty pools cannot start a session.

## Exam definitions and the canonical pool

5. **Personal random:** existing trusted database selection defaults/caps at 30
   eligible canonical bank questions, fewer when the pool is smaller. Unique
   question IDs, order, options, case context and private keys freeze per attempt.
   Reload/resume does not reselect questions; students have independent attempts.
6. **Historical:** existing `past_exams` / `past_exam_questions` preserve year,
   session, source and original numbering/order. New private historical snapshots
   freeze approved text/options/case context/keys against later canonical edits.
   Explicit reviewed republication refreshes the definition; existing attempts
   retain their own snapshots. Original exams are not truncated to 30.
7. **Shared random:** Admin generates a DRAFT with 1–1000 requested questions,
   bounded by the actual eligible pool. `shared_exams` stores metadata and
   `private.shared_exam_questions` stores the randomized fixed set, snapshots
   and order once. Admin reviews/reorders that exact set, saves and publishes.
   A published definition can only be archived, never edited in place. Generate
   a new definition for a revision. All eligible students receive identical
   questions/order but independent saved answers, attempts and scores.
   Archived definitions reject new starts; existing results remain available.
8. **Complete bank:** all experiences reference the same `bank_questions` IDs.
   Approved reusable PDF imports remain in that pool; definitions/snapshots are
   not disconnected question copies. No similarity-based merging was introduced.
9. **PDF import:** existing private PDF upload, extraction, confirmed year/session,
   warnings, clinical-case review, explicit answer verification and publication
   are reused. No PDF or missing answer/year is fabricated. Original documents
   remain in the protected `exam-source-pdfs` bucket.

## Administration and public content

10. **Admin:** `/admin/specialties` creates/edits categories and assigns existing
    materials without granting student access or altering question content.
    `/admin/question-banks/[bankId]/shared-exams` generates, reviews, reorders,
    publishes and archives definitions. Definitions are paged five at a time;
    question review displays 20 per page. Backend count limits bound snapshots.
    Existing bank, PDF, case and approval interfaces are not duplicated.
11. **Public Services:** `/services` adds Explore Our Learning Programs from the
    live published catalog. `/programs/[slug]` exposes only basic published
    material summaries and the existing sign-in/request-access flow. Empty
    categories explicitly say no materials are published. Services catalog
    heading/description are editable through the existing portfolio CMS, with
    backward-compatible defaults; existing production CMS records were unchanged.
12. **Icons:** nursing clipboard/care, medical stethoscope, dentistry tooth,
    pharmacy pill, laboratory microscope, radiology scan, physiotherapy activity,
    plus book/calendar/shuffle/shared-exam icons. Icons are decorative where
    adjacent text already supplies their meaning.
13. **Lordicon:** no configured licensed integration/assets were found. No asset
    was downloaded or remote player installed. Lucide/local SVG fallbacks comply
    with the requested fallback and avoid an unlicensed third-party dependency.
    See [Lordicon licensing](https://lordicon.com/licenses) before adding assets.
14. **Motion:** event-driven card lift/border emphasis, wrapper icon rotation,
    tactile clicks and 200ms check/X confirmation. No new perpetual animation,
    hidden scroll content or animation-player dependency. Reduced motion disables
    these effects; coarse-pointer devices do not receive hover motion.

## Feedback, scoring and security

15. **Correct practice:** after `check_practice_answer` authorizes feedback, show
    green highlighting, a checkmark and Correct Answer. Only real backend feedback
    controls styling; no client-side key or invented explanation is used.
16. **Incorrect practice:** selected wrong option becomes red/X/Incorrect Answer;
    the authorized correct option is green. Checked responses are disabled in UI
    and immutable through the existing database save guard.
17. **Exam mode:** selections stay neutral during an active exam. Keys/outcomes
    are absent until final trusted submission. Completed review uses the shared
    feedback component. Final submission performs a fresh results navigation to
    avoid a stale resumed-route redirect; answer saves remain asynchronous and
    failures retain selections with retry controls.
18. **Clinical cases:** existing question/case IDs and relationships persist;
    definitions and attempts snapshot case title/description. Later bank edits
    do not replace historical/shared content already frozen for students.
19. **Data preservation:** production before/after digests matched across banks
    (excluding intended specialty metadata/update time), questions, cases, users,
    grants, requests, attempts (excluding the new nullable FK), answers, wallet,
    portfolio, source PDFs and past exams. Nursing remains 100 questions / 20
    cases; four existing attempts remain. No production QA identities, exams,
    answers, PDFs or wallet entries were inserted.
20. **Migration:** repository file
    `supabase/migrations/20261011161422_learning_catalog_shared_exams.sql`;
    production MCP history version `20261011170845`, name
    `learning_catalog_shared_exams`. Match name/content when reconciling these
    timestamps. Already applied: do not blindly run it again. Public TypeScript
    types were regenerated from the live schema. No earlier migration was edited.
21. **Authorization/RLS:** active ADMIN is checked in every management action and
    private RPC. Student starts reuse `lock_exam_access`, ownership, approved-bank
    access, advisory locks, frozen private solutions and idempotent submission.
    Admin View-As cannot mutate exams. Direct client definition writes and private
    snapshot reads are denied. Public wrappers are invoker; the catalog binds its
    one safe metadata lookup at creation time, without granting anon private-schema
    USAGE. That no-input lookup explicitly exposes published summary fields only.
    Teacher assignment and add/view-only permissions are unchanged.

## Verification and measured performance

22. **Responsive:** isolated Edge/Chromium browser checks cover 320, 375, 390, 430,
    768, 1024, 1366, 1440 and 1920px, light/dark, plus 844×390 and 1024×768 landscape.
    Both new and archive journeys assert page overflow, application/network errors
    and actual form/exam workflows. Screenshots of mobile, tablet, laptop and
    desktop states were visually reviewed after theme transitions settled.
    Physical Galaxy S24 Ultra/Samsung Internet, Android Chrome and iOS Safari were
    **not available**; viewport emulation is not physical-device verification.
23. **Performance:** comparison against a separate production build of `0cc6cdd`
    used Node 22.23.2, the same isolated backend, Edge, disabled browser cache and
    five samples after warmup. No device/network throttling; these are lab numbers,
    not production Core Web Vitals or a statistically proven speed improvement.

    | Width / route | TTFB before → after | DOM ready before → after | JS bytes before → after |
    | --- | --- | --- | --- |
    | 390 / Services | 25.0 → 32.9ms | 42.9 → 51.3ms | 181196 → 181244 |
    | 390 / Student | 40.4 → 37.9ms | 393.2 → 406.2ms | 301595 → 302585 |
    | 390 / Material | 44.5 → 40.7ms | 73.5 → 62.8ms | 169896 → 169912 |
    | 1366 / Services | 23.6 → 24.3ms | 39.4 → 39.6ms | 215882 → 181244 |
    | 1366 / Student | 47.5 → 31.3ms | 374.2 → 353.8ms | 301595 → 302585 |
    | 1366 / Material | 47.5 → 34.7ms | 68.4 → 60.8ms | 169896 → 169912 |

    The Services desktop transfer difference includes viewport-driven Link prefetch
    variation, not a promised bundle reduction. Student JS increased about 1KB;
    no significant lab navigation regression was observed. New catalog cards/icons
    are server components; requests are request-deduplicated and fetched in parallel.
    Admin definition loading is bounded; no per-card browser Supabase requests,
    public protected-content cache or animation runtime was added. Raw lab evidence
    remains ignored in `.test-artifacts/learning-performance.json`.
24. **Automated/E2E:** 67 Node tests pass. Isolated rollback SQL: existing 112
    checks plus 49 new checks = 161 PASS. Real browser PDF extraction/review/publish,
    ordering, save failure/retry, resume and scoring pass. New suite passes Admin
    assignment/edit, shared generation/reordering/publication/archiving, CMS save,
    two-student RANDOM/PAST/SHARED attempts, fixed sets, independent scores, locked
    access, student isolation, reduced motion and checked-answer immutability.
    Final focused browser checks also confirm paging, generation from a later
    page returning to the newest definitions, and null/reassign Server Actions.
    No browser console exceptions or 5xx responses occurred in successful runs.
25. **Validation:** Node 22.23.2 typecheck, lint, production build, Node tests and
    diff whitespace checks pass. Node's existing MODULE_TYPELESS_PACKAGE_JSON test
    warning remains; changing the package module system was outside this task.
    Production anonymous catalog/REST guard checks pass without production writes.
26–29. **Release evidence:** commit SHA, push result, exact Vercel deployment URL,
    deployed Git SHA/READY/domain/runtime and post-push production smoke are reported
    in the release handoff. Local browser success alone is not deployment success.

Supabase security advisors after migration have only the existing
[leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Performance advisors show 14 unused-index INFO findings, including newly created
FK/lookup indexes before traffic. No index was removed merely because it is new.

## Repeatable checks

Use Node 22.23.2. The existing isolated `archive-db` Docker stack is required for
database/browser tests; these runners refuse production fixture writes.
Load ignored `.test-artifacts/archive-qa.env` into the Next process for a local
build/start on port 3100. Never replace `.env.local` with fixture credentials.

```text
npm run typecheck
npm run lint
npm run build
node --test scripts/*.test.mjs
node scripts/archive-db-tests.mjs
node scripts/learning-platform-db.mjs
node scripts/archive-qa-fixtures.mjs setup --fresh
node scripts/archive-browser-test.mjs
node scripts/learning-platform-browser.mjs
git diff --check
```

`learning-platform-performance.mjs` compares localhost:3101 (previous build) and
3100 (upgrade). `learning-platform-production.mjs` performs read-only public
production/API/anonymous-route smoke; `--backend-only` skips deployed UI checks.
Fixtures/credentials/screenshots/raw timings stay in ignored `.test-artifacts`.
The test harness initializes its local CMS heading with a scoped update: the
existing local reset RPC hit the local SQL safe-update guard. Production reset
behavior was not changed or claimed verified by this task.

Physical-device handoff: on Samsung Internet, Android Chrome and Safari, check
the public catalog and authenticated specialty → material → three exam choices,
portrait/landscape, explicit light/dark, option taps, confirmation, resume and
results. Verify that Samsung's force-dark setting does not recolor feedback.

## Files changed

Documentation: this file, `docs/backend-map.md`, `docs/student-exams.md`.

Validation/operations:

- `scripts/archive-browser-test.mjs`
- `scripts/learning-platform-browser.mjs`
- `scripts/learning-platform-db.mjs`
- `scripts/learning-platform-performance.mjs`
- `scripts/learning-platform-production.mjs`
- `scripts/learning-platform.test.mjs`
- `supabase/migrations/20261011161422_learning_catalog_shared_exams.sql`
- `supabase/tests/learning_platform.sql`

Application:

- `src/actions/exams.ts`
- `src/actions/learning-catalog.ts`
- `src/app/(public)/[slug]/page.tsx`
- `src/app/(public)/programs/[slug]/page.tsx`
- `src/app/admin/question-banks/[bankId]/shared-exams/page.tsx`
- `src/app/admin/specialties/page.tsx`
- `src/app/globals.css`
- `src/app/student/[[...section]]/page.tsx`
- `src/app/student/banks/[bankId]/setup/page.tsx`
- `src/app/student/banks/[bankId]/shared-exams/page.tsx`
- `src/app/student/specialties/[slug]/page.tsx`
- `src/components/ui/specialty-icon.tsx`
- `src/constants/navigation.ts`
- `src/data/learning-copy.ts`
- `src/features/exams/bank-details.tsx`
- `src/features/exams/exam-form.tsx`
- `src/features/exams/exam-result.tsx`
- `src/features/exams/exam-setup.tsx`
- `src/features/learning/admin-shared-exams.tsx`
- `src/features/learning/admin-specialties.tsx`
- `src/features/learning/answer-feedback.tsx`
- `src/features/learning/shared-exam-list.tsx`
- `src/features/learning/specialty-catalog.tsx`
- `src/features/portfolio-content/portfolio-editor.tsx`
- `src/features/question-banks/admin-question-bank-detail.tsx`
- `src/features/question-banks/question-bank-grid.tsx`
- `src/lib/learning/server.ts`
- `src/lib/supabase/database.types.ts`
- `src/lib/validation/exam.ts`
- `src/lib/validation/learning-catalog.ts`
- `src/lib/validation/past-exam.ts`
- `src/lib/validation/portfolio.ts`
- `src/types/learning-catalog.ts`
- `src/types/portfolio-content.ts`

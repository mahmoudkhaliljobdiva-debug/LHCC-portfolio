# Approved learning architecture and implementation record

Status: 2026-10-31. Branch: `feat/learning-material-foundation`.
Reviewed baseline: `9abc258`. This is a phased implementation record, not a
production release or a claim that the entire learning/commerce platform exists.
The controlling approval is the user's **LHCC — Final Architecture Decisions and
Implementation Approval**, dated 2026-10-31.

## Approved structure

```text
LHCC
├── Medical
│   ├── Medical Subjects
│   │   └── Psychiatry / other Admin-published subjects
│   │       └── Chapters → Lessons → approved PDFs and extracted practice questions
│   ├── Colloquium Exams → generated / historical PDF / shared exams
│   ├── Prometric Exams → generated / uploaded PDF / shared exams
│   ├── Other Admin-configured Exam Tracks
│   └── Packages & Offers
├── Nursing → reusable Subjects / Exam Tracks / Offers structure
└── Dentistry → reusable Subjects / Exam Tracks / Offers structure
```

Subjects are learning materials, not exam tracks. Colloquium, Prometric and other
exam tracks remain separate sections directly under their specialty. Lesson
questions must not automatically enter an exam's canonical question pool.
Content is Admin-configured; this diagram does not authorize seeding fake subjects,
lessons, exams, prices or educational content.

Reuse the existing authentication, approvals, private PDF handling, question
verification, historical/shared definitions, chapter practice, clinical cases,
frozen attempts, grading and Realtime infrastructure. Existing chapter-question
practice is not evidence that lesson/PDF management has been implemented.

## The 13 approved decisions

1. **PDFs and languages:** Support Arabic, English and mixed RTL/LTR text-based
   PDFs. Admin will supply authorized representative Psychiatry PDFs. Do not
   fabricate educational content or claim extraction success without samples.
2. **Question extraction:** Extract questions already present in uploaded PDFs.
   Admin may manually create, correct and verify questions and explanations.
   Generating medical questions from lecture prose is outside this release.
3. **OCR:** OCR is not a mandatory dependency. Warn clearly about scanned or
   unreadable PDFs and provide manual transcription/review; retain an extension
   point for later OCR.
4. **PDF answer security:** Original uploads are private by default. Students
   receive only an Admin-approved Student-safe PDF or reviewed derivative. Never
   expose embedded answer keys before authorized feedback.
5. **Completion:** Store explicit lesson reading/completion separately from
   practice results. Opening a PDF does not imply completion or mastery.
6. **Unfinished sessions:** Keep resume-first safeguards and the current attempt
   engine. Preserve frozen content, saved answers, deadlines and grading; do not
   rebuild the engine for this work.
7. **Subject access:** Admin may grant a specialty Subjects group or explicitly
   included subjects. Packages may cover Subjects, exam tracks or both. Do not
   sell chapters individually. Preserve existing purchases' agreed coverage.
8. **Payments:** Begin with manual Admin-confirmed external payments in USD.
   Payment confirmation, Admin approval and complimentary grants are separate
   audited concepts. No gateway is approved. An existing bank-sale ledger entry
   is not proof that money was received.
9. **Duration:** Default access has no expiry; Admin may configure a duration.
   Enforce expiry server-side and retain completed attempts/results. For an
   active exam crossing expiry, apply agreed rules and explain the outcome; do
   not invent a grace period or silently change existing access behavior.
10. **Future content:** New chapters/lessons inside a covered subject or exam
    track are normally included. New subjects/tracks are included only when the
    purchased package explicitly permits future additions. Snapshot these terms
    with the accepted purchase.
11. **Partial ownership:** Show what the Student already owns and prevent a
    duplicate charge for the same standalone entitlement. Offer an upgrade only
    at an Admin-configured upgrade price; no automatic prorating.
12. **Price changes:** Preserve the accepted offer version, price, currency and
    terms. Honor the accepted quote after a later price change. Replacement terms
    require Student acceptance.
13. **Refund/revocation:** Revoke only the selected entitlement source; access
    from other valid purchases/grants survives. Refunds are separate audited
    financial events and are not automatically triggered by revocation.

Any unresolved detail that changes real payments, access rights or historical
records requires the user's approval before implementation affects production.

## Publication, access and experience requirements

Admin management must cover specialties, typed subjects/exam tracks, subject
icons/descriptions, chapters, lessons, private PDF upload/extraction review,
verified question publication, existing historical exams, offers, requests,
manual payment confirmation and entitlement administration. Extend existing
screens and services wherever possible.

Student specialty pages must distinguish Subjects, Colloquium, Prometric, Other
Exams and configured Packages/Offers. Psychiatry will expose only published
chapters/lessons, authorized PDFs/practice and separate reading/practice progress
when those phases are implemented. Backend-verified entitlements govern every
protected read and mutation; a lock icon is not an access control.

Use additive, backward-compatible schema changes, least-privilege grants, RLS
and guarded server/RPC checks. Explicit grants and row policies are separate
controls; neither replaces the other. See [Supabase's Data API security guide](https://supabase.com/docs/guides/api/securing-your-api).
New content stays unpublished until access-control tests pass. Keep original
PDFs, private solutions and feedback gating protected; never send answer keys to
a catalog or active exam response.

Reuse private Realtime synchronization so approval changes update the Student
without refresh, reconcile across tabs and recover correctly after reconnect.
The server remains authoritative when client state is stale or disconnected.

The mobile-first design requires large relevant local SVG/Lucide icons, spacious
cards, comfortable touch targets, clear lock states, progress, skeleton loading,
responsive light/dark layouts, reduced-motion support and lightweight tap
feedback. Licensed Lordicon assets are optional, not permission to add an
unlicensed integration or heavy animation dependency. Optimize for Samsung
Internet; browser emulation must not be reported as physical Samsung testing.

A Medical specialty card may show a price only for a published qualifying
specialty-wide package. Otherwise show **Explore Medical** without a price.
Section-specific offers stay in their relevant sections. Show exact coverage
before purchase; never invent prices, discounts or free access.

## Ten-phase checklist

Each phase must be completed and verified before advancing to the next.

- [x] **Phase 1 — Review repository, migrations and existing architecture.**
  Reviewed baseline/branch, historical inventory, read-only production state and
  schema comparison. Recorded exceptions and deployment gates in
  [migration-history-reconciliation.md](migration-history-reconciliation.md).
  Review is complete; it did not repair history or authorize a production change.
- [x] **Phase 2 — Typed Subjects and Exam Tracks with secure foundations.**
  Locally implemented and verified; not released. Migration
  `20261031173818_typed_learning_materials.sql` applied only to archive-db.
  See [phase verification and file inventory](typed-learning-materials.md).
  No production migration applied; Subjects remain draft-only.
- [ ] **Phase 3 — Chapters, Lessons and lesson PDF management.**
  Resumed on 2026-11-01 from the two lesson schemas and an empty migration.
  Admin authoring/private PDFs/extraction review are implemented locally; see
  [tests and the source acceptance gate](subject-lessons.md). Every published
  question requires an Admin-reviewed why-correct explanation. The supplied
  98-page Psychiatry PDF is image-only and exceeds the 20 MB upload boundary;
  visual yellow keys need manual transcription or separately scoped OCR/splitting.
  Arabic/mixed selectable-text acceptance is still pending. Phase 3 is not marked
  accepted solely from synthetic fixtures. No production migration/release occurred.
- [ ] **Phase 4 — Student reading and question practice.**
  Lesson reading, separate completion/progress and reviewed lesson practice are
  not complete. Preserve existing exam/chapter practice behavior.
- [ ] **Phase 5 — Organize exam tracks using existing engines.**
  Reuse existing generated-selection, historical PDF and fixed shared exam
  behavior; no new AI-generation capability is implied by an existing label.
- [ ] **Phase 6 — Admin commerce and entitlements.**
  Packages, versioned offers/quotes, orders, separate payment confirmations,
  entitlement sources, expiry and refund audit workflows are not complete.
- [ ] **Phase 7 — Student purchase/access interfaces.**
  Exact coverage, ownership, accepted quote, configured upgrades and clear
  request/payment status depend on Phase 6; not complete.
- [ ] **Phase 8 — Extend Realtime synchronization.**
  Verify new approval/entitlement changes across tabs and reconnection; existing
  Realtime support alone does not prove these future flows work.
- [ ] **Phase 9 — Premium mobile UI/UX.**
  Apply the approved interaction/accessibility requirements to completed flows
  and verify responsive layouts without fabricating content or offers.
- [ ] **Phase 10 — Full security, performance and regression verification.**
  Run applicable lint, TypeScript, production build, Node, SQL/RLS, auth/access,
  PDF security, exam regression, purchase/entitlement concurrency, responsive
  browser and Realtime reconnection tests in isolated safe environments.

## Evidence and release gates

Pre-completion baseline evidence reported during this work: **263 existing local
SQL checks PASS and 95 Node checks PASS**. These are baseline results, not final
Phase 2 verification. Record final tests and exact results in the phase handoff;
do not reuse older docs' counts as evidence for current changes.

Preserve all production users, questions/cases, attempts/results, access grants,
wallet/transaction records, CMS content, private PDFs and applied migrations.
The existing unpublished empty `test` chapter is left untouched. Nursing's
current misassignment is documented separately and remains approval-gated.

No push, production migration or production deployment is authorized by this
record. Do not reset, truncate, reseed, force-push, rewrite old migrations or
overwrite unrelated work. Do not run real financial transactions or destructive
production tests. Before any production deployment, present final test results,
migration impact and a release summary, and obtain explicit user approval.

After each phase, report completed work, changed files, migrations, tests,
security checks, preserved functionality, blockers and the next phase. Verified
work may be committed in logical increments under the user's workflow; this
documentation task performs no commit. After an approved push, use the existing
Git/Vercel integration and report the exact deployed SHA, deployment URL, READY
state, domain routing/runtime checks and [production link](https://lhcc-lb.com)
as required by `AGENTS.md`. Never claim a release that was not observed.

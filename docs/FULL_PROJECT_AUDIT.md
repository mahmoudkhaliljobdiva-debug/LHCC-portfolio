# LHCC full project audit

Audit dates: **2026-11-11 and 2026-11-14** (Asia/Beirut; resumed after interruption). Repository:
`mahmoudkhaliljobdiva-debug/LHCC-portfolio`. Production: https://lhcc-lb.com.
Development branch: `audit/full-project-2026-11-11`. Starting source/release: `5e51b03`.

**Overall: NOT an all-features PASS.** Existing exam-track functionality has strong
executed regression evidence, but hosted schema/content drift, disconnected Medical
Subject workflows, unfinished commerce/Student lessons and infrastructure gaps remain.
No production migration or business-data write was performed by this audit.

Evidence is dated below; November 11 browser/SQL results are not relabeled as
fresh November 14 runs. The final validation/release section is authoritative.

## A. Scope and evidence levels

| Inventory | Observed count |
| --- | --- |
| Application-owned tables (public/private) | 41 (25 public, 16 private) |
| Public/private database functions | 125, including wrappers/helpers/trigger/internal historical layers |
| Distinct source RPC names | 40; none missing from production |
| TypeScript/TSX source files at baseline | 213; 123 TSX files including pages/layouts |
| Page entry files | 42; dynamic/catch-all routes expand to additional URLs |
| HTTP route handlers | 2 GET handlers: catalog revision and Auth callback |
| Server-action modules / exported actions | 15 / 47 |
| Validated application foreign keys | 77; every relationship queried for actual orphan rows |
| Application row triggers | 45; all enabled in catalog |
| Application SQL views | 0 |
| PDF Storage buckets | 2; both private; 20 MiB cap |
| Applied hosted migrations before audit | 27; four applied November 8-9 absent from source migration directory |
| Local migration files before audit | 22; historical version drift also predates this audit |
| Feature groups classified in section C | 27; per-row execution/absence boundaries, not 27 blanket passes |

Findings: **15 issue groups** (F01-F15). Seven have narrowly implemented and
verified development corrections (F01-F04, F07, F14-F15); eight remain documented
decisions/infrastructure/backlog items. These are issue groups, not a claim of
seven production fixes: neither pending migration nor the Invite template was
applied live. The feature matrix distinguishes executed workflows from absent or
partially connected features; no blanket count of all payloads tested is claimed.

See [the complete route/action/function inventory](audit/full-project-inventory.md).
Every table was inspected for columns, types, nullability, defaults, PK, FK, checks,
unique constraints, indexes, triggers, RLS/policies and effective grants. All 40
source RPC names and all static table/bucket references exist. This is structural
and reference validation, **not proof that every possible payload/route branch works**.

Production checks were read-only, including role-switched transactions and denied
Admin RPC probes. Successful writes, uploads, grading, role changes and concurrency
were tested only in the explicitly identified local `archive-db` Supabase stack.
No production Auth users, emails, grants, questions, exams, results or ledger entries
were created, updated or removed. No real financial transaction was initiated.

## B. Database connection / permission / relationship matrix

All 77 FK orphan counts are exactly zero; every PK is present; all inspected
constraints/indexes are valid. Actual options have no duplicate IDs; canonical
keys refer to real options; active questions have keys; current case/attempt
questions do not cross banks; no duplicate pending requests or active attempts
exist. Counts below are the November 11 production snapshot, not test fixtures.
November 14 refresh: 39/41 table row counts/fingerprints match that snapshot.
`profiles` increased from five to six and private `live_revisions` from three to
four; one new production profile is dated November 14. The audit made no production
writes and did not delete this new real account. Auth now also has six identities.
All content, attempts, answers, grants, requests and ledger fingerprints match.
"STRUCTURE PASS" does not certify an absent or untested UI feature.

| Table | Application usage | Operations | Permissions | Relationships / rows | Audit status |
| --- | --- | --- | --- | --- | --- |
| `private.exam_question_solutions` | Private frozen grading keys; authorized completed/checked feedback only | C frozen snapshot; R guarded | RLS on; 1 policies | 1 FK; 120 rows | STRUCTURE PASS; workflow evidence below |
| `private.imported_question_owners` | Historical import ownership and canonical reuse boundaries | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 2 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `private.lesson_case_owners` | Private authored clinical-case ownership | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 2 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `private.lesson_drafts` | Private incomplete/unverified Admin lesson review JSON | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 1 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `private.lesson_question_explanations` | Private Admin-reviewed why-correct explanations; not Student delivered | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 2 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `private.lesson_question_owners` | Private authored question ownership; protects cross-lesson reuse | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 2 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `private.live_revisions` | Private revision-only reconciliation; no browser table reads | C/U internal triggers; R guarded revision RPC | RLS on; no policies, deliberate raw-read denial | 0 FK; 3 rows | STRUCTURE PASS; workflow evidence below |
| `private.past_exam_drafts` | Unverified historical import review; excluded from Student reads | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 1 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `private.past_exam_snapshots` | Private immutable historical source/key snapshots | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 1 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `private.practice_checks` | Server check-once markers; immutable feedback state | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 1 FK; 5 rows | STRUCTURE PASS; workflow evidence below |
| `private.question_answer_reviews` | Hosted-only source keys/rationales; no application review UI; 10 rows lack reviewer/date | No application operations; retained hosted records | RLS missing; all API table grants denied | 2 FK; 10 rows | UNCONNECTED / findings F05-F07 |
| `private.question_import_sources` | Hosted-only manual Medical import provenance; no application import UI/RPC | No application operations; retained hosted records | RLS missing; all API table grants denied | 1 FK; 12 rows | UNCONNECTED / findings F05-F07 |
| `private.question_import_staging` | Hosted-only manual staging; conflicting later schema definition; no application API | No application operations; retained hosted records | RLS missing; all API table grants denied | 2 FK; 12 rows | UNCONNECTED / findings F05-F07 |
| `private.question_solutions` | Private canonical QCU keys; guarded Admin write/read and server grading | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 1 FK; 110 rows | STRUCTURE PASS; workflow evidence below |
| `private.question_source_links` | Hosted-only canonical question provenance; no application retrieval workflow | No application operations; retained hosted records | RLS missing; all API table grants denied | 2 FK; 10 rows | UNCONNECTED / findings F05-F07 |
| `private.shared_exam_questions` | Private fixed shared text/order/keys; frozen start | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 2 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `public.bank_chapters` | Admin chapter management; exam-track chapter practice; Subject lesson organization | C/R/U guarded; archive/unpublish instead of historical deletion | RLS on; 1 policies | 1 FK; 1 rows | STRUCTURE PASS; workflow evidence below |
| `public.bank_generation_settings` | Admin balanced exam setup limits and selection | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 1 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `public.bank_questions` | Admin question editor; Teacher insert-only; reviewed imports; frozen exams | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 3 FK; 110 rows | STRUCTURE PASS; workflow evidence below |
| `public.chapter_questions` | Admin many-to-many assignment; chapter-scoped selection | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 2 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `public.exam_sources` | Admin private historical PDF provenance/signing | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 2 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `public.lesson_documents` | Admin private PDFs and explicit Student-safe review only; no Student delivery | C/R/U guarded; archive/unpublish instead of historical deletion | RLS on; 1 policies | 3 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `public.lesson_questions` | Reviewed lesson publication provenance; no Student lesson practice | C/R/U guarded; archive/unpublish instead of historical deletion | RLS on; 1 policies | 3 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `public.lessons` | Admin Subject lesson authoring only; no Student reader | C/R/U guarded; archive/unpublish instead of historical deletion | RLS on; 1 policies | 2 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `public.past_exam_questions` | Canonical question reuse and original order/number | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 2 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `public.past_exams` | Admin historical definitions; Student year/session filters | C/R/U guarded; archive/unpublish instead of historical deletion | RLS on; 1 policies | 2 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `public.portfolio_content` | Four public CMS pages; Admin portfolio; published/default revisions | R public allowlist; U save/reset RPC | RLS on; 1 policies | 1 FK; 4 rows | STRUCTURE PASS; workflow evidence below |
| `public.profiles` | Auth provisioning; account/settings; Admin users; role guards | C Auth trigger; R; U guarded server actions | RLS on; 1 policies | 2 FK; 5 rows | STRUCTURE PASS; workflow evidence below |
| `public.question_assets` | Hosted-only question-image metadata; no application upload/render workflow; empty | No application operations; retained hosted records | RLS on; no policies, deliberate raw-read denial | 1 FK; 0 rows | UNCONNECTED / findings F05-F07 |
| `public.question_attempt_answers` | Saved options; version conflicts; grading; reporting | C/R/U guarded selections/grading | RLS on; 1 policies | 2 FK; 43 rows | STRUCTURE PASS; workflow evidence below |
| `public.question_attempt_questions` | Ordered immutable question/option/case/source snapshots | C frozen snapshot; R guarded | RLS on; 1 policies | 2 FK; 120 rows | STRUCTURE PASS; workflow evidence below |
| `public.question_attempts` | Start/resume/submit; history; dashboards; analytics; Admin read-only preview | C/R/U via exam RPC; no client D | RLS on; 1 policies | 5 FK; 4 rows | STRUCTURE PASS; workflow evidence below |
| `public.question_banks` | Admin materials/banks; specialty catalog; requests; teacher assignments; exams | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 2 policies | 2 FK; 13 rows | STRUCTURE PASS; free-Subject flow PARTIAL |
| `public.question_groups` | Hosted-only shared-option groups; no application rendering/authoring; one used group | No application operations; retained hosted records | RLS on; no policies, deliberate raw-read denial | 1 FK; 1 rows | UNCONNECTED / findings F05-F07 |
| `public.question_sections` | Admin clinical cases; question context; frozen attempts | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 1 FK; 20 rows | STRUCTURE PASS; workflow evidence below |
| `public.shared_exams` | Admin generated/reviewed fixed sets; published Student shared exams | C/R/U guarded; archive/unpublish instead of historical deletion | RLS on; 1 policies | 2 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `public.specialties` | Public /programs; Student specialty hubs; Admin specialties | C/R/U guarded; archive/unpublish instead of historical deletion | RLS on; 1 policies | 0 FK; 3 rows | STRUCTURE PASS; workflow evidence below |
| `public.teacher_bank_assignments` | Admin managed roles/assignments; Teacher scope | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 3 FK; 0 rows | STRUCTURE PASS; workflow evidence below |
| `public.user_bank_access` | RLS access guard; Student banks; approval/revocation | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 1 policies | 4 FK; 3 rows | STRUCTURE PASS; workflow evidence below |
| `public.user_bank_access_requests` | Student requests; Admin approve/reject/revoke | R guarded; C/U/D via owning workflow, constrained by history/ownership | RLS on; 2 policies | 3 FK; 3 rows | STRUCTURE PASS; workflow evidence below |
| `public.wallet_transactions` | Admin ledger/manual tickets; atomic paid access approval; idempotency | R RPC; C automatic; C/U/D manual tickets only | RLS on; 1 policies | 4 FK; 2 rows | STRUCTURE PASS; workflow evidence below |

### Security boundaries confirmed

- Anon lacks private-schema USAGE. Authenticated users have only the deliberately
  granted private helper/RPC execution paths; raw keys, drafts, explanations, wallet
  and import tables are denied. No public definer is executable by anon/authenticated.
- All public application tables have RLS. Four newer private import tables do not;
  their raw table grants are denied, so this is defense-in-depth missing, not a
  demonstrated public data leak. The pending migration adds RLS without grants/policies.
- Real Student-role read-only production probes: 11 visible banks (one track + ten
  free Medical Subjects), 110 visible questions, zero lesson metadata; own-attempt
  isolation holds. This differs from the application's track-only Subject boundary.
- Real Admin-role probes: 12 Subjects, one Exam Track, three catalog specialties;
  raw import-review table SELECT remains denied through the session role.
- Fifteen Admin read/write/reset/profile RPCs reject a Student even with spoofed
  `user_metadata.role=ADMIN`. Anonymous catalog contains no keys, source paths or explanations.
- Original PDFs are private; scoped signed links are Admin-only. Student-safe
  approval metadata is not itself a Student PDF delivery implementation.
- Frozen attempts, private canonical/frozen keys, ownership locks, idempotent ledger
  insertion and database-based role/status checks remain authoritative.

## C. Feature verification matrix

| Feature | Current status / evidence boundary |
| --- | --- |
| Public Home/About/Services/Platform/Contact/program pages | Production public browser PASS: ten pages x eleven widths x two themes = 220 checks; anonymous guards PASS |
| Signup, immediate entry, normalized phone, no automatic grants | Local browser PASS; actual Auth/profile/session readback |
| Login/logout/session persistence/cross-role denial | Local Auth browser PASS |
| Password recovery | Local full-flow PASS: captured SMTP -> PKCE -> password change -> old password rejected -> new login; no external delivery tested |
| Enabled/disabled/expired account enforcement | SQL/two-session live browser PASS; actual Admin deactivate/reactivate UI and existing-session enforcement PASS |
| Own profile editing, Admin user editing/invitation/role changes | Local Admin management/invite/password setup/replay PASS; self-profile browser evidence below |
| Exam-track request/approve/reject/revoke + wallet idempotency | Local SQL + two-session browser PASS; production read-only authorization/integrity PASS |
| Teacher assigned-bank view/add-only | Local SQL PASS; source guard preserved; picker fixed to exclude Subjects; current role browser completion below |
| Specialty catalog + Admin assignment/publication | Production summaries verified; local Admin edit/assign/unassign and public/Student specialty separation PASS |
| Admin typed Subjects/Exam Tracks | Local material browser PASS, 144 responsive combinations; new records draft/inactive; pagination actually followed |
| Admin Subject chapters/lessons/private PDF/review/why-correct explanation | Local lesson browser PASS: 160 responsive combinations, 44 focused captures, eight workflow groups; actual server/RPC/readback |
| Student Subject reading/PDF delivery/completion/lesson practice | NOT IMPLEMENTED; no Student lesson reader, progress table or lesson-practice entitlement path |
| Ten published free Medical Subjects | PARTIAL/BROKEN FLOW: hosted helper/RLS/catalog allows them; UI has no Subject CTA and exam RPC rejects Subjects; published Subject metadata cannot save through draft-only editor |
| Psychiatry | No real Psychiatry Subject/lesson exists in production; do not fabricate one |
| Medical/Nursing/Dentistry + Admin-created specialties | Reusable catalog exists; Nursing Colloquium's current assignment needs owner decision (F09) |
| Generated exam selection | Database-selected/balanced canonical questions; **not LLM question generation**; SQL/browser evidence below |
| Chapter practice / historical PDF exams / shared fixed exams / random/all/case | SQL, archive, chapter and full learning-platform browser suites PASS; shared frozen order/scores, random independence and checked feedback verified |
| Resume, autosave/retry, grading, history, checked feedback | Local historical exam browser PASS; secure/frozen/idempotent SQL tests PASS |
| Scanned PDFs / yellow highlights | Conservative warning/manual transcription supported; no OCR or automatic highlight-based answer certification |
| Source import assets/shared option groups | Hosted records retained but UNCONNECTED to deployed source UI/RPCs; no Student rendering claim |
| Dashboard/analytics/Student activity | Real backend-derived data; unit/reporting PASS; route/chart browser evidence below |
| Portfolio CMS save/reset/live public update | Local save/reset/exact default readback and already-open public-page reconciliation PASS after safeupdate fix; production reset correction pending approval |
| Admin wallet manual income/expense and automatic bank sales | Local browser create/edit/delete and signed-amount readback PASS; automatic ledger idempotency SQL PASS; not a payment gateway |
| Packages/offers/accepted quote versions/manual payment approval/overlapping entitlements/refunds | NOT IMPLEMENTED as the approved new commerce architecture; do not infer them from existing bank-sale ledger types |
| Realtime approval/revocation/multi-tab conflict/reconnect | Local actual private-channel transport and eight two-session browser workflow groups PASS |
| Lesson/import-specific live publication | PARTIAL: new lesson/import tables have no equivalent live invalidation triggers yet; not full platform-wide Realtime |
| Physical Samsung S24 Ultra / Samsung Internet / Safari | NOT TESTED; Chromium responsive emulation is not real-device/browser certification |

## D. Findings and smallest safe corrections

### F01 - Dependency advisories (fixed on development branch)

Initial `npm audit`: ten affected package entries (one critical, one high, eight
moderate), including Next.js, Zod and lint's transitive minimatch. This does not
claim every reported exploit path was exercised against LHCC. Updated pinned
Next.js + eslint-config-next `16.3.8 -> 16.4.6`, Zod `4.4.3 -> 4.6.7`, and a targeted
`@typescript-eslint/typescript-estree > minimatch 11.0.1` override. Lockfile updated;
no forced major downgrade or disabled TLS. Final dependency audit: **zero findings**.

Sources: [Next SVG advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw),
[Server Actions advisory](https://github.com/advisories/GHSA-p3m5-59mp-jv5r),
[cache advisory](https://github.com/advisories/GHSA-673q-mjm6-r5xr),
[Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5),
[minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).

### F02 - Hosted schema missing from TypeScript contract (fixed)

Generated and inspected current production types. Added only the missing public
`question_assets`, `question_groups`, `bank_questions.group_id` and FK relationships
to `src/lib/supabase/database.types.ts`. No grants, queries or content publication
were added merely by describing their actual types.

### F03 - Impossible Subject teacher assignments offered (fixed picker)

`getAdminBankOptions` listed all materials although `teacher_has_bank` only authorizes
Exam Tracks. Filtered its Admin-guarded server query to `EXAM_TRACK`; retained draft
and inactive tracks to preserve existing assignment editing. Two regression tests
cover the filter and guard-before-query. Backend authoring still independently
denies Subject questions; the picker does not grant any privilege.

### F04 - Wallet/CMS/user-confirmation keyboard dialogs (fixed and retested)

Actual pre-fix browser probe: wallet focus containment false / Escape false; CMS
reset focus true / Escape false. Reused the approved native `ModalPanel` (focus
containment/restoration, top layer, scroll containment) for wallet create/edit/delete
and CMS reset, plus Admin deactivate/reactivate confirmations. Added optional alert role/description/width; retained existing design
and busy-state cancellation protection. Wallet delete now blocks duplicate submissions.
No wallet business operation or CMS data model changed. Actual post-fix focus and
Escape checks PASS for all four affected workflows; wallet deletion also receives
focus. Native Escape automation sends both key events with virtual key code 27.
Files: `src/components/ui/modal-panel.tsx`, wallet page, portfolio editor and
`src/features/users/admin-user-dialogs.tsx`. Reused existing components rather than
introducing a second modal library or changing the design.

### F05 - Production migration/source drift (documented; not destructively repaired)

Four additional November 8-9 migration entries were discovered live, not in Git.
Saved their exact applied definitions under `docs/audit/production-history/` as
**evidence, not replay migrations**. Historical missing default-grant migration and
nine logical version mismatches (seven historical + two foundation) also remain.
Do not run directory-wide `supabase db push`, reset, rename or repair old history.
See [migration reconciliation](migration-history-reconciliation.md).

### F06 - Conflicting import schemas remain unreconciled (needs design/data decision)

The second import migration uses `CREATE TABLE IF NOT EXISTS` with different
columns/status enums/keys; it therefore does not change the first applied schema.
Actual staging lacks its later intended bank column and uses REVIEWED rather than
APPROVED/NEEDS_REVIEW; source/review statuses differ too. Local rollback reproduction
confirms this. No generic import API was enabled over this inconsistent contract.

### F07 - Missing private RLS and four covering FK indexes (local fix ready; production approval pending)

Prepared `20261111183838_audit_import_defense_and_fk_indexes.sql`: enable RLS on
four private import tables; index reviewer, question-group, lesson/chapter-bank and
lesson-question/lesson-bank FKs. No row/grant/policy/publication changes; no unused
index drops. Explicit prerequisites fail before mutation if the imported schema is
missing. Tested with the captured hosted definitions in **one local rollback**;
twelve assertions PASS. Not applied to production; not a blanket drift repair.

### F08 - Free Medical Subjects conflict with approved application boundary (decision required)

Hosted November 9 helper/policy/constraint permits ten published free Subjects.
Source still requires draft/inactive Subjects; Student bank reads and preview scope
exclude them; `exam_bank_data`/exam triggers reject them. Admin metadata saves reject
published Subjects too. The catalog advertises incomplete access without a working
reading/practice path. The audit reproduced this mismatch locally and read-only live.
Do not route Subjects through exam pools or silently change existing availability
as a workaround. A dedicated Subject workflow/access decision is required.

### F09 - Nursing Colloquium remains assigned to Medical (approval-gated historical correction)

Current track `d7e37b48-8afc-4df0-ad5e-a1c08dc65eb4` retains 100 questions,
20 clinical cases, existing attempts/grants/ledger rows. Its specialty is Medical.
No reassignment/deletion or ID change was performed. Recommend Nursing only after
owner confirmation; preserve every existing relationship/access/history row.

### F10 - Imported clinical-content signoff incomplete (not auto-corrected)

Twelve source/staging rows are PARTIAL; ten canonical Subject questions have
SOURCE_VERIFIED reviews and nonblank explanations, but all ten lack reviewer/date.
No imported source PDF is stored in either application bucket; one shared-options
group is referenced by a question but has no application rendering. SQL keys match
canonical options and source page/bank relations are consistent. This is not a
medical-accuracy or publication-signoff certification. Do not fabricate reviewers,
clinical explanations, missing sources or completed import counts.

### F11 - Approved later architecture not implemented (backlog, not a passing test)

Student reading/completion/lesson practice, Student-safe PDF delivery, package/group
entitlements, immutable accepted quotes/offers, payment-confirmation/revocation/refund
workflows and their Realtime are absent. No such tables/routes were found. Existing
bank grants and wallet sales are not replacements for those approved features.

### F12 - Existing leaked-password protection warning (infrastructure action)

Hosted security advisor still reports leaked-password protection disabled.
[Remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Not silently changed. Existing no-policy INFO findings on private revisions and
unexposed groups/assets are intentional deny boundaries, not reasons to grant reads.
Hosted performance also reports redundant permissive bank SELECT policies (introduced
by free Subject access) and unused-index information. No policy merging without
revalidating the access decision; no speculative index removals.

### F13 - Monitoring/release/backup coverage gaps (explicit)

Vercel's November 11 runtime-error summary returned no errors; November 14's actual
runtime-log query returned no error/fatal groups within the supported 30-minute
window. A one-hour request was rejected by plan retention; no log drain is configured.
This is not proof of zero errors outside the observed windows. No repository
CI workflow gates all SQL/browser suites. A current recoverable hosted backup/restore
was not exposed by available tooling and was **not certified**; catalog/function
snapshots and row fingerprints are not full backups. No hosted migration was applied.

Performance limits: the Student overview fans out `getExamBank` once per approved
bank (in parallel), and dashboards paginate full allowed result sets before
application-side aggregation. Current small fixtures pass, but this scales with
banks/history and is not certified at production load. Local services TTFB samples
were 19-25 ms and Student dashboard 62-72 ms; dashboard document load was 0.80-0.94 s.
These are local cached observations, not network/device SLAs. Do not introduce an
unrelated reporting refactor or claim load optimization from these measurements.

Source security review: privileged Supabase clients are marked `server-only`;
callers retain verified-identity and role/subject guards. CMS/question text is rendered
as React text; the two `dangerouslySetInnerHTML` uses are the fixed theme bootstrap
and fixed Organization JSON-LD, not CMS/question HTML. Input
validation/RPC parameters remain structured rather than interpolated SQL. Existing
Next server-action Origin protection remains in place and the framework is patched.
No new public mutation endpoint, browser secret, unsafe HTML sink or access-policy
relaxation was introduced. The generated browser chunks also contain no server
secret/key references. This is source/negative-test evidence, not a full pentest.

### F14 - Portfolio reset rejected by PostgREST safeupdate (local fix verified; production pending)

The previous reset function updated the entire CMS table without a WHERE clause.
Direct SQL succeeded, but actual PostgREST returned HTTP 400 / SQLSTATE `21000`,
`UPDATE requires a WHERE clause`. This reproduces the visible default-reset error.
`20261111195537_fix_portfolio_reset_safeupdate.sql` limits the update to the four
approved section keys, retains the Admin guard and requires exactly four affected
rows or rolls back. The migration replaces code only: it does not reset content
while applying and does not change grants or disable safeupdate.

Local real REST reset returned 204, exact defaults matched, Student/anon reset was
denied and original local CMS content was restored. Browser confirmation/reset and
readback also PASS. Regression: `scripts/audit-cms-defaults.mjs`,
`scripts/audit-admin-workflows.mjs`, `scripts/audit-security.test.mjs`.
This is **not yet fixed on production**; explicit production approval is required.

### F15 - Admin invitation cannot bootstrap recipient-side PKCE (local fix verified; production pending)

An actual local Admin invitation used an implicit Auth verification link. The
recipient had no originating PKCE verifier, and the app callback accepted only a
code, so password setup was never reached. Added a narrowly scoped invitation-hash
callback: Supabase verifies/consumes `type=invite` using the existing SSR client,
writes session cookies and redirects to the fixed password setup route. No role
is accepted from the URL; malformed/ambiguous/expired/replayed links fail neutrally.
Existing password-recovery PKCE remains intact. Callback responses are no-store
with no-referrer headers; tokens/passwords are not logged by the tests.

Files: `src/app/auth/callback/route.ts`, `supabase/templates/invite.html`,
`scripts/auth-callback.test.mjs`, `scripts/audit-admin-users.mjs` and
`scripts/audit-auth-browser.mjs`. Actual local SMTP invite -> callback -> password
setup -> login -> replay denial PASS; full signup/recovery/login/logout also PASS.
The recovery harness now waits for React hydration before entering passwords;
its earlier premature submission timeout was not an application regression.

Approval-gated rollout: first deploy approved callback code, then configure only
the hosted **Invite user** template from the versioned file, verify Site URL
`https://lhcc-lb.com` and allowed callbacks, then perform an explicitly authorized
invitation test. Do not alter the working recovery template or enable implicit
token-fragment handling. Production template/configuration has not been changed.

### Test-tool corrections (not additional application feature claims)

- QA material listing now follows actual pagination instead of assuming page one.
- QA completed-attempt seeding uses current start/save/submit, not retired immediate feedback.
- Local CLI status adapter supports an explicit cached executable, pins its offline
  fallback and rejects non-loopback API targets; no surprise CLI v3 installation.
- Added source inventory, read-only FK/integrity audit, captured drift reproduction,
  Auth/browser/managed-user/workflow diagnostics and security regressions.

## E. Execution record / remaining coverage

Executed evidence from November 11:

- Node **22.23.2**; typecheck, lint and production build PASS after security/type/picker fixes.
- **138/138** Node tests PASS before final callback/reset regressions; superseded by the final rerun below.
- **519 distinct** existing rollback/concurrency assertions PASS: course38 + exams44 +
  teacher25 + clinical11 + archive32 + learning49 + chapters44 + Realtime20 distinct
  (58 includes repeated course38) + material80 + lesson141 + material races16 + lesson races19.
- **12** additional hosted-drift/hardening local rollback checks PASS; that transaction leaves no schema/data changes.
- Actual private-channel own-topic message delivery/minimal payload PASS; other-user topic denied.
- Eight two-session Realtime workflows PASS; measured local request ~1413 ms, approval ~1325 ms.
- Full local Auth/signup/recovery story PASS; real email captured on loopback, not sent externally.
- Historical PDF/exam browser suite PASS (ten screens, nine widths, two themes, two landscape sizes).
- Material144 and lesson160 responsive checks PASS; lesson44 focused captures; source PDF and
  Student-safe review flows tested with non-medical synthetic fixtures only.
- Production structural read-only audit: **41 tables, 77 FKs, zero orphans/integrity failures**.
- Production 15 Admin RPC denial probes PASS under Student with spoofed metadata.
- Production HTTP/favicon/robots/anonymous guards PASS; 220 public responsive combinations PASS.

Executed on November 14 after resuming:

- Production: 41 tables / 77 FK actual orphan queries PASS again; zero invalid
  constraints/indexes, missing PKs, key/option/case/attempt integrity failures.
  Content/history/grant/ledger fingerprints match; the live new-account delta is
  disclosed above. Production remains READY at the original release commit.
- Repeated 12 local rollback drift/RLS/index assertions PASS after the CMS correction.
- Real local REST CMS reset/default readback/Student and anonymous denials PASS.
- Admin invitation, role assignment validation, Teacher session, deactivate,
  reactivate and demotion without course grants: five browser workflow groups PASS.
- Full Auth/signup/password-recovery/session story: three browser workflow groups PASS.
- Wallet CRUD and persisted signed amounts, CMS dirty/save/reload/already-open
  public update/confirmed reset: browser PASS; original CMS restored afterwards.
- Full learning-platform browser PASS: 23 screens x nine widths x two themes plus
  two landscape sizes = 460 screen/viewport checks. Admin specialty edit/assignment,
  shared generation/reorder/publish/archive/pagination, two independent Students,
  SHARED/PAST/RANDOM frozen/resumed order, independent scoring, locked RLS,
  checked green/red feedback, immutable checked answers and reduced motion PASS.
- Dependency audit rerun: zero vulnerabilities. Node 22.23.2 used for verification.
- Expanded responsive route audit PASS: 50 observed routes x 15 widths x two themes
  plus three landscape sizes = **1,650 checks**, zero overflow/application errors;
  includes all eleven requested widths, protected previews and dashboard/analytics.
  Drawer keyboard behavior, storage-denied system theme and manual theme toggle PASS.
- Signup/access approval/rejection/Teacher add-only and self-profile editing for
  all three roles: five additional local browser workflow groups PASS. Personal
  updates preserve role/status/expiration; nine widths and both themes tested.
- Five modified dialogs captured at 320/768/1366/1920 in both themes: 40 checked
  captures. Visually inspected wallet editor at 320 dark, CMS reset at 768 light,
  deactivate at 1366 dark, reactivate at 1920 light, plus shared exam at 320 dark
  and results at 768 light. Native scrolling/focus and original design remain intact.

Final expanded route matrix and final checks are recorded in section G. Older
release counts were not substituted for newly executed audit evidence.

Evidence artifacts remain ignored under `.test-artifacts/`: dated audit database
logs; `audit-final-*` logs; `audit-admin-users.json`, `audit-auth-browser.json`,
`audit-admin-workflows.json`, `learning-browser-results.json`, archive/chapter/
lesson/material results, public/route screenshots and dialog captures. Credentials,
email bodies and temporary invitation URLs are not committed. Local synthetic
fixtures are not claimed to prove real medical extraction accuracy or load capacity.

## F. Questions / recommended decisions

1. **Subjects access:** preserve the November 9 free Medical Subjects model, or use
   the approved Subject-group/package entitlements? Recommend confirming this before
   connecting Student reading/practice or changing published availability. Do not mix
   Subject questions into Colloquium/Prometric pools.
2. **Production fixes:** approve promoting the verified development code, applying
   the two isolated RLS/index + CMS reset migrations and enabling the matching Invite
   template, after a current recoverable backup and migration-aware plan are confirmed.
   No directory-wide migration push, historical repair or content reset is proposed.
3. **Historical content:** confirm Nursing Colloquium -> Nursing and identify the
   authorized reviewer/source signoff for the ten newly imported Subject questions.
   Recommend preserving IDs/history and completing review before broader publication.
4. **Infrastructure:** enable leaked-password protection if supported by your plan;
   choose an error-monitoring drain and a restore-verification process. These were not
   silently configured or marked as application test failures.

## G. Final validation and Git/production status

| Check | Observed result |
| --- | --- |
| `npm run typecheck` | PASS, November 14 |
| `npm run lint` | PASS, November 14 |
| `npm run build` | PASS, Next 16.4.6 / Node 22.23.2, November 14 |
| `node --test scripts/*.test.mjs` | PASS, 143/143, zero skipped |
| `npm audit` | PASS, zero vulnerabilities, November 14 |
| Existing isolated SQL/concurrency checks | PASS, 519 distinct assertions, November 11 |
| Hosted drift / pending RLS-index regression | PASS, 12 rollback assertions, repeated November 14 |
| CMS safeupdate / exact default / role denial REST test | PASS on isolated local Supabase |
| Local Auth / Admin / learning / profile browser suites | PASS as separately detailed above |
| Expanded local route responsiveness | PASS, 1,650 checks / 50 routes |
| Production public responsive browser | PASS, 220 combinations / 10 pages, November 11 |
| Production HTTP / favicon / robots / anonymous guards | PASS again November 14; 11 public routes, four referenced icon URLs, six portal guards |
| Fresh production FK/integrity checks | PASS, 77 foreign keys, zero violations |
| `git diff --check` | PASS; Windows LF-to-CRLF notices are not whitespace failures |

Production is still the Git-linked `main` release at [lhcc-lb.com](https://lhcc-lb.com),
verified READY with commit `5e51b034e021a6192db72c49793ac972aa3cbe9f`:
[exact production deployment](https://lhcc-portfolio-qpee49qm9-mahmoudkhaliljobdiva-8508.vercel.app).
The audit did not merge/promote to production, apply hosted migrations, configure
the hosted Invite template or send external test email. The requested delivery
scope is **`audit/full-project-2026-11-11`**, through normal Git integration only.
The final commit, push outcome and exact observed Git-triggered preview status
are provided in the accompanying handoff; a preview is not production acceptance.

### Remaining verification boundaries

- No physical Samsung S24 Ultra/Samsung Internet, Safari, assistive-technology or
  hostile penetration-test certification; Chromium checks are emulated layouts.
- No real external email delivery, representative authorized Arabic Psychiatry
  document extraction signoff, OCR, clinical correctness review or production-scale
  performance/load test. Local small-fixture timings are not production SLAs.
- Package buyers, Subject entitlement groups, accepted quote/payment/refund cases
  and Student lesson progress cannot pass E2E: those features do not exist yet.
- Production mutation tests for the two corrections and new Invite configuration
  remain **BLOCKED pending approval and verified recovery readiness**. No full
  hosted restore test or business-data backup was certified by this audit.
- Inventory/reference checks do not execute every conceivable argument permutation
  of 125 database functions or 47 actions. Actual exercised and denied flows are
  identified above; disconnected import/assets/groups remain explicitly unverified.

### Reproduction and safe release order

1. Use Node 22.23.2, `npm ci`, typecheck, lint, build and the Node regression suite.
   Do not load production credentials into local mutation runners.
2. Restore the preserved isolated `archive-db` stack and its ignored local fixture
   manifest. Point `LHCC_QA_SUPABASE_CLI` at an installed compatible CLI when needed;
   `scripts/qa-local-status.mjs` validates loopback targets. Test artifacts can carry
   local credentials and must remain ignored. Do not start a fresh production seed.
3. Use the versioned SQL tests, `audit-schema-regression.mjs`,
   `audit-cms-defaults.mjs --probe-rest-reset`, Auth/Admin browser runners and
   archive/material/lesson/chapter/learning/live/mobile suites. Runners with shared
   CMS/exam fixtures must not concurrently mutate the same records.
4. Before production corrections: confirm backup/restore readiness, inspect current
   migration history and new schema prerequisites, obtain the owner's approval,
   and apply only the two explicitly approved new migration definitions with proper
   history entries. Never replay `docs/audit/production-history/` or run a blanket
   migration push. The CMS migration itself performs no content reset.
5. Promote approved code through Git; enable only the matching Invite template
   after callback code is live. Verify the actual SHA/domain/status and approved
   narrow production checks. Keep existing Auth, RLS, content, grants and ledger
   history intact; no real payments are part of this audit.

### Changed-file groups

- Runtime security: `package.json`, `package-lock.json` and the existing version
  assertion in `scripts/production-audit.test.mjs`.
- Application corrections: Auth callback, shared ModalPanel, wallet page, portfolio
  editor, Admin user dialogs, Admin teacher-bank options and generated database types.
- Pending backend/configuration: the two new audit migrations, Invite email template
  and read-only SQL integrity audit. No existing migration was edited.
- Regression/QA: new `audit-*`, `auth-callback.test.mjs`,
  `teacher-assignment-options.test.mjs`, `qa-dialog-evidence.mjs`,
  `qa-local-status.mjs` and inventory scripts; targeted archive/backend fixture,
  material/learning/mobile/public-smoke harness updates.
- Documentation: this report, full route/action/function inventory, four captured
  already-applied schema-history definitions and `PROJECT_HANDOFF.md` checkpoint.

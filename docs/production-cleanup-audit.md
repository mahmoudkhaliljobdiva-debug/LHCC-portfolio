# LHCC production cleanup audit

Audit started: 2026-10-11. Resumed/release validation: 2026-10-17.
Repository: `mahmoudkhaliljobdiva-debug/LHCC-portfolio`.
Production: <https://lhcc-lb.com>. Starting commit: `e63a49348449be2bc3bebd937a4e3bab55d19f23`.
Architecture reference: [backend map](backend-map.md).

## Scope and classification

This is repository/configuration cleanup, not a redesign or database reset.
The starting `main` worktree was clean. No production database, Auth, storage,
RLS, migration, domain, environment-variable or account changes were made.
Browser mutations use the isolated local `archive-db` project only.

| Class | Findings and decision |
| --- | --- |
| A: production-required | Keep all live routes, three exam modes, practice/review, clinical cases, original branding, dynamic PDF reader/import, CMS, role/access guards, private answer storage, ledger, navigation/cache optimizations and responsive/theme utilities. |
| B: automated test infrastructure | Keep unit, Auth, RLS, grading, PDF, archive, shared-exam, mobile, performance and read-only production tests. Keep ignored private evidence/local fixtures. Modernize the course SQL test instead of deleting its coverage. |
| C: proven obsolete | Remove the tracked write-test marker, unreachable old start-exam component, superseded exam fixture generator, three ignored one-off debug scripts, and two unused packages. |
| D: review needed | Published About QA suffix, ignored historical secret/env copies and accumulated private evidence. No automatic deletion or production mutation. |

## 1-5. QA UI, debugging, mock data and removed files

No QA/debug/test dashboard, authentication bypass, debug API, demo navigation,
mock business-data import or hardcoded fake response was found in application
routes. Student testing/exam functionality is legitimate production software.
No temporary `console.log`, `console.debug`, `debugger`, fake-data identifier or
development URL was found in application source. Meaningful server-only
View-As actor/target audit events and generic Admin rollback errors are kept;
they do not log passwords, tokens, answer keys or service-role keys.

Tracked deletions (recoverable from Git history):

- `.chatgpt-write-test-2026-10-03.txt`: obsolete connectivity/write probe.
- `src/features/exams/start-exam-button.tsx`: no import/re-export/usage; current setup flow remains.
- `scripts/exam-qa-fixtures.mjs`: superseded by the isolated archive fixtures; the existing exam browser entry point already delegates to that suite.

Ignored local deletions (not recoverable from Git history):

- `.test-artifacts/theme-browser-debug.mjs`: one-off inspection covered by retained theme tests.
- `.test-artifacts/production-color-check.mjs`: one-off color probe, not application code.
- `.test-artifacts/prepare-mobile.mjs`: duplicate of maintained `mobile-qa-fixtures.mjs`.

No QA screenshots, PDFs, environment files or private manifests are public assets.
Other ignored evidence and user-owned local files remain untouched. No CSS,
legitimate assets or feature modules were removed merely for low/static usage.
`pdf-reader.ts` is dynamically imported and is not dead code.

## 6. Dependencies

Removed `class-variance-authority` and `date-fns`: no application, configuration
or maintained script imports. Kept PDF.js, Recharts and other used dependencies.
Patched Next.js and matching ESLint configuration to pinned `16.3.8`, compatible
with repository Node `22.23.2` and React 19. Supported transitive lockfile updates
include Sharp, PostCSS, nanoid, source-map-js, brace-expansion and js-yaml.
No forced audit fix, major downgrade or speculative override was applied.

`npm audit --omit=dev`: **0 vulnerabilities** (previously 5 affected packages,
including a critical Next.js finding). Full audit: **5 high affected packages**,
all propagated from the remaining `braces@3.0.3` development/lint chain. There
was no compatible patched release available during this audit; npm's suggested
ESLint-config major downgrade was rejected. Avoid untrusted lint/glob input and
recheck the upstream patch before the next release. This is not a clean full audit.

## 7. Production configuration cleanup

- Disable `X-Powered-By`; explicitly keep browser production source maps off.
- Add `nosniff`, strict-origin referrer policy, frame denial and scoped CSP:
  `frame-ancestors 'none'; object-src 'none'; base-uri 'self'`.
- The CSP is deliberately not advertised as a full script/nonce policy;
  Next hydration, Supabase, chart rendering and PDF workers remain usable.
- Preserve Vercel HSTS, cookie/session behavior, server-action body limits,
  authorization, private/no-store responses and recent request/cache improvements.
- Remove one stale Supabase proxy comment; no proxy behavior change.
- Guard legacy mutating QA clients and fetch instrumentation against remote
  targets/Vercel before initialization. Local app URL alone does not prove that
  its backend is isolated; Auth-browser mutations also check the Supabase URL.
- Separate new local manifests from historical production QA manifests and
  verify their exact origin. Convert the old cleanup script to read-only inventory;
  it no longer contains account, row, session or CMS deletion/update capability.
- Mark historical QA/provisioning notes as history, not current production seeding
  instructions. `supabase/seed.sql` remains empty executable SQL (comments only).

Public artifact requests were also inspected by body, not status alone. Existing
App Router streamed not-found documents can return HTTP 200 with `noindex` and
"Page not found"; these are not leaked files. No unrelated routing refactor was
made to change that existing behavior.

## 8. Security/configuration findings

- All 24 public/private application tables have RLS enabled. Anonymous private
  schema usage is denied. Existing public security-definer trigger functions are
  not executable anonymously. No migration or policy was changed.
- Server-only Supabase admin client/key boundary and role/RPC checks remain.
  Browser/application scans found no secret literals or public secret variable.
- Initial updated build: 55 browser JS files inspected, 0 browser source maps;
  45 function traces contained no QA script/artifact dependency. Private test
  tooling is not imported into the application.
- Supabase security advisor: existing WARN, leaked-password protection disabled.
  Recommend enabling it through an explicitly authorized Auth configuration task:
  <https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>.
- Performance advisors: 13 `unused_index` INFO findings on resumption (14 on
  October 11). Keep indexes: new/FK/
  shared-exam indexes cannot be proven obsolete from one quiet snapshot.
- Vercel metadata inspected without decrypted values: Supabase URL/anon key,
  server-only secret and site URL are configured; no QA instrumentation/debug flag
  is deployed. Project runtime remains Node 22.x. Domain/account settings unchanged.
- Preview shares production Supabase credentials. Recommend a separate staging
  project/credentials, rather than removing working variables during cleanup.
- Ignored `.env.qa.local` and `SUPABASE_SECRET_KEY.env.local` are historical/local
  copies, not application imports or tracked/public artifacts. Rotate any key
  previously shared in chat, then review obsolete local copies with the owner.
  Key rotation and deletion were not performed by this audit.

## 9. Production record requiring approval

| Field | Exact finding |
| --- | --- |
| Table | `public.portfolio_content` |
| Record ID / primary key | `section_key = 'about'` |
| Field | `content.description` |
| Published | `true` |
| Observed update time | `2026-09-28 16:16:42.867203+00` |
| Proven QA suffix | ` [TEST] QA 20260917-0b33a4 CMS persistence verified.` |
| Evidence | Exact run marker matches the historical private QA manifest and recorded CMS persistence workflow; not a guess based on a name/email. |
| Related records | One published CMS section; no user, bank, question, access or ledger relationship needs removal. |
| Removal impact | Only the public About description would lose its trailing QA suffix. The legitimate preceding description and all other CMS fields must remain. |

Observed description:

> We are building a calm, rigorous digital environment where healthcare learners and educators can focus on meaningful progress. [TEST] QA 20260917-0b33a4 CMS persistence verified.

**Untouched pending explicit approval.** Recovery plan (not yet executed or
represented as verified): capture the exact current full row in a private backup,
read it back and verify a checksum, then conditionally update only the suffix
if the current description/update time still match. Read back the result. Keep
the backup for a similarly guarded restoration; never overwrite concurrent edits
or reset the entire section/portfolio. Stop if the row has changed.

Historical manifest ID checks found zero surviving matches for 7 QA users/profiles,
4 QA banks, 10 QA questions and 3 recorded wallet transactions. No additional
conclusive QA user/bank/question candidate was found. The credential-free cleaned
historical exam marker is retained as evidence. No bulk/name-based deletion.

## 10. Production preservation

October 11 before/after read-only counts and sorted-row checksums matched across **28 groups**:
24 application tables, Auth users, storage objects, storage buckets and applied
migration history. Auth checksum excludes only natural sign-in/update timestamps.
No identities/IDs, credentials, options/keys or private records were exported to
the audit report. Snapshot summaries are not a backup or deletion authorization.

October 17 pre-release observed inventory: 5 Auth users/profiles, 1 Nursing bank, 100 canonical
questions/private solutions, 20 clinical cases, 4 attempts, 120 frozen questions/
solutions, 37 answers, 5 practice checks, 3 access grants, 3 requests, 2 ledger
entries, 4 CMS sections and 3 specialties. Existing zero source/past/shared rows
and zero PDF objects were not populated to make production tests pass. The private
PDF bucket and all 19 applied migration-history entries remain unchanged.
One additional answer exists compared with the October 11 snapshot (36 then,
37 on resumption); this audit did not insert it or attempt to undo intervening
production activity. A fresh 28-group read-only checksum baseline was captured
before the resumed release for the final preservation comparison.

## 11-13. Retained tests and validation

Node used for verification: **22.23.2**.
Typecheck/lint/build, all Node tests, dependency audit, browser-bundle/trace scan
and anonymous production backend checks were refreshed on October 17. SQL and
authenticated browser results below were completed on October 11 on this same
unchanged implementation; their private logs/JSON were recovered and retained.
Docker is stopped on the resumed machine, so those completed mutation suites
were not repeated or redirected to production.

| Check | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS, Next.js 16.3.8 |
| `node --test scripts/*.test.mjs` | 78/78 PASS, including 11 new production/QA guardrail tests |
| Rollback-only SQL suites | 199 checks PASS: course/access/CMS/ledger 38, exams 44, teacher 25, cases 11, yearly archive 32, learning platform 49 |
| Archive/PDF browser suite | PASS: upload/extract/review/draft/publish/retry, historical order, grading, resume, practice and authorization |
| Learning/shared browser suite | PASS: 23 screen states, specialties/CMS, pagination, generate/reorder/publish/archive, two-student independent scoring, all three exam modes |
| Whole-portal mobile suite | PASS: 35 routes, 15 widths, both themes, 3 landscape sizes; no reported layout/runtime issues |
| Additional workflow browser | PASS: real local signup/session/phone, request/approve/reject, assigned teacher add/view-only, all three roles' own-profile edits without privilege changes |
| `git diff --check` | PASS |

Course SQL coverage no longer assumes historical demo seeds/empty catalogs or
allows the retired correctness oracle. It now tests current protected practice
attempts and assigned-teacher access. This only changes test SQL, not migrations.
All browser writes and transactional tests run on isolated local Supabase.
The Node test runner emits an existing module-type detection warning for direct
TypeScript imports; tests pass. Package module semantics were not changed to
silence it. Git also reports ordinary Windows LF/CRLF conversion notices.

Representative mobile/tablet/laptop/desktop screenshots were visually reviewed.
These are Edge viewport/theme checks, not a physical Samsung Internet/device or
iOS Safari certification. Retain physical-device follow-up. The earlier recorded
local CMS Reset-to-Default safe-update guard issue is outside this cleanup;
CMS save/read passed, but production reset was not invoked or newly certified.

## 14-17. Performance and release verification

No application request/query/cache/middleware algorithm was changed. Dynamic PDF
loading, request memoization, parallel reads, paging, chart visibility and static
asset behavior remain. Removal of unused packages is not claimed as a runtime
bundle saving when they were already tree-shaken/not imported.

`scripts/production-audit.mjs before|after` records read-only public HTTP/body/
header/exposure checks and same-domain lab performance (Edge, cache disabled,
five samples after warmup at 390/1366px). Network-variable TTFB/DOMContentLoaded
and transferred JS bytes are not Core Web Vitals or guaranteed speed improvements.
Private JSON evidence is ignored, not bundled/committed.

Release through a normal `main` Git push only; no force push or duplicate manual
Vercel deployment. The final release handoff supplies the cleanup SHA, push
result, exact Vercel READY deployment link, domain-to-SHA verification, public
after-audit/performance comparison and runtime error scan. That post-push evidence
must be checked live rather than inferred from the local build or prior release.

## 18. Remaining actions

1. Obtain narrowly scoped approval and verify recovery before removing the About suffix.
2. Review leaked-password protection, key rotation/local copies and preview isolation separately.
3. Recheck the development-only `braces` advisory for a compatible patch.
4. Reproduce/fix the previously recorded local CMS reset guard in a focused task; no production reset for QA.
5. Complete physical Samsung Internet/iOS Safari checks and establish routine retention for ignored private QA evidence.

## Changed-file inventory

Besides the deletions listed above:

- `next.config.ts`, `next-env.d.ts`, `package.json`, `package-lock.json`.
- `src/lib/supabase/proxy.ts` (stale comment only).
- `scripts/qa-safety.mjs`, `production-audit.mjs`, `production-audit.test.mjs`,
  `production-cleanup-browser.mjs` (new).
- `scripts/backend-qa-data.mjs`, `backend-qa-cleanup.mjs`, `course-browser-test.mjs`,
  `local-fetch-metrics.mjs`, `archive-db-tests.mjs`.
- `supabase/tests/student_course_access.sql`; `supabase/seed.sql` (comments only).
- `README.md`, `PROJECT_HANDOFF.md`, `docs/backend-qa.md`,
  `docs/supabase-phase3-test-accounts.md`, this audit document.

No working application UI was redesigned. No applied migration, schema, RLS,
Auth implementation, production data or source-PDF content was modified.

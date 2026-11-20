# Mobile compatibility and performance audit

Date: 2026-10-11. Baseline: `24efd276db11e2a3a494fa17b448af4a9a52ca80`.
Production: https://lhcc-lb.com. This audit preserves the yearly archive, PDF review,
clinical cases, real Supabase backend, and approved LHCC design.

## Findings and fixes

- Dark mode previously remapped utility classes but left background, foreground,
  surface and border tokens light. Shared tokens now follow the selected theme,
  including default dividers, chart grids, native controls and tooltip surfaces.
- Chart labels/lines now have dark-theme colors; chart drawing animations are off.
- Keyboard focus rings use solid theme-aware colors instead of translucent coral.
- Root viewport declares `light dark`, device width and safe-area support. Selected
  light mode uses `color-scheme: only light`; selected dark mode uses `dark`.
  This is standards-based, not a Samsung-specific guarantee. MDN documents
  [only light for automatic recoloring](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme).
- Initial system-theme detection and the toggle work when storage throws. Other
  tabs apply changed preferences, and system changes are followed unless the user
  saved an explicit preference. Only the theme preference uses localStorage.
- Portal drawers are inert when closed on mobile, contain keyboard focus, close
  with Escape, restore focus and lock background scrolling. Desktop navigation
  remains available after resizing. Public menus also support Escape and scroll
  within short landscape viewports.
- Compact sidebar branding, shrinking search fields and truncated long account
  names prevent navigation crowding. Existing gutters are preserved, with safe-area
  additions scoped to layout shells rather than global overflow-hiding.
- The user editor uses a reusable native top-layer dialog, scroll containment,
  viewport bounds, focus restoration and disabled dismissal during saving.
- Users table activity summaries have an explicit contained column width instead
  of wrapping each short summary over many lines. Usage lookup is indexed once
  per supplied summary set instead of rescanning it for every displayed user.
  The default table-cell minimum is in Tailwind's base layer so it no longer
  overrides intentionally sized responsive columns.
- Touch/coarse-pointer devices stop decorative hero glow, rotation and heartbeat
  loops, alongside the existing disabled mobile effects. Reduced-motion support
  remains. No Lordicon integration was found; none was added.
- Status RPC results are deduplicated with React.cache **within one server render**,
  keyed by status, role and expiration. Profile/identity lookup is reused for admin
  authorization. Explicit transaction clients remain uncached. New requests still
  revalidate identity, database role and expiration; no shared private cache exists.
- The complete admin question/answer provider is scoped to `/admin/question-banks`.
  Users receives only bank IDs/names via a separately authorized, paginated query;
  teacher assignment controls remain functional. Other admin routes no longer
  download all editor answer keys. Student bank reads are request-deduplicated.

## Measured before/after

Production-mode `next build`/`next start`, Node **22.23.2**, isolated local Supabase,
headless desktop Edge at **412 x 915 CSS pixels**, CDP configured for 4x CPU,
150 ms latency, 200,000 bytes/s down and 93,750 bytes/s up. Same local business
fixtures, three full navigations per route in each run. Authentication primed the
private-route assets. These are small **lab samples**, not cold-start benchmarks,
physical-device measurements, production-network latency or field p75 results.

Entries include automatic prefetches. Transfer bytes are browser Resource Timing
encoded transfer totals (cached assets contribute zero). Server request counts
are timestamp-window measurements of local Supabase fetches, including prefetch
activity. HTTP duration sums overlap and **are not database execution times**.
Raw local reports/screenshots and credentials stay ignored in `.test-artifacts`.
The measurements were captured after the query/layout changes and before final
focus-ring, table-spacing and storage-denied preference polish; byte totals describe that measured
build, not a promised exact payload size for subsequent releases.

Each cell is before -> after; times are median milliseconds of three samples.

| Route | Load | TTFB | LCP | Browser requests | Transfer bytes | Supabase requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Homepage | 419 -> 750 | 28 -> 21 | 376 -> 508 | 20 -> 18 | 23,834 -> 21,068 | 1 -> 1 |
| Login | 451 -> 285 | 21 -> 15 | 316 -> 260 | 28 -> 26 | 22,878 -> 23,351 | 0 -> 0 |
| Student dashboard | 790 -> 438 | 80 -> 50 | 956 -> 644 | 28 -> 28 | 26,766 -> 27,162 | 23 -> 19 |
| Question banks | 417 -> 400 | 58 -> 56 | 616 -> 620 | 26 -> 26 | 18,917 -> 19,276 | 8 -> 7 |
| Bank details | 283 -> 320 | 88 -> 52 | 612 -> 680 | 24 -> 24 | 19,963 -> 20,321 | 4 -> 3 |
| Exam setup | 387 -> 360 | 74 -> 57 | 648 -> 320 | 27 -> 27 | 19,705 -> 18,068 | 4 -> 3 |
| Active exam | 270 -> 458 | 59 -> 62 | 556 -> 352 | 30 -> 30 | 24,431 -> 24,979 | 4 -> 3 |
| Exam result | 357 -> 319 | 72 -> 52 | 636 -> 584 | 24 -> 24 | 21,847 -> 22,832 | 4 -> 3 |
| Admin dashboard | 465 -> 460 | 164 -> 108 | 680 -> 616 | 26 -> 23 | 29,949 -> 20,557 | 22 -> 18 |
| Admin users | 408 -> 382 | 128 -> 54 | 708 -> 736 | 26 -> 27 | 28,121 -> 21,468 | 15 -> 13 |

| Route | Sum of local Supabase HTTP durations (ms) | Status RPCs |
| --- | ---: | ---: |
| Homepage | 15.5 -> 7.6 | 0 -> 0 |
| Login | 0 -> 0 | 0 -> 0 |
| Student dashboard | 826.7 -> 482.7 | 5 -> 1 |
| Question banks | 89.9 -> 85.0 | 2 -> 1 |
| Bank details | 85.8 -> 34.4 | 2 -> 1 |
| Exam setup | 71.9 -> 38.1 | 2 -> 1 |
| Active exam | 56.2 -> 50.1 | 2 -> 1 |
| Exam result | 57.7 -> 33.0 | 2 -> 1 |
| Admin dashboard | 894.3 -> 669.4 | 4 -> 1 |
| Admin users | 287.4 -> 235.9 | 4 -> 1 |

The reproducible structural improvements are fewer status RPCs and no complete
bank-editor fetch on unrelated admin pages (1 -> 0). Admin dashboard transfer fell
31%; Users transfer fell 24%; sampled Student dashboard load fell 45%. **Not every
timing improved**: homepage, bank-details and active-exam load were higher. Three
samples and prefetch/cache behavior do not establish statistically significant
speedups or regressions. No claim that the whole site is uniformly faster is made.
Sample CLS was **0 on all measured navigations**. All after median LCP samples were
below 2.5 s, but this does not establish production p75. INP, hydration CPU cost,
native query execution time and cold private-route bundle totals were not measured.
The first homepage JS transfer was 170,252 -> 170,613 bytes; most subsequent assets
were cached. No large dependency or third-party script was added.

## Responsive and functional coverage

The pre-change overflow baseline passed, so the responsive foundation was retained.
The browser suite covers 35 real routes: public home/About/Services/Platform/Contact,
login/signup/password reset; Student dashboard/list/details/archive/setup/active
exam/result/progress/analytics/profile/account settings; Teacher dashboard/questions/
banks/details/profile; Admin dashboard/users/list/bank detail/question create/edit/
PDF archive/access requests/portfolio/wallet/settings.

Widths: **320, 360, 375, 390, 412, 430, 480, 600, 767, 768, 900, 1024, 1366, 1440,
1920**. Both themes; landscape **915 x 412, 844 x 390, 1024 x 768**. This is 1,155
route/theme/orientation combinations, plus drawer, restricted-storage and user-dialog
interactions. Screenshots cover mobile/tablet/laptop/desktop. Tables retain contained
horizontal scrolling. Existing archive browser tests separately exercise navigation,
save/retry, resume, submission, scoring, PDF import/review and read-only preview.

**412 x 915 is representative Android emulation, not a verified S24 Ultra viewport.**
Only desktop Edge is installed for this audit. Samsung Internet, Safari, Chrome
Android, Edge Android and physical S24/S23/S25/A-series/iPhone testing are unavailable.
Forced Samsung recoloring may override author colors even with correct CSS. It must
not be described as fixed until observed on the device.

## Focused device checklist (remaining)

1. Open production on S24 Ultra, then S23/S25/A-series and iPhone where available.
   Record browser/version, OS, zoom/text scale and actual `innerWidth`, `innerHeight`,
   `document.documentElement.clientWidth` and `devicePixelRatio`; do not use physical
   screen resolution as the CSS viewport.
2. Test portrait and landscape with address bar expanded/collapsed and keyboard open.
   Check notches, gutters, long case text, all four option rows and submission dialog.
3. Test OS light/dark with no saved preference; explicitly choose each LHCC theme.
   Repeat Samsung Internet "Dark mode for websites" OFF and ON. Check background,
   text, icons, select/date pickers, selected answers, chart tooltip and disabled/error
   states. If forced recoloring breaks colors, turn that browser setting OFF for
   the site and retain LHCC's own theme; record the exact combination and screenshot.
4. Open/close navigation, scroll tables/dialogs, change archive year/search, start
   an approved exam, save an answer, navigate/reload/resume, submit and inspect results.
   Use authorized test accounts/data only; never discard a real learner's attempt.
5. Repeat in Android Chrome/Edge and iPhone Safari. Report browser-specific failures
   rather than treating Chromium emulation as those browsers.

## Security, preservation and follow-up

No schema, migration, RLS, private solution storage, scoring, ledger or production
record changes. No production test accounts/data were inserted. All fixture work
and rollback-only SQL tests ran in the explicitly isolated `archive-db` container.
Authentication still verifies claims; authorization uses the server-fetched database
profile, not user-editable metadata. Explicit login transaction clients and mutating
RPC guards remain intact. [Supabase auth guidance](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs)
was checked; no dependency upgrade was necessary.

Existing pagination/parallel fetches, route loading boundaries, persisted question
snapshots and the random-exam 30-question cap are retained. The student overview
still retrieves a bank summary RPC per approved bank, and admin bank-management
pages still load their full editor dataset. Future large-data profiling may justify
a guarded aggregate RPC and bank-scoped editor pagination; neither was introduced
without an actual large-data benchmark or a schema change requirement. No speculative
indexes or blanket public caching were added. Production RUM/p75 verification and
physical Samsung forced-dark testing remain infrastructure/device follow-ups.

## Validation and release

Validation uses Node 22.23.2: typecheck PASS, lint PASS, production build PASS,
unit suite **59/59 PASS**, **112/112 rollback-only SQL checks PASS**, mobile browser
suite **1,155 combinations PASS**, drawer/storage/user-dialog interactions PASS,
and full PDF/archive/exam browser regression PASS. Release status is recorded in
the release handoff. After the final table base-layer fix, eight table/data routes
passed another **192 width/theme combinations**; focused checks also verified
the 180px usage column, bounded teacher-assignment dialog, drawer Tab/Escape
behavior and disabled coarse-pointer decorative loops. Node's
existing `MODULE_TYPELESS_PACKAGE_JSON` test warning is informational; package
module semantics were not changed merely to silence it.

To repeat the audit, start the existing isolated archive database and use
`archive-qa-fixtures.mjs setup --fresh`, then `archive-browser-test.mjs` to create
reviewed archive/results fixtures, then `mobile-qa-fixtures.mjs`. Load the ignored
`archive-qa.env` into the **local test process only**, build with Node 22.23.2 and
start Next on port 3100 with `NODE_OPTIONS=--import=./scripts/local-fetch-metrics.mjs`.
Run `mobile-performance-audit.mjs before` before application changes and `after`
after rebuilding the same fixtures; run `mobile-ui-audit.mjs after` for the full
viewport/theme/interaction sweep. Keep credentials/env/reports ignored. Restore
the normal production build environment before release validation.

Use normal Git push and existing Vercel auto-deployment; verify exact SHA, READY
status, https://lhcc-lb.com routing, public smoke and runtime logs. Do not manually
deploy or claim device/p75 results that were not observed.

## Changed files

UI/theme: `src/app/layout.tsx`, `src/app/globals.css`,
`src/app/(public)/layout.tsx`, `src/app/(auth)/layout.tsx`,
`src/components/ui/{brand,theme-toggle,modal-panel}.tsx`,
`src/components/charts/performance-chart.tsx`, `src/lib/theme.ts`,
`src/hooks/use-mobile-navigation.ts`,
`src/layouts/dashboard-layout/dashboard-shell.tsx`,
`src/layouts/public-layout/public-header.tsx`,
`src/features/users/admin-user-dialogs.tsx`.

Data scope/authorization: `src/app/admin/layout.tsx`,
`src/app/admin/question-banks/layout.tsx`, `src/app/admin/users/page.tsx`,
`src/features/users/admin-users-page.tsx`, `src/lib/auth/{admin,server}.ts`,
`src/lib/bank-access/server.ts`.

Tests/evidence: `scripts/qa-browser.mjs`, `scripts/theme.test.mjs`,
`scripts/local-fetch-metrics.mjs`, `scripts/mobile-qa-fixtures.mjs`,
`scripts/mobile-performance-audit.mjs`, `scripts/mobile-ui-audit.mjs`,
`docs/mobile-performance-audit.md`.

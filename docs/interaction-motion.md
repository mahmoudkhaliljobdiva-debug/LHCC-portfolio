# App-like interactions and save efficiency — 2026-11-15

## Scope

Reference: the owner's `Recording 2026-11-14 192700.mp4` (5.33 seconds), inspected
across the full clip. Reused its moving navigation highlight, compact icon rail
and subtle interaction feedback while retaining LHCC colors, typography,
responsive foundation and light/dark modes. No financial-dashboard content,
new business rules, animation dependencies or source-question population.

## Implementation

- `PortalNavigation`: one sliding highlight, keyboard focus and hover feedback,
  nested-route selection, accessible icon labels and real Next Link pending
  feedback. Existing automatic prefetching remains in use; no forced prefetch
  of every protected page. Preview context-boundary anchors remain full renders.
- Dashboard sidebar: optional desktop compact rail, 44px navigation targets and
  short width/content transitions. Mobile retains the existing inert drawer,
  keyboard containment, scroll lock, safe areas and focus restoration. Compact
  state is transient UI state, not database or localStorage business data.
- Public mobile menu: collapsible transition instead of a display toggle; closed
  controls are inert and hidden from assistive technology. Escape restores focus.
- Shared native dialogs: short entrance, mobile bottom sheet, independent scrolling
  and sticky mobile close control. Native focus containment/restoration remains;
  saving blocks close and duplicate submission. No artificial closing delay.
- Shared `PendingButton`: spinner, disabled state and accessible busy/status text
  tied to real requests. Used for profile, material, Subject question and Portfolio
  saves. Feedback never claims success before the server confirms it.
- Short page, feedback, theme-icon and press transitions. Motion uses CSS rather
  than a new animation runtime; decorative hover motion is restricted to a fine
  pointer. Reduced motion disables these transitions/animations, including spinners,
  without hiding feedback or delaying functionality.

Profile, material and Subject mutation UIs no longer call `router.refresh()` after
their Server Actions already revalidate the affected path/layout. Responses still
come from Supabase; authorization, RLS, validation, private keys and realtime
reconciliation are unchanged. No production schema or business-data writes.
See [Next revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
and [Link pending state](https://nextjs.org/docs/app/api-reference/functions/use-link-status).

## Save measurement

Three real profile saves per version, production-mode local Next build against
isolated local Supabase, no network throttling. Each save issued one write.

| Follow-up work per save | Before | After |
|---|---:|---:|
| Explicit/reconciliation RSC GETs | 2 | 1 |
| Live-state reconciliation POSTs | 1 | 1 |

Median UI feedback stayed around 0.22–0.24 seconds across local runs, including
repeat measurements. This variation is not evidence of a production speedup.
The verified improvement is removing one unnecessary page fetch per save while
retaining the legitimate realtime reconciliation. No percentage claim is made
about database writes, production latency or a physical Samsung device.
Measurements: `scripts/interaction-timings.mjs before|after`; ignored detailed
artifacts contain only request metadata/timings, never credentials or bodies.

## Next speed improvement (not applied)

Read-only connected-service inspection found Supabase in `ap-northeast-1`
(Tokyo) and the existing production Vercel deployment in `iad1` (Washington,
D.C.). This geographic separation is a likely source of avoidable server-to-DB
latency, not a measured share of total request time. Evaluate Vercel functions
near the current database, such as Tokyo, in a controlled deployment and compare
authenticated p50/p95 timings before changing production routing. Do not move
the production database or add cross-user/private-data caching for this UI task.
See [Vercel function regions](https://vercel.com/docs/functions/configuring-functions/region).

No hosting plan upgrade, paid monitoring service, region change, service worker
or offline caching of protected health/learning data is included. Request-scoped
Auth deduplication and existing loading boundaries already exist; they were not
reimplemented. Next useful evidence is sanitized action/DB latency and field
interaction metrics, not adding more animation libraries.

## Verification and continuation

Use Node 22.23.2. `scripts/motion.test.mjs` covers routing and motion/save guards;
`scripts/motion-browser.mjs` verifies public menu, sidebar/compact navigation,
touch drawer, native question dialog, reduced motion and actual pending saves.
It covers 320, 375, 390, 430, 768, 1024, 1366, 1440 and 1920px, two themes and
two landscape sizes, using isolated fixtures. Existing Subject CRUD and metadata
browser suites verify server revalidation still updates saved/deleted content.
Screenshots are visually inspected; this is Chromium/Edge emulation, not a
physical Samsung Internet or Safari device claim. Production checks remain
read-only. Final execution results and exact Git/Vercel SHA are in the release
handoff; no duplicate manual Vercel deployment.

Acceptance completed: typecheck, lint, production build and 148 unit tests pass.
The motion browser suite passed 120 viewport/theme/landscape checks across six
screens, plus keyboard, native Escape, focus restoration, sticky mobile close,
reduced-motion and real-save workflows. The Subject suite passed 192 responsive
checks with create/edit/delete and Student authorization, and the independent
metadata-save regression passed. Initial form focus was explicitly preserved
when the mobile-only close control disappears at a desktop breakpoint.

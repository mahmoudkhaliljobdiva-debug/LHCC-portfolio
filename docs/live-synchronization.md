# LHCC live synchronization

Implemented 2026-10-19, extending the existing Supabase source-of-truth architecture.

## Existing approval architecture

Public signup creates an ACTIVE STUDENT without bank grants. There is no separate
account-activation request table/workflow. This release preserves that approved
behavior: Pending/Approved/Rejected refer to the existing material-access requests.
Admin account disable/reactivate/role changes now reach active sessions too.
No duplicate request or notification system was introduced.

Requests use `user_bank_access_requests`, `request_bank_access`,
`review_bank_access` and the existing Server Actions. Approval atomically creates/
updates `user_bank_access` and the existing signed ledger. The new guarded
`revoke_bank_access` changes only the active grant, retaining requests, attempts
and financial history. Revoked approvals are distinguished in the Admin UI.

## Transport and source of truth

- Database triggers emit private Broadcast invalidation hints after committed
  changes. Transaction rollback does not publish a successful approval.
- One root `LiveSyncProvider` owns a singleton client connection and at most three
  channels: `lhcc:user:<auth.uid()>`, `lhcc:catalog`, and (Admin only) `lhcc:admin`.
- Events contain only an allowlisted kind and optional bank/attempt identifiers.
  No row images, personal details, financial values, question text or keys.
  Supabase can append its own transport message UUID.
- The receive-only `realtime.messages` policy binds BOTH requested and row topic,
  and checks the current database Admin role. There is no client INSERT policy.
- Postgres Changes was not chosen: exposing whole business rows is unnecessary,
  DELETE authorization is less suitable, and per-card subscriptions do not scale.
  No business table was added to a Realtime publication.
- Events only cause an authenticated Server Action / guarded RPC snapshot read.
  Final authorization and grading are never derived from event payloads.

## Reusable components and invalidation

`lib/live-sync/routing.ts` centralizes scope matching and hint validation.
`actions/live-sync.ts` validates scopes and returns only the user's role/effective
status, a private revision string and current route's authorized access boolean.
The root provider coalesces bursts for 250ms, serializes reconciliation, queues
events arriving during a read, ignores stale-path responses and cleans up
channels, listeners, timers and auth subscriptions on teardown.

Current-session mutations retain their existing confirmed-response refreshes;
they do not wait for a socket event or optimistically grant permissions.
Remote updates refresh current RSC data, not the entire browser document.
Admin Users now accepts fresh server props instead of retaining stale copied data.
Open editing forms are not automatically discarded by a background refresh.

## Covered workflows

| Workflow | Live behavior |
| --- | --- |
| New requests | Admin's open request queue refreshes. |
| Approve/reject/revoke | Student dashboard, catalog, bank cards/details and open learning routes reconcile; approved actions appear only after confirmed reads. |
| Account/teacher assignments | Affected session updates role/status/access; disabled sessions leave protected routes; reactivation restores the workspace. |
| Bank/specialty publication | Authenticated catalog views update; unpublished content remains protected. |
| Past/shared publication | Eligible lists update without altering already-frozen attempts. |
| Questions/cases | Relevant bank views update, not frozen question sets. |
| Exam save/check/submit | Only the owning user's sessions receive progress hints. Submission additionally invalidates Admin and assigned-teacher reporting metadata. |
| Wallet | Admin ledger/analytics refresh from confirmed rows; no Student wallet introduced. |
| Portfolio | Authenticated public/CMS views refresh; anonymous public pages reconcile a cached revision endpoint. |

No separate Teacher/Admin application-request workflow exists; this release does
not grant teachers approval privileges or invent a second approval system.
The existing notification bell is not a stored notification feed. Feedback uses
the current badges, a short reduced-motion-aware checkmark, and connection status.

## Recovery, revocation and performance

Reconnect, online, focus and visibility restoration reconcile authoritative state.
A visible-tab 60-second revision-only safety check catches missed messages; hidden
and offline tabs do not poll. It does not repeatedly fetch entire dashboards.
Anonymous public pages use the same visible-tab interval and `/api/live/catalog`,
cached for 10 seconds, rather than a permanent public WebSocket connection.
The Supabase browser/WebSocket bundle is dynamically loaded only for an
authenticated identity, keeping anonymous portfolio startup lightweight.

`private.live_revisions` is a small RLS-protected infrastructure counter table:
indexed topic lookups replace repeated scans/counts of users, grants and attempts.
Broadcast outages do not invalidate a legitimate business transaction; the
committed revision remains available for reconciliation. Cached subscriptions
cannot authorize a protected operation, even before their channel disconnects.

When a fresh snapshot denies access, the protected subtree is unmounted, removing
loaded learning state. Backend guards deny actions immediately on revocation.
Offline devices cannot remotely erase already-delivered content; on reconnect
they reconcile before receiving current access, and RLS/RPCs remain authoritative.

## Exam concurrency

An additive `question_attempts.answer_version` increments on answer writes,
including older clients. The new versioned save locks the same existing access
and attempt rows, checks the expected version, then calls the existing trusted
save implementation. A stale version returns a distinct safe conflict error.
The UI preserves the unsaved selection/error, offers an explicit latest-answer
review, and never silently retries a stale write over another tab's answer.
Fresh server props reconcile saved answers without moving the current question;
older snapshots cannot replace a newer acknowledged version. Existing frozen
questions, scoring, checked-practice immutability and deadlines are unchanged.

Legacy save RPCs remain available for rolling compatibility, but the current
application always uses versioned saves. An older, already-open pre-release
client does not gain the new conflict UX until it loads the current application.

## Migration and safety

`20261019173647_live_synchronization.sql` adds private counters/triggers,
receive-only Realtime authorization, revision/metadata RPCs, guarded revocation
and exam versioning. It does not reset/reseed/delete business data or modify
existing business RLS policies. Answer keys remain private. Anonymous private
schema usage is NOT granted; the anonymous counter wrapper uses the repository's
existing pre-bound SQL `BEGIN ATOMIC` invoker pattern.
The CLI-created file was aligned to the actual version returned by Supabase
after applying the new migration; no previous migration/history was rewritten.
Advisors report an informational no-policy notice on the new private counter
table: its deny-all RLS and revoked direct grants are intentional; only guarded
functions can read it. The pre-existing leaked-password-protection warning is
unchanged. No anonymous private-schema usage was granted to silence an advisor.

Use `scripts/live-sync-db.mjs` only with the explicitly labelled `archive-db`
container. The browser and transport suites reject remote backend URLs. Private
reports and credentials belong in ignored `.test-artifacts`, never Git.

## Verification evidence

- 86 Node tests, including eight live-sync routing/security/concurrency checks.
- 199 existing rollback-only SQL checks retained; 20 additional live-sync checks
  pass (the combined course/live test reports 58).
- Real local Broadcast own-topic join/delivery and explicit other-user denial.
- Independent browser sessions: new request, approval in both Student sessions,
  rejection, revocation of already-open material plus backend denial, missed-event
  reconnect, shared publication, cross-tab answers/conflicts and account status.
- Initial local measured request propagation: 835ms; approval to both Student
  sessions: 870ms. These are local lab observations, not production latency SLAs.
- Repeat after deferred client loading: 831ms request, 849ms approval. The actual
  connection/performance test observed zero anonymous WebSockets, one authenticated
  WebSocket retained across SPA navigation, and one reconciliation fetch for five
  rapid focus events (no duplicate connections or five-fold refresh burst).
- Approval, shared list and exam screens checked at 320, 375, 390, 430, 768,
  1024, 1366, 1440 and 1920px in both themes; representative screenshots retained.
- Physical Samsung Internet sleep/dark mode is not claimed from Edge emulation.
- Production test authorization is limited to one temporary Student and one empty
  QA bank, with cleanup of only generated IDs/sessions. No temporary Admin account
  or changes to existing users are authorized. The final handoff records release
  SHA/READY deployment, production test result and post-cleanup preservation checks.

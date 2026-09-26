# Admin portal preview

The active authenticated actor remains ADMIN. The viewed subject is a separate
server-validated STUDENT or TEACHER profile; preview never changes Auth cookies,
logs in as a subject, or stores an impersonation role in browser storage.

## Routes and authorization

- `/admin/view-as/student` and `/admin/view-as/teacher`: searchable selectors.
- `/admin/view-as/{role}/{userId}`: subject dashboard.
- Subject navigation remains beneath that route (analytics, banks, profile, etc.).
- Each server data entry point calls `authorizeActiveAdmin()`, validates the UUID,
  and verifies the target's real profile role before privileged reads.
- Invalid/missing/wrong-role targets return a controlled 404. Non-admin actors
  remain blocked by existing server guards. No schema, RLS, or Auth changes.

## Data and safety

Normal portals retain caller-session queries and RLS. Private shared readers
reuse the existing dashboard calculations. Explicit admin preview wrappers
validate actor/subject before creating a server-only administrative client.
Student attempts, answers, grants, and requests are scoped to the subject;
question visibility additionally requires active bank/question and a grant.
Question content uses the existing explicit safe field/option allowlist, never
the private solutions table. Inactive/expired subjects show an access state,
not a functional learning portal.

Teachers currently see institution-wide reporting. Preview uses the selected
teacher's identity with the same reporting scope; it does not invent assignments.

Access requests and answer submission are disabled and explain read-only mode.
Existing backend writes still require the real STUDENT actor: enabling a DOM
control cannot turn the ADMIN session into that student. Management stays in
existing admin workflows. Exit returns to `/admin`; public Dashboard also remains
`/admin`. Refresh re-authorizes from the route, without client preview state.
Leaving/changing subject context uses intentional document navigation to avoid
reusing a stale nested Next router tree. Browser session cookies remain intact;
normal non-preview navigation remains unchanged.

The persistent banner names both identities. Server logs emit `VIEW_AS`,
`actor_user_id`, `target_user_id`, target role, and `read_only: true`; logs contain
no passwords/tokens/emails/solutions. They use existing platform runtime logging,
not a duplicate database audit system.

## Directory and verification

Selectors return 20 profiles per page, role-filtered in the database, with name,
email search and profile-status filters. Effective status is displayed. Auth's
admin API has no email-search filter, so search scans Auth pages server-side;
only the matching profile page is returned to the browser. At much larger scale,
an admin-protected indexed directory would avoid this scan; none is added here.

`scripts/portal-preview-test.mjs` compares real normal-portal rendering with
preview for five existing student QA identities and the existing teacher. It
checks role denial, invalid targets, session preservation, change/exit, refresh,
five responsive widths in light/dark, disabled writes, read-only RLS regressions,
and business-data fingerprints. Run with `.env.local`; set `LHCC_TEST_URL` to
`https://lhcc-lb.com` for production. Credentials stay in the ignored QA manifest.
There is only one existing teacher, so Teacher A-to-B switching cannot be tested
without a second account; selector reopening/reselection is tested.

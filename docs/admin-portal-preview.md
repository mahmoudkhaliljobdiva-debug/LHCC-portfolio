# Admin selected-user portal access

## One selection workflow

The public homepage's existing portal cards are role-aware. For ADMIN, Student
portal opens `/admin/users?role=STUDENT`, Teacher portal opens
`/admin/users?role=TEACHER`. The redundant Admin portal card is removed; the global
Dashboard link still opens `/admin` for admins. Student/teacher own
portal links and anonymous login behavior are unchanged. The global Dashboard
button always returns to the authenticated actor's own dashboard.

Selection reuses the real Supabase-backed Users table, existing search, status,
role filters, and management actions. Query parameters initialize the role filter
on both navigation and refresh; changing that filter updates the URL. Every
student/teacher row has a labeled Open Portal action. No separate directory,
selector table, or admin portal switcher remains. Old selector bookmarks redirect
to the same filtered Users page after admin authorization.

The Users table horizontally scrolls at all screen sizes. Its first User column
and header are sticky on the left, 200px wide, with opaque light/dark backgrounds,
matching hover/selected styling, and higher stacking order. Names wrap at words;
roles, statuses, dates, and portal labels remain intact. The scroll region is
keyboard-focusable. Existing account management actions remain available.

## Actor and subject security

The authenticated actor stays ADMIN; the selected subject is a separately
validated STUDENT/TEACHER. Selected-user routes remain under
`/admin/view-as/{role}/{userId}`. Each server entry point authorizes an active
admin and validates the target UUID, existence, and expected profile role before
privileged reads. Normal portals retain their caller-session queries and RLS.
No Auth, RLS, schema, migration, or service-key changes are needed.

The persistent banner identifies the selected user and signed-in administrator.
Back to Students/Teachers returns to the corresponding filtered Users table;
Exit View returns to Admin. Context-boundary links use document navigation to
avoid reusing stale nested router trees, while preserving session cookies.
Back to Website retains ADMIN identity; the public Dashboard link stays /admin.
Refresh revalidates server-side from the route, not browser storage.

Student data is scoped to the subject's attempts, answers, requests, and grants;
question visibility requires active bank/question and an active grant. Question
content uses the existing safe allowlist, never private solution data. Inactive
or expired subjects get an access-state message. Teachers see only assigned active
banks and their questions. Admin teacher previews can inspect those questions but
cannot use the teacher's add form. Institution-wide teacher reporting is removed.

Personal requests and answer submission are disabled with read-only explanations.
Existing backend guards reject such writes by the real ADMIN actor, regardless
of browser DOM changes. Management remains in Admin workflows. Server runtime
logs identify VIEW_AS, actor_user_id, target_user_id, role, and read_only without
passwords, tokens, emails, or answer keys.

## Verification

`scripts/portal-preview-test.mjs` verifies homepage-to-Users flows, role filters,
row portal actions, return links, session preservation, subject-data equality for
five existing student QA accounts and the teacher, invalid targets/non-admin
security, RLS read regressions, disabled actions, and unchanged business-data
fingerprints. Sticky geometry, scrolling, readable column styles, selected-row
backgrounds, and light/dark layouts are tested at 390, 430, 768, 1024, 1366, 1920px.
Credentials remain in the ignored QA manifest. Set LHCC_TEST_URL to
https://lhcc-lb.com for production; otherwise it targets localhost:3100.

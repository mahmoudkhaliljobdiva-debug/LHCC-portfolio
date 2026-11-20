# Student account and course access

## Behavior

Supabase Auth owns email/password verification. The profile selects the portal.
Public signup always creates an ACTIVE STUDENT with no activation dates and no
course grants. ACTIVE students have no account expiration. INACTIVE and explicitly
EXPIRED accounts remain blocked. Teachers retain expiration checks using database
time; administrators retain active-account and role checks.

No existing profile is bulk activated. An administrator must review any previously
disabled student; the migration cannot infer whether an old INACTIVE record meant
pending signup or an administrative suspension.

The admin user editor now stores no activation period for students. Re-enabling a
student does not approve any courses. Existing legacy student activation columns
are preserved but no longer determine access when the stored status is ACTIVE.

## Database authority

`question_banks` is the catalog, initially seeded from the six existing defaults
(microbiology remains inactive). The existing admin editor now saves this catalog
and questions through authenticated server actions and admin-checked RPCs.
Browser-local demo edits are not imported automatically: they are untrusted,
browser-specific data. They remain in the old browser storage for manual recovery.

`user_bank_access_requests` keeps each request and decision. No row means LOCKED;
PENDING, APPROVED and REJECTED are stored states. A partial unique index prevents
multiple PENDING requests for the same student/bank. Rejected requests are retained;
Request Again inserts a new row. Admin review locks the pending request, verifies
the admin, bank and student, then creates/updates `user_bank_access` and records the
decision in one transaction. That table has one grant per student/bank.
Referenced banks cannot be deleted; make them inactive to preserve history.

Student cards are rendered from Supabase on each server navigation/refresh.
Mutation results trigger revalidation. No browser storage grants course access.
An inactive bank or revoked grant blocks course entry and question reads.

## Security boundaries

- Profile role/status comes from PostgreSQL, never user metadata.
- Student requests use the session identity and database-generated timestamps.
- Authenticated users have only own-row request/grant reads. Request insertion
  permits only `question_bank_id`; status, identity, review and time fields cannot
  be supplied. They have no UPDATE/DELETE or grant INSERT privilege.
- RLS independently checks enabled students, active banks and grants for questions.
- Answer keys live in `private.question_solutions`, inaccessible to normal clients.
  Public questions contain only option IDs/text. Only the submission RPC returns
  whether the submitted option is correct, after rechecking access.
- Admin RPCs repeat active-admin checks using `auth.uid()` and use an empty
  search_path. No service credential is needed for course approval/content RPCs.
- Admin-only answer data is fetched on the server after admin authorization.
  Static demo answer data is no longer imported into application client bundles.
- Callback redirects are allowlisted to the password-setup route or site root.

## Signup configuration and release prerequisite

Hosted Supabase must have **Email > Confirm email OFF** and signup enabled.
The public Auth settings endpoint must report `mailer_autoconfirm: true` and
`disable_signup: false`. The application checks this before calling signUp so
configuration drift does not knowingly create an unconfirmed account. A rare
configuration change during signup returns an honest registration-received
message rather than claiming the committed registration failed.

The owner disabled confirmation on September 7, 2026. Auth settings now report
`mailer_autoconfirm: true`; real public signup and password login passed.
Public signup uses `auth.signUp`; it does not use privileged auto-confirmation,
custom password storage, or password comparison. Admin invitations remain separate.

## Migration and verification

Applied migrations: `20260906161352_student_course_access.sql` and
`20260907175002_isolate_course_privileged_functions.sql`. Prior migrations are
untouched. Local versions match hosted history. The first migration is transactional
and changes no existing profile rows. The second moves privileged implementations
into `private` and exposes only SECURITY INVOKER wrappers, retaining all role checks.

The SQL suite `supabase/tests/student_course_access.sql` was executed after the
new migration within a single transaction ending in ROLLBACK, with a 3-second
lock timeout and 30-second statement timeout. All assertions passed, and a
subsequent read confirmed the new tables did not remain. Test users are created
only inside that transaction and are rolled back with everything else.

Coverage: profile demographics, metadata privilege tampering, role/status rules,
active catalog, locked question denial, answer-key denial, cross-student isolation,
direct mutation denial, pending uniqueness, admin approval, rejection audit,
grant uniqueness, repeated request history, approved question reads, submitted
answer evaluation, inactive bank and suspended-account denial.

The suite also passed against the applied schema. Isolated headless Edge tests
verified actual UI signup, immediate password login, incorrect credentials,
anonymous redirects, locked URLs with no questions, requests surviving refresh,
admin approve/reject, retries, approved questions and post-submission feedback.
The test run had no browser runtime exceptions after fixing the country dropdown
hydration mismatch. Phone/tablet/laptop viewport checks found no horizontal overflow.
Dark-mode link/feedback contrast was adjusted after screenshot review.

The browser script is `scripts/course-browser-test.mjs`; it adds no dependencies.
All test users, sessions, requests and grants were removed after the run. Only the
original active admin remains. Test identity promotion was explicitly approved by
the owner and was never a public signup capability.

Security advisors report no new warnings. The pre-existing
[leaked-password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
remains disabled. Performance advisors report informational unused indexes, not
missing foreign-key indexes or RLS performance warnings.

Development server-function argument logging is disabled to keep transient
password inputs out of Next.js debug logs. No password or test credential is
committed or stored in application database tables.

## Rollout and recovery

Final application checks on September 7, 2026 with Node 22.23.2: `npm run
typecheck`, `npm run lint`, and `npm run build` all passed. `git diff --check`
passed. Vercel project inspection returned HTTP 403, so Git integration could not
be independently reverified during this release; no manual deployment was made.

1. Review the migration and the successful transactional SQL test results.
2. Apply the migration with bounded lock/statement timeouts. On failure the
   transaction rolls back; do not partially apply statements.
3. Disable hosted public email confirmation, verify public Auth settings, and run
   signup/login plus authenticated student/admin flow tests.
4. Run security/performance advisors and application checks, then commit and push
   the established branch. Vercel deploys through Git; no manual deployment.

If application rollout fails, revert the application commit through Git and retain
the new database tables and history. Do not replay old migrations or drop request
tables. Existing admins/teachers remain compatible. Investigate and roll forward;
any database rollback affecting newly registered users requires a separately
reviewed data plan. Never bulk disable/enable students as a rollback shortcut.

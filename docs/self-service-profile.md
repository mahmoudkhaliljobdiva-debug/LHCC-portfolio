# Self-service profile editing

All authenticated roles can edit their own name, country, phone, age, gender, and
home address at `/account/settings`. Existing role profile/settings screens use
the same editor. Inactive/expired users may edit personal information here but
cannot reactivate themselves or bypass existing portal guards.

`saveOwnProfile` validates a strict personal-field payload and calls Supabase
Auth `getUser()` before any privileged write. The update target is exclusively
the verified Auth ID; no caller-supplied ID or selected preview subject is used.
Only six personal columns are updated. Roles, status, activation, expiration,
email, passwords, bank grants, and permissions are not editable here. Existing
direct-update RLS permissions remain unchanged. The server-only key never goes
to the browser. Phone numbers use the existing country validator and E.164
normalization. Optional legacy details may remain empty.

Successful saves return safe personal fields and invalidate layouts; refreshing
the router updates identity labels from Supabase. Admin selected-user previews
remain read-only. Only enabled STUDENT actors can request question banks through
the existing action/RPC guards; teachers/admins cannot request as a student.

Checks: `node --test scripts/own-profile.test.mjs` (isolated security/validation
tests), typecheck, lint, build, and diff whitespace checks. The optional browser
suite is `node --env-file=.env.local scripts/own-profile-browser.mjs` with a local
production server on port 3100 and existing QA manifest accounts. It restores QA
names after checking persistence. It does not create accounts. The September 28
browser run was blocked before any write because the old QA accounts were gone.

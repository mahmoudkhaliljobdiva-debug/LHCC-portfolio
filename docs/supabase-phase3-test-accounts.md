# Phase 3 Supabase test accounts

Never commit test passwords, secret API keys, or invitation links. Supabase
Auth remains the source of identity and `public.profiles` remains the source of
application role and activation state.

## Bootstrap the first Admin

Phase 3 deliberately prevents Admin creation through the normal user form.
Bootstrap one Auth identity from **Supabase Dashboard → Authentication → Users**.
After the profile trigger creates its inactive Student profile, run the
following in the SQL editor with the real Auth user UUID:

```sql
update public.profiles
set
  full_name = 'L.H.C.C Administrator',
  role = 'ADMIN',
  status = 'ACTIVE',
  activation_start = null,
  activation_months = null,
  expiration_date = null
where id = '<admin-auth-user-uuid>'::uuid;
```

Store a server-only Supabase secret key in `.env.local` as
`SUPABASE_SECRET_KEY`. The legacy `SUPABASE_SERVICE_ROLE_KEY` remains a fallback.
Restart the development server after changing environment variables.

## Configure invitation redirects

Set the local Site URL and redirect allow-list entry in Supabase Auth:

```text
http://localhost:3000
http://localhost:3000/auth/callback
```

Add the corresponding production URLs before deploying. Configure custom SMTP
for reliable production invitations.

## Create the test matrix through `/admin/users`

Use unique, non-production email aliases. Do not record passwords in this file.

| Account | Role | Stored status | Activation setup |
| --- | --- | --- | --- |
| Active Student | Student | Active | Today, forced to 1 month |
| Expired Student | Student | Active | A start date more than 1 month ago |
| Active Teacher | Teacher | Active | Today, 3 months |
| Inactive Teacher | Teacher | Inactive | Any valid start date, 1+ months |

Each new account receives a Supabase invitation and sets its own password. Test
deactivation and reactivation against these accounts; do not delete them merely
to change access state.

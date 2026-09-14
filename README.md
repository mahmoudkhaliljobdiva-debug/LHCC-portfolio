# L.H.C.C — Lebanese Health & Competence Center

Healthcare learning application built with Next.js App Router, strict TypeScript,
Tailwind CSS, Recharts, and Lucide React. Supabase Auth/PostgreSQL is the source
of truth for production business data.

## Architecture

- Public portfolio CMS; student, teacher, and admin portals.
- Server Components read Supabase; Server Actions validate and authorize writes.
- RLS and guarded database functions enforce course access and protect answer keys.
- Attempts, progress, dashboard metrics and activity use real saved records.
- Admin wallet totals come from the signed transaction ledger.
- No mock business fallback or browser-persisted business state. Empty data stays empty.
- Phone, tablet, laptop layouts and light/dark themes are supported.
- localStorage stores only `lhcc-theme`.

See [the backend map](docs/backend-map.md) for every route, table, action, RPC,
permission boundary, remaining feature limits, and the demo-removal audit.

## Local development

Use Node.js `22.23.2` from `.node-version` / `.nvmrc`.

```bash
fnm use
npm ci
npm run dev
```

Open http://localhost:3000. Protected portals require a real Supabase account
and the appropriate database profile role/status. Student course access requires
an admin-approved bank grant, independently of account activation.

Copy `.env.example` to `.env.local` and supply the existing project's URL,
publishable/anon key, and server-only administrative secret. Never commit secrets.

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public client configuration.
- `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY`: server only, for
  authorized administrative Auth/profile operations. Never prefix with NEXT_PUBLIC.
- Configure Auth Site URL and allowed callback URLs for the intended environment.

For the existing project, compare local and remote migration history before
applying anything; never reset production or reapply/edit an applied migration.
All current migration versions are applied to `lcazjsmmegwwnmuupsko`.

## Validation

```bash
npm run typecheck
npm run lint
npm run build
git diff --check
node --experimental-strip-types --test scripts/backend-reporting.test.mjs
```

`supabase/tests/student_course_access.sql` exercises backend authorization and
persistence in a transaction that always rolls back. The isolated headless Edge
fallback is `scripts/course-browser-test.mjs`; public checks create no accounts.
Authenticated test mode requires explicit opt-in and cleanup.

## Deployment

Production: https://lhcc-lb.com and https://lhcc-portfolio.vercel.app.

Normal pushes to `main` in `mahmoudkhaliljobdiva-debug/LHCC-portfolio` trigger
the connected Vercel project's production build. Verify the deployment result
for the pushed commit; do not create a duplicate manual deployment.

## Current feature boundaries

Exams and teacher cohort management are not yet configured; their UI does not
pretend to contain real records. Teacher analytics use the existing permitted
learning data. See the backend map for the remaining workflow limitations.

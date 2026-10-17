# L.H.C.C — Lebanese Health & Competence Center

Healthcare learning application built with Next.js App Router, strict TypeScript,
Tailwind CSS, Recharts, and Lucide React. Supabase Auth/PostgreSQL is the source
of truth for production business data.

## Architecture

- Public portfolio CMS; student, teacher, and admin portals.
- Independent specialties and materials with personal random, historical and shared exams.
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
node --test scripts/*.test.mjs
```

Keep automated tests. `archive-db-tests.mjs` and `learning-platform-db.mjs` run
rollback security/scoring checks only against the isolated `archive-db` container.
For real browser PDF/exam journeys use the local archive fixtures and runners in
[the learning-platform report](docs/learning-platform.md). Production smoke is
read-only; legacy backend QA tools now reject remote Supabase URLs, and their
inventory helper cannot delete records. See [QA safety](docs/backend-qa.md).

## Deployment

Production: https://lhcc-lb.com and https://lhcc-portfolio.vercel.app.

Normal pushes to `main` in `mahmoudkhaliljobdiva-debug/LHCC-portfolio` trigger
the connected Vercel project's production build. Verify the deployment result
for the pushed commit; do not create a duplicate manual deployment.

## Current feature boundaries

Personal random exams and complete-bank/case practice use the real eligible
question pool. Historical/shared exams appear only after Admin publication;
empty archives are not populated with fabricated offerings. Teacher cohort
management remains unconfigured; analytics use permitted real learning data.
See [the production cleanup audit](docs/production-cleanup-audit.md) for classified
artifacts, security findings and changes requiring separate approval.

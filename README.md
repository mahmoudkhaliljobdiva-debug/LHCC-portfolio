# L.H.C.C — Lebanese Health & Competence Center

Frontend-only SaaS demonstration built with Next.js App Router, strict TypeScript,
Tailwind CSS, Recharts, and Lucide React.

## Current phase

The repository contains a responsive frontend demonstration with a public
healthcare portfolio, role-based portals, typed mock data, local mock services,
and interactive analytics charts.

## Boundaries

- No database, authentication, API, backend, payment gateway, or Supabase.
- Responsive phone, tablet, and laptop layouts are required for every route.
- Light and dark themes are user-selectable and persisted locally.
- Routes stay thin and compose modules from `features` and `layouts`.
- Shared visual primitives live in `components`.
- Feature modules must not import another feature's internal files.
- Components read demo data through `services`, not directly from `data`.
- Server Components are the default; use Client Components only for interaction
  or browser-only libraries such as Recharts.

## Commands

Node.js `22.23.2` is the supported runtime. Version managers can read the pinned
version from `.node-version` or `.nvmrc`; run `fnm use` before installing
dependencies when using Fast Node Manager.

```bash
fnm use
npm install
npm run typecheck
npm run lint
npm run dev
```

Open `http://localhost:3000` after starting the development server. Demo portals
are available at `/student`, `/teacher`, and `/admin`.

## Supabase Development Setup

Supabase Auth and Admin User Management are connected. Question banks, wallet,
portfolio CMS, analytics, and usage remain on their existing demo boundaries
until their dedicated migration phases.

1. Create a Supabase project.
2. In the project dashboard, copy the Project URL, publishable key, and a
   server-only secret key.
3. Copy `.env.example` to `.env.local`.
4. Add the three project values to `.env.local` without committing that file.
5. Apply every SQL file in `supabase/migrations` in filename order. Until the
   Supabase CLI is configured, each migration can be pasted into the dashboard
   SQL editor.
6. Follow `docs/supabase-phase3-test-accounts.md` to bootstrap the first Admin
   and prepare the test matrix without committing passwords.
7. In Supabase Auth URL Configuration, set the application Site URL and allow
   `http://localhost:3000/auth/callback` as a local redirect URL. Add the
   deployed callback URL before production deployment.

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` may be used by
browser code; database Row Level Security still controls access.
`SUPABASE_SECRET_KEY` (or the legacy `SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS,
is server-only, and must never be exposed through a `NEXT_PUBLIC_` variable or
imported by a Client Component.

Never commit `.env.local` or real Supabase credentials.

### Authentication test accounts

Only the first Admin is bootstrapped manually. That Admin invites Student and
Teacher accounts from `/admin/users`; the browser never receives the server-only
administrative key. See `docs/supabase-phase3-test-accounts.md`.

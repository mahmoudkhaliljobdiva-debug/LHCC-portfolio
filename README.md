# L.H.C.C Healthcare Learning Platform

Frontend-only SaaS demonstration built with Next.js App Router, strict TypeScript,
Tailwind CSS, Recharts, and Lucide React.

## Current phase

The repository contains a responsive frontend demonstration with a public
healthcare portfolio, role-based portals, typed mock data, local mock services,
and interactive analytics charts.

## Boundaries

- No database, authentication, API, backend, payment gateway, or Supabase.
- Routes stay thin and compose modules from `features` and `layouts`.
- Shared visual primitives live in `components`.
- Feature modules must not import another feature's internal files.
- Components read demo data through `services`, not directly from `data`.
- Server Components are the default; use Client Components only for interaction
  or browser-only libraries such as Recharts.

## Commands

```bash
npm install
npm run typecheck
npm run lint
npm run dev
```

Open `http://localhost:3000` after starting the development server. Demo portals
are available at `/student`, `/teacher`, and `/admin`.

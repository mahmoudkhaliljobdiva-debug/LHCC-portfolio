# L.H.C.C Healthcare Learning Platform — Project Handoff

Last updated: July 28, 2026

## Project objective

Build a production-quality frontend demonstration for a Healthcare Learning
Platform. This is a SaaS-style application containing:

- A public healthcare portfolio
- Student portal
- Teacher portal
- Admin portal
- Question bank management
- Dashboards and analytics
- A virtual wallet using learning credits only
- Performance reports

The current phase is frontend-only. All application information uses reusable
mock data.

## Explicit scope boundaries

Do not implement any of the following during the frontend demo phase:

- Database
- Authentication
- API
- Backend
- Supabase
- Payment gateway
- Production business logic

The login page is presentational. Portal links enter the appropriate demo
directly and do not authenticate or authorize a user.

## Technology

- Next.js 16 with App Router
- React 19
- TypeScript with strict compiler safeguards
- Tailwind CSS 4
- Recharts
- Lucide React
- React Context only if a genuine shared-state requirement emerges
- No Redux
- No Zustand

Supporting packages:

- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- `date-fns`

## Design direction

The product name is **L.H.C.C**, short for **Lebanese Health & Competence
Center**.

The requested visual qualities are:

- Professional
- Medical
- Clean
- Minimal
- Modern
- Responsive

Core colors:

- Warm ivory
- Muted medical navy
- Coral
- Slate
- White

The palette is derived from the supplied L.H.C.C logo. The primary logo asset is:

`public/images/lhcc-logo.png`

Avoid:

- Heavy gradients
- Glassmorphism
- Flashy animation

AMBOSS was used as a reference for clinical positioning, strong content
hierarchy, audience-specific messaging, and the relationship between learning,
question banks, analytics, and educator support:

https://www.amboss.com/us

The implementation is original and does not copy AMBOSS branding or content.

## Architecture

The repository uses a feature-oriented structure:

```text
public/               Static assets
src/
├── app/              Routes, metadata, route layouts, error states
├── components/       Shared domain-neutral components
│   ├── charts/
│   └── ui/
├── constants/        Routes and role navigation
├── data/             Typed mock datasets
├── features/         Product-domain screens and components
├── hooks/            Shared hooks
├── layouts/          Public and dashboard shells
├── lib/              Infrastructure helpers
├── services/         Mock-data access boundary
├── types/            Shared domain contracts
└── utils/            Pure shared transformations
```

Architectural rules:

1. App Router route files should stay thin.
2. Feature-specific components belong inside their feature.
3. Shared visual primitives belong in `components`.
4. Features must not import another feature's internal modules.
5. Components should read demo data through services when data access is needed.
6. Server Components are the default.
7. Use Client Components only for interaction or browser-dependent libraries
   such as Recharts.
8. Role layouts share a configurable dashboard shell rather than duplicating
   navigation implementations.

## Implemented public routes

| Route | Description |
|---|---|
| `/` | Public landing page |
| `/about` | Product mission and positioning |
| `/services` | Healthcare learning services |
| `/platform` | Platform overview |
| `/contact` | Mock contact information |
| `/login` | Presentational demo login |

## Implemented student routes

| Route | Description |
|---|---|
| `/student` | Student dashboard |
| `/student/question-banks` | Six reusable question banks |
| `/student/exams` | Mock exam management view |
| `/student/analytics` | Performance analytics |
| `/student/profile` | Presentational profile form |

## Implemented teacher routes

| Route | Description |
|---|---|
| `/teacher` | Teacher dashboard |
| `/teacher/questions` | Mock question management |
| `/teacher/question-banks` | Shared question banks |
| `/teacher/exams` | Mock assessment management |
| `/teacher/students` | Mock student cohort table |
| `/teacher/analytics` | Cohort analytics |

## Implemented admin routes

| Route | Description |
|---|---|
| `/admin` | Platform dashboard |
| `/admin/users` | Mock user management |
| `/admin/question-banks` | Shared question banks |
| `/admin/wallet` | Virtual learning-credit administration |
| `/admin/reports` | Performance reports |
| `/admin/settings` | Presentational settings |

The role routes use optional catch-all route files so that each role shares one
screen-composition layer:

- `src/app/student/[[...section]]/page.tsx`
- `src/app/teacher/[[...section]]/page.tsx`
- `src/app/admin/[[...section]]/page.tsx`

## Mock datasets

### Question banks

The six banks are defined once in:

`src/data/question-banks.mock.ts`

Banks:

1. Human Anatomy
2. Medical Physiology
3. Pharmacology
4. General Pathology
5. Medical Microbiology
6. Clinical Medicine

Each record contains:

- Stable ID
- Title
- Description
- Question count
- Completed count
- Average score
- Difficulty
- Accent token

The shared rendering component is:

`src/features/question-banks/question-bank-grid.tsx`

Do not create six separate bank implementations.

### Wallet

Defined in:

`src/data/wallet.mock.ts`

Current demonstration values:

- Balance: 2,450 credits
- Rewards: 780 credits
- Losses: 190 credits
- Three recent transactions
- Six monthly wallet trend points

This is a virtual learning wallet available only to administrators. Students and
teachers must not see wallet navigation or wallet content. It must never imply
real currency, deposits, withdrawals, purchases, or payment processing.

### Analytics

Defined in:

`src/data/analytics.mock.ts`

It currently includes:

- Score distribution histogram data
- Six-month score trend
- Performance metrics
- Wallet trend data from the wallet dataset

Charts are implemented with Recharts in:

`src/components/charts/performance-chart.tsx`

## Important reusable modules

- `src/layouts/public-layout/public-header.tsx`
- `src/layouts/public-layout/public-footer.tsx`
- `src/layouts/dashboard-layout/dashboard-shell.tsx`
- `src/features/dashboard/role-screen.tsx`
- `src/features/dashboard/metric-card.tsx`
- `src/features/question-banks/question-bank-grid.tsx`
- `src/components/charts/performance-chart.tsx`
- `src/components/ui/brand.tsx`
- `src/components/ui/progress.tsx`
- `src/constants/navigation.ts`
- `src/constants/routes.ts`

## Responsive and accessibility work

The current implementation includes:

- Responsive layouts for phone, tablet, and laptop
- Laptop/desktop dashboard sidebar
- Phone and tablet off-canvas dashboard navigation
- Responsive public navigation
- Responsive grids and tables
- Semantic header, main, nav, section, article, table, and footer elements
- Accessible labels on icon-only controls
- Keyboard-visible focus styles
- Progress bar ARIA attributes
- Color combinations designed for readable contrast
- Light and dark color themes
- Accessible theme-toggle labels
- Theme preference stored in `localStorage` under `lhcc-theme`
- Device color-scheme preference used on the first visit

The shared theme control is:

`src/components/ui/theme-toggle.tsx`

The initial inline theme script in `src/app/layout.tsx` applies the stored or
device theme before hydration to minimize incorrect-theme flashing.

The homepage "See the whole learning journey" section has a dedicated dark navy
surface in dark mode. Preserve this contrast treatment when editing that section.

Accessibility should continue to be checked as new interactive components are
introduced.

## Validation status

The following checks passed after implementation:

```powershell
npm run typecheck
npm run lint
npm run build
```

The production build generated the expected public, authentication, student,
teacher, and admin routes successfully.

After the July 28 logo, branding, theme, role, and contrast changes:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed before the final isolated homepage contrast correction.
- Typecheck and lint also passed after that final contrast correction.

## Running locally

```powershell
cd C:\Users\mahmo\GIT\L.H.C.C-portfolio
npm run dev
```

Then open:

http://localhost:3000

Dependencies are already installed and `package-lock.json` is present.

## Known environment notes

- The installed Node version is `20.16.0`.
- Next.js accepts Node `>=20.9.0`.
- One TypeScript ESLint transitive package recommends Node `20.19.0` or newer.
  The lint and build commands currently pass, but updating Node to a current LTS
  patch release is recommended.
- `npm audit --omit=dev` reported three high-severity advisories in transitive
  Next.js dependencies (`postcss` and `sharp`).
- The npm suggested forced remediation would incorrectly downgrade Next.js to
  version 9 and must not be used.
- Recheck these advisories after newer compatible Next.js dependencies become
  available.

## Recommended next session

Continue in this order:

1. Run the development server and visually inspect the public and portal routes.
2. Test both light and dark modes at phone, tablet, and laptop breakpoints.
3. Inspect every pale custom background in dark mode for adequate contrast.
4. Add route-aware titles and breadcrumbs inside the dashboard header.
5. Replace the generic management table with feature-specific exam, question,
   student, and user components.
6. Add detailed question-bank routes using a dynamic bank ID.
7. Add a mock exam-taking flow with local component state.
8. Add accessible chart summaries or data-table alternatives.
9. Add loading, empty, success, and error demonstration states.
10. Add Vitest, React Testing Library, and Playwright.
11. Perform an automated accessibility audit.

## July 28 session summary

Completed changes:

- Added the supplied medical logo and prepared a cleaned project asset.
- Rebranded all visible product references from MedLumen to `L.H.C.C`.
- Set the full name to `Lebanese Health & Competence Center`.
- Changed the visual palette to logo-derived navy, coral, and warm ivory.
- Updated chart colors to match the logo.
- Removed Wallet from the student portal.
- Confirmed teachers also have no Wallet access.
- Restricted Wallet navigation and content to administrators.
- Added persistent light and dark themes.
- Added theme controls to public, mobile, authentication, and dashboard headers.
- Added a dedicated dark-mode background to the homepage learning-journey CTA
  after a contrast issue was identified.
- Confirmed responsive behavior remains designed for phone, tablet, and laptop.

Current Git state:

- Local branch: `main`, tracking `origin/main`.
- The July 28 changes are currently uncommitted and have not been pushed.
- The last pushed commit remains `c3eb93a`.

## Prompt for continuing tomorrow

Use the following prompt in a new session:

> Continue implementing the L.H.C.C Healthcare Learning Platform frontend demo.
> Read `PROJECT_HANDOFF.md` and inspect the existing repository before making
> changes. Preserve the current feature-oriented architecture, strict TypeScript,
> mock-only data boundary, medical visual system, responsiveness, and
> accessibility requirements. Do not add a backend, API, authentication,
> Supabase, payment gateway, or real business logic. Start with the next-session
> checklist in the handoff document, validate changes with typecheck, lint, and
> production build, and report exactly what was completed.

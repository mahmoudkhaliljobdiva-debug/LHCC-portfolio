# LHCC production baseline

This document records the verified production baseline before new feature
development. The application source, Supabase schema, RLS policies,
authentication implementation, migrations, and test data were not changed to
create this record.

## Architecture

LHCC is a Next.js App Router application backed by Supabase. Supabase is the
source of truth for identity, profiles, portfolio content, question banks,
access requests and grants, attempts, answers, wallet transactions, reporting,
and analytics. The production application does not depend on mock or demo
business data.

Authentication uses Supabase Auth and a one-to-one `profiles` record. Trusted
profile data determines the active application role and account status; user
editable signup metadata cannot grant privileges. The supported roles are:

- **ADMIN** — manages users, content, access decisions, wallet ledger entries,
  and portfolio content.
- **TEACHER** — reads the implemented teaching and cohort reporting views.
- **STUDENT** — accesses their own profile, authorized banks, requests,
  attempts, and learning analytics.

## Learning workflow

Question banks and questions are stored in Supabase. Students can see the
active catalog, but a protected bank requires a real active access grant. A
student submits an access request, which remains persisted as `PENDING` until
an administrator approves or rejects it. Approval creates the bank-access
grant and, for paid access, exactly one `BANK_SALE` wallet-ledger transaction.
Retries cannot create duplicate pending requests, grants, or sales.

Student question payloads contain only safe option identifiers and labels. The
correct-answer key is held in the private solution model and is available only
to authorized administrative operations. Answer submission is server-side: it
validates access and option ownership, grades the answer, persists the attempt
and answer, and calculates the final score. Attempt history, progress, and
scores survive refresh and a new login.

## Wallet, CMS, reporting, and security

The administrator wallet is an appendable signed ledger. Its balance is the
sum of transaction amounts; there is no editable standalone balance. Dashboard
metrics and analytics query stored Supabase records and display genuine zero or
empty states when no records exist.

The public About, Services, Platform, and Contact pages read published
Supabase portfolio content. Administrators edit that content through the
portfolio CMS; saved values persist and are reflected on public pages.

Row Level Security and guarded server actions/RPCs enforce role, account
status, ownership, and bank-access rules. Students cannot read or change other
students' profiles, requests, grants, attempts, answers, or administrative
wallet/content operations. Correct answers are never exposed in the
student-facing question path.

## Production references

- Production URL: [https://lhcc-lb.com](https://lhcc-lb.com)
- Detailed UI-to-backend, data, authorization, and RLS map:
  [`docs/backend-map.md`](backend-map.md)

## Verified baseline

| Check | Result |
| --- | --- |
| Live backend QA | 12/12 PASS |
| Backend reporting tests | 7/7 PASS |
| Typecheck | PASS |
| Lint | PASS |
| Production build | PASS |
| Production demo dependency scan | PASS |
| Responsive browser suite | PASS |
| Production smoke | PASS |

## Environment notes

### Node

The repository requires **Node 22.23.2**. The verification machine used
**Node 24.19.0**; all listed checks passed, but future development and release
environments should use the repository-supported Node 22.23.2.

### Supabase advisors

Supabase advisors were not executed because the required Supabase CLI/MCP
capability was unavailable in the verification environment. This is a remaining
infrastructure verification task, not an application failure.

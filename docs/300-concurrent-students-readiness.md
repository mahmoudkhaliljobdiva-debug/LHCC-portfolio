# LHCC — 300 simultaneous students readiness and database audit

Audit date: 2026-11-25. Environment: production Supabase project and Vercel.
This document records *observations*, not a certification of 300-user capacity.

## Changes applied and verified

- Five focused PostgreSQL indexes: three FK covering indexes, one active-question
  partial index and one completed-exam-history partial index. All were applied to
  production and committed in `supabase/migrations/20261125110000_targeted_query_performance_indexes.sql`.
- Merged the two authenticated `question_banks` SELECT RLS policies into the
  exact logical OR in one policy. Student/teacher/admin access predicates were preserved.
- Supabase performance advisor subsequently showed no missing FK indexes
  and no redundant-permissive-policy finding. Unused indexes were not dropped.
- All 43 public/private app tables had a valid index before the change.
- Source database contained 132 indexes before the change, and 20 MB of
  public/private application table+index storage.
- PostgreSQL 17.6, configured `max_connections=60`; 11 connections observed
  during audit, no lock waits and no idle-in-transaction sessions.
- Sampled single-query EXPLAIN ANALYZE after indexing: active questions ~1.8ms;
  completed-exam history ~0.15ms. These measurements cannot be treated as
  p95 under load and vary with cache state, query inputs, RLS and network.
- Supabase project state `ACTIVE_HEALTHY`, zero Supabase health lints.
- Vercel production deployment was READY; its Hobby plan was observed via
  runtime-log-retention API. Production requests' real p95/p99 were not available
  from the accessible metrics endpoint.

## Remaining risks before claiming 300-user readiness

1. **Supabase Realtime peak connections**: LHCC LiveSyncProvider opens one
   WebSocket per signed-in user, with up to three channels. The Free quota is
   200 *connections*, Pro 500. The project's exact Supabase billing tier must
   be checked before operating 300 concurrent online student sessions. Either
   provision >=300 Realtime connections with headroom, or explicitly choose a
   polling-only fallback for student sessions and test its impact.
2. **Vercel Hobby**: do not assume commercial/production traffic bursts are
   supported to the desired SLO. Confirm plan, function execution quotas,
   and realistic scaling with Vercel. Upgrade only with owner approval.
3. **Database compute**: Postgres direct max connections = 60, not a 300-student
   limit, because API/poolers multiplex users. Compute/CPU and pooled connection
   usage during 300-user tests are unmeasured.
4. **Scored exam submissions**: 300 simultaneous writes were not exercised on
   production, and no 300-account staging fixture is currently configured.
5. **OCR**: many Medicine questions are inactive/ungraded by design. They
   must remain excluded from exam load tests until reviewed and approved.

## Reproducible load test — isolated staging only

Run `scripts/load-300-students.js` with k6 against a **separate staging Supabase
project** and staging Vercel deployment. This test deliberately blocks the known
LHCC production domains and Supabase project ID.

Prepare 300 unique, active STUDENT accounts and JWTs in isolated staging with
the same schema/migrations and realistic data volume. Do not copy production
credentials into the repository. Example *shape only* of the private JSON fixture:

```json
[
  {
    "access_token": "<STAGING_STUDENT_JWT>",
    "cookie": "<OPTIONAL_STAGING_NEXTJS_SESSION_COOKIE>",
    "attemptId": "<OPTIONAL_UNIQUE_IN_PROGRESS_STAGING_ATTEMPT_UUID>",
    "answerMap": {"<QUESTION_ID>":"<OPTION_ID>"},
    "expectedVersion": 1
  }
]
```

Every one of the 300 records must have a *different* access token. For the full
Next.js check, also give each a valid staging session cookie. In submission mode,
supply 300 distinct seeded attempt IDs, valid answer maps, and version numbers.

Run in a secure terminal with the required variables, for example:

```bash
K6_STAGING_CONFIRMED=ISOLATED \
K6_SUPABASE_URL=https://YOUR-STAGING-REF.supabase.co \
K6_SUPABASE_ANON_KEY=YOUR_STAGING_PUBLISHABLE_KEY \
K6_MEDICAL_BANK_ID=YOUR_STAGING_MEDICINE_SUBJECT_ID \
K6_USERS_FILE=../.test-artifacts/lhcc-300-users.private.json \
K6_WEB_URL=https://YOUR-STAGING-WEB-URL \
k6 run scripts/load-300-students.js
```

The default `browse` mode ramps up to 300 VUs, sustains them for 5 minutes,
and checks real authenticated RPCs for catalog, medical preview and personal
mistake history. With `K6_WEB_URL` and cookies, it also checks dashboard SSR.

To test a simultaneous submission burst on *disposable* staging exams, use
`K6_MODE=submit` with the same env vars. It runs one write per student/attempt.
Do not reuse submitted attempts or point at production.

### Suggested release gates

- API p95 below 1.2s; API p99 below 2.5s.
- Next.js dashboard p95 below 2.5s; p99 below 4.5s.
- Successful requests >99%; no widespread 429, 5xx, timeout or lost submissions.
- Monitor Supabase CPU, pool usage, lock waits, SQL statements and Realtime
  connections; monitor Vercel function durations, errors, and throttling.
- Repeat tests at production-equivalent compute sizes, network regions and
  data volumes. Include a dedicated 300-user realtime-browser test: k6 HTTP
  tests **do not** open the Supabase WebSockets used by actual student browsers.
- Observe at least a 30-minute soak after passing burst tests, with error and
  database-connection headroom, before asserting readiness.

## References

- Supabase: https://supabase.com/docs/guides/database/query-optimization
- Supabase: https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits
- Supabase: https://supabase.com/docs/guides/realtime/limits
- Vercel: https://vercel.com/docs/limits

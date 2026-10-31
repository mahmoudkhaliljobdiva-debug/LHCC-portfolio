# Migration history reconciliation and production safety

Read-only review: 2026-10-31. Branch: `feat/learning-material-foundation`.
Reviewed baseline: `9abc258`. Production Supabase project:
`lcazjsmmegwwnmuupsko`; site: https://lhcc-lb.com.

This records observed history/schema differences and a conditional correction
plan. It is not permission to repair migration history, rename/reapply migrations,
change production assignments or deploy the pending local migration.

## Historical inventory

The baseline contains **20 historical local migration files**; production has
**21 applied historical entries**. One production migration has no local file.
Seven migrations share a logical name but have different local/live versions.
All remaining historical versions match. The new pending local Phase 2 migration
is listed separately and is not part of either historical count.

| Migration name | Local historical version | Live applied version |
| --- | --- | --- |
| `create_profiles` | `20260816105616` | `20260816105616` |
| `restrict_rls_auto_enable` | `20260816105726` | `20260816105726` |
| `add_profile_admin_audit_fields` | `20260816112045` | `20260816112045` |
| `add_profile_demographics` | `20260906085448` | `20260906085448` |
| `add_profile_phone_country` | `20260906101939` | `20260906101939` |
| `student_course_access` | `20260906161352` | `20260906161352` |
| `isolate_course_privileged_functions` | `20260907175002` | `20260907175002` |
| `backend_source_of_truth` | `20260913174715` | `20260913174715` |
| `fix_answer_submission_ambiguity` | `20260913175128` | `20260913175128` |
| `harden_wallet_and_add_fk_indexes` | `20260913175259` | `20260913175259` |
| `make_completed_answers_idempotent` | `20260918174508` | `20260918174508` |
| `opt_in_explicit_data_api_grants` | Missing locally | `20260924070649` |
| `teacher_bank_assignments` | `20260928164803` | `20260928164833` |
| `student_bank_exams` | `20260928173425` | `20260928173806` |
| `exam_private_deny_policy` | `20260928174708` | `20260928174859` |
| `clinical_question_sections` | `20261004100547` | `20261004101303` |
| `yearly_exam_archive` | `20261011090748` | `20261011112836` |
| `align_archive_case_eligibility` | `20261011112320` | `20261011112854` |
| `learning_catalog_shared_exams` | `20261011161422` | `20261011170845` |
| `live_synchronization` | `20261019173647` | `20261019173647` |
| `chapter_learning_modes` | `20261021172927` | `20261021172927` |

Missing local migration `20260924070649_opt_in_explicit_data_api_grants` revokes
default table DML privileges, function `EXECUTE`, and sequence `USAGE`/`SELECT`
from `anon`, `authenticated` and `service_role`, plus default function `EXECUTE`
from `PUBLIC`. Do not assume a fresh local replay reproduces production default
privileges merely because current functions and policies match. Explicit object
grants and RLS need separate verification; see [Supabase's grants/RLS guidance](https://supabase.com/docs/guides/api/securing-your-api).

## Read-only schema comparison

The following comparisons were performed against the historical baseline,
before the pending typed-material foundation is considered a release candidate:

- All **91 shared functions** in `public`/`private` have equal MD5 values after
  whitespace normalization of their definitions. This does not claim byte-for-
  byte migration-file equality or complete privilege parity.
- All **30 compared RLS policies** across `public`, `private` and `storage` match
  exactly.
- Of **204 compared column definitions**, the only observed differences are
  `public.question_sections.created_at` and `updated_at`: production defaults
  use `statement_timestamp()`, while local defaults use `now()`.
- Production additionally contains `public.rls_auto_enable`, an event-trigger
  function not executable by `anon` or `authenticated`.

These bounded comparisons explain the known drift; they are not a blanket
assertion that every database object, owner, grant, default privilege, extension
or migration statement is identical. Preserve the production default timestamps
and event-trigger behavior unless a separately reviewed change requires otherwise.

## Reconciliation outcome and pending migration

The history discrepancy is documented, not mechanically repaired. No historical
file was renamed or reapplied, no migration-history row was changed, and the
missing historical migration was not fabricated locally. Do not run an automatic
push/replay that would interpret the seven timestamp differences as unapplied
schema changes. Do not reset/reseed production to make the histories match.

Pending local-only file:
`supabase/migrations/20261031173818_typed_learning_materials.sql`.
It belongs to Phase 2 of the
[approved implementation checklist](learning-architecture-implementation.md).
It has not been applied to production or approved for release. Local Phase 2
implementation/testing is underway; historical inventory review does not make
that implementation complete.

Before a production migration can be proposed, review the final additive SQL,
explicit grants, authorization/RLS tests, backward compatibility and impact against
the live state recorded here. Present a history-aware application plan that does
not repair/reapply/rename historical entries. Obtain the user's explicit approval
for the production migration/deployment. If a tool cannot safely apply the new
change without history mutation, stop and request direction rather than bypassing
this gate. [Supabase's migration guide](https://supabase.com/docs/guides/deployment/database-migrations)
describes the normal workflow; it does not override this project's safety gates.

## Nursing Colloquium: current production state

The 2026-10-31 read-only inspection found bank
`d7e37b48-8afc-4df0-ad5e-a1c08dc65eb4` (**Nursing Colloquium**) assigned to
**Medical**, not Nursing. This observation supersedes the older assignment
snapshots in `learning-platform.md` and `chapter-learning-modes.md`; neither older
description is evidence of the current assignment.

Preservation baseline observed during this review: **100 questions, 20 clinical
cases, 4 attempts, 3 access grants, 2 ledger entries and 5 Auth users**. Auth-user
count is a project-wide preservation baseline, not a bank ownership claim. These
counts do not prove payment receipt. The existing unpublished, empty `test`
chapter remains untouched.

Changing this bank's specialty is explicitly approval-gated even though the
misassignment is known. A specialty change can affect catalog placement and
specialty-derived coverage, so it must not be treated as a cosmetic UI fix.

### Conditional correction plan — no executable update

1. Obtain explicit user approval specifically for moving the existing Nursing
   Colloquium bank from Medical to Nursing.
2. Immediately before any approved change, repeat read-only verification of the
   exact bank ID, current Medical assignment, the unique intended Nursing
   specialty ID, publication state and dependent access/package behavior. Stop
   if any identity, count or assumption differs.
3. Record the original specialty ID and dependency/count/digest evidence for
   questions, cases, attempts/results, grants, requests, ledger/wallet, PDFs and
   applicable entitlement coverage. Resolve any change to existing access
   rights with the user before proceeding.
4. Propose a transaction-scoped, conditional **one-row specialty reassignment**
   for this bank only, guarded by its ID and verified original assignment, with
   an exact one-row result requirement. Do not recreate the bank, copy questions,
   alter grants/ledger entries, change other specialties or touch the `test`
   chapter. No executable reassignment statement is included here.
5. After an approved execution, verify Nursing/Medical catalog placement,
   unchanged question/case/attempt/result/access/financial evidence and existing
   resume/feedback behavior. Roll back the transaction on any mismatch; any
   later compensating production change requires its own reviewed authority.

This review made **no production data change**, history repair, push or deployment.
The approved architecture is not permission to perform this reassignment without
the separate approval above.

## Verification status

The existing isolated local baseline reported **263 SQL checks PASS** and
**95 Node checks PASS** before final Phase 2 work completed. These results do not
certify the pending migration, current uncommitted application changes, lesson
management, commerce, or a production release. Final focused and regression
results must be reported separately. No physical Samsung-device test is claimed.

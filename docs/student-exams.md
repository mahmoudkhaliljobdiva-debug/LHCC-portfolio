# Student question-bank exams

## Architecture

Approved active bank → bank details → `startExam` → atomic `start_exam` RPC →
persisted exam → individual saved answers → `submitExam` / `submit_exam` →
persisted result. Supabase is the only exam source of truth; no browser grading,
random question selection, mock questions, or localStorage exam state.

Existing `question_attempts` / `question_attempt_answers` remain canonical.
`mode` distinguishes preserved PRACTICE history from new EXAM attempts.
`question_attempt_questions` stores up to 30 unique questions in immutable order
with safe question/option text snapshots. Private `exam_question_solutions`
stores the corresponding frozen keys and is unavailable to clients.
Edits/deactivation do not alter existing exams. Referenced question deletion is
FK-protected. Bank name is snapshotted too. No applied migration was edited.

Migrations: `20260928173425_student_bank_exams.sql` and
`20260928174708_exam_private_deny_policy.sql`.

## Trusted operations and security

- `start_exam`: active STUDENT + active bank + approved grant; profile/bank/grant
  share locks, student/bank advisory lock, unique in-progress constraint.
  Database `ORDER BY random() LIMIT 30` samples the same bank's active valid QCU
  pool. Existing EXAM resumes. Explicit Start supersedes unfinished legacy
  PRACTICE as ABANDONED, preserving answers. Empty pool rolls back atomically.
- `save_exam_answer`: ownership, grant, persisted membership and option validation;
  locked in-progress attempt, one upserted selection per question. `is_correct`
  stays NULL until submission. No client score/correctness input.
- `submit_exam`: ownership + active access, attempt lock, frozen private-key
  grading, two-decimal score. Unanswered questions count as incorrect. Completed
  retry returns the original ID/result without extra completion or wallet events.
- `exam_data` / `exam_bank_data`: guarded safe allowlists. Pre-submit responses
  exclude outcome and all answer-key fields. Completed review shows the selected
  answer and correctness only, never the correct option key.
- Old `submit_bank_answer` EXECUTE permissions are revoked to prevent an
  immediate-feedback oracle. Obsolete practice UI/actions/readers were removed;
  stored practice history and reporting remain.
- Own active-student history remains accessible. Revoked grants/inactive banks
  block unfinished exam reads/saves/submission, including direct URLs/API.
  Own completed results remain accessible after bank revocation; inactive accounts
  cannot access the portal. Teachers and other students cannot access attempts.
- Public snapshot RLS follows authorized attempt visibility; direct writes denied.
  Private snapshot keys have explicit deny RLS, no client grants.
- Admin selected-student preview uses guarded subject-specific reads, disabled
  fields, and no start/submit controls. Backend denies ADMIN exam mutations too.

## Frontend and reporting

Routes: `/student/banks/[bankId]`, `/student/exams`,
`/student/exams/[attemptId]`, `/student/exams/[attemptId]/result`.
Bank details/history use backend eligible counts and real attempts; zero disables
Start, smaller banks use all eligible questions. Completed exams can be retaken.
Exam cards have radio selections, numbered anchor navigator, progress, per-answer
save feedback/retry, and a native keyboard-accessible confirmation dialog.
Submission waits for saved answers; failed saves block submission. Refresh/resume
loads the same ordered snapshots and selections. Save invalidates exam/dashboard
route caches. Result/history/dashboard use authoritative attempt/answer records.
Dashboard adds correct answers, accuracy, best score and last attempt.
Admin usage/activity counts actual saved selections separately from incorrect
exam totals, so unanswered questions are not mislabeled as answered.

## Verification

- `supabase/tests/student_exams.sql`: 41 real database checks, transaction rollback.
- Existing teacher permissions: 25 checks, transaction rollback.
- Focused exam action/schema tests plus reporting/profile/signup/teacher suites:
  40 passing unit tests.
- `scripts/exam-browser-test.mjs`: real login → start → 20 saves → refresh →
  resume → submit → 66.67% result → dashboard/history. Exactly 30, 12 and zero;
  concurrent start/submit retries; safe payload and cross-student denials.
  Includes a controlled connection failure/save retry and a fresh login restoring
  the saved exam without changing its questions.
- Exam/confirmation/result checked at 390/430/768/1366/1920px, light/dark.
- Browser fixtures are controlled TEST-only Supabase records, never production
  frontend data. Ignored private manifest holds random credentials; cleanup
  removes only recorded TEST identities and their related records.
- Admin preview authorization/mutation denial is database-tested; an authenticated
  ADMIN browser walkthrough was not run. No permanent elevated QA account created.
- Security advisors: no new application findings. Existing leaked-password
  protection warning remains. Performance: unused-index INFO notices only.

The legacy `course-browser-test.mjs` targets retired immediate-answer practice;
use the exam suite for current course behavior. Historical baseline docs describe
their original verification dates, not this new lifecycle.

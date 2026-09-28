# Teacher question-bank permissions

Admins assign one or more question banks when creating or editing a teacher.
Promoting a student without an assignment is rejected. The admin-only RPC saves
profile and assignments atomically. Demotion clears teaching assignments, not
historical student activity. No existing user receives an automatic assignment.

Active teachers can view questions and add a new QCU question only in their
assigned active banks. The dedicated RPC validates answers and uses INSERT, never
upsert. Editing/deleting questions and managing banks remain admin-only. Safe
options never contain answer keys, and private solutions remain unreadable.
Teacher student/cohort analytics and exam navigation are no longer exposed.
Admin teacher previews reproduce the assignments and remain read-only.

Migration: `20260928164803_teacher_bank_assignments.sql` (applied to production).
Security checks: `supabase/tests/teacher_bank_permissions.sql`, always rolled back.
25 database checks pass; temporary Auth profiles/banks/questions are not retained.
Action/validation tests: `node --test scripts/teacher-questions.test.mjs` (8 pass).
Earlier persistent browser QA identities no longer exist, so an authenticated
teacher browser save has not yet been verified. SQL tests cover the live backend.

Release also includes pending self-service profile edits, direct-entry signup,
centered icon actions, and removal of the homepage Admin portal card. The global
authenticated Dashboard button still leads admins to their own dashboard.

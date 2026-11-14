# Full audit source and database inventory

Captured 2026-11-11 from source baseline `5e51b03` and live Supabase catalog.
This is an inventory, **not evidence that every individual item passed a browser test**.
The main findings, table matrix, execution evidence and exclusions are in
[FULL_PROJECT_AUDIT.md](../FULL_PROJECT_AUDIT.md).

## Scope

213 TypeScript/TSX files; 123 TSX files (including layouts/pages); 42 page entry files;
2 GET route handlers; 15 server-action files with 47 exported actions; 40 distinct
application RPC names; 125 live public/private functions; 41 application-owned tables;
no application-owned SQL views; 45 enabled application row triggers; 2 private PDF buckets.
Dynamic/catch-all entry files represent multiple URLs. They are not 42 fixed public pages.

The 125-function total includes invoker wrappers, legacy/internal implementation
layers, authorization/validation helpers and trigger functions. Forty functions are
referenced as RPC names by application code. Existence and catalog review do not
mean all 125 independently executed successfully.

## Page entry files

| Route pattern | Source | Verification boundary |
| --- | --- | --- |
| `/account/expired` | `src/app/(auth)/account/expired/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/account/inactive` | `src/app/(auth)/account/inactive/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/login/forgot-password` | `src/app/(auth)/login/forgot-password/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/login` | `src/app/(auth)/login/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/login/update-password` | `src/app/(auth)/login/update-password/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/signup` | `src/app/(auth)/signup/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/unauthorized` | `src/app/(auth)/unauthorized/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/[slug]` | `src/app/(public)/[slug]/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/account/settings` | `src/app/(public)/account/settings/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/` | `src/app/(public)/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/programs/[slug]` | `src/app/(public)/programs/[slug]/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/[[...section]]` | `src/app/admin/[[...section]]/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/access-requests` | `src/app/admin/access-requests/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/exam-tracks` | `src/app/admin/exam-tracks/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/question-banks/[bankId]/chapters` | `src/app/admin/question-banks/[bankId]/chapters/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/question-banks/[bankId]` | `src/app/admin/question-banks/[bankId]/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/question-banks/[bankId]/past-exams` | `src/app/admin/question-banks/[bankId]/past-exams/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/question-banks/[bankId]/questions/[questionId]/edit` | `src/app/admin/question-banks/[bankId]/questions/[questionId]/edit/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/question-banks/[bankId]/questions/new` | `src/app/admin/question-banks/[bankId]/questions/new/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/question-banks/[bankId]/shared-exams` | `src/app/admin/question-banks/[bankId]/shared-exams/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/question-banks` | `src/app/admin/question-banks/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/specialties` | `src/app/admin/specialties/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/subjects/[bankId]/lessons` | `src/app/admin/subjects/[bankId]/lessons/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/subjects` | `src/app/admin/subjects/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/users/[userId]/activity` | `src/app/admin/users/[userId]/activity/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/users` | `src/app/admin/users/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/view-as/[role]/[userId]/[[...section]]` | `src/app/admin/view-as/[role]/[userId]/[[...section]]/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/view-as/[role]` | `src/app/admin/view-as/[role]/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/admin/wallet` | `src/app/admin/wallet/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/student/[[...section]]` | `src/app/student/[[...section]]/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/student/banks/[bankId]/chapters` | `src/app/student/banks/[bankId]/chapters/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/student/banks/[bankId]` | `src/app/student/banks/[bankId]/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/student/banks/[bankId]/past-exams` | `src/app/student/banks/[bankId]/past-exams/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/student/banks/[bankId]/setup` | `src/app/student/banks/[bankId]/setup/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/student/banks/[bankId]/shared-exams` | `src/app/student/banks/[bankId]/shared-exams/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/student/exams/[attemptId]` | `src/app/student/exams/[attemptId]/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/student/exams/[attemptId]/result` | `src/app/student/exams/[attemptId]/result/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/student/exams` | `src/app/student/exams/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/student/question-banks` | `src/app/student/question-banks/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/student/specialties/[slug]` | `src/app/student/specialties/[slug]/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/teacher/[[...section]]` | `src/app/teacher/[[...section]]/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |
| `/teacher/question-banks/[bankId]` | `src/app/teacher/question-banks/[bankId]/page.tsx` | Source inventoried; see scope-specific browser coverage in main report |

## HTTP handlers

- `src/app/api/live/catalog/route.ts`: GET revision-only response and cache headers.
- `src/app/auth/callback/route.ts`: GET PKCE exchange; next destination allowlisted.
- Framework metadata: `robots.ts`, `sitemap.ts`, root favicon/icon assets.
- Session refresh boundary: `src/proxy.ts` -> `src/lib/supabase/proxy.ts`;
  role/status authorization stays in server guards and database RLS/RPCs.

## Exported server actions

| Module | Actions |
| --- | --- |
| `src/actions/admin-users.ts` | `listUsers`, `createUser`, `updateUser`, `deactivateUser`, `reactivateStudent`, `reactivateTeacher` |
| `src/actions/auth.ts` | `login`, `registerAccount`, `logout`, `requestPasswordReset`, `updatePassword` |
| `src/actions/bank-access.ts` | `requestBankAccess`, `approveBankAccessRequest`, `rejectBankAccessRequest`, `revokeBankAccessRequest` |
| `src/actions/bank-content.ts` | `manageBankContent` |
| `src/actions/chapters.ts` | `saveChapter`, `assignQuestionChapters`, `saveGenerationSettings` |
| `src/actions/exams.ts` | `startLearningExam`, `checkPracticeAnswer`, `startExam`, `readCurrentExam`, `saveExamAnswer`, `submitExam` |
| `src/actions/learning-catalog.ts` | `saveSpecialty`, `assignMaterial`, `generateSharedExam`, `saveSharedExam` |
| `src/actions/lessons.ts` | `loadAdminLessons`, `saveLesson`, `registerLessonDocument`, `approveLessonDocument`, `getAdminLessonDocumentLink` |
| `src/actions/live-sync.ts` | `LiveState`, `readLiveState` |
| `src/actions/materials.ts` | `saveMaterial` |
| `src/actions/past-exams.ts` | `savePastExam`, `registerExamSource`, `getExamSourceLink` |
| `src/actions/portfolio.ts` | `savePortfolioContent`, `resetPortfolioContent` |
| `src/actions/profile.ts` | `saveOwnProfile` |
| `src/actions/teacher-questions.ts` | `addTeacherQuestion` |
| `src/actions/wallet.ts` | `createWalletTicket`, `updateWalletTicket`, `deleteWalletTicket` |

## Database functions and execution grants

Anon/authenticated columns are effective EXECUTE privileges; private execution
privileges do not imply Data API exposure or permission to use the function.
Each definer implementation must additionally enforce its actor/scope guards.
Only the anonymous catalog/revision functions are public application RPCs.
The Auth provisioning and RLS event-trigger definers are not executable by API roles.

| Function signature | Mode | Anon / Authenticated EXECUTE | Evidence boundary |
| --- | --- | --- | --- |
| `private.admin_bank_data()` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.admin_chapters(bank_id text, page_number integer, search_text text)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.admin_learning_materials(kind text, page_number integer)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.admin_past_exams(bank_id text)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.admin_shared_exams(bank_id text, page_number integer)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.admin_subject_lessons(bank_id text, lesson_id uuid)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.admin_update_managed_profile(payload jsonb)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.admin_wallet_data()` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.approve_lesson_document(document_id uuid, approved boolean)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.archive_exam_bank_data(bank_id text, subject_id uuid)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.assign_bank_specialty(bank_id text, specialty_id uuid)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.bump_answer_version()` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.can_open_bank(bank_id text)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.capture_past_snapshot()` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.catalog_revision()` | Definer | Yes / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.check_practice_answer(attempt_id uuid, question_id text)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.emit_live(topic text, kind text, bank_id text, attempt_id uuid)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.exam_bank_data(bank_id text, subject_id uuid)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.exam_data(attempt_id uuid, subject_id uuid)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.generate_shared_exam(payload jsonb)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.guard_exam_material()` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.guard_lesson_document_identity()` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.guard_lesson_subject()` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.guard_material_identity()` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.guard_material_request()` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.guard_subject_commerce()` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.is_active_role(required_role user_role)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.learning_catalog()` | Definer | Yes / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.learning_progress()` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.lesson_json_id(value jsonb, nullable boolean)` | Invoker | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.lesson_json_integer(value jsonb, minimum bigint, maximum bigint)` | Invoker | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.lesson_json_object(value jsonb, keys text[])` | Invoker | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.lesson_json_string(value jsonb, min_length integer, max_length integer)` | Invoker | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.lesson_json_uuid(value jsonb, nullable boolean)` | Invoker | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.lesson_trim(value text)` | Invoker | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.list_bank_access_requests()` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.live_change()` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.live_practice_change()` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.live_sync_state(bank_id text, attempt_id uuid)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.lock_exam_access(bank_id text)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.lock_learning_content_identities(ids text[])` | Invoker | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.lock_material_reference()` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.manage_bank_content(operation text, item_id text, payload jsonb)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.manage_chapters(operation text, payload jsonb)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.manage_wallet_transaction(operation text, item_id uuid, payload jsonb)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.original_exam_bank_data(bank_id text, subject_id uuid)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.original_exam_data(attempt_id uuid, subject_id uuid)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.portfolio_section_valid(section_name text, value jsonb)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.pre_live_exam_data(attempt_id uuid, subject_id uuid)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.prechapter_exam_bank_data(bank_id text, subject_id uuid)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.prechapter_exam_data(attempt_id uuid, subject_id uuid)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.prepare_attempt_answer()` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.pretyped_exam_bank_data(bank_id text, subject_id uuid)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.pretyped_generate_shared_exam(payload jsonb)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.pretyped_manage_bank_content(operation text, item_id text, payload jsonb)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.pretyped_register_exam_source(payload jsonb)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.pretyped_save_past_exam(payload jsonb)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.pretyped_save_shared_exam(payload jsonb)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.register_exam_source(payload jsonb)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.register_lesson_document(payload jsonb)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.require_exam_material(bank_id text)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.reset_portfolio_content()` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.review_bank_access(request_id uuid, decision text, reason text)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.revoke_bank_access(request_id uuid)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.save_exam_answer(attempt_id uuid, question_id text, option_id text)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.save_exam_answer_versioned(attempt_id uuid, question_id text, option_id text, expected_version bigint)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.save_learning_material(payload jsonb)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.save_lesson(payload jsonb)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.save_past_exam(payload jsonb)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.save_portfolio_content(payload jsonb)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.save_shared_exam(payload jsonb)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.save_specialty(payload jsonb)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.start_exam(bank_id text)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.start_learning_exam(config jsonb)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.start_legacy_nonshared_learning_exam(config jsonb)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.start_nonshared_learning_exam(config jsonb)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.submit_bank_answer(question_id text, option_id text)` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.submit_exam(attempt_id uuid)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.teacher_add_question(item_id text, payload jsonb)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `private.teacher_has_bank(bank_id text)` | Definer | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.admin_bank_data()` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.admin_chapters(bank_id text, page_number integer, search_text text)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.admin_learning_materials(kind text, page_number integer)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.admin_past_exams(bank_id text)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.admin_shared_exams(bank_id text, page_number integer)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.admin_subject_lessons(bank_id text, lesson_id uuid)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.admin_update_managed_profile(payload jsonb)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.admin_wallet_data()` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.approve_lesson_document(document_id uuid, approved boolean)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.assign_bank_specialty(bank_id text, specialty_id uuid)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.catalog_revision()` | Invoker | Yes / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.check_practice_answer(attempt_id uuid, question_id text)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.exam_bank_data(bank_id text, subject_id uuid)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.exam_data(attempt_id uuid, subject_id uuid)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.generate_shared_exam(payload jsonb)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.handle_new_auth_user()` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.is_profile_access_active(profile_status user_status, profile_role user_role, profile_expiration_date timestamp with time zone)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.learning_catalog()` | Invoker | Yes / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.learning_progress()` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.list_bank_access_requests()` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.live_sync_state(bank_id text, attempt_id uuid)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.manage_bank_content(operation text, item_id text, payload jsonb)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.manage_chapters(operation text, payload jsonb)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.manage_wallet_transaction(operation text, item_id uuid, payload jsonb)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.register_exam_source(payload jsonb)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.register_lesson_document(payload jsonb)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.request_bank_access(bank_id text)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.reset_portfolio_content()` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.review_bank_access(request_id uuid, decision text, reason text)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.revoke_bank_access(request_id uuid)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.rls_auto_enable()` | Definer | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.save_exam_answer(attempt_id uuid, question_id text, option_id text)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.save_exam_answer_versioned(attempt_id uuid, question_id text, option_id text, expected_version bigint)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.save_learning_material(payload jsonb)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.save_lesson(payload jsonb)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.save_past_exam(payload jsonb)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.save_portfolio_content(payload jsonb)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.save_shared_exam(payload jsonb)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.save_specialty(payload jsonb)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.set_updated_at()` | Invoker | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.start_exam(bank_id text)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.start_learning_exam(config jsonb)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.submit_bank_answer(question_id text, option_id text)` | Invoker | No / No | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.submit_exam(attempt_id uuid)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |
| `public.teacher_add_question(item_id text, payload jsonb)` | Invoker | No / Yes | Catalog inspected; execution evidence is suite-specific, not blanket PASS |

## Reproduction

`node scripts/full-project-inventory.mjs .test-artifacts/audit-2026-11-11-production-snapshot.json`

The ignored snapshot contains catalog definitions and counts/fingerprints, not
rows, passwords, keys or sessions. The inventory follows function-call references
back to source RPCs; this is static evidence and does not replace execution tests.

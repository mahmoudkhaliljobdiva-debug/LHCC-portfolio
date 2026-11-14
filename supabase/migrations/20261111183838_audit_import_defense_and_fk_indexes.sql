-- Pending production approval: audit defense-in-depth only. No rows or existing grants change.
-- Requires the four production import tables documented in docs/audit/production-history.
-- Fail before doing anything if schema/history drift has not been reconciled.
set lock_timeout = '5s';
set statement_timeout = '60s';
do $$
begin
  if to_regclass('private.question_import_sources') is null
    or to_regclass('private.question_import_staging') is null
    or to_regclass('private.question_source_links') is null
    or to_regclass('private.question_answer_reviews') is null
    or to_regclass('public.question_groups') is null then
    raise exception 'Reconcile the existing production import schema before applying this audit migration';
  end if;
end $$;

-- Existing table privileges are already denied. RLS adds defense in depth without
-- inventing a browser import API, adding permissive policies or granting access.
alter table private.question_import_sources enable row level security;
alter table private.question_import_staging enable row level security;
alter table private.question_source_links enable row level security;
alter table private.question_answer_reviews enable row level security;

-- Cover the full FK prefix (a partial or differently ordered index is not enough).
create index lessons_chapter_bank_fk_idx on public.lessons(chapter_id, question_bank_id);
create index lesson_questions_lesson_bank_fk_idx on public.lesson_questions(lesson_id, question_bank_id);
create index bank_questions_group_fk_idx on public.bank_questions(group_id);
create index question_answer_reviews_reviewer_fk_idx on private.question_answer_reviews(reviewed_by);

-- Atomic final exam submission: selections are not sent until student confirms.
-- Validation, answer writing and grading run in one database transaction.
-- Enforce existing snapshot/ownership/access rules; no client-side scoring.
CREATE OR REPLACE FUNCTION private.submit_exam_with_answers(attempt_id uuid, answer_map jsonb, expected_version bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  attempt public.question_attempts;
  total_supplied integer;
begin
  -- Never trust a browser-supplied student ID, questions, keys or score.
  if not private.is_active_role('STUDENT') then
    raise exception 'Active student required' using errcode='42501';
  end if;
  select * into attempt
  from public.question_attempts a
  where a.id=attempt_id and a.student_id=auth.uid() and a.mode='EXAM';
  if not found then raise exception 'Owned exam attempt required' using errcode='42501'; end if;

  perform private.lock_exam_access(attempt.question_bank_id);
  select * into attempt from public.question_attempts a where a.id=attempt_id for update;
  -- An uncertain network retry after successful submission is idempotent.
  if attempt.status='COMPLETED' then return attempt.id; end if;
  if attempt.status<>'IN_PROGRESS' or attempt.learning_mode<>'EXAM' then
    raise exception 'Only in-progress exam-mode attempts can use final answer submission' using errcode='23514';
  end if;
  if attempt.answer_version is distinct from expected_version then
    raise exception 'This exam was changed in another tab' using errcode='40001';
  end if;
  -- Allow modest network latency when the timer reaches zero.
  if attempt.deadline_at is not null and clock_timestamp()>attempt.deadline_at+interval '30 seconds' then
    raise exception 'Exam submission window has expired' using errcode='23514';
  end if;
  if answer_map is null or jsonb_typeof(answer_map)<>'object' then
    raise exception 'Answer map must be an object' using errcode='23514';
  end if;
  if octet_length(answer_map::text)>100000 then
    raise exception 'Answer payload too large' using errcode='23514';
  end if;
  select count(*) into total_supplied from jsonb_each(answer_map);
  if total_supplied>attempt.total_questions then
    raise exception 'Too many answers supplied' using errcode='23514';
  end if;
  -- Validate every item against the immutable attempt snapshot.
  if exists (
    select 1 from jsonb_each(answer_map) as item(question_id, selected)
    where jsonb_typeof(item.selected)<>'string'
       or length(item.question_id) not between 1 and 200
       or length(btrim(item.selected #>> '{}')) not between 1 and 200
       or not exists (
         select 1 from public.question_attempt_questions q
         where q.attempt_id=attempt.id
           and q.question_id=item.question_id
           and exists (
             select 1 from jsonb_array_elements(q.options) opt
             where opt->>'id'=item.selected #>> '{}'
           )
       )
  ) then
    raise exception 'One or more answers are invalid for this exam' using errcode='23514';
  end if;

  -- One SQL statement; existing triggers set grading fields and bump version.
  insert into public.question_attempt_answers (
    attempt_id,question_id,selected_option_id,is_correct
  )
  select attempt.id,item.question_id,item.option_id,null
  from jsonb_each_text(answer_map) as item(question_id,option_id)
  on conflict on constraint question_attempt_answers_attempt_id_question_id_key
  do update set selected_option_id=excluded.selected_option_id,answered_at=now();

  -- Retain exactly the answers in this confirmed submission, including any
  -- answers cleared by the student since a previously saved older client.
  delete from public.question_attempt_answers saved
  where saved.attempt_id=attempt.id
    and not (answer_map ? saved.question_id);

  perform private.submit_exam(attempt.id);
  return attempt.id;
end
$function$
;

CREATE OR REPLACE FUNCTION public.submit_exam_with_answers(attempt_id uuid, answer_map jsonb, expected_version bigint)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.submit_exam_with_answers(attempt_id,answer_map,expected_version)
$function$
;

REVOKE ALL ON FUNCTION private.submit_exam_with_answers(uuid,jsonb,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.submit_exam_with_answers(uuid,jsonb,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_exam_with_answers(uuid,jsonb,bigint) TO authenticated;

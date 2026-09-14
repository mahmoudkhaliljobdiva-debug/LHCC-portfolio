begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function private.submit_bank_answer(question_id text, option_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.bank_questions; attempt_row public.question_attempts; existing_answer public.question_attempt_answers;
declare answer_correct boolean; answered_count integer; correct_count integer;
begin
  select * into q from public.bank_questions where id=question_id and status='active';
  if not found or not private.can_open_bank(q.question_bank_id) then raise exception 'Course access required' using errcode='42501'; end if;
  if not exists(select 1 from jsonb_array_elements(q.options) o where o->>'id'=option_id) then raise exception 'Invalid option'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || q.question_bank_id, 0));
  select * into attempt_row from public.question_attempts
    where student_id=auth.uid() and question_bank_id=q.question_bank_id and status='IN_PROGRESS'
    order by started_at desc limit 1 for update;
  if not found then
    insert into public.question_attempts(student_id,question_bank_id,total_questions)
    select auth.uid(),q.question_bank_id,count(*)::integer from public.bank_questions
    where question_bank_id=q.question_bank_id and status='active' returning * into attempt_row;
  end if;
  select * into existing_answer
    from public.question_attempt_answers answer_row
    where answer_row.attempt_id=attempt_row.id and answer_row.question_id=q.id;
  if found then
    return jsonb_build_object('correct',existing_answer.is_correct,'attemptId',attempt_row.id,
      'completed',attempt_row.status='COMPLETED','scorePercentage',attempt_row.score_percentage);
  end if;
  insert into public.question_attempt_answers(attempt_id,question_id,selected_option_id,is_correct)
    values(attempt_row.id,q.id,option_id,false)
    returning is_correct into answer_correct;
  select count(*)::integer,count(*) filter(where is_correct)::integer into answered_count,correct_count
    from public.question_attempt_answers where attempt_id=attempt_row.id;
  update public.question_attempts set correct_answers=correct_count,incorrect_answers=answered_count-correct_count,
    score_percentage=round(correct_count::numeric*100/total_questions,2),
    status=case when answered_count>=total_questions then 'COMPLETED' else 'IN_PROGRESS' end,
    submitted_at=case when answered_count>=total_questions then statement_timestamp() else null end
    where id=attempt_row.id returning * into attempt_row;
  return jsonb_build_object('correct',answer_correct,'attemptId',attempt_row.id,
    'completed',attempt_row.status='COMPLETED','scorePercentage',attempt_row.score_percentage);
end;
$$;

commit;

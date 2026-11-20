create policy deny_client_exam_keys on private.exam_question_solutions
  for all to anon,authenticated using (false) with check (false);

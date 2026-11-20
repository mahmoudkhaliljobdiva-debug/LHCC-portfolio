-- Keep clinical-case setup counts aligned with the complete-bank eligible pool.
create or replace function private.exam_bank_data(bank_id text,subject_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; eligible integer; target uuid:=coalesce(subject_id,auth.uid());
begin
  result:=private.original_exam_bank_data(bank_id,subject_id);
  select count(*) into eligible from public.bank_questions b join private.question_solutions s on s.question_id=b.id where b.question_bank_id=bank_id
    and b.status='active' and b.include_in_complete_bank and jsonb_array_length(b.options) between 2 and 10 and exists(select 1 from jsonb_array_elements(b.options) o where o->>'id'=s.correct_option_id);
  return result || jsonb_build_object('available',eligible,'examCount',least(eligible,30),
    'cases',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'description',c.description,'displayOrder',c.display_order,
      'questionCount',(select count(*) from public.bank_questions b join private.question_solutions s on s.question_id=b.id
        where b.section_id=c.id and b.question_bank_id=bank_id and b.status='active' and b.include_in_complete_bank
        and jsonb_array_length(b.options) between 2 and 10 and exists(select 1 from jsonb_array_elements(b.options) o where o->>'id'=s.correct_option_id)))
        order by c.display_order,c.id) from public.question_sections c where c.question_bank_id=bank_id),'[]'),
    'pastExams',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'year',e.exam_year,'session',e.session,
      'timeLimitMinutes',e.time_limit_minutes,'questionCount',(select count(*) from public.past_exam_questions where exam_id=e.id),
      'completed',(select count(*) from public.question_attempts where student_id=target and past_exam_id=e.id and status='COMPLETED'),
      'bestScore',(select max(score_percentage) from public.question_attempts where student_id=target and past_exam_id=e.id and status='COMPLETED')) order by e.exam_year desc,e.session,e.title)
      from public.past_exams e where e.question_bank_id=bank_id and e.status='PUBLISHED'),'[]'));
end $$;

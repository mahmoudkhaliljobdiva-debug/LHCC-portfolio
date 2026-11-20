-- Student-only, read-only missed question review across completed attempts.
-- Question text/options/answers come from immutable completed-attempt snapshots.
-- Never reveal keys for in-progress attempts or other students.
-- Explanations are shown only after editorial approval.
CREATE OR REPLACE FUNCTION private.student_missed_question_review(max_questions integer DEFAULT 40, filter_question_id text DEFAULT NULL::text, filter_source_kind text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare output jsonb;
begin
 if not private.is_active_role('STUDENT') then
   raise exception 'Active student access required' using errcode='42501';
 end if;
 if max_questions is null or max_questions not between 1 and 100
    or length(coalesce(filter_question_id,''))>200
    or (filter_source_kind is not null and filter_source_kind not in ('PAST','RANDOM','ALL','CASE','SHARED','CHAPTER'))
 then raise exception 'Invalid review filter' using errcode='23514'; end if;

 with completed as materialized (
   select a.id as attempt_id,a.question_bank_id,a.source_kind,a.exam_title_snapshot,
          a.bank_name_snapshot,a.submitted_at,a.score_percentage,
          coalesce(s.name,b.name,a.bank_name_snapshot,'Other') as specialty_name,
          coalesce(b.name,a.bank_name_snapshot,'Question bank') as bank_name
   from public.question_attempts a
   left join public.question_banks b on b.id=a.question_bank_id
   left join public.specialties s on s.id=b.specialty_id
   where a.student_id=auth.uid() and a.mode='EXAM' and a.status='COMPLETED'
 ), wrong as materialized (
   select a.*,snap.question_id,snap.text as question_text,snap.options,
          snap.case_title_snapshot as case_title,snap.case_description_snapshot as case_description,
          snap.source_number_snapshot as source_number,
          ans.selected_option_id,sol.correct_option_id
   from completed a
   join public.question_attempt_answers ans on ans.attempt_id=a.attempt_id
   join private.exam_question_solutions sol on sol.attempt_id=ans.attempt_id
                                         and sol.question_id=ans.question_id
   join public.question_attempt_questions snap on snap.attempt_id=ans.attempt_id
                                              and snap.question_id=ans.question_id
   where ans.selected_option_id<>sol.correct_option_id
 ), occurrences as materialized (
   select question_bank_id, source_kind, question_id,
          count(*)::integer as wrong_count, max(submitted_at) as last_missed_at
   from wrong group by question_bank_id,source_kind,question_id
 ), last_wrong as materialized (
   select distinct on (question_bank_id,source_kind,question_id)
     question_bank_id,source_kind,question_id,
     specialty_name,bank_name,exam_title_snapshot,question_text,options,case_title,case_description,
     source_number,selected_option_id,correct_option_id,submitted_at
   from wrong
   order by question_bank_id,source_kind,question_id,submitted_at desc,attempt_id desc
 ), top_questions as materialized (
   select o.question_id as "questionId",o.question_bank_id as "bankId",
     w.specialty_name as "specialty",w.bank_name as "bankName",
     o.source_kind as "sourceKind",
     case o.source_kind when 'PAST' then coalesce(nullif(w.exam_title_snapshot,''),'Past exam')
       when 'RANDOM' then 'Random questions'
       when 'ALL' then 'All questions'
       when 'CASE' then 'Clinical cases'
       when 'SHARED' then 'Shared exam'
       when 'CHAPTER' then 'Chapter questions' else 'Exam' end as "sourceLabel",
     w.question_text as "questionText",w.options as "options",
     w.case_title as "caseTitle",w.case_description as "caseDescription",
     w.source_number as "sourceNumber",
     w.selected_option_id as "selectedOptionId",w.correct_option_id as "correctOptionId",
     o.wrong_count as "wrongCount",o.last_missed_at as "lastMissedAt",
     case when rv.approval_status='APPROVED' and nullif(btrim(rv.explanation),'') is not null
            then rv.explanation else null end as "explanation"
   from occurrences o join last_wrong w
     on w.question_bank_id=o.question_bank_id
    and w.source_kind=o.source_kind and w.question_id=o.question_id
   left join private.question_answer_reviews rv on rv.question_id=o.question_id
   where (filter_question_id is null or o.question_id=filter_question_id)
     and (filter_source_kind is null or o.source_kind=filter_source_kind)
   order by o.wrong_count desc,o.last_missed_at desc,o.question_id
   limit max_questions
 )
 select jsonb_build_object(
   'mistakes',(select count(*)::integer from wrong),
   'uniqueQuestions',(select count(*)::integer from occurrences),
   'completedExams',(select count(*)::integer from completed),
   'specialties',coalesce((select jsonb_agg(
      jsonb_build_object('name',x.specialty_name,'mistakes',x.n) order by x.n desc,x.specialty_name)
     from (select specialty_name,count(*)::integer n from wrong
           group by specialty_name order by n desc,specialty_name limit 8) x),'[]'::jsonb),
   'scoreHistogram',coalesce((
     select jsonb_agg(jsonb_build_object('label',bins.label,'count',coalesce(c.n,0)) order by bins.bucket)
     from (values (0,'0–19%'),(1,'20–39%'),(2,'40–59%'),(3,'60–79%'),(4,'80–100%')) bins(bucket,label)
     left join (
       select least(4,floor(score_percentage / 20)::int) bucket,count(*)::int n from completed
       group by least(4,floor(score_percentage / 20)::int)
     ) c on c.bucket=bins.bucket
    ),'[]'::jsonb),
   'questions',coalesce((
      select jsonb_agg(to_jsonb(q) order by q."wrongCount" desc,q."lastMissedAt" desc,q."questionId")
      from top_questions q
   ),'[]'::jsonb)
 ) into output;
 return output;
end
$function$
;

CREATE OR REPLACE FUNCTION public.student_missed_question_review(max_questions integer DEFAULT 40, filter_question_id text DEFAULT NULL::text, filter_source_kind text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select private.student_missed_question_review(max_questions,filter_question_id,filter_source_kind) $function$
;

REVOKE ALL ON FUNCTION private.student_missed_question_review(integer,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.student_missed_question_review(integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.student_missed_question_review(integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_missed_question_review(integer,text,text) TO authenticated;

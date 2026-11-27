-- Let admin View-As-Student recognize package entitlements while preserving existing protections.
CREATE OR REPLACE FUNCTION private.original_exam_bank_data(bank_id text, subject_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target uuid:=coalesce(subject_id,auth.uid()); bank public.question_banks; eligible integer;
begin
  if subject_id is not null then
    if not private.is_active_role('ADMIN') or not exists(select 1 from public.profiles where id=target and role='STUDENT') then
      raise exception 'Access denied' using errcode='42501'; end if;
    if not exists(select 1 from public.user_bank_access where user_id=target and question_bank_id=bank_id and status='ACTIVE')
       and not exists(
         select 1 from public.course_package_access a
         join public.question_banks b on b.specialty_id=a.specialty_id
         where a.user_id=target and b.id=bank_id and a.status='ACTIVE'
       ) then
      raise exception 'Access denied' using errcode='42501'; end if;
  elsif not private.can_open_bank(bank_id) then raise exception 'Access denied' using errcode='42501'; end if;
  select * into bank from public.question_banks where id=bank_id and status='active';
  if not found then raise exception 'Bank unavailable' using errcode='42501'; end if;
  select count(*)::integer into eligible from public.bank_questions b join private.question_solutions s on s.question_id=b.id
    where b.question_bank_id=bank_id and b.status='active' and jsonb_array_length(b.options) between 2 and 10
      and exists(select 1 from jsonb_array_elements(b.options) o where o->>'id'=s.correct_option_id);
  return jsonb_build_object('id',bank.id,'name',bank.name,'description',bank.description,'available',eligible,
    'examCount',least(eligible,30),
    'cases',coalesce((select jsonb_agg(jsonb_build_object('id',sec.id,'title',sec.title,'description',sec.description,
      'displayOrder',sec.display_order,'questionCount',(select count(*)::integer from public.bank_questions b
        join private.question_solutions s on s.question_id=b.id where b.section_id=sec.id and b.question_bank_id=bank_id
          and b.status='active' and jsonb_array_length(b.options) between 2 and 10
          and exists(select 1 from jsonb_array_elements(b.options) o where o->>'id'=s.correct_option_id)))
      order by sec.display_order,sec.id) from public.question_sections sec where sec.question_bank_id=bank_id),'[]'::jsonb),
    'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'status',status,'mode',mode,'startedAt',started_at,
      'submittedAt',submitted_at,'totalQuestions',total_questions,
      'score',case when status='COMPLETED' then score_percentage else null end) order by started_at desc,id)
      from public.question_attempts where student_id=target and question_bank_id=bank_id),'[]'::jsonb));
end $function$;

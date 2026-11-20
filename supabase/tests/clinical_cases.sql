-- Rollback-only integration: uses uniquely named fixtures and an existing admin identity.
begin;
create temporary table clinical_case_results(label text, passed boolean);
grant select,insert on clinical_case_results to authenticated;
create function pg_temp.check_case(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAILED: %',label; end if;
  insert into clinical_case_results values(label,true);
end $$;
create function pg_temp.case_denied(command text,label text) returns void language plpgsql as $$
begin
  begin execute command; exception when others then
    if sqlstate in ('42501','23514','23505') then perform pg_temp.check_case(true,label); return; end if;
    raise;
  end;
  raise exception 'Expected denial: %',label;
end $$;
select set_config('case.prefix','clinical-test-'||gen_random_uuid(),true);
select set_config('case.admin',(select id::text from public.profiles where role='ADMIN' and status='ACTIVE' limit 1),true);
select pg_temp.check_case(current_setting('case.admin',true) is not null,'active admin available');
insert into public.question_banks(id,name,description,status) values
  (current_setting('case.prefix')||'-a','[TEST] Clinical A','Rollback fixture','active'),
  (current_setting('case.prefix')||'-b','[TEST] Clinical B','Rollback fixture','active');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('case.admin'),'role','authenticated')::text,true);
select public.manage_bank_content('save_section',current_setting('case.prefix')||'-case',
  jsonb_build_object('bankId',current_setting('case.prefix')||'-a','title','First case','description','Initial description','displayOrder',1));
select pg_temp.check_case((select count(*)=1 from public.question_sections where id=current_setting('case.prefix')||'-case'),'admin case create');
select public.manage_bank_content('save_section',current_setting('case.prefix')||'-case',
  jsonb_build_object('bankId',current_setting('case.prefix')||'-a','title','Updated case','description','Updated description','displayOrder',2));
select pg_temp.check_case((select title='Updated case' and display_order=2 from public.question_sections where id=current_setting('case.prefix')||'-case'),'admin case edit and order');
select pg_temp.case_denied(format('select public.manage_bank_content(''save_section'',%L,%L::jsonb)',current_setting('case.prefix')||'-case',
  jsonb_build_object('bankId',current_setting('case.prefix')||'-b','title','Move','description','Forbidden','displayOrder',1)::text),'case cannot move banks');
select public.manage_bank_content('save_question',current_setting('case.prefix')||'-q',
  jsonb_build_object('bankId',current_setting('case.prefix')||'-a','text','Clinical question','status','active',
    'sectionId',current_setting('case.prefix')||'-case','displayOrder',3,
    'answers',jsonb_build_array(jsonb_build_object('id','a','text','First','isCorrect',true),
      jsonb_build_object('id','b','text','Second','isCorrect',false))));
select pg_temp.check_case((select section_id=current_setting('case.prefix')||'-case' and display_order=3 from public.bank_questions where id=current_setting('case.prefix')||'-q'),'admin question case assignment and order');
select pg_temp.case_denied(format('select public.manage_bank_content(''save_question'',%L,%L::jsonb)',current_setting('case.prefix')||'-q',
  jsonb_build_object('bankId',current_setting('case.prefix')||'-b','text','Wrong bank','status','active',
    'sectionId',current_setting('case.prefix')||'-case','displayOrder',3,
    'answers',jsonb_build_array(jsonb_build_object('id','a','text','First','isCorrect',true),
      jsonb_build_object('id','b','text','Second','isCorrect',false)))::text),'cross-bank question mutation denied');
select pg_temp.check_case((public.admin_bank_data()->'sections') @> jsonb_build_array(jsonb_build_object('id',current_setting('case.prefix')||'-case')),'admin projection includes cases');
select set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
select pg_temp.check_case((select count(*)=0 from public.question_sections where id=current_setting('case.prefix')||'-case'),'unentitled student cannot read case directly');
select pg_temp.case_denied('select public.admin_bank_data()','non-admin cannot read answer-key projection');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('case.admin'),'role','authenticated')::text,true);
select public.manage_bank_content('delete_section',current_setting('case.prefix')||'-case','{}');
select pg_temp.check_case((select section_id is null from public.bank_questions where id=current_setting('case.prefix')||'-q'),'deleting case unassigns question');
select pg_temp.check_case((select count(*)=1 from public.bank_questions where id=current_setting('case.prefix')||'-q'),'deleting case preserves question');
select count(*) passed_checks,bool_and(passed) all_passed from clinical_case_results;
rollback;

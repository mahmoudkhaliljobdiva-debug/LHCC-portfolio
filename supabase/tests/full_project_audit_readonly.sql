-- Read-only structural and data-integrity audit. No fixtures, identities, writes or key values.
-- Execute with the database owner against local/staging or production; returns counts only.
begin read only;
set local statement_timeout = '30s';
with foreign_keys as (
  select c.oid,c.conname,c.conrelid,c.confrelid,c.convalidated,
    n.nspname as schema,t.relname as name,
    format('select count(*) as violations from %s child where %s and not exists(select 1 from %s parent where %s)',
      c.conrelid::regclass,
      string_agg(format('child.%I is not null', a.attname),' and ' order by k.position),
      c.confrelid::regclass,
      string_agg(format('child.%I = parent.%I',a.attname,b.attname),' and ' order by k.position)) as check_sql
  from pg_constraint c
  join pg_class t on t.oid=c.conrelid
  join pg_namespace n on n.oid=t.relnamespace
  cross join lateral unnest(c.conkey,c.confkey) with ordinality k(child_col,parent_col,position)
  join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.child_col
  join pg_attribute b on b.attrelid=c.confrelid and b.attnum=k.parent_col
  where c.contype='f' and n.nspname in ('public','private')
  group by c.oid,n.nspname,t.relname
), orphan_counts as (
  select schema,name,conname,convalidated,
    ((xpath('/table/row/violations/text()',query_to_xml(check_sql,false,false,'')))[1]::text)::bigint as violations
  from foreign_keys
)
select jsonb_build_object(
  'foreignKeys', (select jsonb_agg(to_jsonb(o) order by schema,name,conname) from orphan_counts o),
  'invalidConstraints',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('public','private') and not c.convalidated),
  'invalidIndexes',(select count(*) from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and not i.indisvalid),
  'tablesWithoutPrimaryKey',(select coalesce(jsonb_agg(n.nspname||'.'||c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','p') and not exists(select 1 from pg_constraint p where p.conrelid=c.oid and p.contype='p')),
  'unsafePublicDefiners',(select coalesce(jsonb_agg(p.proname),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))),
  'activeQuestionsWithoutKey',(select count(*) from public.bank_questions q left join private.question_solutions k on k.question_id=q.id where q.status='active' and k.question_id is null),
  'keysOutsideOptions',(select count(*) from public.bank_questions q join private.question_solutions k on k.question_id=q.id where not exists(select 1 from jsonb_array_elements(q.options) o where o->>'id'=k.correct_option_id)),
  'duplicateOptionIds',(select count(*) from public.bank_questions q where jsonb_array_length(q.options)<>(select count(distinct o->>'id') from jsonb_array_elements(q.options) o)),
  'crossBankCaseReferences',(select count(*) from public.bank_questions q join public.question_sections s on s.id=q.section_id where q.question_bank_id<>s.question_bank_id),
  'crossBankAttemptQuestions',(select count(*) from public.question_attempt_questions q join public.question_attempts a on a.id=q.attempt_id join public.bank_questions b on b.id=q.question_id where b.question_bank_id<>a.question_bank_id),
  'duplicatePendingRequests',(select count(*) from (select user_id,question_bank_id from public.user_bank_access_requests where status='PENDING' group by 1,2 having count(*)>1) d),
  'duplicateActiveAttempts',(select count(*) from (select student_id,question_bank_id from public.question_attempts where status='IN_PROGRESS' group by 1,2 having count(*)>1) d),
  'extensions',(select jsonb_agg(extname order by extname) from pg_extension),
  'views',(select coalesce(jsonb_agg(n.nspname||'.'||c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('v','m'))
) as audit;
rollback;

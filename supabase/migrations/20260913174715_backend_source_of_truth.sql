begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Extend the existing canonical course model instead of introducing duplicate tables.
alter table public.question_banks
  add column image_url text,
  add column price numeric(12,2) not null default 0,
  add column created_by uuid references public.profiles(id) on delete set null,
  add constraint question_banks_price_valid check (price >= 0);

alter table public.user_bank_access
  add column id uuid not null default gen_random_uuid(),
  add column price numeric(12,2) not null default 0,
  add column revoked_at timestamptz,
  add column created_at timestamptz not null default statement_timestamp(),
  add column updated_at timestamptz not null default statement_timestamp(),
  add constraint user_bank_access_id_unique unique (id),
  add constraint user_bank_access_price_valid check (price >= 0);

update public.user_bank_access
set revoked_at = granted_at
where status = 'REVOKED' and revoked_at is null;

alter table public.user_bank_access
  add constraint user_bank_access_state_valid check (
    (status = 'ACTIVE' and revoked_at is null)
    or (status = 'REVOKED' and revoked_at is not null)
  );

create trigger bank_access_updated
before update on public.user_bank_access
for each row execute function public.set_updated_at();

create table public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  question_bank_id text not null references public.question_banks(id),
  started_at timestamptz not null default statement_timestamp(),
  submitted_at timestamptz,
  total_questions integer not null check (total_questions >= 1),
  correct_answers integer not null default 0 check (correct_answers >= 0),
  incorrect_answers integer not null default 0 check (incorrect_answers >= 0),
  score_percentage numeric(5,2) not null default 0 check (score_percentage between 0 and 100),
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS','COMPLETED','ABANDONED')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint question_attempt_totals_valid check (correct_answers + incorrect_answers <= total_questions),
  constraint question_attempt_submission_valid check (
    (status = 'IN_PROGRESS' and submitted_at is null)
    or (status <> 'IN_PROGRESS' and submitted_at is not null)
  )
);

create unique index one_in_progress_attempt_per_bank
  on public.question_attempts(student_id, question_bank_id)
  where status = 'IN_PROGRESS';
create index question_attempts_student_activity_idx on public.question_attempts(student_id, started_at desc);
create index question_attempts_bank_activity_idx on public.question_attempts(question_bank_id, started_at desc);

create table public.question_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.question_attempts(id) on delete cascade,
  question_id text not null references public.bank_questions(id),
  selected_option_id text not null check (char_length(btrim(selected_option_id)) between 1 and 200),
  is_correct boolean not null,
  answered_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  unique (attempt_id, question_id)
);
create index question_attempt_answers_question_idx on public.question_attempt_answers(question_id);

create function private.prepare_attempt_answer()
returns trigger language plpgsql security definer set search_path = '' as $$
declare correct_option text;
begin
  select s.correct_option_id into correct_option
  from public.question_attempts a
  join public.bank_questions q on q.id = new.question_id
  join private.question_solutions s on s.question_id = q.id
  where a.id = new.attempt_id
    and a.question_bank_id = q.question_bank_id
    and exists (select 1 from jsonb_array_elements(q.options) option where option->>'id' = new.selected_option_id);
  if correct_option is null then
    raise exception 'The selected option does not belong to this attempt question' using errcode = '23514';
  end if;
  new.is_correct := correct_option = new.selected_option_id;
  return new;
end;
$$;
create trigger prepare_attempt_answer
before insert or update on public.question_attempt_answers
for each row execute function private.prepare_attempt_answer();
revoke all on function private.prepare_attempt_answer() from public, anon, authenticated;

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_type text not null check (transaction_type in ('BANK_SALE','BANK_PRICE_ADJUSTMENT','REFUND','MANUAL_INCOME','MANUAL_EXPENSE')),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  amount numeric(12,2) not null check (amount <> 0),
  user_id uuid references public.profiles(id) on delete set null,
  question_bank_id text references public.question_banks(id) on delete set null,
  user_bank_access_id uuid references public.user_bank_access(id),
  category text check (category is null or char_length(category) <= 100),
  created_by uuid references public.profiles(id) on delete set null,
  transaction_date date not null default current_date,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint wallet_amount_direction_valid check (
    (transaction_type in ('BANK_SALE','MANUAL_INCOME') and amount > 0)
    or (transaction_type in ('REFUND','MANUAL_EXPENSE') and amount < 0)
    or transaction_type = 'BANK_PRICE_ADJUSTMENT'
  )
);
create unique index one_bank_sale_per_access on public.wallet_transactions(user_bank_access_id) where transaction_type = 'BANK_SALE';
create unique index one_refund_per_access on public.wallet_transactions(user_bank_access_id) where transaction_type = 'REFUND';
create index wallet_transactions_date_idx on public.wallet_transactions(transaction_date desc, created_at desc);
create index wallet_transactions_user_idx on public.wallet_transactions(user_id) where user_id is not null;
create index wallet_transactions_bank_idx on public.wallet_transactions(question_bank_id) where question_bank_id is not null;
create trigger wallet_transactions_updated before update on public.wallet_transactions for each row execute function public.set_updated_at();

create table public.portfolio_content (
  section_key text primary key check (section_key in ('about','services','platform','contact')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  default_content jsonb not null check (jsonb_typeof(default_content) = 'object'),
  published boolean not null default true,
  revision integer not null default 1 check (revision >= 1),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);
create trigger portfolio_content_updated before update on public.portfolio_content for each row execute function public.set_updated_at();

insert into public.portfolio_content(section_key, content, default_content) values
('about', $json${"subtitle":"About L.H.C.C","title":"Better learning creates better care.","description":"We are building a calm, rigorous digital environment where healthcare learners and educators can focus on meaningful progress.","sectionHeading":"Designed around what matters","buttonLabel":"Explore the student portal","items":[{"id":"about-clinical","title":"Clinically focused learning","description":"Learning experiences centered on practical healthcare competence."},{"id":"about-analytics","title":"Clear and ethical analytics","description":"Useful progress signals presented with clarity and care."},{"id":"about-accessible","title":"Accessible by design","description":"A responsive, inclusive platform built for every learner."}]}$json$::jsonb, $json${"subtitle":"About L.H.C.C","title":"Better learning creates better care.","description":"We are building a calm, rigorous digital environment where healthcare learners and educators can focus on meaningful progress.","sectionHeading":"Designed around what matters","buttonLabel":"Explore the student portal","items":[{"id":"about-clinical","title":"Clinically focused learning","description":"Learning experiences centered on practical healthcare competence."},{"id":"about-analytics","title":"Clear and ethical analytics","description":"Useful progress signals presented with clarity and care."},{"id":"about-accessible","title":"Accessible by design","description":"A responsive, inclusive platform built for every learner."}]}$json$::jsonb),
('services', $json${"subtitle":"Our services","title":"Tools for every stage of medical learning.","description":"Structured practice, educator workflows, cohort insight, and institutional oversight—designed as one connected experience.","sectionHeading":"Learning support for every role","buttonLabel":"Explore our platform","items":[{"id":"services-students","title":"Student preparation","description":"Focused practice and feedback for confident exam preparation."},{"id":"services-educators","title":"Educator assessment tools","description":"Create, organize, and review meaningful learning activities."},{"id":"services-institutions","title":"Institutional reporting","description":"See cohort progress and program performance in one place."}]}$json$::jsonb, $json${"subtitle":"Our services","title":"Tools for every stage of medical learning.","description":"Structured practice, educator workflows, cohort insight, and institutional oversight—designed as one connected experience.","sectionHeading":"Learning support for every role","buttonLabel":"Explore our platform","items":[{"id":"services-students","title":"Student preparation","description":"Focused practice and feedback for confident exam preparation."},{"id":"services-educators","title":"Educator assessment tools","description":"Create, organize, and review meaningful learning activities."},{"id":"services-institutions","title":"Institutional reporting","description":"See cohort progress and program performance in one place."}]}$json$::jsonb),
('platform', $json${"subtitle":"The platform","title":"One workspace. Every learning signal.","description":"Move from focused question practice to assessment, feedback, and long-term performance trends without losing context.","sectionHeading":"A connected learning workspace","buttonLabel":"Open the platform","items":[{"id":"platform-qbanks","title":"Reusable question banks","description":"Structured medical banks powered by one reusable content system."},{"id":"platform-exams","title":"Exams and assignments","description":"Purposeful assessment workflows for learners and educators."},{"id":"platform-insight","title":"Progress and financial oversight","description":"Learning analytics for every role and financial oversight for administrators."}]}$json$::jsonb, $json${"subtitle":"The platform","title":"One workspace. Every learning signal.","description":"Move from focused question practice to assessment, feedback, and long-term performance trends without losing context.","sectionHeading":"A connected learning workspace","buttonLabel":"Open the platform","items":[{"id":"platform-qbanks","title":"Reusable question banks","description":"Structured medical banks powered by one reusable content system."},{"id":"platform-exams","title":"Exams and assignments","description":"Purposeful assessment workflows for learners and educators."},{"id":"platform-insight","title":"Progress and financial oversight","description":"Learning analytics for every role and financial oversight for administrators."}]}$json$::jsonb),
('contact', $json${"subtitle":"Contact","title":"Let’s talk about better healthcare learning.","description":"Whether you represent a medical school, teaching team, or learning program, we would be glad to hear what you are building.","sectionHeading":"Get in touch","buttonLabel":"Send an email","email":"hello@lhcc-lb.com","phone":"+961 1 555 014","address":"Beirut, Lebanon"}$json$::jsonb, $json${"subtitle":"Contact","title":"Let’s talk about better healthcare learning.","description":"Whether you represent a medical school, teaching team, or learning program, we would be glad to hear what you are building.","sectionHeading":"Get in touch","buttonLabel":"Send an email","email":"hello@lhcc-lb.com","phone":"+961 1 555 014","address":"Beirut, Lebanon"}$json$::jsonb);

alter table public.question_attempts enable row level security;
alter table public.question_attempt_answers enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.portfolio_content enable row level security;

revoke all on public.question_attempts, public.question_attempt_answers, public.wallet_transactions, public.portfolio_content from anon, authenticated;
grant select on public.question_attempts, public.question_attempt_answers to authenticated;
grant select(section_key, content, published, revision, updated_at) on public.portfolio_content to anon, authenticated;

create policy own_or_staff_attempts on public.question_attempts for select to authenticated using (
  student_id = (select auth.uid())
  or (select private.is_active_role('ADMIN'))
  or (select private.is_active_role('TEACHER'))
);
create policy own_or_staff_attempt_answers on public.question_attempt_answers for select to authenticated using (
  exists (
    select 1 from public.question_attempts a
    where a.id = attempt_id and (
      a.student_id = (select auth.uid())
      or (select private.is_active_role('ADMIN'))
      or (select private.is_active_role('TEACHER'))
    )
  )
);
create policy published_portfolio_content on public.portfolio_content for select to anon, authenticated using (published);

drop policy bank_catalog on public.question_banks;
create policy bank_catalog on public.question_banks for select to authenticated using (
  (status = 'active' and ((select private.is_active_role('STUDENT')) or (select private.is_active_role('TEACHER'))))
  or (select private.is_active_role('ADMIN'))
);
drop policy approved_questions on public.bank_questions;
create policy approved_questions on public.bank_questions for select to authenticated using (
  (status = 'active' and private.can_open_bank(question_bank_id))
  or (select private.is_active_role('TEACHER'))
  or (select private.is_active_role('ADMIN'))
);

create function private.portfolio_section_valid(section_name text, value jsonb)
returns boolean language sql immutable security invoker set search_path = '' as $$
  select jsonb_typeof(value) = 'object'
    and coalesce(nullif(btrim(value->>'subtitle'), ''), '') <> ''
    and coalesce(nullif(btrim(value->>'title'), ''), '') <> ''
    and coalesce(nullif(btrim(value->>'description'), ''), '') <> ''
    and coalesce(nullif(btrim(value->>'sectionHeading'), ''), '') <> ''
    and coalesce(nullif(btrim(value->>'buttonLabel'), ''), '') <> ''
    and case when section_name = 'contact' then
      coalesce(nullif(btrim(value->>'email'), ''), '') <> ''
      and coalesce(nullif(btrim(value->>'phone'), ''), '') <> ''
      and coalesce(nullif(btrim(value->>'address'), ''), '') <> ''
    else
      jsonb_typeof(value->'items') = 'array'
      and jsonb_array_length(value->'items') >= 1
      and not exists (
        select 1 from jsonb_array_elements(value->'items') item
        where coalesce(nullif(btrim(item->>'id'), ''), '') = ''
          or coalesce(nullif(btrim(item->>'title'), ''), '') = ''
          or coalesce(nullif(btrim(item->>'description'), ''), '') = ''
      )
    end;
$$;

create function private.save_portfolio_content(payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare section_name text;
begin
  if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then raise exception 'Invalid portfolio payload'; end if;
  foreach section_name in array array['about','services','platform','contact'] loop
    if not private.portfolio_section_valid(section_name, payload->section_name) then raise exception 'Invalid portfolio section: %', section_name; end if;
  end loop;
  update public.portfolio_content
    set content = payload->section_key, revision = revision + 1, updated_by = auth.uid(), published = true
    where section_key in ('about','services','platform','contact');
  if not found then raise exception 'Portfolio content is not initialized'; end if;
end;
$$;

create function private.reset_portfolio_content()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode = '42501'; end if;
  update public.portfolio_content set content = default_content, revision = revision + 1, updated_by = auth.uid(), published = true;
end;
$$;

create function private.admin_wallet_data()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', w.id, 'type', lower(w.transaction_type), 'name', w.name, 'description', w.description,
      'amount', w.amount, 'transactionDate', w.transaction_date, 'userId', w.user_id,
      'userName', p.full_name, 'bankId', w.question_bank_id, 'bankName', b.name,
      'userBankAccessId', w.user_bank_access_id, 'category', w.category, 'createdAt', w.created_at
    ) order by w.transaction_date desc, w.created_at desc)
    from public.wallet_transactions w
    left join public.profiles p on p.id = w.user_id
    left join public.question_banks b on b.id = w.question_bank_id
  ), '[]'::jsonb);
end;
$$;

create function private.manage_wallet_transaction(operation text, item_id uuid, payload jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare normalized_type text; normalized_amount numeric(12,2);
begin
  if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if operation in ('create','update') then
    normalized_type := upper(payload->>'type');
    if normalized_type not in ('MANUAL_INCOME','MANUAL_EXPENSE') then raise exception 'Only manual transactions can be managed'; end if;
    normalized_amount := abs((payload->>'amount')::numeric);
    if normalized_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
    if normalized_type = 'MANUAL_EXPENSE' then normalized_amount := -normalized_amount; end if;
  end if;
  if operation = 'create' then
    insert into public.wallet_transactions(id, transaction_type, name, description, amount, category, created_by, transaction_date)
    values(item_id, normalized_type, payload->>'name', nullif(btrim(payload->>'description'),''), normalized_amount,
      nullif(btrim(payload->>'category'),''), auth.uid(), (payload->>'transactionDate')::date);
  elsif operation = 'update' then
    update public.wallet_transactions set transaction_type = normalized_type, name = payload->>'name',
      description = nullif(btrim(payload->>'description'),''), amount = normalized_amount,
      category = nullif(btrim(payload->>'category'),''), transaction_date = (payload->>'transactionDate')::date
    where id = item_id and transaction_type in ('MANUAL_INCOME','MANUAL_EXPENSE');
    if not found then raise exception 'Manual transaction not found'; end if;
  elsif operation = 'delete' then
    delete from public.wallet_transactions where id = item_id and transaction_type in ('MANUAL_INCOME','MANUAL_EXPENSE');
    if not found then raise exception 'Manual transaction not found'; end if;
  else raise exception 'Invalid wallet operation';
  end if;
end;
$$;

-- Approval, access pricing, and the sale ledger are one database transaction.
create or replace function private.review_bank_access(request_id uuid, decision text, reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.user_bank_access_requests; access_row public.user_bank_access; bank_row public.question_banks;
begin
  if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
  if decision not in ('APPROVED','REJECTED') then raise exception 'Invalid decision'; end if;
  select * into r from public.user_bank_access_requests where id=request_id for update;
  if not found or r.status <> 'PENDING' then raise exception 'Request is no longer pending'; end if;
  if decision='APPROVED' then
    select * into bank_row from public.question_banks where id=r.question_bank_id and status='active' for share;
    if not found then raise exception 'Bank is unavailable'; end if;
    perform 1 from public.profiles where id=r.user_id and role='STUDENT' and status='ACTIVE' for share;
    if not found then raise exception 'Student account is disabled'; end if;
    insert into public.user_bank_access(user_id,question_bank_id,granted_by,request_id,price)
    values(r.user_id,r.question_bank_id,auth.uid(),r.id,bank_row.price)
    on conflict(user_id,question_bank_id) do update set status='ACTIVE',granted_at=statement_timestamp(),
      granted_by=auth.uid(),request_id=r.id,price=excluded.price,revoked_at=null
    returning * into access_row;
    if bank_row.price > 0 then
      insert into public.wallet_transactions(transaction_type,name,description,amount,user_id,question_bank_id,user_bank_access_id,created_by,transaction_date)
      values('BANK_SALE',bank_row.name || ' access',bank_row.name || ' access granted',bank_row.price,r.user_id,r.question_bank_id,access_row.id,auth.uid(),current_date)
      on conflict(user_bank_access_id) where transaction_type='BANK_SALE' do nothing;
    end if;
  end if;
  update public.user_bank_access_requests set status=decision,reviewed_at=statement_timestamp(),reviewed_by=auth.uid(),
    rejection_reason=case when decision='REJECTED' then nullif(btrim(reason),'') else null end where id=r.id;
end;
$$;

create or replace function private.admin_bank_data()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
  return jsonb_build_object('banks',coalesce((select jsonb_agg(jsonb_build_object(
    'id',id,'name',name,'description',description,'status',status,'displayOrder',display_order,
    'imageUrl',image_url,'price',price,'createdAt',created_at,'updatedAt',updated_at) order by display_order)
    from public.question_banks),'[]'),
    'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'bankId',q.question_bank_id,'text',q.text,
    'status',q.status,'type','QCU','createdAt',q.created_at,'updatedAt',q.updated_at,
    'answers',(select jsonb_agg(o || jsonb_build_object('isCorrect',o->>'id'=s.correct_option_id)) from jsonb_array_elements(q.options) o)))
    from public.bank_questions q join private.question_solutions s on s.question_id=q.id),'[]'));
end;
$$;

create or replace function private.manage_bank_content(operation text, item_id text, payload jsonb default '{}')
returns void language plpgsql security definer set search_path='' as $$
declare correct_id text; safe_options jsonb;
begin
  if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
  if operation='save_bank' then
    insert into public.question_banks(id,name,description,status,display_order,image_url,price,created_by)
    values(item_id,payload->>'name',payload->>'description',payload->>'status',coalesce((payload->>'displayOrder')::integer,0),
      nullif(btrim(payload->>'imageUrl'),''),coalesce((payload->>'price')::numeric,0),auth.uid())
    on conflict(id) do update set name=excluded.name,description=excluded.description,status=excluded.status,
      display_order=excluded.display_order,image_url=excluded.image_url,price=excluded.price;
  elsif operation='delete_bank' then
    delete from public.question_banks where id=item_id;
  elsif operation='save_question' then
    if jsonb_typeof(payload->'answers') <> 'array' or jsonb_array_length(payload->'answers') not between 2 and 10 then raise exception 'Provide 2 to 10 answers'; end if;
    if (select count(*) from jsonb_array_elements(payload->'answers') a where a->>'isCorrect'='true') <> 1 then raise exception 'Exactly one correct answer required'; end if;
    if exists(select 1 from jsonb_array_elements(payload->'answers') a where nullif(btrim(a->>'text'),'') is null or nullif(a->>'id','') is null)
      or (select count(distinct a->>'id') from jsonb_array_elements(payload->'answers') a) <> jsonb_array_length(payload->'answers') then raise exception 'Invalid answers'; end if;
    select a->>'id' into correct_id from jsonb_array_elements(payload->'answers') a where a->>'isCorrect'='true';
    select jsonb_agg(jsonb_build_object('id',a->>'id','text',a->>'text')) into safe_options from jsonb_array_elements(payload->'answers') a;
    insert into public.bank_questions(id,question_bank_id,text,status,options) values(item_id,payload->>'bankId',payload->>'text',payload->>'status',safe_options)
    on conflict(id) do update set text=excluded.text,status=excluded.status,options=excluded.options;
    insert into private.question_solutions values(item_id,correct_id) on conflict(question_id) do update set correct_option_id=excluded.correct_option_id;
  elsif operation='delete_question' then delete from public.bank_questions where id=item_id;
  else raise exception 'Invalid operation'; end if;
end;
$$;

drop function public.submit_bank_answer(text,text);
drop function private.submit_bank_answer(text,text);
create function private.submit_bank_answer(question_id text, option_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.bank_questions; attempt_row public.question_attempts; existing_answer public.question_attempt_answers;
declare answer_correct boolean; answered_count integer; correct_count integer;
begin
  select * into q from public.bank_questions where id=question_id and status='active';
  if not found or not private.can_open_bank(q.question_bank_id) then raise exception 'Course access required' using errcode='42501'; end if;
  if not exists(select 1 from jsonb_array_elements(q.options) o where o->>'id'=option_id) then raise exception 'Invalid option'; end if;
  -- Serialize attempt creation per student/bank so concurrent submissions cannot
  -- create competing in-progress attempts before the partial unique index is seen.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || q.question_bank_id, 0));
  select * into attempt_row from public.question_attempts
    where student_id=auth.uid() and question_bank_id=q.question_bank_id and status='IN_PROGRESS'
    order by started_at desc limit 1 for update;
  if not found then
    insert into public.question_attempts(student_id,question_bank_id,total_questions)
    select auth.uid(),q.question_bank_id,count(*)::integer from public.bank_questions
    where question_bank_id=q.question_bank_id and status='active' returning * into attempt_row;
  end if;
  select * into existing_answer from public.question_attempt_answers where attempt_id=attempt_row.id and question_id=q.id;
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

create function public.submit_bank_answer(question_id text, option_id text)
returns jsonb language sql security invoker set search_path='' as $$ select private.submit_bank_answer(question_id,option_id); $$;
create function public.save_portfolio_content(payload jsonb)
returns void language sql security invoker set search_path='' as $$ select private.save_portfolio_content(payload); $$;
create function public.reset_portfolio_content()
returns void language sql security invoker set search_path='' as $$ select private.reset_portfolio_content(); $$;
create function public.admin_wallet_data()
returns jsonb language sql stable security invoker set search_path='' as $$ select private.admin_wallet_data(); $$;
create function public.manage_wallet_transaction(operation text,item_id uuid,payload jsonb default '{}')
returns void language sql security invoker set search_path='' as $$ select private.manage_wallet_transaction(operation,item_id,payload); $$;

revoke all on function private.portfolio_section_valid(text,jsonb), private.save_portfolio_content(jsonb), private.reset_portfolio_content(),
  private.admin_wallet_data(), private.manage_wallet_transaction(text,uuid,jsonb), private.submit_bank_answer(text,text)
  from public,anon;
grant execute on function private.portfolio_section_valid(text,jsonb), private.save_portfolio_content(jsonb), private.reset_portfolio_content(),
  private.admin_wallet_data(), private.manage_wallet_transaction(text,uuid,jsonb), private.submit_bank_answer(text,text)
  to authenticated;
revoke all on function public.save_portfolio_content(jsonb), public.reset_portfolio_content(), public.admin_wallet_data(),
  public.manage_wallet_transaction(text,uuid,jsonb), public.submit_bank_answer(text,text) from public,anon;
grant execute on function public.save_portfolio_content(jsonb), public.reset_portfolio_content(), public.admin_wallet_data(),
  public.manage_wallet_transaction(text,uuid,jsonb), public.submit_bank_answer(text,text) to authenticated;

commit;

begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';
-- Keep privilege-bearing implementations outside the exposed Data API schema.
-- Public entry points run as the caller; private bodies retain identity/role checks.
alter function public.admin_bank_data() set schema private;
alter function public.list_bank_access_requests() set schema private;
alter function public.manage_bank_content(text,text,jsonb) set schema private;
alter function public.review_bank_access(uuid,text,text) set schema private;
alter function public.submit_bank_answer(text,text) set schema private;

create function public.admin_bank_data() returns jsonb language sql stable security invoker set search_path='' as $$
  select private.admin_bank_data();
$$;
create function public.list_bank_access_requests() returns jsonb language sql stable security invoker set search_path='' as $$
  select private.list_bank_access_requests();
$$;
create function public.manage_bank_content(operation text,item_id text,payload jsonb default '{}') returns void language sql security invoker set search_path='' as $$
  select private.manage_bank_content(operation,item_id,payload);
$$;
create function public.review_bank_access(request_id uuid,decision text,reason text default null) returns void language sql security invoker set search_path='' as $$
  select private.review_bank_access(request_id,decision,reason);
$$;
create function public.submit_bank_answer(question_id text,option_id text) returns boolean language sql security invoker set search_path='' as $$
  select private.submit_bank_answer(question_id,option_id);
$$;
revoke all on function public.admin_bank_data(),public.list_bank_access_requests(),public.manage_bank_content(text,text,jsonb),public.review_bank_access(uuid,text,text),public.submit_bank_answer(text,text) from public,anon;
grant execute on function public.admin_bank_data(),public.list_bank_access_requests(),public.manage_bank_content(text,text,jsonb),public.review_bank_access(uuid,text,text),public.submit_bank_answer(text,text) to authenticated;
-- Explicitly document the deny-all policy; table grants are also revoked.
create policy no_direct_solution_reads on private.question_solutions for select to authenticated using (false);
commit;

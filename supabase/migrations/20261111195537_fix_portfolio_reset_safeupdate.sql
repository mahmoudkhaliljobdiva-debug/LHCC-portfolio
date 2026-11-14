-- Fix the authorized reset's PostgREST safeupdate failure without disabling safety.
-- Replaces code only; does not reset content during migration or alter privileges.
set lock_timeout = '5s';
set statement_timeout = '30s';
create or replace function private.reset_portfolio_content()
returns void language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  if not private.is_active_role('ADMIN') then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  update public.portfolio_content
    set content = default_content, revision = revision + 1,
        updated_by = auth.uid(), published = true
    where section_key in ('about','services','platform','contact');
  get diagnostics affected = row_count;
  if affected <> 4 then
    raise exception 'Portfolio defaults are not fully initialized' using errcode = '23514';
  end if;
end;
$$;

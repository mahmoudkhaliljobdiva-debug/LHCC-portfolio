begin;

-- Some Supabase projects include this event-trigger helper in the public
-- schema. Event triggers do not require PostgREST roles to execute the
-- underlying function, so prevent it from being exposed as an RPC endpoint.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable()
      from public, anon, authenticated;
  end if;
end;
$$;

commit;

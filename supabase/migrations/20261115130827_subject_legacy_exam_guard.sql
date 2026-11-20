-- Catalog access to approved free Subjects does not authorize legacy Exam Track
-- creation, answering or grading. Guard the shared definer entry point, not just
-- UI/read RPCs: SECURITY DEFINER exam selectors do not inherit question RLS.
-- Preserve all existing attempts/snapshots/keys and the existing function ACL.
set lock_timeout='5s';
create or replace function private.lock_exam_access(bank_id text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles where id=auth.uid() for share;
  perform 1 from public.question_banks where id=bank_id
    and material_kind='EXAM_TRACK' and publication_status='PUBLISHED' for share;
  if not found then raise exception 'Published exam track required' using errcode='42501'; end if;
  perform 1 from public.user_bank_access where user_id=auth.uid() and question_bank_id=bank_id for share;
  if not private.can_open_bank(bank_id) then raise exception 'Bank access required' using errcode='42501'; end if;
end $$;

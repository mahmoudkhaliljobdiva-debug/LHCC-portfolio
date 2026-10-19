-- Additive invalidation infrastructure. No business records are reset or reseeded.
create table private.live_revisions(topic text primary key, revision bigint not null default 0);
alter table private.live_revisions enable row level security;
revoke all on private.live_revisions from public,anon,authenticated;

create function private.emit_live(topic text,kind text,bank_id text default null,attempt_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  insert into private.live_revisions values(topic,1)
    on conflict on constraint live_revisions_pkey do update set revision=private.live_revisions.revision+1;
  -- Only hints, never rows, keys, answers, scores, names, email or financial values.
  -- A notification outage cannot undo a confirmed business transaction.
  begin
    perform realtime.send(jsonb_strip_nulls(jsonb_build_object('kind',kind,'bankId',bank_id,'attemptId',attempt_id)), 'invalidate',topic,true);
  exception when others then raise warning 'Live notification unavailable; revision reconciliation retained'; end;
end $$;
revoke all on function private.emit_live(text,text,text,uuid) from public,anon,authenticated;

create policy lhcc_receive_live_hints on realtime.messages for select to authenticated
using (extension='broadcast' and topic=(select realtime.topic()) and (
  (select realtime.topic())='lhcc:user:'||(select auth.uid())::text
  or ((select realtime.topic())='lhcc:catalog' and (select auth.uid()) is not null)
  or ((select realtime.topic())='lhcc:admin' and private.is_active_role('ADMIN'))
));
-- No INSERT policy: application clients cannot forge database change signals.

create function private.live_change() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb; bank text; person uuid; kind text; attempt uuid; teacher uuid;
begin
  r:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  bank:=r->>'question_bank_id';
  case tg_table_name
    when 'profiles' then
      perform private.emit_live('lhcc:user:'||(r->>'id'),'profile');
      perform private.emit_live('lhcc:admin','users');
    when 'teacher_bank_assignments' then
      perform private.emit_live('lhcc:user:'||(r->>'teacher_id'),'profile',bank);
      perform private.emit_live('lhcc:admin','users',bank);
    when 'user_bank_access_requests','user_bank_access' then
      person:=(r->>'user_id')::uuid;
      perform private.emit_live('lhcc:user:'||person,'access',bank);
      perform private.emit_live('lhcc:admin','access',bank);
    when 'wallet_transactions' then perform private.emit_live('lhcc:admin','wallet');
    when 'question_attempts' then
      attempt:=(r->>'id')::uuid;
      perform private.emit_live('lhcc:user:'||(r->>'student_id'),'attempt',bank,attempt);
      if r->>'status'='COMPLETED' and (tg_op='INSERT' or to_jsonb(old)->>'status' is distinct from 'COMPLETED') then
        perform private.emit_live('lhcc:admin','attempt',bank,attempt);
        for teacher in select teacher_id from public.teacher_bank_assignments where question_bank_id=bank loop
          perform private.emit_live('lhcc:user:'||teacher,'attempt',bank);
        end loop;
      end if;
    else
      bank:=coalesce(bank,case when tg_table_name='question_banks' then r->>'id' end);
      kind:=case when tg_table_name='portfolio_content' then 'portfolio'
        when tg_table_name in ('shared_exams','past_exams') then 'exams'
        when tg_table_name in ('bank_questions','question_sections') then 'questions' else 'catalog' end;
      perform private.emit_live('lhcc:admin',kind,bank);
      if tg_table_name not in ('shared_exams','past_exams') or r->>'status'<>'DRAFT'
        or (tg_op='UPDATE' and to_jsonb(old)->>'status'='PUBLISHED') then
        perform private.emit_live('lhcc:catalog',kind,bank);
      end if;
  end case;
  return null;
end $$;
revoke all on function private.live_change() from public,anon,authenticated;
create function private.live_practice_change() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.question_attempts;
begin
  select * into a from public.question_attempts where id=new.attempt_id;
  perform private.emit_live('lhcc:user:'||a.student_id,'attempt',a.question_bank_id,a.id);
  return null;
end $$;
revoke all on function private.live_practice_change() from public,anon,authenticated;
create trigger lhcc_live_practice after insert on private.practice_checks for each row execute function private.live_practice_change();
do $$ declare t text; begin
  foreach t in array array['profiles','teacher_bank_assignments','user_bank_access_requests','user_bank_access',
    'wallet_transactions','question_attempts','question_banks','bank_questions','question_sections','specialties','shared_exams','past_exams','portfolio_content'] loop
    execute format('create trigger lhcc_live_change after insert or update or delete on public.%I for each row execute function private.live_change()',t);
  end loop;
end $$;

create function private.live_sync_state(bank_id text default null,attempt_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.profiles; active boolean; allowed boolean:=null; b text:=bank_id; rev text;
begin
  select * into p from public.profiles where id=auth.uid();
  if not found then raise exception 'Authenticated profile required' using errcode='42501'; end if;
  active:=public.is_profile_access_active(p.status,p.role,p.expiration_date);
  if attempt_id is not null then
    select a.question_bank_id into b from public.question_attempts a where a.id=attempt_id and a.student_id=p.id;
    if not found then allowed:=false; end if;
  end if;
  if b is not null then
    allowed:=active and (case when p.role='STUDENT' then private.can_open_bank(b)
      when p.role='TEACHER' then private.teacher_has_bank(b) else p.role='ADMIN' end);
  end if;
  select coalesce(string_agg(topic||':'||revision::text,',' order by topic),'0') into rev from private.live_revisions
    where topic='lhcc:user:'||p.id or (attempt_id is null and topic='lhcc:catalog') or (p.role='ADMIN' and active and topic='lhcc:admin');
  return jsonb_build_object('userId',p.id,'role',p.role,'status',case when not active and p.status='ACTIVE' then 'EXPIRED' else p.status::text end,
    'revision',rev,'bankAllowed',allowed);
end $$;
create function public.live_sync_state(bank_id text default null,attempt_id uuid default null) returns jsonb
language sql security invoker set search_path='' as $$ select private.live_sync_state(bank_id,attempt_id) $$;
create function private.catalog_revision() returns text language sql stable security definer set search_path='' as $$
  select coalesce((select revision::text from private.live_revisions where topic='lhcc:catalog'),'0')
$$;
create function public.catalog_revision() returns text language sql stable security invoker set search_path=''
begin atomic select private.catalog_revision(); end;
revoke all on function private.live_sync_state(text,uuid),public.live_sync_state(text,uuid) from public,anon;
grant execute on function private.live_sync_state(text,uuid),public.live_sync_state(text,uuid) to authenticated;
revoke all on function private.catalog_revision(),public.catalog_revision() from public;
grant execute on function private.catalog_revision(),public.catalog_revision() to anon,authenticated;

-- Revocation preserves the request history, attempt snapshots and signed ledger.
create function private.revoke_bank_access(request_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.is_active_role('ADMIN') then raise exception 'Admin required' using errcode='42501'; end if;
  update public.user_bank_access a set status='REVOKED',revoked_at=clock_timestamp()
    where a.request_id=revoke_bank_access.request_id and a.status='ACTIVE';
  if not found then raise exception 'Active approval not found' using errcode='23514'; end if;
end $$;
create function public.revoke_bank_access(request_id uuid) returns void language sql security invoker set search_path='' as $$ select private.revoke_bank_access(request_id) $$;
revoke all on function private.revoke_bank_access(uuid),public.revoke_bank_access(uuid) from public,anon;
grant execute on function private.revoke_bank_access(uuid),public.revoke_bank_access(uuid) to authenticated;

-- Global attempt version detects cross-tab writes, including legacy-client writes.
alter table public.question_attempts add column answer_version bigint not null default 0;
create function private.bump_answer_version() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.question_attempts set answer_version=answer_version+1 where id=new.attempt_id;
  return null;
end $$;
revoke all on function private.bump_answer_version() from public,anon,authenticated;
create trigger lhcc_answer_version after insert or update on public.question_attempt_answers for each row execute function private.bump_answer_version();
alter function private.exam_data(uuid,uuid) rename to pre_live_exam_data;
revoke all on function private.pre_live_exam_data(uuid,uuid) from public,anon,authenticated;
create function private.exam_data(attempt_id uuid,subject_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; v bigint;
begin
  result:=private.pre_live_exam_data(attempt_id,subject_id);
  select answer_version into v from public.question_attempts where id=attempt_id;
  return result||jsonb_build_object('answerVersion',v);
end $$;
revoke all on function private.exam_data(uuid,uuid) from public,anon;
grant execute on function private.exam_data(uuid,uuid) to authenticated;
create function private.save_exam_answer_versioned(attempt_id uuid,question_id text,option_id text,expected_version bigint) returns bigint
language plpgsql security definer set search_path='' as $$
declare a public.question_attempts;
begin
  select * into a from public.question_attempts t where t.id=attempt_id and t.student_id=auth.uid() and t.mode='EXAM';
  if not found then raise exception 'Owned attempt required' using errcode='42501'; end if;
  perform private.lock_exam_access(a.question_bank_id);
  select * into a from public.question_attempts t where t.id=attempt_id for update;
  if a.answer_version is distinct from expected_version then raise exception 'Attempt changed in another session' using errcode='40001'; end if;
  perform private.save_exam_answer(attempt_id,question_id,option_id);
  return (select answer_version from public.question_attempts where id=attempt_id);
end $$;
create function public.save_exam_answer_versioned(attempt_id uuid,question_id text,option_id text,expected_version bigint) returns bigint
language sql security invoker set search_path='' as $$ select private.save_exam_answer_versioned(attempt_id,question_id,option_id,expected_version) $$;
revoke all on function private.save_exam_answer_versioned(uuid,text,text,bigint),public.save_exam_answer_versioned(uuid,text,text,bigint) from public,anon;
grant execute on function private.save_exam_answer_versioned(uuid,text,text,bigint),public.save_exam_answer_versioned(uuid,text,text,bigint) to authenticated;

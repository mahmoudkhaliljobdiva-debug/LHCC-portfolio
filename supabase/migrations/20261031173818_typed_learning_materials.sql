-- Phase 2 foundation only. No reassignment, seeds, grants, sales or content deletion.
-- Legacy banks retain their identities, prices, images, publication and history.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.question_banks
 add column material_kind text not null default 'EXAM_TRACK' check(material_kind in ('SUBJECT','EXAM_TRACK')),
 add column exam_category text default 'OTHER' check(exam_category in ('COLLOQUIUM','PROMETRIC','OTHER')),
 add column publication_status text not null default 'PUBLISHED' check(publication_status in ('DRAFT','PUBLISHED','ARCHIVED')),
 add column material_icon text not null default 'book' check(material_icon in ('book','brain','stethoscope','nursing','dentistry','graduation','clipboard','other')),
 add column content_language text not null default 'auto' check(content_language in ('auto','ar','en','mixed')),
 add constraint question_banks_material_shape check(
  (material_kind='EXAM_TRACK' and exam_category is not null)
  or (material_kind='SUBJECT' and exam_category is null and specialty_id is not null
      and price=0 and publication_status='DRAFT' and status='inactive'));
create index question_banks_material_page_idx on public.question_banks(material_kind,display_order,id);

-- A database-level invariant also protects service-side or older admin paths.
create function private.guard_material_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.material_kind is distinct from old.material_kind and (
  exists(select 1 from public.bank_questions where question_bank_id=old.id)
  or exists(select 1 from public.question_sections where question_bank_id=old.id)
  or exists(select 1 from public.bank_chapters where question_bank_id=old.id)
  or exists(select 1 from public.bank_generation_settings where question_bank_id=old.id)
  or exists(select 1 from public.user_bank_access where question_bank_id=old.id)
  or exists(select 1 from public.user_bank_access_requests where question_bank_id=old.id)
  or exists(select 1 from public.question_attempts where question_bank_id=old.id)
  or exists(select 1 from public.exam_sources where question_bank_id=old.id)
  or exists(select 1 from public.past_exams where question_bank_id=old.id)
  or exists(select 1 from public.shared_exams where question_bank_id=old.id)
  or exists(select 1 from public.teacher_bank_assignments where question_bank_id=old.id)
  or exists(select 1 from public.wallet_transactions where question_bank_id=old.id)) then
  raise exception 'A populated material cannot change type' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function private.guard_material_identity() from public,anon,authenticated;
create trigger material_identity before update on public.question_banks for each row execute function private.guard_material_identity();

-- Preserve this OID: existing policies and pre-bound functions depend on it.
create or replace function private.can_open_bank(bank_id text) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active_role('STUDENT') and exists(
  select 1 from public.user_bank_access a join public.question_banks b on b.id=a.question_bank_id
  where a.user_id=(select auth.uid()) and a.question_bank_id=bank_id and a.status='ACTIVE'
   and b.status='active' and b.material_kind='EXAM_TRACK' and b.publication_status='PUBLISHED')
$$;
revoke all on function private.can_open_bank(text) from public,anon;
grant execute on function private.can_open_bank(text) to authenticated;
alter policy bank_catalog on public.question_banks using(
 (status='active' and material_kind='EXAM_TRACK' and publication_status='PUBLISHED' and (select private.is_active_role('STUDENT')))
 or private.teacher_has_bank(id) or (select private.is_active_role('ADMIN')));
alter policy own_pending_request on public.user_bank_access_requests with check(
 user_id=(select auth.uid()) and (select private.is_active_role('STUDENT')) and status='PENDING'
 and reviewed_at is null and reviewed_by is null and rejection_reason is null
 and exists(select 1 from public.question_banks b where b.id=question_bank_id and b.status='active'
  and b.material_kind='EXAM_TRACK' and b.publication_status='PUBLISHED')
 and not private.can_open_bank(question_bank_id));

-- The original public function is invoker and remains subject to the INSERT
-- policy above; explicit validation gives a useful denial before insertion.
create or replace function public.request_bank_access(bank_id text) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 if not private.is_active_role('STUDENT') then raise exception 'Student access required' using errcode='42501'; end if;
 if not exists(select 1 from public.question_banks b where b.id=bank_id and b.status='active'
  and b.material_kind='EXAM_TRACK' and b.publication_status='PUBLISHED') then
  raise exception 'Published exam track required' using errcode='42501'; end if;
 insert into public.user_bank_access_requests(question_bank_id) values(bank_id) returning id into result;
 return result;
end $$;
revoke all on function public.request_bank_access(text) from public,anon;
grant execute on function public.request_bank_access(text) to authenticated;

create or replace function private.review_bank_access(request_id uuid,decision text,reason text default null) returns void language plpgsql security definer set search_path='' as $$
declare r public.user_bank_access_requests; access_row public.user_bank_access; bank_row public.question_banks;
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if decision is null or decision not in ('APPROVED','REJECTED') then raise exception 'Invalid decision'; end if;
 select * into r from public.user_bank_access_requests where id=request_id for update;
 if not found or r.status<>'PENDING' then raise exception 'Request is no longer pending'; end if;
 if decision='APPROVED' then
  select * into bank_row from public.question_banks where id=r.question_bank_id and status='active'
   and material_kind='EXAM_TRACK' and publication_status='PUBLISHED' for share;
  if not found then raise exception 'Published exam track required' using errcode='42501'; end if;
  perform 1 from public.profiles where id=r.user_id and role='STUDENT' and status='ACTIVE' for share;
  if not found then raise exception 'Student account is disabled' using errcode='42501'; end if;
  insert into public.user_bank_access(user_id,question_bank_id,granted_by,request_id,price)
   values(r.user_id,r.question_bank_id,auth.uid(),r.id,bank_row.price)
   on conflict(user_id,question_bank_id) do update set status='ACTIVE',granted_at=statement_timestamp(),
    granted_by=auth.uid(),request_id=r.id,price=excluded.price,revoked_at=null returning * into access_row;
  if bank_row.price>0 then
   insert into public.wallet_transactions(transaction_type,name,description,amount,user_id,question_bank_id,user_bank_access_id,created_by,transaction_date)
    values('BANK_SALE',bank_row.name||' access',bank_row.name||' access granted',bank_row.price,r.user_id,r.question_bank_id,access_row.id,auth.uid(),current_date)
    on conflict(user_bank_access_id) where transaction_type='BANK_SALE' do nothing;
  end if;
 end if;
 update public.user_bank_access_requests set status=decision,reviewed_at=statement_timestamp(),reviewed_by=auth.uid(),
  rejection_reason=case when decision='REJECTED' then nullif(btrim(reason),'') else null end where id=r.id;
end $$;
revoke all on function private.review_bank_access(uuid,text,text) from public,anon;
grant execute on function private.review_bank_access(uuid,text,text) to authenticated;

-- No interim subject-bank entitlement or per-subject sale, including trusted
-- server entrypoints. Existing grants/sale history are not changed.
create function private.guard_subject_commerce() returns trigger language plpgsql security definer set search_path='' as $$
declare kind text;
begin
 -- Lock before reading the kind, not in a later alphabetical BEFORE trigger.
 select b.material_kind into kind from public.question_banks b where b.id=new.question_bank_id for share;
 if (tg_table_name='user_bank_access' or to_jsonb(new)->>'transaction_type'='BANK_SALE') and kind='SUBJECT' then
  raise exception 'Subject access and sales are not available' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function private.guard_subject_commerce() from public,anon,authenticated;
create trigger material_access_guard before insert or update on public.user_bank_access for each row execute function private.guard_subject_commerce();
create trigger material_sale_guard before insert or update on public.wallet_transactions for each row execute function private.guard_subject_commerce();

create function private.guard_material_request() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.question_banks where id=new.question_bank_id and material_kind='EXAM_TRACK'
  and publication_status='PUBLISHED' and status='active' for share;
 if not found then raise exception 'Published active exam track required' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function private.guard_material_request() from public,anon,authenticated;
create trigger material_request_guard before insert on public.user_bank_access_requests for each row execute function private.guard_material_request();

-- Preserve this OID too: public.learning_catalog is a pre-bound SQL invoker
-- wrapper. Anonymous users still receive no private-schema USAGE.
create or replace function private.learning_catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'slug',s.slug,'name',s.name,'description',s.description,'icon',s.icon,
  'materials',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'description',b.description,
   'materialKind',b.material_kind,'examCategory',b.exam_category,'icon',b.material_icon,'language',b.content_language) order by b.display_order,b.id)
   from public.question_banks b where b.specialty_id=s.id and b.status='active' and b.material_kind='EXAM_TRACK'
    and b.publication_status='PUBLISHED'),'[]')) order by s.display_order,s.id),'[]')
 from public.specialties s where s.published
$$;
revoke all on function private.learning_catalog() from public;
grant execute on function private.learning_catalog() to anon,authenticated;

-- Keep the legacy question-bank editor scoped to Exam Tracks. Subject backing
-- rows belong exclusively to typed material management. Preserve this OID and
-- the existing single-call question/case projection; do not fetch a second pool.
create or replace function private.admin_bank_data() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 return jsonb_build_object(
  'banks',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'description',b.description,'status',b.status,
   'displayOrder',b.display_order,'imageUrl',b.image_url,'price',b.price,'createdAt',b.created_at,'updatedAt',b.updated_at) order by b.display_order)
   from public.question_banks b where b.material_kind='EXAM_TRACK'),'[]'::jsonb),
  'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'bankId',s.question_bank_id,'title',s.title,
   'description',s.description,'displayOrder',s.display_order,'createdAt',s.created_at,'updatedAt',s.updated_at)
   order by s.question_bank_id,s.display_order) from public.question_sections s
   join public.question_banks b on b.id=s.question_bank_id where b.material_kind='EXAM_TRACK'),'[]'::jsonb),
  'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'bankId',q.question_bank_id,'sectionId',q.section_id,
   'displayOrder',q.display_order,'text',q.text,'status',q.status,'type','QCU','createdAt',q.created_at,'updatedAt',q.updated_at,
   'answers',(select jsonb_agg(o||jsonb_build_object('isCorrect',o->>'id'=s.correct_option_id)) from jsonb_array_elements(q.options) o))
   order by q.question_bank_id,coalesce(sec.display_order,2147483647),coalesce(q.display_order,2147483647),q.created_at)
   from public.bank_questions q join private.question_solutions s on s.question_id=q.id
   join public.question_banks b on b.id=q.question_bank_id
   left join public.question_sections sec on sec.id=q.section_id and sec.question_bank_id=q.question_bank_id
   where b.material_kind='EXAM_TRACK'),'[]'::jsonb));
end $$;
revoke all on function private.admin_bank_data() from public,anon;
grant execute on function private.admin_bank_data() to authenticated;

create function private.admin_learning_materials(kind text,page_number integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if kind is null or kind not in ('SUBJECT','EXAM_TRACK') or page_number is null or page_number not between 0 and 100000 then
  raise exception 'Invalid material type or page' using errcode='23514'; end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'description',b.description,
  'specialtyId',b.specialty_id,'materialKind',b.material_kind,'examCategory',b.exam_category,'publicationStatus',b.publication_status,
  'icon',b.material_icon,'language',b.content_language,'displayOrder',b.display_order,'status',b.status) order by b.display_order,b.id)
  from (select * from public.question_banks where material_kind=kind order by display_order,id limit 20 offset page_number*20) b),'[]'),
  'total',(select count(*) from public.question_banks where material_kind=kind));
end $$;
create function public.admin_learning_materials(kind text,page_number integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$ select private.admin_learning_materials(kind,page_number) $$;

create function private.save_learning_material(payload jsonb) returns text language plpgsql security definer set search_path='' as $$
declare bid text; k text; category text; publication text; state text; specialty uuid; old_bank public.question_banks; new_record boolean;
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Invalid material payload' using errcode='23514'; end if;
 if not(payload ?& array['id','name','description','specialtyId','materialKind','examCategory','publicationStatus','icon','language','displayOrder','status'])
  or exists(select 1 from jsonb_object_keys(payload) t(key)
  where key not in ('id','name','description','specialtyId','materialKind','examCategory','publicationStatus','icon','language','displayOrder','status')) then
  raise exception 'Invalid material payload' using errcode='23514'; end if;
 if exists(select 1 from unnest(array['id','name','description','materialKind','publicationStatus','icon','language','status']) key
   where jsonb_typeof(payload->key) is distinct from 'string')
  or jsonb_typeof(payload->'displayOrder') is distinct from 'number'
  or (payload->>'displayOrder') !~ '^[0-9]{1,9}$'
  or (jsonb_typeof(payload->'specialtyId') not in ('string','null'))
  or (jsonb_typeof(payload->'examCategory') not in ('string','null')) then
  raise exception 'Invalid material field types' using errcode='23514'; end if;
 bid:=payload->>'id'; k:=payload->>'materialKind'; category:=payload->>'examCategory';
 publication:=payload->>'publicationStatus'; state:=payload->>'status';
 if bid is null or length(bid) not between 1 and 200 or bid !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  or length(btrim(payload->>'name')) not between 1 and 200 or length(btrim(payload->>'description')) not between 1 and 5000
  or k not in ('SUBJECT','EXAM_TRACK') or publication not in ('DRAFT','PUBLISHED','ARCHIVED') or state not in ('active','inactive')
  or payload->>'icon' not in ('book','brain','stethoscope','nursing','dentistry','graduation','clipboard','other')
  or payload->>'language' not in ('auto','ar','en','mixed')
  or (k='EXAM_TRACK' and (category is null or category not in ('COLLOQUIUM','PROMETRIC','OTHER')))
  or (k='SUBJECT' and category is not null) then
  raise exception 'Invalid material fields' using errcode='23514'; end if;
 begin specialty:=(payload->>'specialtyId')::uuid;
 exception when invalid_text_representation then raise exception 'Invalid specialty' using errcode='23514'; end;
 if (specialty is not null and not exists(select 1 from public.specialties where id=specialty))
  or (k='SUBJECT' and specialty is null) then raise exception 'Valid specialty required' using errcode='23514'; end if;
 if k='SUBJECT' and (publication<>'DRAFT' or state<>'inactive') then
  raise exception 'Subjects remain draft and inactive until lessons and entitlements are available' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended('material:'||bid,0));
 select * into old_bank from public.question_banks where id=bid for update; new_record:=not found;
 if new_record then
  if publication<>'DRAFT' or state<>'inactive' then raise exception 'New materials must begin draft and inactive' using errcode='23514'; end if;
  insert into public.question_banks(id,name,description,specialty_id,material_kind,exam_category,publication_status,material_icon,content_language,status,display_order,created_by)
   values(bid,btrim(payload->>'name'),btrim(payload->>'description'),specialty,k,category,publication,payload->>'icon',payload->>'language',state,(payload->>'displayOrder')::integer,auth.uid());
 else
  if k='SUBJECT' and old_bank.price<>0 then raise exception 'Paid banks cannot become subjects' using errcode='23514'; end if;
  update public.question_banks set name=btrim(payload->>'name'),description=btrim(payload->>'description'),specialty_id=specialty,
   material_kind=k,exam_category=category,publication_status=publication,material_icon=payload->>'icon',content_language=payload->>'language',
   status=state,display_order=(payload->>'displayOrder')::integer where id=bid;
 end if;
 return bid;
end $$;
create function public.save_learning_material(payload jsonb) returns text language sql security invoker set search_path='' as $$ select private.save_learning_material(payload) $$;
revoke all on function private.admin_learning_materials(text,integer),public.admin_learning_materials(text,integer),private.save_learning_material(jsonb),public.save_learning_material(jsonb) from public,anon;
grant execute on function private.admin_learning_materials(text,integer),public.admin_learning_materials(text,integer),private.save_learning_material(jsonb),public.save_learning_material(jsonb) to authenticated;

-- The old editor can maintain existing exam-bank commercial fields, but it
-- cannot create a published bank or reclassify/activate a Subject.
alter function private.manage_bank_content(text,text,jsonb) rename to pretyped_manage_bank_content;
revoke all on function private.pretyped_manage_bank_content(text,text,jsonb) from public,anon,authenticated;
create function private.manage_bank_content(operation text,item_id text,payload jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 if operation='save_bank' then
  if payload ?| array['materialKind','examCategory','publicationStatus','icon','language','specialtyId']
   or not exists(select 1 from public.question_banks where id=item_id and material_kind='EXAM_TRACK') then
   raise exception 'Use typed material management' using errcode='23514'; end if;
 end if;
 perform private.pretyped_manage_bank_content(operation,item_id,payload);
end $$;
create or replace function public.manage_bank_content(operation text,item_id text,payload jsonb default '{}') returns void language sql security invoker set search_path='' as $$ select private.manage_bank_content(operation,item_id,payload) $$;
revoke all on function private.manage_bank_content(text,text,jsonb),public.manage_bank_content(text,text,jsonb) from public,anon;
grant execute on function private.manage_bank_content(text,text,jsonb),public.manage_bank_content(text,text,jsonb) to authenticated;

-- Every historical/shared/source mutation, including older private functions,
-- is constrained at the actual data boundary. Existing archived rows survive.
create function private.guard_exam_material() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.question_banks where id=new.question_bank_id and material_kind='EXAM_TRACK'
  and publication_status='PUBLISHED' for share;
 if not found then raise exception 'Published exam track required' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function private.guard_exam_material() from public,anon,authenticated;
create trigger source_material_guard before insert or update on public.exam_sources for each row execute function private.guard_exam_material();
create trigger past_material_guard before insert or update on public.past_exams for each row execute function private.guard_exam_material();
create trigger shared_material_guard before insert or update on public.shared_exams for each row execute function private.guard_exam_material();

-- Guard idempotent/no-write paths as well as the mutation triggers above.
create function private.require_exam_material(bank_id text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_active_role('ADMIN') then raise exception 'Administrator access required' using errcode='42501'; end if;
 perform 1 from public.question_banks where id=bank_id and material_kind='EXAM_TRACK' and publication_status='PUBLISHED' for share;
 if not found then raise exception 'Published exam track required' using errcode='23514'; end if;
end $$;
revoke all on function private.require_exam_material(text) from public,anon,authenticated;
alter function private.generate_shared_exam(jsonb) rename to pretyped_generate_shared_exam;
alter function private.save_shared_exam(jsonb) rename to pretyped_save_shared_exam;
alter function private.register_exam_source(jsonb) rename to pretyped_register_exam_source;
alter function private.save_past_exam(jsonb) rename to pretyped_save_past_exam;
revoke all on function private.pretyped_generate_shared_exam(jsonb),private.pretyped_save_shared_exam(jsonb),
 private.pretyped_register_exam_source(jsonb),private.pretyped_save_past_exam(jsonb) from public,anon,authenticated;
create function private.generate_shared_exam(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
begin perform private.require_exam_material(payload->>'bankId'); return private.pretyped_generate_shared_exam(payload); end $$;
create function private.save_shared_exam(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_exam_material((select question_bank_id from public.shared_exams where id=(payload->>'id')::uuid));
 perform private.pretyped_save_shared_exam(payload);
end $$;
create function private.register_exam_source(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
begin perform private.require_exam_material(payload->>'bankId'); return private.pretyped_register_exam_source(payload); end $$;
create function private.save_past_exam(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
begin perform private.require_exam_material(payload->>'bankId'); return private.pretyped_save_past_exam(payload); end $$;
create or replace function public.generate_shared_exam(payload jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.generate_shared_exam(payload) $$;
create or replace function public.save_shared_exam(payload jsonb) returns void language sql security invoker set search_path='' as $$ select private.save_shared_exam(payload) $$;
create or replace function public.register_exam_source(payload jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.register_exam_source(payload) $$;
create or replace function public.save_past_exam(payload jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.save_past_exam(payload) $$;
revoke all on function private.generate_shared_exam(jsonb),public.generate_shared_exam(jsonb),private.save_shared_exam(jsonb),public.save_shared_exam(jsonb),
 private.register_exam_source(jsonb),public.register_exam_source(jsonb),private.save_past_exam(jsonb),public.save_past_exam(jsonb) from public,anon;
grant execute on function private.generate_shared_exam(jsonb),public.generate_shared_exam(jsonb),private.save_shared_exam(jsonb),public.save_shared_exam(jsonb),
 private.register_exam_source(jsonb),public.register_exam_source(jsonb),private.save_past_exam(jsonb),public.save_past_exam(jsonb) to authenticated;

-- The administrative student-preview branch of the existing metadata stack
-- checks grants directly. Require the typed publication invariant before it.
alter function private.exam_bank_data(text,uuid) rename to pretyped_exam_bank_data;
revoke all on function private.pretyped_exam_bank_data(text,uuid) from public,anon,authenticated;
create function private.exam_bank_data(bank_id text,subject_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.question_banks where id=bank_id and material_kind='EXAM_TRACK' and publication_status='PUBLISHED') then
  raise exception 'Published exam track required' using errcode='42501'; end if;
 return private.pretyped_exam_bank_data(bank_id,subject_id);
end $$;
create or replace function public.exam_bank_data(bank_id text,subject_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.exam_bank_data(bank_id,subject_id) $$;
revoke all on function private.exam_bank_data(text,uuid),public.exam_bank_data(text,uuid) from public,anon;
grant execute on function private.exam_bank_data(text,uuid),public.exam_bank_data(text,uuid) to authenticated;

-- Serialize dependency insertion with a material-type update. FK KEY SHARE
-- alone does not conflict with a non-key UPDATE, so it is insufficient here.
create function private.lock_material_reference() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.question_banks where id=new.question_bank_id for share;
 return new;
end $$;
revoke all on function private.lock_material_reference() from public,anon,authenticated;
do $$ declare relation_name text; begin
 foreach relation_name in array array['bank_questions','question_sections','bank_chapters','bank_generation_settings',
  'user_bank_access','user_bank_access_requests','question_attempts','teacher_bank_assignments','wallet_transactions'] loop
  execute format('create trigger material_reference_lock before insert or update on public.%I for each row execute function private.lock_material_reference()',relation_name);
 end loop;
end $$;

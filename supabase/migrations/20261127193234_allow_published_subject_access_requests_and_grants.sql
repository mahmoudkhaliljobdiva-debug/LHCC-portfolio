-- Permit student access requests and admin grants for active, published subjects.
-- Existing SUBJECT bank-sale restrictions remain in place; the current published subjects are free.
-- No existing rows or request history are modified.
CREATE OR REPLACE FUNCTION private.guard_material_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform 1 from public.question_banks where id=new.question_bank_id and material_kind in ('EXAM_TRACK','SUBJECT')
  and publication_status='PUBLISHED' and status='active'
  and exists (select 1 from public.specialties s where s.id=specialty_id and s.published)
  for share;
 if not found then raise exception 'Published active course required' using errcode='23514'; end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.guard_subject_commerce()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare kind text;
begin
 -- Lock before reading the kind, not in a later alphabetical BEFORE trigger.
 select b.material_kind into kind from public.question_banks b where b.id=new.question_bank_id for share;
 if to_jsonb(new)->>'transaction_type'='BANK_SALE' and kind='SUBJECT' then
  raise exception 'Subject sale records are not available' using errcode='23514';
 end if;
 return new;
end $function$;

-- LOCAL archive-db ONLY. Historical production entry 20260924070649 is already
-- applied remotely; this is not a new migration and must never be pushed to it.
-- Reproduce its default privileges and two verified timestamp-default differences
-- before testing new migrations against the isolated local schema.
alter default privileges for role postgres in schema public
 revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
 revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
 revoke usage, select on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter table public.question_sections alter column created_at set default statement_timestamp();
alter table public.question_sections alter column updated_at set default statement_timestamp();

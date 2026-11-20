// Reconstruct only this feature's pre-DDL state inside a transaction, replay the
// entire migration and ROLLBACK. Local-only, no persisted schema/data changes.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const container='supabase_db_archive-db';
const info=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.equal(info.Config.Labels['com.supabase.cli.project'],'archive-db');
const migration=await readFile('supabase/migrations/20261114165153_subject_question_review.sql','utf8');
const followup=await readFile('supabase/migrations/20261114170912_subject_global_duplicate_review.sql','utf8');
const indexes=await readFile('supabase/migrations/20261114171408_subject_duplicate_lookup_indexes.sql','utf8');
const examGuard=await readFile('supabase/migrations/20261115130827_subject_legacy_exam_guard.sql','utf8');
const directSave=await readFile('supabase/migrations/20261115140100_subject_direct_question_management.sql','utf8');
const before=`begin;
drop function if exists public.save_reviewed_subject_question(text,text,jsonb),private.save_reviewed_subject_question(text,text,jsonb);
drop policy subject_approved_questions_only on public.bank_questions;
drop function public.admin_subject_materials(text,integer),public.admin_subject_questions(text,integer,text,text,uuid),public.manage_subject_import(text,text,uuid,jsonb),public.delete_subject_question(text,text),public.save_subject_metadata(jsonb);
drop function private.admin_subject_materials(text,integer),private.admin_subject_questions(text,integer,text,text,uuid),private.manage_subject_import(text,text,uuid,jsonb),private.delete_subject_question(text,text),private.save_subject_metadata(jsonb),private.subject_question_eligible(text);
drop table private.question_import_events,private.question_import_pages;
drop index private.question_answer_reviews_reviewer_idx;
drop index if exists public.subject_question_text_lookup_idx,private.subject_staging_text_lookup_idx;
alter table private.question_import_sources drop column source_kind;
alter table private.question_import_staging drop column revision,drop column reviewed_by,drop column reviewed_at,drop column imported_at;
alter table private.question_answer_reviews drop column approval_status,drop column explanation_origin;
`;
execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],{input:before+migration+'\n'+followup+'\n'+indexes+'\n'+examGuard+'\n'+directSave+'\nrollback;\n',encoding:'utf8',timeout:90000});
console.log('PASS complete Subject migration replay; all changes rolled back; existing local data preserved.');

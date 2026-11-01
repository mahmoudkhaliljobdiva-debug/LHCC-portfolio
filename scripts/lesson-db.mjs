// LOCAL archive-db only. No hosted URL, .env file, or service credential is read.
// Default runs rollback SQL; --apply is an explicit reviewed local migration;
// --concurrency uses generated committed fixtures and finally removes exact IDs.
import {execFileSync, spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => !['--apply', '--concurrency'].includes(arg))) {
  throw Error('Usage: node scripts/lesson-db.mjs [--apply | --concurrency]');
}
const container = 'supabase_db_archive-db';
const info = JSON.parse(execFileSync('docker', ['inspect', container], {encoding: 'utf8'}))[0];
if (info.Config.Labels['com.supabase.cli.project'] !== 'archive-db' || !info.State.Running) {
  throw Error('Running isolated archive-db required; refusing any other target');
}
const dockerArgs = ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-P', 'pager=off'];
const control = sql => execFileSync('docker', dockerArgs, {
  input: `set lock_timeout='4s'; set statement_timeout='15s';\n${sql}\n`, encoding: 'utf8',
  stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000,
}).trim();

if (!args.includes('--concurrency')) {
  const apply = args.includes('--apply');
  const sql = await readFile(apply
    ? 'supabase/migrations/20261031185924_subject_lessons_private_pdfs.sql'
    : 'supabase/tests/subject_lessons.sql', 'utf8');
  try {
    if (apply && control("select to_regprocedure('private.guard_material_identity()') is not null and exists(select 1 from pg_attribute where attrelid='public.question_banks'::regclass and attname='material_kind') and to_regclass('public.lessons') is null;") !== 't') {
      throw Error('Phase 2 foundation required and lesson migration must not already be applied');
    }
    const output = control(apply ? `begin;\n${sql}\ncommit;` : sql);
    const lastLine = output.trim().split('\n').at(-1);
    console.log(apply ? 'Local lesson migration applied.' : `PASS lesson rollback: ${lastLine} checks; all fixtures rolled back.`);
  } catch (error) {
    console.error(error.stderr?.toString() ?? error.message);
    process.exitCode = 1;
  }
} else {
  await concurrency();
}

async function concurrency() {
  if (control("select to_regprocedure('public.save_lesson(jsonb)') is not null;") !== 't') {
    throw Error('Reviewed lesson migration must be present in isolated archive-db');
  }
  const adminId = control("select id from public.profiles where role='ADMIN' and status='ACTIVE' limit 1;");
  if (!/^[0-9a-f-]{36}$/.test(adminId)) throw Error('Active local administrator required');
  const runId = randomUUID();
  const specialtyId = randomUUID();
  const bankId = `lesson-race-${runId}`;
  const otherBankId = `lesson-race-other-${runId}`;
  const chapterId = randomUUID();
  const otherChapterId = randomUUID();
  const lessonId = randomUUID();
  const claimId = randomUUID();
  const questionLessonId = randomUUID();
  const otherQuestionLessonId = randomUUID();
  const questionId = `lesson-question-race-${runId}`;
  const caseId = `lesson-case-race-${runId}`;
  const caseQuestionId = `lesson-case-question-${runId}`;
  const otherCaseQuestionId = `lesson-other-case-question-${runId}`;
  const caseLessonId = randomUUID();
  const otherCaseLessonId = randomUUID();
  const trackId = `lesson-legacy-race-${runId}`;
  const documentId = randomUUID();
  const objectPath = `${lessonId}/${documentId}.pdf`;
  const sessions = [];
  let sequence = 0;
  let checks = 0;
  let fixtureStarted = false;
  const assert = (value, label) => {
    if (!value) throw Error(`FAIL ${label}`);
    checks += 1;
    console.log(`PASS ${label}`);
  };
  const payload = (revision, status = 'DRAFT', overrides = {}) => JSON.stringify({
    id: lessonId, bankId, chapterId, title: '[TEST] Race lesson', description: 'Generated local-only fixture',
    displayOrder: 0, language: 'auto', status, expectedRevision: revision, questions: [], ...overrides,
  });
  const save = (revision, status, overrides) => `select public.save_lesson('${payload(revision, status, overrides)}'::jsonb);`;
  const expectState = (sql, state) => `do $$ begin begin ${sql} raise exception 'Expected ${state}' using errcode='XX000';
    exception when sqlstate '${state}' then null; end; end $$;`;

  class Session {
    constructor(label) {
      this.label = label;
      this.applicationName = `lhcc-lesson-${runId}-${label}`;
      this.stdout = '';
      this.stderr = '';
      this.exited = false;
      this.listeners = [];
      this.process = spawn('docker', dockerArgs, {stdio: ['pipe', 'pipe', 'pipe']});
      this.process.stdout.on('data', data => { this.stdout += data; this.notify(); });
      this.process.stderr.on('data', data => { this.stderr += data; });
      this.process.on('exit', code => { this.exited = true; this.exitCode = code; this.notify(); });
      this.process.on('error', error => { this.error = error; this.exited = true; this.notify(); });
      sessions.push(this);
    }
    notify() { for (const listener of [...this.listeners]) listener(); }
    query(sql) {
      const marker = `LESSON_DONE_${++sequence}`;
      const start = this.stdout.length;
      const result = new Promise((resolve, reject) => {
        const finish = () => {
          const found = this.stdout.indexOf(`${marker}\n`, start);
          if (found >= 0 || this.exited) {
            clearTimeout(timeout);
            this.listeners = this.listeners.filter(item => item !== finish);
            if (found >= 0) resolve(this.stdout.slice(start, found).trim());
            else reject(this.error ?? Error(`Session ${this.label} exited ${this.exitCode}: ${this.stderr}`));
          }
        };
        const timeout = setTimeout(() => {
          this.listeners = this.listeners.filter(item => item !== finish);
          reject(Error(`Session ${this.label} exceeded bounded query deadline: ${this.stderr}`));
        }, 10000);
        this.listeners.push(finish);
        this.process.stdin.write(`${sql}\n\\echo ${marker}\n`);
        finish();
      });
      result.catch(() => {});
      return result;
    }
    async initialize() {
      this.pid = Number(await this.query(`set application_name='${this.applicationName}'; set lock_timeout='4s'; set statement_timeout='8s';
        set idle_in_transaction_session_timeout='12s'; select pg_backend_pid();
        select set_config('request.jwt.claims','{"sub":"${adminId}","role":"authenticated"}',false); set role authenticated;`)
        .then(value => value.split('\n')[0]));
      if (!Number.isInteger(this.pid) || this.pid <= 0) throw Error('Invalid local backend PID');
    }
    async close() {
      if (!this.exited) {
        try { await this.query('rollback;'); } catch { /* exact backend cleanup follows */ }
        if (!this.exited) this.process.stdin.end('\\q\n');
      }
    }
  }
  function observeBlocked(blocked, blocker, label) {
    control(`do $$ declare deadline timestamptz:=clock_timestamp()+interval '1500 milliseconds'; begin loop
      exit when ${blocker.pid}=any(pg_blocking_pids(${blocked.pid}));
      if clock_timestamp()>deadline then raise exception 'Expected lesson row-lock wait'; end if;
      perform pg_sleep(0.03); end loop; end $$;`);
    assert(true, `${label}: real blocker observed via pg_blocking_pids`);
  }
  try {
    fixtureStarted = true;
    control(`begin;
      insert into public.specialties(id,slug,name,icon,published) values('${specialtyId}','lesson-race-${runId}','[TEST] Lesson race','other',false);
      insert into public.question_banks(id,name,description,specialty_id,material_kind,exam_category,status,publication_status,price)
        values('${bankId}','[TEST] Lesson race','Generated local-only fixture','${specialtyId}','SUBJECT',null,'inactive','DRAFT',0),
        ('${otherBankId}','[TEST] Other lesson race','Generated local-only fixture','${specialtyId}','SUBJECT',null,'inactive','DRAFT',0);
      insert into public.bank_chapters(id,question_bank_id,title) values('${chapterId}','${bankId}','[TEST] Race chapter'),
        ('${otherChapterId}','${otherBankId}','[TEST] Other race chapter');
      insert into public.question_banks(id,name,description,status) values('${trackId}','[TEST] Legacy race','Generated local-only fixture','active');
      select set_config('request.jwt.claims','{"sub":"${adminId}","role":"authenticated"}',true);
      ${save(0)}
      insert into storage.objects(bucket_id,name,metadata) values('lesson-source-pdfs','${objectPath}','{"size":1024,"mimetype":"application/pdf"}');
      select public.register_lesson_document('${JSON.stringify({id: documentId, lessonId, filename: '[TEST] Race.pdf', storagePath: objectPath,
        sha256: 'a'.repeat(64), sizeBytes: 1024, documentRole: 'ORIGINAL', provenance: '[TEST] Local concurrency'})}'::jsonb);
      select public.approve_lesson_document('${documentId}',true); commit;`);
    const first = new Session('a');
    const second = new Session('b');
    await Promise.all([first.initialize(), second.initialize()]);

    await first.query(`begin; ${save(1)}`);
    let waiting = second.query(`begin; ${expectState(save(1), '40001')}`);
    observeBlocked(second, first, 'concurrent save');
    await first.query('commit;'); await waiting; await second.query('rollback;');
    assert(control(`select revision=2 from public.lessons where id='${lessonId}';`) === 't', 'stale concurrent save denied without lost update');

    await first.query(`begin; select public.approve_lesson_document('${documentId}',false);`);
    waiting = second.query(`begin; ${expectState(save(2, 'PUBLISHED'), '23514')}`);
    observeBlocked(second, first, 'revoke-before-publish');
    await first.query('commit;'); await waiting; await second.query('rollback;');
    assert(control(`select l.status='DRAFT' and l.revision=2 and not d.approved_for_students from public.lessons l
      join public.lesson_documents d on d.lesson_id=l.id where l.id='${lessonId}';`) === 't', 'publication rechecks committed PDF revocation');

    await first.query(`begin; select public.approve_lesson_document('${documentId}',true);`);
    waiting = second.query(`begin; ${save(2, 'PUBLISHED')}`);
    observeBlocked(second, first, 'approve-before-publish');
    await first.query('commit;'); await waiting; await second.query('commit;');
    assert(control(`select status='PUBLISHED' and revision=3 from public.lessons where id='${lessonId}';`) === 't', 'publication sees approved committed PDF');

    await first.query(`begin; ${save(3, 'PUBLISHED')}`);
    waiting = second.query(`begin; ${expectState(`select public.approve_lesson_document('${documentId}',false);`, '23514')}`);
    observeBlocked(second, first, 'publish-before-revoke');
    await first.query('commit;'); await waiting; await second.query('rollback;');
    assert(control(`select approved_for_students from public.lesson_documents where id='${documentId}';`) === 't', 'published reading lesson retains approved PDF');

    await first.query(`begin; ${save(4, 'ARCHIVED')}`);
    // A trusted material-kind update must also wait on the actual Subject row.
    // Its trigger rejects the existing chapter/lesson dependencies after waiting.
    const conversion = new Session('conversion'); await conversion.initialize();
    await conversion.query('reset role;');
    waiting = conversion.query(`begin; ${expectState(`update public.question_banks set material_kind='EXAM_TRACK',exam_category='OTHER' where id='${bankId}';`, '23514')}`);
    observeBlocked(conversion, first, 'lesson-save-before-type-conversion');
    await first.query('commit;'); await waiting; await conversion.query('rollback;');
    assert(control(`select material_kind='SUBJECT' and publication_status='DRAFT' and status='inactive' from public.question_banks where id='${bankId}';`) === 't', 'lesson writes preserve draft inactive Subject identity');

    await first.query(`begin; ${save(0, 'DRAFT', {id: claimId})}`);
    waiting = second.query(`begin; ${expectState(save(0, 'DRAFT', {id: claimId, bankId: otherBankId, chapterId: otherChapterId}), '23514')}`);
    observeBlocked(second, first, 'cross-Subject lesson identity claim');
    await first.query('commit;'); await waiting; await second.query('rollback;');
    assert(control(`select question_bank_id='${bankId}' and chapter_id='${chapterId}' and revision=1 from public.lessons where id='${claimId}';`) === 't', 'concurrent cross-Subject lesson identity claim cannot overwrite original');

    const question = {id: questionId, reuseQuestionId: null, duplicateReviewed: true, sourceNumber: '1', text: '[TEST] Identity race question',
      options: [{id: 'a', text: '[TEST] First'}, {id: 'b', text: '[TEST] Second'}], correctOptionId: 'a', verified: true,
      includeInBank: false, caseId: null, caseTitle: '', caseDescription: '', warnings: [], explanation: '[TEST] Correct answer reasoning', documentId: null, sourcePage: null};
    await first.query(`begin; ${save(0, 'PUBLISHED', {id: questionLessonId, questions: [question]})}`);
    waiting = second.query(`begin; ${expectState(save(0, 'PUBLISHED', {id: otherQuestionLessonId, bankId: otherBankId, chapterId: otherChapterId,
      questions: [{...question, text: '[TEST] Wrong Subject replacement', correctOptionId: 'b'}]}), '23514')}`);
    observeBlocked(second, first, 'cross-Subject canonical question identity claim');
    await first.query('commit;'); await waiting; await second.query('rollback;');
    assert(control(`select b.question_bank_id='${bankId}' and b.text='[TEST] Identity race question' and s.correct_option_id='a'
      and not exists(select 1 from public.lessons where id='${otherQuestionLessonId}') from public.bank_questions b
      join private.question_solutions s on s.question_id=b.id where b.id='${questionId}';`) === 't', 'concurrent foreign question claim preserves original content key and owner');

    const caseQuestion = {...question, id: caseQuestionId, caseId, caseTitle: '[TEST] Shared case identity', caseDescription: '[TEST] Shared case description'};
    await first.query(`begin; ${save(0, 'PUBLISHED', {id: caseLessonId, questions: [caseQuestion]})}`);
    waiting = second.query(`begin; ${expectState(save(0, 'PUBLISHED', {id: otherCaseLessonId, bankId: otherBankId, chapterId: otherChapterId,
      questions: [{...caseQuestion, id: otherCaseQuestionId}]}), '23514')}`);
    observeBlocked(second, first, 'cross-Subject clinical case identity claim');
    await first.query('commit;'); await waiting; await second.query('rollback;');
    assert(control(`select s.question_bank_id='${bankId}' and not exists(select 1 from public.bank_questions where id='${otherCaseQuestionId}')
      from public.question_sections s where s.id='${caseId}';`) === 't', 'same metadata does not permit foreign Subject case association');

    // Existing Subject identities must also be protected against the generic
    // legacy editor, even when its payload lies about the backing Exam Track.
    await first.query(`begin; ${save(1, 'PUBLISHED', {id: questionLessonId, questions: [question]})}`);
    const legacyPayload = JSON.stringify({bankId: trackId, text: '[TEST] Legacy bypass', status: 'active',
      answers: [{id: 'a', text: '[TEST] First', isCorrect: false}, {id: 'b', text: '[TEST] Second', isCorrect: true}], sectionId: null, displayOrder: 1});
    waiting = second.query(`begin; ${expectState(`select public.manage_bank_content('save_question','${questionId}','${legacyPayload}'::jsonb);`, '23514')}`);
    observeBlocked(second, first, 'lesson-save-before-legacy-editor-bypass');
    await first.query('commit;'); await waiting; await second.query('rollback;');
    assert(control(`select b.text='[TEST] Identity race question' and s.correct_option_id='a' from public.bank_questions b
      join private.question_solutions s on s.question_id=b.id where b.id='${questionId}';`) === 't', 'legacy editor cannot bypass Subject verification or revision');
  } finally {
    await Promise.all(sessions.map(session => session.close()));
    for (const session of sessions) {
      if (Number.isInteger(session.pid)) control(`select pg_terminate_backend(pid) from pg_stat_activity where pid=${session.pid} and application_name='${session.applicationName}';`);
    }
    if (fixtureStarted) {
      control(`begin;
        set local storage.allow_delete_query='true';
        delete from storage.objects where bucket_id='lesson-source-pdfs' and name='${objectPath}';
        delete from private.lesson_question_explanations where lesson_id in('${lessonId}','${claimId}','${questionLessonId}','${otherQuestionLessonId}','${caseLessonId}','${otherCaseLessonId}');
        delete from private.lesson_question_owners where lesson_id in('${lessonId}','${claimId}','${questionLessonId}','${otherQuestionLessonId}','${caseLessonId}','${otherCaseLessonId}');
        delete from private.lesson_case_owners where lesson_id in('${lessonId}','${claimId}','${questionLessonId}','${otherQuestionLessonId}','${caseLessonId}','${otherCaseLessonId}');
        delete from private.lesson_drafts where lesson_id in('${lessonId}','${claimId}','${questionLessonId}','${otherQuestionLessonId}','${caseLessonId}','${otherCaseLessonId}');
        delete from public.lesson_questions where lesson_id in('${lessonId}','${claimId}','${questionLessonId}','${otherQuestionLessonId}','${caseLessonId}','${otherCaseLessonId}');
        delete from public.lesson_documents where lesson_id='${lessonId}';
        delete from public.lessons where id in('${lessonId}','${claimId}','${questionLessonId}','${otherQuestionLessonId}','${caseLessonId}','${otherCaseLessonId}') and question_bank_id in('${bankId}','${otherBankId}');
        delete from private.question_solutions where question_id in('${questionId}','${caseQuestionId}','${otherCaseQuestionId}');
        delete from public.bank_questions where id in('${questionId}','${caseQuestionId}','${otherCaseQuestionId}') and question_bank_id in('${bankId}','${otherBankId}');
        delete from public.question_sections where id='${caseId}' and question_bank_id='${bankId}';
        delete from public.bank_chapters where id in('${chapterId}','${otherChapterId}') and question_bank_id in('${bankId}','${otherBankId}');
        delete from public.question_banks where id in('${bankId}','${otherBankId}','${trackId}');
        delete from public.specialties where id='${specialtyId}';
        delete from realtime.messages where payload::text like '%${runId}%'; commit;`);
      assert(control(`select not exists(select 1 from public.lessons where id in('${lessonId}','${claimId}','${questionLessonId}','${otherQuestionLessonId}','${caseLessonId}','${otherCaseLessonId}'))
        and not exists(select 1 from public.question_banks where id in('${bankId}','${otherBankId}','${trackId}'))
        and not exists(select 1 from public.bank_questions where id in('${questionId}','${caseQuestionId}','${otherCaseQuestionId}'))
        and not exists(select 1 from public.question_sections where id='${caseId}')
        and not exists(select 1 from public.specialties where id='${specialtyId}')
        and not exists(select 1 from storage.objects where bucket_id='lesson-source-pdfs' and name='${objectPath}');`) === 't', 'exact generated local fixtures cleaned');
    }
  }
  console.log(`PASS lesson concurrency: ${checks} checks; nine observed two-session races; exact generated fixtures cleaned.`);
}

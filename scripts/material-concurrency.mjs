// Two-session tests against the named isolated LOCAL Docker DB only.
// Fixtures must be committed so separate sessions can see them; finally removes
// only the generated IDs. Live invalidation revision counters may advance.
import {execFileSync, spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';

if (process.argv.length !== 2) throw Error('Usage: node scripts/material-concurrency.mjs');
const container = 'supabase_db_archive-db';
const info = JSON.parse(execFileSync('docker', ['inspect', container], {encoding: 'utf8'}))[0];
if (info.Config.Labels['com.supabase.cli.project'] !== 'archive-db' || !info.State.Running) {
  throw Error('Running isolated archive-db required');
}
const dockerArgs = ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-P', 'pager=off'];
const control = sql => execFileSync('docker', dockerArgs, {
  input: `set lock_timeout='4s'; set statement_timeout='8s';\n${sql}\n`, encoding: 'utf8',
  stdio: ['pipe', 'pipe', 'pipe'], timeout: 12000,
}).trim();
if (control("select current_database()='postgres' and to_regprocedure('private.guard_material_identity()') is not null and to_regprocedure('private.guard_material_request()') is not null;") !== 't') {
  throw Error('Typed-material local database not ready');
}

const runId = randomUUID();
const personId = randomUUID();
const specialtyId = randomUUID();
const applicationPrefix = `lhcc-material-race-${runId}`;
const cases = [
  {kind: 'request', first: 'conversion'}, {kind: 'grant', first: 'conversion'},
  {kind: 'request', first: 'reference'}, {kind: 'grant', first: 'reference'},
  {kind: 'question', first: 'reference'},
].map((test, index) => ({...test, bankId: `mt-race-${runId}-${index}`}));
const quotedBanks = cases.map(test => `'${test.bankId}'`).join(',');
const sessions = [];
let sequence = 0;
let checks = 0;
let fixtureStarted = false;
function assert(condition, label) {
  if (!condition) throw Error(`FAIL ${label}`);
  checks += 1;
}

class Session {
  constructor(label) {
    this.label = label;
    this.applicationName = `${applicationPrefix}-${label}`;
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
  async query(sql) {
    const marker = `MT_DONE_${++sequence}`;
    const start = this.stdout.length;
    const result = new Promise((resolve, reject) => {
      const finish = () => {
        const found = this.stdout.indexOf(`${marker}\n`, start);
        if (found >= 0) {
          clearTimeout(timeout); this.listeners = this.listeners.filter(item => item !== finish);
          resolve(this.stdout.slice(start, found).trim());
        } else if (this.exited) {
          clearTimeout(timeout); this.listeners = this.listeners.filter(item => item !== finish);
          reject(this.error ?? Error(`Session ${this.label} exited ${this.exitCode}: ${this.stderr}`));
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
    // Attach immediately, even when a blocking query is awaited after commit.
    result.catch(() => {});
    return result;
  }
  async initialize() {
    this.pid = Number(await this.query(`set application_name='${this.applicationName}'; set lock_timeout='4s'; set statement_timeout='8s'; set idle_in_transaction_session_timeout='12s'; select pg_backend_pid();`));
    if (!Number.isInteger(this.pid) || this.pid <= 0) throw Error('Invalid local backend PID');
  }
  async close() {
    if (!this.exited) {
      try { await this.query('rollback;'); } catch { /* backend cleanup below is fail-closed */ }
      if (!this.exited) this.process.stdin.end('\\q\n');
    }
  }
}

function waitForBlocked(blocked, blocker, label) {
  control(`do $$ declare deadline timestamptz:=clock_timestamp()+interval '1500 milliseconds'; begin
    loop
      exit when ${blocker.pid}=any(pg_blocking_pids(${blocked.pid}));
      if clock_timestamp()>deadline then raise exception 'Expected material-row lock wait'; end if;
      perform pg_sleep(0.03);
    end loop;
  end $$;`);
  checks += 1;
  console.log(`PASS ${label}: observed blocker via pg_blocking_pids`);
}
function expectConstraint(sql) {
  return `do $$ begin begin ${sql}; raise exception 'Expected check_violation' using errcode='XX000';
    exception when check_violation then null; end; end $$;`;
}

try {
  const adminId = control("select id from public.profiles where role='ADMIN' and status='ACTIVE' limit 1;");
  if (!/^[0-9a-f-]{36}$/.test(adminId)) throw Error('Local active administrator fixture required');
  fixtureStarted = true;
  control(`begin;
    insert into auth.users(id,email,raw_user_meta_data) values('${personId}','${personId}@example.invalid','{"full_name":"Material concurrency fixture"}');
    insert into public.specialties(id,slug,name,icon,published) values('${specialtyId}','mt-race-${runId}','[TEST] Concurrency specialty','other',false);
    insert into public.question_banks(id,name,description,status,specialty_id)
      values ${cases.map(test => `('${test.bankId}','[TEST] Concurrency bank','Generated local-only race fixture','active','${specialtyId}')`).join(',')};
    commit;`);

  const first = new Session('a');
  const second = new Session('b');
  await Promise.all([first.initialize(), second.initialize()]);
  for (const test of cases) {
    const bank = test.bankId;
    const conversion = `update public.question_banks set material_kind='SUBJECT',exam_category=null,publication_status='DRAFT',status='inactive' where id='${bank}'`;
    const reference = test.kind === 'request'
      ? `insert into public.user_bank_access_requests(user_id,question_bank_id) values('${personId}','${bank}')`
      : test.kind === 'grant'
        ? `insert into public.user_bank_access(user_id,question_bank_id,granted_by) values('${personId}','${bank}','${adminId}')`
        : `insert into public.bank_questions(id,question_bank_id,text,status,options) values('${bank}-q','${bank}','[TEST] Race question','active','[{"id":"a","text":"First"},{"id":"b","text":"Second"}]')`;
    const relation = test.kind === 'request' ? 'user_bank_access_requests' : test.kind === 'grant' ? 'user_bank_access' : 'bank_questions';
    await first.query(`begin; ${test.first === 'conversion' ? conversion : reference};`);
    const waiting = second.query(`begin; ${expectConstraint(test.first === 'conversion' ? reference : conversion)}`);
    waitForBlocked(second, first, `${test.kind}/${test.first}-first`);
    await first.query('commit;');
    await waiting;
    checks += 1;
    await second.query('rollback;');
    const expectedKind = test.first === 'conversion' ? 'SUBJECT' : 'EXAM_TRACK';
    const expectedReferences = test.first === 'conversion' ? 0 : 1;
    assert(control(`select material_kind='${expectedKind}' and (select count(*) from public.${relation} where question_bank_id='${bank}')=${expectedReferences} from public.question_banks where id='${bank}';`) === 't', `${test.kind}/${test.first}-first final invariant`);
    console.log(`PASS ${test.kind}/${test.first}-first: waited, denied unsafe operation, final invariant intact`);
  }
} finally {
  await Promise.all(sessions.map(session => session.close()));
  // Terminate only the explicitly recorded test backend/application pair if a
  // failed statement left it alive; never use broad connection termination.
  for (const session of sessions) {
    if (Number.isInteger(session.pid)) control(`select pg_terminate_backend(pid) from pg_stat_activity where pid=${session.pid} and application_name='${session.applicationName}';`);
  }
  if (fixtureStarted) {
    control(`begin;
      delete from public.user_bank_access_requests where question_bank_id in (${quotedBanks});
      delete from public.user_bank_access where question_bank_id in (${quotedBanks});
      delete from public.bank_questions where question_bank_id in (${quotedBanks});
      delete from public.question_banks where id in (${quotedBanks});
      delete from public.specialties where id='${specialtyId}';
      delete from auth.users where id='${personId}';
      delete from private.live_revisions where topic='lhcc:user:${personId}';
      delete from realtime.messages where topic='lhcc:user:${personId}' or payload::text like '%${runId}%';
      commit;`);
    assert(control(`select not exists(select 1 from public.question_banks where id in (${quotedBanks}))
      and not exists(select 1 from auth.users where id='${personId}') and not exists(select 1 from public.specialties where id='${specialtyId}');`) === 't', 'generated local fixtures cleaned');
  }
}
console.log(`PASS material concurrency: ${checks} checks; five two-session races; generated local fixtures cleaned.`);

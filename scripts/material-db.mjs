// Isolated local validation only. Never reads a hosted URL or credentials.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const container = 'supabase_db_archive-db';
const args = process.argv.slice(2);
if (args.some(arg => !['--apply'].includes(arg))) throw Error('Usage: node scripts/material-db.mjs [--apply]');
const info = JSON.parse(execFileSync('docker', ['inspect', container], {encoding: 'utf8'}))[0];
if (info.Config.Labels['com.supabase.cli.project'] !== 'archive-db') throw Error('Isolated archive-db required');
const apply = args.includes('--apply');
const sql = await readFile(apply
  ? 'supabase/migrations/20261031173818_typed_learning_materials.sql'
  : 'supabase/tests/typed_learning_materials.sql', 'utf8');
try {
  const output = execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-q', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
    input: apply ? `begin;\n${sql}\ncommit;` : sql,
    encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  });
  console.log(output.slice(-3000) || 'Local material migration applied.');
} catch (error) {
  console.error(error.stderr?.toString() ?? 'Local SQL failed');
  process.exitCode = 1;
}

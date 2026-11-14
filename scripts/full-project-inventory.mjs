// Read-only source/database evidence inventory. Never loads environment files or calls a backend.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';

async function files(path) {
  return (await Promise.all((await readdir(path, { withFileTypes: true })).map(entry =>
    entry.isDirectory() ? files(`${path}/${entry.name}`) : [`${path}/${entry.name}`]))).flat().sort();
}
const sources = (await files('src')).filter(path => /\.tsx?$/.test(path));
const inventory = { sourceFiles: sources.length, components: [], pages: [], handlers: [], actions: [], modules: [], tables: {}, rpcs: {} };
const record = (map, name, file) => { (map[name] ??= []).push(file); };
for (const file of sources) {
  const code = await readFile(file, 'utf8');
  const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  const exported = ast.statements.filter(node => node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
  if (file.endsWith('/page.tsx')) inventory.pages.push({ file, route: '/' + file.slice('src/app/'.length, -'/page.tsx'.length).split('/').filter(part => !/^\(.*\)$/.test(part)).join('/'), exports: exported.map(node => node.name?.getText(ast)).filter(Boolean) });
  if (file.endsWith('/route.ts')) inventory.handlers.push({ file, methods: exported.map(node => node.name?.getText(ast)).filter(Boolean) });
  if (file.startsWith('src/actions/')) inventory.actions.push({ file, functions: exported.map(node => node.name?.getText(ast)).filter(Boolean) });
  if (file.endsWith('.tsx')) inventory.components.push(file);
  if (file.startsWith('src/lib/') || file.startsWith('src/services/')) inventory.modules.push(file);
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const name = node.arguments[0];
      if (name && ts.isStringLiteral(name)) {
        if (node.expression.name.text === 'from') record(inventory.tables, name.text, file);
        if (node.expression.name.text === 'rpc') record(inventory.rpcs, name.text, file);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
for (const map of [inventory.tables, inventory.rpcs]) for (const name of Object.keys(map)) map[name] = [...new Set(map[name])];
const snapshotFile = process.argv[2];
assert(process.argv.length <= 3, 'Usage: node scripts/full-project-inventory.mjs [ignored-catalog-snapshot.json]');
if (snapshotFile) {
  assert(snapshotFile.replaceAll('\\', '/').startsWith('.test-artifacts/'), 'Use a local ignored catalog snapshot, never an environment file.');
  const snapshot = JSON.parse(await readFile(snapshotFile, 'utf8'));
  const functions = snapshot.functions;
  inventory.databaseTables = snapshot.tables.map(table => {
    const name = `${table.schema}.${table.name}`;
    const escaped = name.replaceAll('.', '\\.');
    const readers = functions.filter(fn => new RegExp(`\\b${escaped}\\b`).test(fn.definition));
    // Follow private wrappers backwards until reaching application RPC entry points.
    const callers = new Set(readers.map(fn => `${fn.schema}.${fn.name}`));
    let changed = true;
    while (changed) {
      changed = false;
      for (const fn of functions) {
        const key = `${fn.schema}.${fn.name}`;
        if (!callers.has(key) && [...callers].some(caller => new RegExp(`\\b${caller.replaceAll('.', '\\.')}\\s*\\(`).test(fn.definition))) {
          callers.add(key); changed = true;
        }
      }
    }
    const rpcs = Object.keys(inventory.rpcs).filter(rpc => callers.has(`public.${rpc}`));
    return {
      table: name, rows: JSON.parse(table.integrity).count, rls: table.rls,
      policies: table.policies.length, foreignKeys: table.constraints.filter(constraint => constraint.type === 'f').length,
      directReferences: table.schema === 'public' ? inventory.tables[table.name] ?? [] : [],
      databaseFunctions: readers.map(fn => `${fn.schema}.${fn.name}`), rpcs,
      applicationFiles: [...new Set(rpcs.flatMap(rpc => inventory.rpcs[rpc]))],
      grants: table.grants,
    };
  });
  inventory.databaseFunctions = functions.map(fn => ({
    function: `${fn.schema}.${fn.name}(${fn.args})`, securityDefiner: fn.securityDefiner,
    anonExecute: fn.anon, authenticatedExecute: fn.authenticated,
    applicationFiles: fn.schema === 'public' ? inventory.rpcs[fn.name] ?? [] : [],
  }));
  inventory.missingRpcReferences = Object.keys(inventory.rpcs).filter(name => !functions.some(fn => fn.schema === 'public' && fn.name === name));
  inventory.missingTableReferences = Object.keys(inventory.tables).filter(name => !snapshot.tables.some(table => table.schema === 'public' && table.name === name) && !snapshot.storage.some(bucket => bucket.id === name));
}
await mkdir('.test-artifacts', { recursive: true });
await writeFile('.test-artifacts/full-project-inventory.json', JSON.stringify(inventory, null, 2));
console.log(JSON.stringify({
  sourceFiles: inventory.sourceFiles, tsxFiles: inventory.components.length, pageFiles: inventory.pages.length,
  handlers: inventory.handlers, actionFiles: inventory.actions.length,
  exportedActions: inventory.actions.reduce((sum, action) => sum + action.functions.length, 0),
  directTables: Object.keys(inventory.tables), rpcNames: Object.keys(inventory.rpcs),
  databaseTables: inventory.databaseTables?.length, databaseFunctions: inventory.databaseFunctions?.length,
  missingRpcReferences: inventory.missingRpcReferences, missingTableReferences: inventory.missingTableReferences,
}, null, 2));

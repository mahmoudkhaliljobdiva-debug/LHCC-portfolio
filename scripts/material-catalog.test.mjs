import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'exports', code)(name => name.startsWith('@/')
    ? load(resolve('src', name.slice(2) + '.ts')) : require(name), exports);
  return exports;
}
const { catalogSchema } = load('src/lib/validation/learning-catalog.ts');
const { groupLearningMaterials } = load('src/lib/learning/material-groups.ts');
const specialty = { id: '984b3c1a-7cab-4bd7-aa5c-39c6c63d093f', slug: 'medical', name: 'Medical', description: '', icon: 'medical' };
const base = { id: 'material', name: 'An actual configured material', description: '' };

test('legacy catalog metadata retains explicit track defaults without inventing a track category', () => {
  const parsed = catalogSchema.parse([{ ...specialty, materials: [base] }])[0].materials[0];
  assert.equal(parsed.materialKind, 'EXAM_TRACK');
  assert.equal(parsed.examCategory, 'OTHER');
  assert.equal(parsed.icon, 'book');
});

test('typed catalog rejects contradictory subject and exam classification', () => {
  for (const material of [
    { ...base, materialKind: 'SUBJECT', examCategory: 'COLLOQUIUM' },
    { ...base, materialKind: 'EXAM_TRACK', examCategory: null },
    { ...base, materialKind: 'guessed-from-name' },
    { ...base, icon: 'https://untrusted.invalid/animation.js' },
  ]) assert(!catalogSchema.safeParse([{ ...specialty, materials: [material] }]).success);
});

test('subjects, colloquium, prometric and other tracks have independent nonempty sections', () => {
  const input = [
    { ...base, id: 'psychiatry', materialKind: 'SUBJECT', examCategory: null, icon: 'brain', language: 'mixed' },
    { ...base, id: 'colloquium', materialKind: 'EXAM_TRACK', examCategory: 'COLLOQUIUM' },
    { ...base, id: 'prometric', materialKind: 'EXAM_TRACK', examCategory: 'PROMETRIC' },
    { ...base, id: 'other', materialKind: 'EXAM_TRACK', examCategory: 'OTHER' },
  ];
  const materials = catalogSchema.parse([{ ...specialty, materials: input }])[0].materials;
  const groups = groupLearningMaterials(materials);
  assert.deepEqual(groups.map(group => group.key), ['SUBJECT', 'COLLOQUIUM', 'PROMETRIC', 'OTHER']);
  assert.deepEqual(groups.map(group => group.materials.map(material => material.id)), [['psychiatry'], ['colloquium'], ['prometric'], ['other']]);
  assert.deepEqual(groupLearningMaterials([]), []);
  assert.deepEqual(groupLearningMaterials(materials.slice(0, 1)).map(group => group.key), ['SUBJECT']);
});

test('Arabic and mixed-language metadata is retained without exposing private catalog fields', () => {
  const input = { ...base, name: 'الطب النفسي Psychiatry', materialKind: 'SUBJECT', examCategory: null, language: 'mixed', correctOptionId: 'private-key' };
  const material = catalogSchema.parse([{ ...specialty, materials: [input] }])[0].materials[0];
  assert.equal(material.name, input.name);
  assert.equal(material.language, 'mixed');
  assert(!('correctOptionId' in material));
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "exports", js)(name => name in mocks ? mocks[name] : name.startsWith("@/") ? load(resolve("src", name.slice(2) + ".ts"), mocks) : require(name), exports);
  return exports;
}

const { materialSchema, materialPageNumber, adminMaterialsSchema } = load(resolve("src/lib/validation/material.ts"));
const specialtyId = "984b3c1a-7cab-4bd7-aa5c-39c6c63d093f";
const material = { id: "legacy-bank", name: "Mixed العربية", description: "وصف / description", specialtyId, materialKind: "EXAM_TRACK", examCategory: "COLLOQUIUM", publicationStatus: "DRAFT", icon: "book", language: "mixed", displayOrder: 0, status: "inactive" };
const allowed = { authorizeActiveAdmin: async () => ({ ok: true, data: {} }) };
const denied = { authorizeActiveAdmin: async () => ({ ok: false, error: { code: "FORBIDDEN", message: "Administrator access is required." } }) };

test("material validation supports independent subject and exam-track records", () => {
  assert(materialSchema.safeParse(material).success);
  assert(materialSchema.safeParse({ ...material, materialKind: "SUBJECT", examCategory: null }).success);
  assert(materialSchema.safeParse({ ...material, name: "  Mixed العربية  " }).data.name === material.name);
  assert(materialSchema.safeParse({ ...material, specialtyId: null }).success);
});

test("strict material input rejects malformed, injected and unbounded fields", () => {
  for (const change of [
    { id: "" }, { name: "   " }, { name: "x".repeat(201) }, { description: "" }, { description: "   " }, { description: "x".repeat(3001) },
    { specialtyId: "guessed" }, { materialKind: "COURSE" }, { examCategory: null }, { examCategory: "UNKNOWN" },
    { publicationStatus: "LIVE" }, { icon: "https://untrusted.invalid/image.svg" }, { language: "unknown" },
    { displayOrder: -1 }, { displayOrder: 10001 }, { displayOrder: 1.5 }, { displayOrder: "1" }, { displayOrder: NaN },
    { status: "ACTIVE" }, { price: 0 }, { questions: [] }, { role: "ADMIN" }, { available: true },
  ]) assert.equal(materialSchema.safeParse({ ...material, ...change }).success, false, JSON.stringify(change));
  for (const value of [null, undefined, [], "material", 1]) assert.equal(materialSchema.safeParse(value).success, false);
});

test("subjects require a specialty and cannot publish, activate or become exam tracks", () => {
  const subject = { ...material, materialKind: "SUBJECT", examCategory: null };
  for (const change of [{ specialtyId: null }, { examCategory: "PROMETRIC" }, { publicationStatus: "PUBLISHED" }, { publicationStatus: "ARCHIVED" }, { status: "active" }]) {
    assert.equal(materialSchema.safeParse({ ...subject, ...change }).success, false);
  }
});

test("material pagination rejects malformed values and oversized RPC pages", () => {
  assert.equal(materialPageNumber("12"), 12);
  for (const value of [undefined, [], ["1"], "-1", "1.5", "1e2", "100001", "bad"]) assert.equal(materialPageNumber(value), 0);
  assert(adminMaterialsSchema.safeParse({ items: [material], total: 1 }).success);
  assert.equal(adminMaterialsSchema.safeParse({ items: Array(21).fill(material), total: 21 }).success, false);
  assert.equal(adminMaterialsSchema.safeParse({ items: [], total: -1 }).success, false);
  assert(adminMaterialsSchema.safeParse({ items: [{ ...material, id: "legacy bank / identifier", description: "x".repeat(5000), displayOrder: 2147483647 }], total: 1 }).success);
});

test("unauthorized material actions fail before database access", async () => {
  let reached = false;
  const { saveMaterial } = load(resolve("src/actions/materials.ts"), {
    "@/lib/auth/admin": denied,
    "@/lib/supabase/server": { createClient: async () => { reached = true; throw Error("Must not query"); } },
    "next/cache": { revalidatePath() {} },
  });
  assert.equal((await saveMaterial(material)).ok, false);
  assert.equal((await saveMaterial({})).ok, false);
  assert.equal(reached, false);
});

test("authorized malformed material input never reaches a query", async () => {
  let reached = false;
  const { saveMaterial } = load(resolve("src/actions/materials.ts"), {
    "@/lib/auth/admin": allowed,
    "@/lib/supabase/server": { createClient: async () => { reached = true; throw Error("Must not query"); } },
    "next/cache": { revalidatePath() {} },
  });
  for (const input of [{}, { ...material, price: 0 }, { ...material, materialKind: "SUBJECT", examCategory: null, status: "active" }]) {
    assert.equal((await saveMaterial(input)).ok, false);
  }
  assert.equal(reached, false);
});

test("material save uses the trusted RPC and sends no legacy prices or exam content", async () => {
  const calls = [], paths = [];
  const { saveMaterial } = load(resolve("src/actions/materials.ts"), {
    "@/lib/auth/admin": allowed,
    "@/lib/supabase/server": { createClient: async () => ({ rpc: async (name, args) => { calls.push([name, args]); return { data: material.id, error: null }; } }) },
    "next/cache": { revalidatePath: (...args) => paths.push(args) },
  });
  assert.deepEqual(await saveMaterial(material), { ok: true, data: material.id });
  assert.deepEqual(calls, [["save_learning_material", { payload: material }]]);
  assert(paths.some(([path]) => path === "/admin/subjects"));
  assert(paths.some(([path]) => path === "/admin/exam-tracks"));
});

test("database errors stay generic and never expose backend details", async () => {
  const { saveMaterial } = load(resolve("src/actions/materials.ts"), {
    "@/lib/auth/admin": allowed,
    "@/lib/supabase/server": { createClient: async () => ({ rpc: async () => ({ data: null, error: { message: "PRIVATE SQL internals" } }) }) },
    "next/cache": { revalidatePath() {} },
  });
  const result = await saveMaterial(material);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
});

test("unauthorized material reads fail before any database access", async () => {
  let reached = false;
  const { getAdminMaterials } = load(resolve("src/lib/learning/materials.ts"), {
    "server-only": {}, "@/lib/auth/admin": denied,
    "@/lib/supabase/server": { createClient: async () => { reached = true; throw Error("Must not query"); } },
  });
  assert.equal((await getAdminMaterials("SUBJECT", 0)).ok, false);
  assert.equal(reached, false);
});

test("material reads query only specialty options and the requested material page", async () => {
  const calls = [];
  const { getAdminMaterials } = load(resolve("src/lib/learning/materials.ts"), {
    "server-only": {}, "@/lib/auth/admin": allowed,
    "@/lib/supabase/pagination": { readAllRows: async query => {
      await query(0, 499);
      return [{ id: specialtyId, name: "Specialty" }];
    } },
    "@/lib/supabase/server": { createClient: async () => ({
      rpc: async (name, args) => { calls.push([name, args]); return { data: { items: [material], total: 1 }, error: null }; },
      from: name => {
        calls.push(["from", name]);
        const chain = { select: fields => { calls.push(["select", fields]); return chain; }, order: () => chain, range: async () => ({ data: [], error: null }) };
        return chain;
      },
    }) },
  });
  const result = await getAdminMaterials("EXAM_TRACK", 3);
  assert(result.ok);
  assert.deepEqual(calls, [["from", "specialties"], ["select", "id,name,slug"], ["admin_learning_materials", { kind: "EXAM_TRACK", page_number: 3 }]]);
});

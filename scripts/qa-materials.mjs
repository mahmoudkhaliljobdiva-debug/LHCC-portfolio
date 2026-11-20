// Local-only fixture creation through the same typed material lifecycle as Admin.
import assert from "node:assert/strict";
import { assertLocalQaTarget } from "./qa-safety.mjs";

async function checked(result, label) {
  const { data, error } = await result;
  if (error) throw new Error(label + ": " + error.code + " " + error.message);
  return data;
}

export async function createQaExamTrack(client, { id, name, description, specialtyId = null, examCategory = "OTHER", displayOrder = 0, price = 0, imageUrl }) {
  // Fail closed before any query, even if a caller accidentally supplies a remote client.
  assertLocalQaTarget(client.supabaseUrl);
  assert(Number.isFinite(price) && price >= 0, "QA fixture price must be nonnegative.");
  const existing = await checked(client.from("question_banks").select("id").eq("id", id).maybeSingle(), "Check new QA material ID");
  assert.equal(existing, null, "QA fixture creation must not overwrite an existing material.");
  const draft = { id, name, description, specialtyId, materialKind: "EXAM_TRACK", examCategory, publicationStatus: "DRAFT", icon: "book", language: "auto", displayOrder, status: "inactive" };
  assert.equal(await checked(client.rpc("save_learning_material", { payload: draft }), "Create draft QA exam track"), id);
  const first = await checked(client.from("question_banks").select("material_kind,exam_category,publication_status,status,price").eq("id", id).single(), "Read draft QA exam track");
  assert.equal(first.material_kind, "EXAM_TRACK");
  assert.equal(first.exam_category, examCategory);
  assert.equal(first.publication_status, "DRAFT");
  assert.equal(first.status, "inactive");
  assert.equal(Number(first.price), 0, "New fixtures must not bypass the price-free draft lifecycle.");
  await checked(client.rpc("save_learning_material", { payload: { ...draft, publicationStatus: "PUBLISHED", status: "active" } }), "Publish and activate existing QA exam track");
  if (price !== 0 || imageUrl !== undefined) {
    await checked(client.rpc("manage_bank_content", { operation: "save_bank", item_id: id, payload: { name, description, status: "active", displayOrder, price, ...(imageUrl === undefined ? {} : { imageUrl }) } }), "Edit existing QA bank commercial fields");
  }
  const published = await checked(client.from("question_banks").select("material_kind,publication_status,status,price").eq("id", id).single(), "Read published QA exam track");
  assert.equal(published.material_kind, "EXAM_TRACK");
  assert.equal(published.publication_status, "PUBLISHED");
  assert.equal(published.status, "active");
  assert.equal(Number(published.price), price);
  return id;
}

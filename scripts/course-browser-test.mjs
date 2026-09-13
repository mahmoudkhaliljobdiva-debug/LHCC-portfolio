// Dependency-free fallback for environments where agent-browser cannot start.
// Uses an isolated headless Edge profile. Auth tests require explicit opt-in and
// pause for a trusted operator to promote ONLY the newly created test identity.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";

const base = process.env.LHCC_TEST_URL ?? "http://localhost:3000";
assert(new URL(base).hostname === "localhost", "Run against the local application only.");
const port = 9337;
const profile = await mkdtemp(join(tmpdir(), "lhcc-course-browser-"));
const browser = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;
let sequence = 0;
const pending = new Map();
const exceptions = [];
const input = createInterface({ input: process.stdin, output: process.stdout });
async function waitFor(fn, label, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { try { if (await fn()) return; } catch {} await pause(200); }
  throw new Error(`Timed out: ${label}`);
}
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function page() {
  const { browserContextId } = await command("Target.createBrowserContext");
  const { targetId } = await command("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await command("Target.attachToTarget", { targetId, flatten: true });
  await command("Page.enable", {}, sessionId);
  await command("Runtime.enable", {}, sessionId);
  const evaluate = async (expression) => {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  return {
    sessionId, evaluate,
    async resize(width, height = 900) {
      await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 }, sessionId);
      await pause(150);
    },
    async goto(path) {
      await command("Page.navigate", { url: base + path }, sessionId);
      await waitFor(() => evaluate("document.readyState === 'complete' && document.body.innerText.length > 40"), path);
      await pause(800);
    },
    async text() { return evaluate("document.body.innerText"); },
    async fill(selector, value) {
      await evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)}); if(!el) throw Error('Missing field'); const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true})); })()`);
    },
    async click(text, scope = "document") {
      await evaluate(`(() => {const el=[...${scope}.querySelectorAll('button,a')].find(el=>el.textContent.trim().startsWith(${JSON.stringify(text)})); if(!el || el.disabled) throw Error('Missing/disabled control'); el.click();})()`);
    },
    async screenshot(name, width = 1280) {
      await this.resize(width);
      const { data } = await command("Page.captureScreenshot", { format: "png" }, sessionId);
      await mkdir(".test-artifacts", { recursive: true });
      await writeFile(`.test-artifacts/${name}.png`, Buffer.from(data, "base64"));
      assert(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `No horizontal overflow: ${name}`);
    },
  };
}

async function auditResponsive(p, path, widths) {
  for (const width of widths) {
    await p.resize(width, width <= 430 ? 844 : 900);
    await p.goto(path);
    assert(await p.evaluate("document.documentElement.scrollWidth <= innerWidth"), `${path} fits at ${width}px`);
    assert.equal(await p.evaluate("Boolean(document.querySelector('[data-nextjs-dialog]'))"), false, `${path} has no framework error overlay`);
    assert(await p.evaluate("document.body.innerText.trim().length > 40"), `${path} renders content at ${width}px`);
    assert(await p.evaluate("[...document.querySelectorAll('button')].filter(el=>el.getClientRects().length && !el.closest('[hidden]')).every(el=>el.getBoundingClientRect().height >= 43.5)"), `${path} button targets are at least 44px at ${width}px`);
    if (width < 640) assert(await p.evaluate("[...document.querySelectorAll('input:not([type=radio]):not([type=checkbox]),select,textarea')].every(el=>parseFloat(getComputedStyle(el).fontSize) >= 16)"), `${path} prevents iOS form zoom at ${width}px`);
  }
}
async function auth(path, payload) {
  const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + "/auth/v1/" + path, { method: "POST", headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return { status: response.status, data: await response.json() };
}
async function signup(p, email, password, name) {
  await p.goto("/signup");
  for (const [selector, value] of [
    ['input[autocomplete="name"]', name], ['input[type="email"]', email], ['input[type="tel"]', "71056331"],
    ['input[type="number"]', "25"], ['select:not([autocomplete])', "male"], ['textarea', "Beirut test address"],
    ['input[placeholder="Create a password"]', password], ['input[placeholder="Repeat your password"]', password],
  ]) await p.fill(selector, value);
  await p.click("Create Account");
  await waitFor(async () => (await p.text()).includes("Account created successfully"), "signup success");
  const login = await auth("token?grant_type=password", { email, password });
  assert.equal(login.status, 200, "Supabase password login succeeds");
  assert(login.data.user.email_confirmed_at, "Account confirmed without email link");
  console.log(JSON.stringify({ created_test_user: login.data.user.id, email }));
  return login.data;
}
async function login(p, email, password, portal) {
  await p.goto("/login");
  await p.fill('input[type="email"]', email);
  await p.fill('input[type="password"]', password);
  await p.click("Sign in");
  await waitFor(() => p.evaluate(`location.pathname === ${JSON.stringify(portal)}`), `login redirect ${portal}`);
  await waitFor(async () => (await p.text()).includes(portal === "/admin" ? "Platform overview" : "Explore courses"), "dashboard loaded");
}
const card = (name) => `[...document.querySelectorAll('article')].find(el=>el.textContent.includes(${JSON.stringify(name)}))`;

try {
  let endpoint;
  await waitFor(async () => { const r = await fetch(`http://127.0.0.1:${port}/json/version`); endpoint = (await r.json()).webSocketDebuggerUrl; return Boolean(endpoint); }, "Edge startup", 15000);
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timer); pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  });
  const student = await page();
  const viewportWidths = [320, 375, 390, 430, 768, 1024, 1366, 1536, 1920];
  for (const path of ["/", "/about", "/services", "/platform", "/contact", "/login", "/signup"]) {
    await auditResponsive(student, path, viewportWidths);
  }
  await student.goto("/signup");
  assert((await student.text()).includes("Create Account"));
  assert.equal(await student.evaluate("Boolean(document.querySelector('[data-nextjs-dialog]'))"), false);
  for (const width of [320, 390, 768, 1280]) await student.screenshot(`signup-${width}`, width);
  for (const path of ["/admin", "/admin/users", "/teacher", "/student", "/student/banks/anatomy"]) {
    await student.goto(path);
    await waitFor(() => student.evaluate("location.pathname === '/login'"), `anonymous guard ${path}`);
  }
  console.log(`PASS: public/auth routes at ${viewportWidths.join(", ")}px, touch targets, iOS form text, and protected-route guards.`);
  if (process.env.LHCC_RUN_AUTH_TESTS !== "1") process.exitCode = 0;
  else {
    const suffix = Date.now().toString(36);
    const email = `lhcc-course-${suffix}@example.com`;
    const adminEmail = process.env.LHCC_TEST_ADMIN_EMAIL ?? `lhcc-review-${suffix}@example.com`;
    const password = process.env.LHCC_TEST_PASSWORD ?? randomBytes(24).toString("base64url");
    const studentAuth = await signup(student, email, password, "LHCC Course Test");
    const wrongPassword = await auth("token?grant_type=password", { email, password: password + "wrong" });
    assert.equal(wrongPassword.status, 400);
    const wrongEmail = await auth("token?grant_type=password", { email: `missing-${email}`, password });
    assert.equal(wrongEmail.status, 400);
    await login(student, email, password, "/student");
    await student.goto("/student/banks/anatomy");
    assert((await student.text()).includes("don't have access"));
    assert(!(await student.text()).includes("Which organ pumps"));
    await student.goto("/student/question-banks");
    assert.equal(await student.evaluate("document.querySelectorAll('article').length"), 5);
    await student.click("Request Access", card("Human Anatomy"));
    await waitFor(async () => (await student.text()).includes("Pending Approval"), "pending approval");
    await student.goto("/student/question-banks");
    assert((await student.text()).includes("Pending Approval"));
    await student.click("Request Access", card("Medical Physiology"));
    await waitFor(() => student.evaluate(`${card("Medical Physiology")}.innerText.includes('Pending Approval')`), "second pending request");
    await student.screenshot("student-pending-phone", 390);
    const admin = await page();
    const adminAuth = process.env.LHCC_TEST_ADMIN_EMAIL
      ? (await auth("token?grant_type=password", { email: adminEmail, password })).data
      : await signup(admin, adminEmail, password, "LHCC Review Test");
    assert(adminAuth.user, "Test administrator can authenticate");
    if (!process.env.LHCC_TEST_ADMIN_EMAIL) {
      console.log(JSON.stringify({ promote_only_this_test_admin: adminAuth.user.id, student_id: studentAuth.user.id }));
      await new Promise((resolve) => input.question("Waiting for trusted test-admin promotion; enter continue when ready: ", resolve));
    }
    await login(admin, adminEmail, password, "/admin");
    await admin.goto("/admin/access-requests");
    await admin.click("Approve", card("Human Anatomy"));
    await waitFor(() => admin.evaluate(`!${card("Human Anatomy")}`), "approved request leaves pending filter");
    await admin.fill("textarea", "Complete the prerequisite first.");
    await admin.click("Reject", card("Medical Physiology"));
    await waitFor(async () => (await admin.text()).includes("No requests in this category"), "rejected request leaves pending filter");
    await admin.fill("select", "ALL");
    await admin.screenshot("admin-access-requests-tablet", 768);
    await student.goto("/student/question-banks");
    assert((await student.text()).includes("Access Granted"));
    assert((await student.text()).includes("Access Request Rejected"));
    await student.click("Request Again", card("Medical Physiology"));
    await waitFor(() => student.evaluate(`${card("Medical Physiology")}.innerText.includes('Pending Approval')`), "request again");
    await student.goto("/student/banks/anatomy");
    assert((await student.text()).includes("Which organ pumps"));
    await student.evaluate("document.querySelector('input[type=radio]').click()");
    await student.click("Submit Answer");
    await waitFor(async () => (await student.text()).includes("That answer is incorrect"), "answer feedback after submission");
    await student.screenshot("approved-course-laptop", 1280);
    await student.evaluate("document.documentElement.classList.add('dark')");
    await student.screenshot("approved-course-dark-phone", 390);
    assert.equal(exceptions.length, 0, "No browser runtime exceptions");
    console.log("PASS: public signup, password login, wrong credentials, locked URLs, pending refresh, admin approve/reject, retry, approved questions and answer submission.");
    console.log(JSON.stringify({ cleanup_test_users: [studentAuth.user.id, adminAuth.user.id] }));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  input.close();
  if (socket?.readyState === WebSocket.OPEN) { await command("Browser.close").catch(() => {}); socket.close(); }
  browser.kill();
}

import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { checked, getAdmin, loadManifest, saveManifest } from "./backend-qa-data.mjs";
import { card, login, pause, startBrowser, waitFor } from "./qa-browser.mjs";

const base = process.env.LHCC_TEST_URL ?? "http://localhost:3100";
const mode = process.argv[2] ?? "smoke";
assert(["smoke", "workflows", "routes"].includes(mode));
if (mode === "workflows") assert.equal(new URL(base).hostname, "localhost", "Only the local app runs mutation tests");
const m = await loadManifest(); const db = getAdmin(); const browser = await startBrowser(base);
const results = [];
const pass = (name) => { results.push(name); console.log("PASS: " + name); };
const has = async (page, text) => (await page.text()).includes(text);
const visibleCard = (page, name, text) => page.evaluate(`${card(name)}?.textContent.includes(${JSON.stringify(text)})`);
const persisted = (page, path, text) => waitFor(async () => { await page.goto(path); return has(page, text); }, "persisted " + text);
try {
  const publicPage = await browser.page(); await publicPage.resize(1366, 768);
  await publicPage.goto("/"); await publicPage.healthy("home"); await publicPage.screenshot("qa-home"); pass("Public production build renders");
  const admin = await browser.page(); await login(admin, m.users.admin, "/admin"); pass("Admin login and real-data dashboard");
  const student = await browser.page(); await login(student, m.users.approved, "/student"); pass("Student login and real-data dashboard");
  const teacher = await browser.page(); await login(teacher, m.users.teacher, "/teacher"); pass("Teacher login and real-data dashboard");
  if (mode === "smoke") {
    for (const [page, path] of [[admin, "/admin/users"], [admin, "/admin/wallet"], [student, "/student/analytics"], [teacher, "/teacher/analytics"]]) { await page.goto(path); await page.healthy(path); pass(path); }
  }
  if (mode === "workflows") {
    m.browser ??= {};
    const anatomy = m.banks[0]; const cardiology = m.banks[1]; const nursing = m.banks[2];
    const rejection = await browser.page(); await login(rejection, m.users.rejected, "/student");
    await rejection.goto("/student/question-banks");
    if (!m.browser.approval) {
      await student.goto("/student/question-banks");
      assert(await visibleCard(student, nursing.name, "Locked"));
      await student.click("Request Access", card(nursing.name));
      await waitFor(() => visibleCard(student, nursing.name, "Pending Approval"), "request pending");
      await student.goto("/student/question-banks"); assert(await visibleCard(student, nursing.name, "Pending Approval"));
      await admin.goto("/admin/access-requests");
      const scope = `[...document.querySelectorAll('article')].find(el=>el.textContent.includes(${JSON.stringify(m.users.approved.name)})&&el.textContent.includes(${JSON.stringify(nursing.name)}))`;
      await admin.click("Approve", scope);
      await waitFor(async () => !await admin.evaluate(`Boolean(${scope})`), "request leaves pending list");
      await student.goto("/student/question-banks"); assert(await visibleCard(student, nursing.name, "Access Granted"));
      m.browser.approval = true; await saveManifest(m);
    }
    pass("Student request → admin approval → unlocked after refresh");
    if (!m.browser.rejection) {
      assert(await visibleCard(rejection, cardiology.name, "Access Request Rejected"));
      await rejection.click("Request Again", card(cardiology.name));
      await waitFor(() => visibleCard(rejection, cardiology.name, "Pending Approval"), "request again pending");
      await admin.goto("/admin/access-requests");
      const scope = card(m.users.rejected.name);
      await admin.fillLabel("Rejection reason", m.tag + " browser rejection", scope);
      await admin.click("Reject", scope);
      await waitFor(async () => !await admin.evaluate(`Boolean(${scope})`), "rejected request leaves pending");
      await rejection.goto("/student/question-banks"); assert(await visibleCard(rejection, cardiology.name, "Access Request Rejected"));
      assert(await has(rejection, m.tag + " browser rejection"));
      m.browser.rejection = true; await saveManifest(m);
    }
    pass("Request Again → admin rejection → reason persists after refresh");
    await student.goto("/student/banks/" + anatomy.id);
    for (const q of m.questions.filter((q) => q.bankId === anatomy.id)) {
      const scope = card(q.text, "form");
      if (await student.evaluate(`${scope}.querySelector('button').textContent.includes('Answer recorded')`)) continue;
      await student.evaluate(`${scope}.querySelector('input[value="A"]').click()`);
      await student.click("Submit Answer", scope);
      await waitFor(() => student.evaluate(`${scope}.textContent.includes('Correct answer.')`), "answer recorded");
      await student.goto("/student/banks/" + anatomy.id);
      assert(await student.evaluate(`${scope}.textContent.includes('Answer recorded')`));
    }
    const attempt = await checked(db.from("question_attempts").select("*").eq("student_id", m.users.approved.id).eq("question_bank_id", anatomy.id).single(), "UI attempt");
    assert.equal(attempt.status, "COMPLETED"); assert.equal(attempt.correct_answers, 3); assert.equal(attempt.incorrect_answers, 0); assert.equal(Number(attempt.score_percentage), 100); assert(attempt.submitted_at);
    m.browser.attempt = true; await saveManifest(m); pass("Three UI answers persist across refresh and complete a 100% attempt");
    if (!m.browser.bank) {
      await admin.goto("/admin/question-banks"); await admin.click("Add Question Bank");
      await admin.fillLabel("Bank name", m.tag + " Browser workflow"); await admin.fillLabel("Description", m.tag + " created through admin UI");
      await admin.fillLabel("Access price", "15"); await admin.click("Save Question Bank");
      await waitFor(() => has(admin, m.tag + " Browser workflow added successfully."), "bank save");
      const bank = await checked(db.from("question_banks").select("*").eq("name", m.tag + " Browser workflow").eq("created_by", m.users.admin.id).single(), "Browser bank");
      m.banks.push({ id: bank.id, name: bank.name, price: Number(bank.price) }); m.browser.bank = bank.id; await saveManifest(m);
    }
    pass("Admin bank creation persisted in Supabase");
    const uiBank = m.banks.find((b) => b.id === m.browser.bank);
    await admin.goto("/admin/question-banks");
    await admin.evaluate(`document.querySelector('[aria-label="Edit ${uiBank.name}"]').click()`);
    await admin.fillLabel("Description", m.tag + " edited through admin UI");
    await admin.click("Save Question Bank");
    await waitFor(() => has(admin, uiBank.name + " updated successfully."), "bank edit");
    await admin.goto("/admin/question-banks"); assert(await has(admin, m.tag + " edited through admin UI"));
    pass("Admin bank editing persists after refresh");
    if (!m.browser.question) {
      await admin.goto(`/admin/question-banks/${uiBank.id}/questions/new`);
      await admin.fillLabel("Question text", m.tag + " Browser QCU: select option A.");
      await admin.click("Add Another Answer"); await admin.click("Add Another Answer");
      for (let i = 1; i <= 4; i++) await admin.fillLabel("Answer " + i, "Option " + "ABCD"[i - 1]);
      await admin.evaluate("document.querySelector('input[name=correct-answer]').click()");
      await admin.click("Save Question");
      await waitFor(() => admin.evaluate(`location.pathname === '/admin/question-banks/${uiBank.id}'`), "question saved");
      const question = await checked(db.from("bank_questions").select("id,text").eq("question_bank_id", uiBank.id).single(), "Browser question");
      m.questions.push({ ...question, bankId: uiBank.id, correct: "new-answer-1" }); m.browser.question = question.id; await saveManifest(m);
    }
    await admin.goto(`/admin/question-banks/${uiBank.id}/questions/${m.browser.question}/edit`);
    const updatedQuestion = m.tag + " Browser QCU edited: select option A.";
    await admin.fillLabel("Question text", updatedQuestion); await admin.click("Save Question");
    await waitFor(() => admin.evaluate(`location.pathname === '/admin/question-banks/${uiBank.id}'`), "question updated");
    await persisted(admin, `/admin/question-banks/${uiBank.id}`, updatedQuestion);
    pass("Admin QCU creation/edit and four options persist after navigation");
    if (!m.browser.wallet) {
      await admin.goto("/admin/wallet"); await admin.click("Add Ticket");
      await admin.fillLabel("Ticket name", m.tag + " Browser income"); await admin.fillLabel("Amount (USD)", "8");
      await admin.click("Save Ticket"); await waitFor(() => has(admin, "Ticket added successfully."), "wallet saved");
      const ticket = await checked(db.from("wallet_transactions").select("id").eq("name", m.tag + " Browser income").eq("created_by", m.users.admin.id).single(), "Browser wallet ticket");
      m.walletIds.push(ticket.id); m.browser.wallet = ticket.id; await saveManifest(m);
    }
    await admin.goto("/admin/wallet");
    await admin.evaluate(`document.querySelector('[aria-label="Edit ${m.tag} Browser income"]').click()`);
    await admin.fillLabel("Amount (USD)", "9"); await admin.click("Save Ticket");
    await waitFor(() => has(admin, "Ticket updated successfully."), "wallet edited");
    await admin.goto("/admin/wallet"); await admin.healthy("wallet refresh");
    assert.equal(Number((await checked(db.from("wallet_transactions").select("amount").eq("id", m.browser.wallet).single(), "Wallet amount")).amount), 9);
    pass("Wallet manual ticket add/edit persisted with signed ledger amount");
    if (!m.browser.portfolio) {
      const original = await checked(db.from("portfolio_content").select("content").eq("section_key", "about").single(), "Original About content");
      m.portfolioOriginal = original.content; m.portfolioMarker = m.tag + " CMS persistence verified."; await saveManifest(m);
      await admin.goto("/admin/portfolio");
      await admin.fillLabel("Main description", original.content.description + " " + m.portfolioMarker);
      assert(await has(admin, "Unsaved changes"));
      await admin.click("Save Changes"); await waitFor(() => has(admin, "Portfolio content updated successfully."), "portfolio saved");
      m.browser.portfolio = true; await saveManifest(m);
    }
    await admin.goto("/admin/portfolio");
    assert(await admin.evaluate(`document.querySelector('textarea').value.includes(${JSON.stringify(m.portfolioMarker)})`));
    await publicPage.goto("/about"); assert(await has(publicPage, m.portfolioMarker));
    pass("CMS save persists after refresh and is visible to an anonymous visitor");
    const locked = await browser.page(); await login(locked, m.users.locked, "/student");
    await admin.goto("/admin/users");
    await admin.evaluate(`document.querySelector('[aria-label="Edit ${m.users.locked.name}"]').click()`);
    await admin.fillLabel("Home address", m.tag + " edited through user management");
    await admin.click("Save Changes"); await waitFor(() => has(admin, m.users.locked.name + " updated successfully."), "user edit");
    await admin.goto("/admin/users");
    assert.equal((await checked(db.from("profiles").select("home_address").eq("id", m.users.locked.id).single(), "Saved user")).home_address, m.tag + " edited through user management");
    await admin.evaluate(`document.querySelector('[aria-label="Deactivate ${m.users.locked.name}"]').click()`);
    await admin.click("Deactivate User"); await waitFor(() => has(admin, m.users.locked.name + " was deactivated."), "user deactivation");
    await locked.goto("/student"); assert(await locked.evaluate("location.pathname === '/account/inactive'"));
    await admin.evaluate(`document.querySelector('[aria-label="Reactivate ${m.users.locked.name}"]').click()`);
    await admin.click("Reactivate", "document.querySelector('[role=dialog]')");
    await waitFor(() => has(admin, m.users.locked.name + " was reactivated"), "user reactivation");
    await locked.goto("/student"); await locked.healthy("reactivated user");
    assert(await locked.evaluate("location.pathname === '/student'"));
    m.browser.users = true; await saveManifest(m);
    pass("Admin user editing, deactivation guard, and reactivation persist");
  }
  if (mode === "routes") {
    const empty = await browser.page(); await login(empty, m.users.locked, "/student");
    assert(await has(empty, "No activity has been recorded."));
    for (const label of ["Average score", "Questions answered", "Attempts", "Approved banks"]) assert(await empty.evaluate(`${card(label)}.querySelectorAll('p')[1].textContent.match(/^0%?$/) !== null`));
    pass("Empty student dashboard: zero metrics and no activity");
    const completed = await browser.page(); await login(completed, m.users.completed, "/student");
    assert(await has(completed, "67%")); pass("Completed student dashboard shows real rounded score");
    const profiles = await checked(db.from("profiles").select("role,status,expiration_date"), "Dashboard profiles");
    const banks = await checked(db.from("question_banks").select("id").eq("status", "active"), "Dashboard banks");
    const ledger = await checked(db.from("wallet_transactions").select("amount"), "Dashboard ledger");
    const metrics = { "Managed users": String(profiles.filter((p) => p.role !== "ADMIN").length), "Active teachers": String(profiles.filter((p) => p.role === "TEACHER" && p.status === "ACTIVE" && Date.parse(p.expiration_date) > Date.now()).length), "Question banks": String(banks.length), "Wallet balance": new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(ledger.reduce((sum, r) => sum + Number(r.amount), 0)) };
    for (const [label, value] of Object.entries(metrics)) assert.equal(await admin.evaluate(`${card(label)}.querySelectorAll('p')[1].textContent`), value, "Admin metric " + label);
    pass("Admin dashboard metrics equal live profile/bank/ledger calculations");
    const routeGroups = [[publicPage, ["/", "/about", "/services", "/platform", "/contact", "/login", "/signup"]], [admin, ["/admin", "/admin/users", "/admin/question-banks", "/admin/access-requests", "/admin/wallet", "/admin/portfolio", "/admin/settings", `/admin/users/${m.users.completed.id}/activity`]], [student, ["/student", "/student/question-banks", "/student/exams", "/student/analytics", "/student/profile", `/student/banks/${m.banks[0].id}`]], [teacher, ["/teacher", "/teacher/questions", "/teacher/question-banks", "/teacher/exams", "/teacher/students", "/teacher/analytics"]]];
    for (const [p, routes] of routeGroups) for (const route of routes) {
      await p.goto(route);
      for (const width of [390, 412, 768, 1366, 1920]) { await p.resize(width); await p.healthy(`${route} @ ${width}`); }
      pass("Responsive route " + route);
    }
    for (const [p, path, expected] of [[empty, "/student/banks/" + m.banks[0].id, "You don't have access"], [student, "/student/banks/missing-test-bank", "You don't have access"], [admin, `/admin/question-banks/${m.banks[0].id}/questions/missing-test-question/edit`, "Question not found"]]) { await p.goto(path); assert(await has(p, expected), path); pass("Safe missing/unauthorized state " + path); }
    for (const path of ["/admin", "/admin/users", "/teacher", "/student"]) { await publicPage.goto(path); assert(await publicPage.evaluate("location.pathname === '/login'")); }
    await student.goto("/admin/wallet"); assert(await student.evaluate("location.pathname === '/unauthorized' || location.pathname === '/student'")); pass("Anonymous and student route authorization");
    await completed.goto("/student/analytics"); assert(await completed.evaluate("document.querySelectorAll('.recharts-surface').length >= 2")); pass("Real score/histogram charts render");
    await admin.goto("/admin/wallet"); assert(await admin.evaluate("document.querySelectorAll('.recharts-surface').length >= 1")); pass("Real ledger chart renders");
    for (const [p, name] of [[admin, "wallet"], [completed, "analytics"]]) for (const width of [390, 768, 1366, 1920]) { await p.resize(width); await p.screenshot(`qa-${name}-${width}`); }
  }
  assert.deepEqual(browser.failedResponses, [], "No HTTP 5xx responses");
  assert.deepEqual(browser.errors, [], "No runtime or console errors");
  await pause(200);
  await writeFile(`.test-artifacts/backend-qa-browser-${mode}.json`, JSON.stringify({ run: m.run, base, results, errors: browser.errors, failedResponses: browser.failedResponses }, null, 2));
} catch (error) {
  console.log(JSON.stringify({ browserErrors: browser.errors, failedResponses: browser.failedResponses }));
  throw error;
} finally { await browser.close(); }

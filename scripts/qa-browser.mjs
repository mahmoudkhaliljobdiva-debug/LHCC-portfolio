// Isolated end-to-end test runner; never connects to a personal browser profile.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function waitFor(fn, label, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await fn()) return; await pause(200); }
  throw new Error("Timed out: " + label);
}
export async function startBrowser(base) {
  assert(["localhost", "lhcc-lb.com", "lhcc-portfolio.vercel.app"].includes(new URL(base).hostname));
  const port = 9341;
  const profile = await mkdtemp(join(tmpdir(), "lhcc-backend-qa-"));
  const browser = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let endpoint;
  await waitFor(async () => { try { endpoint = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; return Boolean(endpoint); } catch { return false; } }, "Edge startup");
  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  const failedResponses = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" "));
    if (message.method === "Network.responseReceived" && message.params.response.status >= 500) failedResponses.push({ url: message.params.response.url, status: message.params.response.status });
    if (!message.id) return;
    const request = pending.get(message.id); if (!request) return;
    clearTimeout(request.timer); pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  });
  function command(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error("CDP timeout: " + method)); }, 30000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  async function page() {
    const { browserContextId } = await command("Target.createBrowserContext");
    const { targetId } = await command("Target.createTarget", { url: "about:blank", browserContextId });
    const { sessionId } = await command("Target.attachToTarget", { targetId, flatten: true });
    for (const method of ["Page.enable", "Runtime.enable", "Network.enable"]) await command(method, {}, sessionId);
    const evaluate = async (expression) => {
      const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      return result.result.value;
    };
    return {
      evaluate,
      async goto(path) {
        // Clear the previous document first, so readyState cannot accept stale UI.
        await command("Page.navigate", { url: "about:blank" }, sessionId);
        await waitFor(() => evaluate("location.href === 'about:blank'"), "clear previous document");
        await command("Page.navigate", { url: base + path }, sessionId);
        await waitFor(() => evaluate("location.protocol !== 'about:' && document.readyState === 'complete' && document.body.innerText.length > 30"), path);
        await pause(500);
      },
      async resize(width, height = width < 600 ? 844 : width === 1366 ? 768 : 1080) { await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 }, sessionId); await pause(100); },
      async text() { return evaluate("document.body.innerText"); },
      async fill(selector, value) { await this.fillElement(`document.querySelector(${JSON.stringify(selector)})`, value); },
      async fillLabel(label, value, scope = "document") {
        await this.fillElement(`(() => {const l=[...${scope}.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith(${JSON.stringify(label)})); return l?.control ?? l?.querySelector('input,textarea,select');})()`, value);
      },
      async fillElement(expression, value) {
        await evaluate(`(() => {const el=${expression}; if(!el)throw Error('Missing field'); const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
      },
      async click(text, scope = "document") {
        await evaluate(`(() => {const el=[...${scope}.querySelectorAll('button,a')].find(el=>el.textContent.trim().startsWith(${JSON.stringify(text)})); if(!el||el.disabled)throw Error('Missing or disabled control: '+${JSON.stringify(text)});el.click();})()`);
      },
      async screenshot(name) { const { data } = await command("Page.captureScreenshot", { format: "png" }, sessionId); await mkdir(".test-artifacts", { recursive: true }); await writeFile(`.test-artifacts/${name}.png`, Buffer.from(data, "base64")); },
      async healthy(label) {
        assert(await evaluate("document.documentElement.scrollWidth <= innerWidth"), "No horizontal overflow: " + label);
        assert(!await evaluate("Boolean(document.querySelector('[data-nextjs-dialog]'))"), "No framework overlay: " + label);
        assert(!/Application error|Something went wrong|Unable to load|Unable to read/i.test(await this.text()), "No application error: " + label);
      },
    };
  }
  return { page, errors, failedResponses, async close() { await command("Browser.close").catch(() => {}); socket.close(); browser.kill(); } };
}
export async function login(page, user, portal) {
  await page.goto("/login");
  await waitFor(() => page.evaluate("Boolean(document.querySelector('input[type=email]'))"), "login form ready");
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click("Sign in");
  await waitFor(() => page.evaluate(`location.pathname === ${JSON.stringify(portal)}`), "login " + portal);
  await waitFor(() => page.evaluate("Boolean(document.querySelector('main h1'))"), "portal heading");
  await page.healthy(portal);
}
export const card = (text, element = "article") => `[...document.querySelectorAll(${JSON.stringify(element)})].find(el=>el.textContent.includes(${JSON.stringify(text)}))`;

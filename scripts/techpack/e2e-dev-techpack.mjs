#!/usr/bin/env node
// Development tech pack — end-to-end in a REAL browser (headless Edge / Chrome over the DevTools
// protocol), against the real server and the real website (Vite dev server), with throwaway data:
// its own DATA_DIR in the system temp folder (never server-data/), its own browser profile.
//
//   node scripts/techpack/e2e-dev-techpack.mjs [outDir]     (screenshots + log.json)
//
// Checks: a customer never sees GENERATE TECH PACK and Add to Cart still works; a signed-in admin
// sees it on Review, the PDF is generated from the design the configurator holds (design-config.json
// equals the configurator's own saved state), the PDF downloads, nothing touches the cart.
// The design is loaded through the configurator's own draft (an automated stand-in for designing by
// hand — not the acceptance test, which is a design made manually on the website).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { devDesign } from "./devDesignFixture.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = resolve(process.argv[2] ?? join(tmpdir(), "jk-dev-techpack-e2e"));
mkdirSync(OUT, { recursive: true });
const ADMIN_KEY = "e2e-admin-key-0123456789";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((ok) => { const s = createServer(); s.listen(0, () => { const { port } = s.address(); s.close(() => ok(port)); }); });

const children = [];
const dataDir = mkdtempSync(join(tmpdir(), "jk-dev-e2e-data-"));
const profile = mkdtempSync(join(tmpdir(), "jk-dev-e2e-browser-"));
const apiPort = await freePort(), sitePort = await freePort(), debugPort = await freePort();
const BASE = `http://localhost:${sitePort}`;

function start(cmd, args, env, ready, label) {
  const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);
  let out = "";
  return new Promise((ok, fail) => {
    const timer = setTimeout(() => fail(new Error(`${label} didn't start:\n${out}`)), 60_000);
    const on = (c) => { out += String(c).replace(/\x1b\[[0-9;]*m/g, ""); if (ready.test(out)) { clearTimeout(timer); ok(child); } };
    child.stdout.on("data", on);
    child.stderr.on("data", on);
    child.on("exit", (code) => fail(new Error(`${label} exited (${code}):\n${out}`)));
  });
}
await start(process.execPath, [join(ROOT, "server/index.mjs")], { DATA_DIR: dataDir, PORT: String(apiPort), ADMIN_KEY }, /JACKETEK server on/, "API server");
await start(process.execPath, [join(ROOT, "node_modules/vite/bin/vite.js"), "--port", String(sitePort), "--strictPort"], { API_PORT: String(apiPort) }, /Local:/, "Vite");
const exe = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
if (!exe) throw new Error("No Edge / Chrome found.");
children.push(spawn(exe, ["--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--no-first-run", "about:blank"], { stdio: "ignore" }));

let ws;
for (let i = 0; i < 80 && !ws; i++) {
  try { ws = new WebSocket((await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json()).webSocketDebuggerUrl); } catch { await sleep(250); }
}
await new Promise((r) => (ws.onopen = r));
let nextId = 0;
const pending = new Map();
const pageErrors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") pageErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
};
const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
  const id = ++nextId;
  pending.set(id, (m) => (m.error ? fail(new Error(`${method}: ${m.error.message}`)) : ok(m.result)));
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const HELPERS = `
window.__vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
window.__all = (sel) => [...document.querySelectorAll(sel)].filter(__vis);
window.__one = (sel) => __all(sel)[0] ?? null;
window.__click = (el) => { if (!el) return false; el.scrollIntoView({ block: "center" }); el.click(); return true; };
window.__idb = (op, key, value) => new Promise((res, rej) => { const q = indexedDB.open("jacketek", 1); q.onupgradeneeded = () => q.result.createObjectStore("drafts");
  q.onsuccess = () => { const t = q.result.transaction("drafts", op === "get" ? "readonly" : "readwrite").objectStore("drafts"); const r = op === "get" ? t.get(key) : t.put(value, key); r.onsuccess = () => res(op === "get" ? r.result ?? null : true); r.onerror = () => rej(r.error); }; q.onerror = () => rej(q.error); });
true`;
async function openPage(ctx, label) {
  const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId: ctx });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);
  await s("Page.enable");
  await s("Runtime.enable");
  await s("Page.addScriptToEvaluateOnNewDocument", { source: HELPERS });
  await s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const page = {
    async eval(expr) {
      const r = await s("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`${label}: ${r.exceptionDetails.exception?.description ?? "eval failed"}\n  in: ${expr.slice(0, 200)}`);
      return r.result?.value;
    },
    async waitFor(expr, what, ms = 20_000) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        try { const v = await page.eval(expr); if (v) return v; } catch { /* navigating */ }
        await sleep(250);
      }
      await page.shot(`FAILED-${label}-${what.replace(/\W+/g, "-")}`);
      throw new Error(`${label}: timed out waiting for ${what}`);
    },
    async goto(path) {
      await s("Page.navigate", { url: BASE + path });
      await page.waitFor(`document.readyState === "complete" && !!window.__one`, `load ${path}`);
    },
    async shot(name) {
      try { const r = await s("Page.captureScreenshot", { format: "png" }); writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, "base64")); } catch { /* closed */ }
    },
  };
  return page;
}
const newContext = async () => (await send("Target.createBrowserContext", { disposeOnDetach: true })).browserContextId;

const log = [];
let n = 0;
async function step(title, fn) {
  n++;
  const t0 = Date.now();
  try {
    const detail = await fn();
    log.push({ n, title, ok: true, ms: Date.now() - t0, detail: detail ?? null });
    console.log(`✔ ${String(n).padStart(2, "0")} ${title}${detail ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  } catch (err) {
    log.push({ n, title, ok: false, ms: Date.now() - t0, error: String(err.message ?? err) });
    console.log(`✖ ${String(n).padStart(2, "0")} ${title}\n   ${String(err.message ?? err).split("\n").join("\n   ")}`);
    throw err;
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
async function toReview(page) {
  await page.waitFor(`!!__one(".jk-stepmap__step")`, "configurator");
  await page.eval(`__click(__all(".jk-stepmap__step").at(-1))`);
  await page.waitFor(`!!__one("[data-testid=commit-design]")`, "review step");
}
const seedDraft = (page, config) => page.eval(`__idb("put", "design-draft-v2", ${JSON.stringify({ version: 2, savedAt: Date.now(), config, step: "review" })})`);

const design = devDesign("XL");
let exitCode = 0;
try {
  const customer = await openPage(await newContext(), "customer");
  const admin = await openPage(await newContext(), "admin");

  await step("A customer (no admin session) never sees Generate Tech Pack; Add to Cart is unchanged", async () => {
    await customer.goto("/");
    await customer.eval(`localStorage.setItem("jacketek.locale", "en"); localStorage.setItem("jacketek.gestureHint.v1", "1"); true`);
    await seedDraft(customer, design);
    await customer.goto("/design");
    await toReview(customer);
    await sleep(1500); // the admin-session check has answered by now
    assert(!(await customer.eval(`!!document.querySelector("[data-testid=dev-techpack]")`)), "the development panel is visible to a customer");
    const label = await customer.eval(`__one("[data-testid=commit-design]").textContent.trim()`);
    assert(/add to cart/i.test(label), `Add to Cart label: ${label}`);
    const status = await customer.eval(`fetch("/api/admin/techpack/development", { method: "POST", headers: { "Content-Type": "application/json", "X-Jacketek-Admin": "1" }, body: "{}" }).then((r) => r.status)`);
    assert(status === 401, `the endpoint answered ${status} without an admin session`);
    await customer.shot("01-customer-review");
    return { addToCart: label, endpointWithoutAdmin: status };
  });

  await step("A signed-in admin sees Generate Tech Pack on Review, next to (not instead of) Add to Cart", async () => {
    await admin.goto("/");
    await admin.eval(`localStorage.setItem("jacketek.locale", "en"); localStorage.setItem("jacketek.gestureHint.v1", "1"); true`);
    const login = await admin.eval(`fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", "X-Jacketek-Admin": "1" }, body: JSON.stringify({ key: ${JSON.stringify(ADMIN_KEY)} }) }).then((r) => r.status)`);
    assert(login === 200, `admin login ${login}`);
    await seedDraft(admin, design);
    await admin.goto("/design");
    await toReview(admin);
    await admin.waitFor(`!!__one("[data-testid=generate-techpack]")`, "Generate Tech Pack button");
    const label = await admin.eval(`__one("[data-testid=generate-techpack]").textContent.trim()`);
    assert(label === "Generate Tech Pack", `button: ${label}`);
    assert(await admin.eval(`!!__one("[data-testid=commit-design]")`), "Add to Cart is gone");
    await admin.shot("02-admin-review");
    return label;
  });

  let result;
  await step("Generate: Generating… then Tech Pack generated successfully, from the design the configurator holds", async () => {
    const cartBefore = await admin.eval(`localStorage.getItem("jacketek-cart-v1")`);
    await admin.eval(`__click(__one("[data-testid=generate-techpack]"))`);
    await admin.waitFor(`/Generating/.test(__one("[data-testid=dev-techpack]").textContent)`, "Generating state", 5000);
    await admin.waitFor(`/generated successfully|not generated/.test(__one("[data-testid=dev-techpack]").textContent)`, "result", 300_000);
    const text = await admin.eval(`__one("[data-testid=dev-techpack]").textContent`);
    await admin.shot("03-admin-generated");
    assert(/generated successfully/.test(text), `panel: ${text}`);
    assert(/size XL/.test(text), `selected size not shown: ${text}`);
    const href = await admin.eval(`__all("[data-testid=dev-techpack] a")[0].getAttribute("href")`);
    const pdf = await admin.eval(`fetch(${JSON.stringify(href)}).then(async (r) => ({ status: r.status, type: r.headers.get("content-type"), bytes: (await r.arrayBuffer()).byteLength }))`);
    assert(pdf.status === 200 && pdf.type === "application/pdf" && pdf.bytes > 50_000, `PDF: ${JSON.stringify(pdf)}`);
    // The frozen snapshot equals the configurator's own state (its saved draft).
    const root = join(dataDir, "development-techpacks");
    const [designId] = readdirSync(root);
    const [revision] = readdirSync(join(root, designId)).filter((d) => /^DEV-\d\d$/.test(d));
    const snap = JSON.parse(readFileSync(join(root, designId, revision, "design-config.json"), "utf8")).config;
    const draft = (await admin.eval(`__idb("get", "design-draft-v2")`)).config;
    assert(JSON.stringify(snap) === JSON.stringify(draft), "design-config.json differs from the configurator's design");
    const report = JSON.parse(readFileSync(join(root, designId, revision, "generation-report.json"), "utf8"));
    assert(report.qa.designToSpec.ok && report.qa.specToDrawing.ok, "QA failed");
    assert(report.selectedSize === "XL", `size ${report.selectedSize}`);
    assert((await admin.eval(`localStorage.getItem("jacketek-cart-v1")`)) === cartBefore, "the cart changed");
    result = { designId, revision, pages: report.document.pages, artwork: report.artwork.length, pdfBytes: pdf.bytes };
    return result;
  });

  await step("Generating again makes the next revision; the first is kept", async () => {
    await admin.eval(`__click(__one("[data-testid=generate-techpack]"))`);
    await admin.waitFor(`/DEV-02/.test(__one("[data-testid=dev-techpack]").textContent)`, "DEV-02", 300_000);
    const dir = join(dataDir, "development-techpacks", result.designId);
    const revs = readdirSync(dir).filter((d) => /^DEV-\d\d$/.test(d)).sort();
    assert(JSON.stringify(revs) === JSON.stringify(["DEV-01", "DEV-02"]), `revisions ${revs}`);
    return revs;
  });

  await step("A rejected design shows a clear error (no silent failure)", async () => {
    const r = await admin.eval(`fetch("/api/admin/techpack/development", { method: "POST", headers: { "Content-Type": "application/json", "X-Jacketek-Admin": "1" }, body: JSON.stringify({ config: { ...${JSON.stringify(design)}, embroidery: [{ ...${JSON.stringify(design.embroidery[1])}, image: { ...${JSON.stringify(design.embroidery[1].image)}, src: "/embroidery-library/../../server-data/jacketek.db" } }] } }) }).then(async (r) => ({ status: r.status, body: await r.json() }))`);
    assert(r.status === 422 && /library design's own file|not inside/.test(r.body.error), `answer ${JSON.stringify(r)}`);
    return r.status;
  });

  assert(pageErrors.length === 0, `uncaught page errors:\n${pageErrors.join("\n")}`);
  console.log(`\nAll ${n} browser steps passed. Screenshots: ${OUT}`);
} catch {
  exitCode = 1;
} finally {
  writeFileSync(join(OUT, "log.json"), JSON.stringify({ base: BASE, steps: log, pageErrors }, null, 2));
  try { ws.close(); } catch { /* gone */ }
  for (const c of children) c.kill();
  await sleep(500);
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  process.exit(exitCode);
}

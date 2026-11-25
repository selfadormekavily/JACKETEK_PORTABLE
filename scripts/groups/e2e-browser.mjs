#!/usr/bin/env node
// Group orders — end-to-end in a REAL browser (headless Edge / Chrome over
// the DevTools protocol; no extra dependency), against the real server and
// the real website (Vite dev server), each with throwaway data:
//   - its own DATA_DIR in the system temp folder (never server-data/)
//   - separate browser contexts per account (own cookies and storage)
//
//   node scripts/groups/e2e-browser.mjs [outDir]     (screenshots + log.json)
//
// Exits non-zero at the first failed step.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = resolve(process.argv[2] ?? join(tmpdir(), "jk-groups-e2e"));
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () =>
  new Promise((ok) => {
    const s = createServer();
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });

// ---------------------------------------------------------------------------
// Servers

const children = [];
const dataDir = mkdtempSync(join(tmpdir(), "jk-groups-e2e-data-"));
const profile = mkdtempSync(join(tmpdir(), "jk-groups-e2e-browser-"));
const apiPort = await freePort();
const sitePort = await freePort();
const debugPort = await freePort();
const BASE = `http://localhost:${sitePort}`;

function start(cmd, args, env, ready, label) {
  const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);
  let out = "";
  return new Promise((ok, fail) => {
    const timer = setTimeout(() => fail(new Error(`${label} didn't start:\n${out}`)), 60_000);
    const on = (c) => {
      out += String(c).replace(/\[[0-9;]*m/g, "");
      if (ready.test(out)) {
        clearTimeout(timer);
        ok(child);
      }
    };
    child.stdout.on("data", on);
    child.stderr.on("data", on);
    child.on("exit", (code) => fail(new Error(`${label} exited (${code}):\n${out}`)));
  });
}

await start(process.execPath, [join(ROOT, "server/index.mjs")], { DATA_DIR: dataDir, PORT: String(apiPort), ADMIN_KEY: "e2e-admin-key-0123456789" }, /JACKETEK server on/, "API server");
await start(process.execPath, [join(ROOT, "node_modules/vite/bin/vite.js"), "--port", String(sitePort), "--strictPort"], { API_PORT: String(apiPort) }, /Local:/, "Vite");

const exe = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
if (!exe) throw new Error("No Edge / Chrome found.");
children.push(
  spawn(exe, ["--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--no-first-run", "about:blank"], { stdio: "ignore" }),
);

// ---------------------------------------------------------------------------
// DevTools protocol (one browser connection; one session per page)

let ws;
for (let i = 0; i < 80 && !ws; i++) {
  try {
    const v = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json();
    ws = new WebSocket(v.webSocketDebuggerUrl);
  } catch {
    await sleep(250);
  }
}
await new Promise((r) => (ws.onopen = r));
let nextId = 0;
const pending = new Map();
const pageErrors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
  if (m.method === "Runtime.exceptionThrown") pageErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
};
const send = (method, params = {}, sessionId) =>
  new Promise((ok, fail) => {
    const id = ++nextId;
    pending.set(id, (m) => (m.error ? fail(new Error(`${method}: ${m.error.message}`)) : ok(m.result)));
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

const HELPERS = `
window.__vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
window.__all = (sel) => [...document.querySelectorAll(sel)].filter(__vis);
window.__one = (sel) => __all(sel)[0] ?? null;
window.__byText = (text, sel = "button, a, [role=tab], [role=radio]") => __all(sel).find((el) => (el.getAttribute("aria-label") || el.textContent || "").trim().includes(text)) ?? null;
window.__click = (el) => { if (!el) return false; el.scrollIntoView({ block: "center" }); el.click(); return true; };
window.__type = (el, value) => {
  if (!el) return false;
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
};
true`;

async function openPage(ctx, label) {
  const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId: ctx });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);
  await s("Page.enable");
  await s("Runtime.enable");
  await s("Page.addScriptToEvaluateOnNewDocument", { source: HELPERS });
  const page = {
    label,
    targetId,
    send: s,
    async eval(expr) {
      const r = await s("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`${label}: ${r.exceptionDetails.exception?.description ?? "eval failed"}\n  in: ${expr.slice(0, 200)}`);
      return r.result?.value;
    },
    async waitFor(expr, what, ms = 20_000) {
      const end = Date.now() + ms;
      let last;
      while (Date.now() < end) {
        try {
          last = await page.eval(expr);
          if (last) return last;
        } catch {
          /* navigating */
        }
        await sleep(200);
      }
      await page.shot(`FAILED-${label}-${what.replace(/\W+/g, "-")}`);
      throw new Error(`${label}: timed out waiting for ${what}`);
    },
    async goto(path) {
      await s("Page.navigate", { url: path.startsWith("http") ? path : BASE + path });
      await page.waitFor(`document.readyState === "complete" && !!window.__one`, `load ${path}`);
    },
    async reload() {
      await s("Page.reload", { ignoreCache: false });
      await sleep(300);
      await page.waitFor(`document.readyState === "complete" && !!window.__one`, "reload");
    },
    async viewport(width, height, mobile = false) {
      await s("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    },
    async shot(name) {
      try {
        const r = await s("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
        writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, "base64"));
      } catch {
        /* closed */
      }
    },
    async fullShot(name) {
      const { cssContentSize } = await s("Page.getLayoutMetrics");
      const r = await s("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: cssContentSize.width, height: Math.min(cssContentSize.height, 6000), scale: 1 } });
      writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, "base64"));
    },
    path: () => page.eval("location.pathname + location.search"),
  };
  await page.viewport(1440, 900);
  return page;
}

const newContext = async () => (await send("Target.createBrowserContext", { disposeOnDetach: true })).browserContextId;

// ---------------------------------------------------------------------------
// Steps

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
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

/** Sign up through the API from inside the page (sets that context's session cookie). */
const apiSignUp = (page, first) =>
  page.eval(`fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json", "X-Jacketek-Auth": "1" },
    body: JSON.stringify({ firstName: ${JSON.stringify(first)}, lastName: "Tester", method: "email", email: "${first.toLowerCase()}-" + Date.now() + "@example.com", password: "correct-horse-battery" }) }).then((r) => r.status)`);

const VALID = { colours: { body: "fabric-navy", sleeves: "leather-white", trim: "fabric-red" }, materials: { body: "felt", sleeves: "leather" }, buttons: "gold", zipper: false, size: "M", fit: "regular",
  embroidery: [{ id: "e-text", kind: "text", text: "CLASS 27", placement: "mainBack", offset: [0, 0], rotation: 0, scale: 1, style: "satin", thread: "ivory", image: null }] };
const cartItem = (id, config, quantity = 1) => ({ id, productId: "graduation-jacket", productName: "Graduation Jacket", config, quantity, unitPrice: null, preview: null, addedAt: new Date().toISOString() });

/** In the configurator: go to Review (step map's last knot) and pick a size. */
async function chooseSize(page, size) {
  await page.waitFor(`!!__one(".jk-stepmap__step")`, "configurator");
  await page.eval(`__click(__all(".jk-stepmap__step").at(-1))`);
  await page.waitFor(`!!__all("[role=radio]").find((b) => b.textContent.trim() === ${JSON.stringify(size)})`, "size options");
  await page.eval(`__click(__all("[role=radio]").find((b) => b.textContent.trim() === ${JSON.stringify(size)}))`);
  await page.waitFor(`__all("[role=radio]").find((b) => b.textContent.trim() === ${JSON.stringify(size)})?.getAttribute("aria-checked") === "true"`, `size ${size} selected`);
}
const commit = (page) => page.eval(`__click(__one("[data-testid=commit-design]"))`);
const groupPath = (id) => `/groups/${id}`;

let groupId, inviteUrl, bItemId;
const ctxA = await newContext();
const ctxB = await newContext();
const ctxC = await newContext();
const ctxD = await newContext();
const A = await openPage(ctxA, "A");
const B = await openPage(ctxB, "B");

try {
  // ---- 1. Account A creates a group from the cart, importing jackets (with a partial failure first)
  await step("A signs up and has three jackets in the personal cart (one with an invalid design)", async () => {
    await A.goto("/");
    assert((await apiSignUp(A, "Yousef")) === 201, "A sign-up failed");
    const bad = { ...VALID, colours: { ...VALID.colours, body: "not-a-colour" } };
    await A.eval(`localStorage.setItem("jacketek-cart-v1", ${JSON.stringify(JSON.stringify([cartItem("cart-a1", VALID, 1), cartItem("cart-a2", { ...VALID, size: "L" }, 2), cartItem("cart-bad", bad, 1)]))}); localStorage.setItem("jacketek.locale", "en"); localStorage.setItem("jacketek.gestureHint.v1", "1"); true`);
    await A.goto("/cart");
    await A.waitFor(`__all(".jk-item").length === 3`, "3 cart items");
  });

  await step("A starts a group, picks all three: the import fails as a whole and the cart keeps all three", async () => {
    await A.eval(`__click(__one("[data-testid=start-group]"))`);
    await A.waitFor(`!!__one("input[name=groupName]")`, "start form");
    await A.eval(`__type(__one("input[name=groupName]"), "AIS Seniors 2027")`);
    await A.eval(`__all(".jk-group-pick input").forEach((c) => c.click()); true`);
    await A.shot("01-start-group-form");
    await A.eval(`__click(__one("[data-testid=create-group]"))`);
    await A.waitFor(`!!__one(".jk-group-note--attention")`, "partial-failure notice");
    const text = await A.eval(`__one(".jk-group-note--attention").textContent`);
    assert(/still in your cart/.test(text), `unexpected notice: ${text}`);
    // The jacket the server refused is named, with what is wrong, and its row is marked.
    assert(/Jacket 3 \(size M\) can't be moved: it uses a colour or material that's no longer offered/.test(text), `no specific reason: ${text}`);
    const marked = await A.eval(`[...document.querySelectorAll(".jk-group-pick")].map((l) => l.classList.contains("jk-group-pick--problem"))`);
    assert(JSON.stringify(marked) === "[false,false,true]", `marked rows ${marked}`);
    const cart = await A.eval(`JSON.parse(localStorage.getItem("jacketek-cart-v1")).map((i) => i.id)`);
    assert(cart.length === 3, `cart changed: ${cart}`);
    await A.shot("02-import-failed-cart-intact");
    return text;
  });

  await step("A server failure without a code (the original bug's answer) shows a clear message, not the generic one", async () => {
    await A.send("Fetch.enable", { patterns: [{ urlPattern: "*/items/import", requestStage: "Request" }] });
    const intercept = new Promise((resolve) => {
      const onMsg = async (e) => {
        const m = JSON.parse(e.data);
        if (m.method !== "Fetch.requestPaused") return;
        ws.removeEventListener("message", onMsg);
        await A.send("Fetch.fulfillRequest", { requestId: m.params.requestId, responseCode: 500, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from(JSON.stringify({ error: "Something went wrong." })).toString("base64") });
        resolve();
      };
      ws.addEventListener("message", onMsg);
    });
    await A.eval(`localStorage.setItem("jacketek.locale", "ar-IQ"); true`);
    await A.goto("/cart");
    await A.waitFor(`!!__one("[data-testid=start-group]")`, "start button");
    await A.eval(`__click(__one("[data-testid=start-group]"))`);
    await A.waitFor(`!!__one("input[name=groupName]")`, "start form");
    await A.eval(`__all(".jk-group-pick input")[0].click(); true`);
    await A.eval(`__click(__one("[data-testid=create-group]"))`);
    await intercept;
    await A.waitFor(`!!__one(".jk-group-note--attention")`, "error notice");
    const text = await A.eval(`__one(".jk-group-note--attention").textContent`);
    await A.shot("02b-server-error-ar");
    await A.send("Fetch.disable");
    await A.eval(`localStorage.setItem("jacketek.locale", "en"); true`);
    assert(text.includes("صار خلل بسيرفر JACKETEK") && !text.includes("صار خطأ. جرّب مرة ثانية."), `notice: ${text}`);
    const cart = await A.eval(`JSON.parse(localStorage.getItem("jacketek-cart-v1")).length`);
    assert(cart === 3, `cart changed: ${cart}`);
    // Back to the form for the next step (English).
    await A.goto("/cart");
    await A.waitFor(`!!__one("[data-testid=start-group]")`, "start button");
    await A.eval(`__click(__one("[data-testid=start-group]"))`);
    await A.waitFor(`!!__one("input[name=groupName]")`, "start form");
    await A.eval(`__type(__one("input[name=groupName]"), "AIS Seniors 2027"); __all(".jk-group-pick input").forEach((c, i) => i < 2 && c.click()); true`);
    return text.trim();
  });

  await step("A unticks the invalid jacket and retries: exactly the two confirmed jackets leave the cart", async () => {
    await A.eval(`__click(__one("[data-testid=create-group]"))`);
    await A.waitFor(`location.pathname.startsWith("/groups/")`, "group page");
    groupId = (await A.path()).split("/")[2];
    await A.waitFor(`!!__one("[data-testid=jacket-count]")`, "group facts");
    const cart = await A.eval(`JSON.parse(localStorage.getItem("jacketek-cart-v1")).map((i) => i.id)`);
    assert(JSON.stringify(cart) === JSON.stringify(["cart-bad"]), `cart after import: ${cart}`);
    const jackets = await A.eval(`__one("[data-testid=jacket-count]").textContent.trim()`);
    assert(jackets === "3", `group jacket count ${jackets} (expected 1 + 2)`);
    const api = await A.eval(`fetch("/api/groups/${groupId}/my-items").then((r) => r.json()).then((b) => b.items.length)`);
    assert(api === 2, `server has ${api} jackets for A (expected 2, no duplicates)`);
    await A.shot("03-group-created");
    return { groupId, cart, jackets };
  });

  // ---- 2. Copy invite
  await step("A copies the invite URL", async () => {
    await send("Browser.grantPermissions", { origin: BASE, browserContextId: ctxA, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] });
    inviteUrl = await A.eval(`__one("[data-testid=invite-url]").textContent.trim()`);
    assert(/\/join\/[A-Za-z0-9_-]{43}$/.test(inviteUrl), `invite url ${inviteUrl}`);
    await A.eval(`__click(__byText("Copy link"))`);
    await A.waitFor(`document.body.textContent.includes("Link copied")`, "copied confirmation");
    const clip = await A.eval(`navigator.clipboard.readText()`);
    assert(clip === inviteUrl, `clipboard: ${clip}`);
    return inviteUrl.replace(/[A-Za-z0-9_-]{43}$/, "<token>");
  });

  // ---- 3–4. B opens the invite, signs up through the UI, joins
  await step("B opens the invitation in a separate browser context and sees the group preview", async () => {
    await B.goto("/");
    await B.eval(`localStorage.setItem("jacketek.locale", "en"); localStorage.setItem("jacketek.gestureHint.v1", "1"); true`);
    await B.goto(inviteUrl);
    await B.waitFor(`document.body.textContent.includes("AIS Seniors 2027") && !!__one("[data-testid=join-signin]")`, "invite preview");
    const text = await B.eval(`document.querySelector("main").textContent`);
    // The host's name is an isolated run (U+2068 … U+2069) inside the sentence.
    assert(/Invited by ⁨Yousef⁩/.test(text) && /1 member/.test(text), `preview text: ${text.slice(0, 200)}`);
    await B.shot("04-invite-preview-signed-out");
  });

  await step("B signs up through the real auth page and comes back to the invitation", async () => {
    await B.eval(`__click(__one("[data-testid=join-signin]"))`);
    await B.waitFor(`location.pathname === "/auth" && __all("[role=tab]").some((b) => /create/i.test(b.textContent))`, "auth page");
    await B.eval(`__click(__all("[role=tab]").find((b) => /create/i.test(b.textContent)))`);
    await B.waitFor(`!!__one("input[autocomplete=given-name]")`, "sign-up form");
    await B.eval(`__type(__one("input[autocomplete=given-name]"), "Omar"); __type(__one("input[autocomplete=family-name]"), "Haddad");
      __type(__one("input[autocomplete=email]"), "omar-${Date.now()}@example.com"); __type(__one("input[autocomplete=new-password]"), "correct-horse-battery"); true`);
    await B.eval(`__click(__one(".jk-auth-submit"))`);
    await B.waitFor(`location.pathname.startsWith("/join/") && !!__one("[data-testid=join-button]")`, "back on the invitation, signed in");
    await B.shot("05-invite-signed-in");
  });

  await step("B joins the group", async () => {
    await B.eval(`__click(__one("[data-testid=join-button]"))`);
    await B.waitFor(`location.pathname === "/groups/${groupId}" && !!__one("[data-testid=my-section]")`, "group page as member");
    const text = await B.eval(`document.querySelector("main").textContent`);
    assert(text.includes("You're in"), "joined notice missing");
    return await B.eval(`__one("[data-testid=member-count]").textContent.trim()`);
  });

  // ---- 5. B designs and adds a jacket
  await step("B designs a jacket in the configurator for the group and adds it", async () => {
    await B.eval(`__click(__one("[data-testid=add-jacket]"))`);
    await B.waitFor(`location.search.includes("group=") && !!__one("[data-testid=design-target]")`, "configurator for the group");
    const bar = await B.eval(`__one("[data-testid=design-target]").textContent`);
    assert(bar.includes("AIS Seniors 2027"), `design bar: ${bar}`);
    await chooseSize(B, "L");
    await B.shot("06-configurator-for-group");
    await commit(B);
    await B.waitFor(`location.pathname === "/groups/${groupId}" && __all("[data-testid=my-section] .jk-gjacket").length === 1`, "jacket in the group");
    const personal = await B.eval(`new Promise((res) => { const q = indexedDB.open("jacketek", 1); q.onsuccess = () => { const g = q.result.transaction("drafts").objectStore("drafts").get("design-draft-v2"); g.onsuccess = () => res(g.result ?? null); }; q.onerror = () => res("err"); })`);
    assert(personal === null, "the personal draft was written by group work");
    bItemId = await B.eval(`fetch("/api/groups/${groupId}/my-items").then((r) => r.json()).then((b) => b.items[0].id)`);
    // The still of the 3D jacket travels with it (none only when the 3D view hadn't drawn yet).
    const preview = await B.eval(`fetch("/api/groups/${groupId}/my-items").then((r) => r.json()).then((b) => b.items[0].previewUrl)`);
    await B.shot("07-b-jacket-added");
    return { bItemId, personalDraft: personal, preview: preview ? "stored" : "none" };
  });

  // ---- 6. A sees it
  await step("A sees B's jacket (picked up by the page's own refresh)", async () => {
    await A.waitFor(`__all("[data-testid=member-section] .jk-gjacket").length === 1`, "B's jacket on A's page", 25_000);
    const size = await A.eval(`__one("[data-testid=member-section] .jk-patch--strong").textContent.trim()`);
    assert(size.includes("L"), `size chip ${size}`);
    const edits = await A.eval(`__all("[data-testid=member-section] a").filter((a) => a.href.includes("item=")).length`);
    assert(edits === 0, "A has an edit link on B's jacket");
    const steppers = await A.eval(`__all("[data-testid=member-section] .jk-stepper").length`);
    assert(steppers === 0, "A has quantity controls on B's jacket");
    await A.fullShot("08-a-sees-b-jacket");
    return size;
  });

  // ---- 7–8. B edits, A sees the update
  await step("B reopens its jacket, changes the size to XL and saves it to the same group item", async () => {
    await B.eval(`__click(__all("[data-testid=my-section] a").find((a) => a.href.includes("item=${bItemId}")))`);
    await B.waitFor(`location.search.includes("item=${bItemId}") && !!__one("[data-testid=design-target]")`, "edit configurator");
    const bar = await B.eval(`__one("[data-testid=design-target]").textContent`);
    assert(bar.includes("Editing"), `design bar: ${bar}`);
    await chooseSize(B, "XL");
    await commit(B);
    await B.waitFor(`location.pathname === "/groups/${groupId}" && document.body.textContent.includes("Your changes are saved")`, "saved notice");
    const items = await B.eval(`fetch("/api/groups/${groupId}/my-items").then((r) => r.json()).then((b) => b.items.map((i) => ({ id: i.id, v: i.version, size: i.config.size })))`);
    assert(items.length === 1 && items[0].id === bItemId && items[0].size === "XL" && items[0].v === 2, `after edit: ${JSON.stringify(items)}`);
    return items[0];
  });

  await step("A sees the updated version", async () => {
    await A.waitFor(`__one("[data-testid=member-section] .jk-patch--strong")?.textContent.includes("XL")`, "XL on A's page", 25_000);
  });

  // ---- 9. A can't edit B's jacket
  await step("A cannot edit B's jacket (no controls; the configurator and the API both refuse)", async () => {
    await A.goto(`/design?group=${groupId}&item=${bItemId}`);
    await A.waitFor(`document.body.textContent.includes("You can only change your own jackets")`, "refusal page");
    await A.shot("09-a-cannot-edit-b");
    const status = await A.eval(`fetch("/api/groups/${groupId}/items/${bItemId}", { method: "PATCH", headers: { "Content-Type": "application/json", "X-Jacketek-Auth": "1" }, body: JSON.stringify({ quantity: 5, expectedVersion: 2 }) }).then((r) => r.status)`);
    assert(status === 403, `API PATCH by host: ${status}`);
    return { apiStatus: status };
  });

  // ---- 10–11. Lock
  await step("A locks the group", async () => {
    await A.goto(groupPath(groupId));
    await A.waitFor(`!!__byText("Lock the group")`, "host controls");
    await A.eval(`__click(__byText("Lock the group"))`);
    await A.eval(`__click(__byText("Yes, continue"))`);
    await A.waitFor(`__one(".jk-status")?.textContent.includes("Locked")`, "locked status");
    await A.shot("10-a-locked");
  });

  await step("B can no longer add or edit (page, configurator and API)", async () => {
    await B.reload();
    await B.waitFor(`__one(".jk-status")?.textContent.includes("Locked")`, "B sees locked");
    assert(!(await B.eval(`!!__one("[data-testid=add-jacket]")`)), "Add button still shown");
    assert((await B.eval(`__all("[data-testid=my-section] .jk-stepper").length`)) === 0, "quantity control still shown");
    assert((await B.eval(`__all("[data-testid=my-section] a").filter((a) => a.href.includes("item=")).length`)) === 0, "edit link still shown");
    await B.shot("11-b-locked-view");
    await B.goto(`/design?group=${groupId}&item=${bItemId}`);
    await B.waitFor(`!!__one("[data-testid=design-target]")`, "edit configurator while locked");
    await B.eval(`__click(__all(".jk-stepmap__step").at(-1))`);
    await B.waitFor(`__one("[data-testid=commit-design]")?.disabled === true && document.body.textContent.includes("The group is locked")`, "save disabled with reason");
    await B.shot("12-b-locked-configurator");
    const add = await B.eval(`fetch("/api/groups/${groupId}/items", { method: "POST", headers: { "Content-Type": "application/json", "X-Jacketek-Auth": "1" }, body: JSON.stringify({ clientRequestId: "req-e2e-locked-1", config: ${JSON.stringify(VALID)}, quantity: 1 }) }).then(async (r) => [r.status, (await r.json()).code])`);
    assert(add[0] === 409 && add[1] === "GROUP_NOT_OPEN", `API add while locked: ${add}`);
    return { apiAdd: add };
  });

  // ---- 12–13. Unlock, B edits again
  await step("A unlocks the group", async () => {
    await A.eval(`__click(__byText("Unlock the group"))`);
    await A.waitFor(`__one(".jk-status")?.textContent.includes("Open")`, "open status");
  });

  await step("B can edit again (quantity 1 → 2 on its own jacket)", async () => {
    await B.goto(groupPath(groupId));
    await B.waitFor(`__all("[data-testid=my-section] .jk-stepper").length === 1`, "quantity control back");
    await B.eval(`__click(__one("[data-testid=my-section] .jk-stepper button[aria-label='Increase quantity']"))`);
    await B.waitFor(`__one("[data-testid=my-section] .jk-stepper [aria-live]")?.textContent.trim() === "2"`, "quantity 2");
    const q = await B.eval(`fetch("/api/groups/${groupId}/my-items").then((r) => r.json()).then((b) => [b.items[0].quantity, b.items[0].version])`);
    assert(q[0] === 2 && q[1] === 3, `server quantity/version ${q}`);
    return { quantity: q[0], version: q[1] };
  });

  // ---- Extra robustness
  await step("Refresh mid-design keeps the group draft (and never touches the personal draft)", async () => {
    await B.goto(`/design?group=${groupId}`);
    await chooseSize(B, "S");
    await sleep(800); // the configurator saves drafts after 300 ms
    // Software-rendered 3D keeps this headless browser's main thread busy: wait until the draft is really saved.
    await B.waitFor(`new Promise((res) => { const q = indexedDB.open("jacketek", 1); q.onsuccess = () => { const g = q.result.transaction("drafts").objectStore("drafts").get("group-draft-new:${groupId}"); g.onsuccess = () => res(g.result?.config?.size === "S"); }; })`, "draft saved", 20_000);
    await B.reload();
    await B.waitFor(`!!__one("[data-testid=design-target]")`, "configurator after reload");
    await B.eval(`__click(__all(".jk-stepmap__step").at(-1))`);
    await B.waitFor(`__all("[role=radio]").find((b) => b.textContent.trim() === "S")?.getAttribute("aria-checked") === "true"`, "size S restored after refresh");
    const keys = await B.eval(`new Promise((res) => { const q = indexedDB.open("jacketek", 1); q.onsuccess = () => { const r = q.result.transaction("drafts").objectStore("drafts").getAllKeys(); r.onsuccess = () => res(r.result); }; })`);
    assert(keys.includes(`group-draft-new:${groupId}`) && !keys.includes("design-draft-v2"), `draft keys ${keys}`);
    return keys;
  });

  await step("Two tabs editing the same jacket: the second save gets a clear conflict, nothing is overwritten", async () => {
    const B2 = await openPage(ctxB, "B2");
    await B.goto(`/design?group=${groupId}&item=${bItemId}`);
    await B2.goto(`/design?group=${groupId}&item=${bItemId}`);
    await chooseSize(B, "M");
    await chooseSize(B2, "XS");
    await commit(B);
    await B.waitFor(`location.pathname === "/groups/${groupId}"`, "tab 1 saved");
    await commit(B2);
    await B2.waitFor(`document.body.textContent.includes("changed somewhere else")`, "conflict message in tab 2");
    await B2.shot("13-two-tabs-conflict");
    const size = await B.eval(`fetch("/api/groups/${groupId}/items/${bItemId}").then((r) => r.json()).then((b) => b.item.config.size)`);
    assert(size === "M", `server size ${size} (tab 2 must not overwrite)`);
    await B2.eval(`__click(__byText("Load the saved version"))`);
    await B2.waitFor(`!!__one("[data-testid=design-target]") && !document.body.textContent.includes("changed somewhere else")`, "reloaded latest");
    await B2.eval(`__click(__all(".jk-stepmap__step").at(-1))`);
    await B2.waitFor(`__all("[role=radio]").find((b) => b.textContent.trim() === "M")?.getAttribute("aria-checked") === "true"`, "tab 2 now shows the saved M");
    await send("Target.closeTarget", { targetId: B2.targetId });
    return { serverSize: size };
  });

  await step("A stale host page gets a revision conflict and reloads (no silent change)", async () => {
    const A2 = await openPage(ctxA, "A2");
    await A2.goto(groupPath(groupId));
    await A2.waitFor(`!!__byText("Remove")`, "A2 host view");
    // Tab 1 changes the group (rename) — tab 2 still holds the old revision.
    await A.goto(groupPath(groupId));
    await A.waitFor(`!!__byText("Rename")`, "rename");
    await A.eval(`__click(__byText("Rename"))`);
    await A.waitFor(`!!__one(".jk-host-row input")`, "rename field");
    await A.eval(`__type(__one(".jk-host-row input"), "AIS Seniors 2027 — Section B"); __click(__byText("Save")); true`);
    await A.waitFor(`document.querySelector("h1").textContent.includes("Section B")`, "renamed");
    await A2.eval(`__click(__all("button").find((b) => b.textContent.trim() === "Remove" && b.closest("[data-testid=member-section]")))`);
    await A2.eval(`__click(__byText("Yes, continue"))`);
    await A2.waitFor(`document.body.textContent.includes("The group changed while you were on it")`, "revision conflict message");
    await A2.shot("14-stale-revision");
    const members = await A2.eval(`fetch("/api/groups/${groupId}").then((r) => r.json()).then((v) => v.totals.members)`);
    assert(members === 2, `B was removed by a stale page (members ${members})`);
    await send("Target.closeTarget", { targetId: A2.targetId });
  });

  await step("Server-rejected design (bad artwork) shows a clear error and keeps the draft", async () => {
    // Put an invalid design (an HTML file posing as artwork) in the group draft, as a broken upload would.
    const bad = { ...VALID, embroidery: [{ id: "e-up", kind: "image", text: "", placement: "leftChest", offset: [0, 0], rotation: 0, scale: 1, style: "satin", thread: null, image: { src: "data:text/html;base64,PGgxPmhpPC9oMT4=", aspect: 1 } }] };
    await B.eval(`new Promise((res) => { const q = indexedDB.open("jacketek", 1); q.onsuccess = () => { const tx = q.result.transaction("drafts", "readwrite"); tx.objectStore("drafts").put({ version: 1, savedAt: Date.now(), config: ${JSON.stringify(bad)}, step: "review" }, "group-draft-new:${groupId}"); tx.oncomplete = () => res(true); }; })`);
    await B.goto(`/design?group=${groupId}`);
    await B.waitFor(`!!__one("[data-testid=commit-design]")`, "review step");
    await commit(B);
    await B.waitFor(`document.body.textContent.includes("This design couldn't be saved")`, "invalid design message");
    await B.shot("15-invalid-design");
    assert((await B.path()).startsWith("/design"), "left the configurator");
  });

  await step("Failed network: the group page keeps the last version, says so, and recovers when back online", async () => {
    await B.goto(groupPath(groupId));
    await B.waitFor(`!!__one("[data-testid=my-section]")`, "group page");
    await B.send("Network.enable");
    await B.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await B.eval(`window.dispatchEvent(new Event("focus")); true`);
    await B.waitFor(`document.body.textContent.includes("can't reach JACKETEK")`, "stale notice", 25_000);
    const still = await B.eval(`__all("[data-testid=my-section] .jk-gjacket").length`);
    assert(still === 1, "the last good view disappeared");
    await B.shot("16-offline-stale");
    await B.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await B.eval(`window.dispatchEvent(new Event("focus")); true`);
    await B.waitFor(`!document.body.textContent.includes("can't reach JACKETEK")`, "recovered", 25_000);
  });

  await step("An expired (rotated) invite shows a clear state; the new one works", async () => {
    await A.goto(groupPath(groupId));
    await A.waitFor(`!!__byText("Make a new link")`, "rotate");
    await A.eval(`__click(__byText("Make a new link"))`);
    await A.eval(`__click(__byText("Yes, continue"))`);
    await A.waitFor(`__one("[data-testid=invite-url]")?.textContent.trim() !== ${JSON.stringify(inviteUrl)}`, "new link");
    const fresh = await A.eval(`__one("[data-testid=invite-url]").textContent.trim()`);
    const D = await openPage(ctxD, "D");
    await D.goto(inviteUrl);
    await D.waitFor(`document.body.textContent.includes("doesn't work any more")`, "invalid invite state");
    await D.shot("17-expired-invite");
    await D.goto(fresh);
    await D.waitFor(`!!__one("[data-testid=join-signin]")`, "fresh invite preview");
    inviteUrl = fresh;
  });

  // ---- 14. Personal cart + checkout regression
  await step("The normal personal cart and checkout still work (another account)", async () => {
    const C = await openPage(ctxC, "C");
    await C.goto("/");
    assert((await apiSignUp(C, "Lina")) === 201, "C sign-up failed");
    await C.eval(`localStorage.setItem("jacketek.locale", "en"); localStorage.setItem("jacketek.gestureHint.v1", "1"); true`);
    await C.goto("/design");
    assert(!(await C.eval(`!!__one("[data-testid=design-target]")`)), "group bar on the personal configurator");
    await chooseSize(C, "M");
    const label = await C.eval(`__one("[data-testid=commit-design]").textContent.trim()`);
    assert(/add to cart/i.test(label), `button label ${label}`);
    await commit(C);
    await C.waitFor(`location.pathname === "/cart" && __all(".jk-item").length === 1`, "personal cart with the jacket");
    await C.eval(`__click(__byText("Proceed to checkout"))`);
    await C.waitFor(`location.pathname === "/checkout" && !!__one("input[name=fullName]")`, "checkout");
    await C.eval(`__type(__one("input[name=fullName]"), "Lina Tester"); __type(__one("input[name=phone]"), "0791234567"); __type(__one("input[name=city]"), "Amman");
      __type(__one("input[name=area]"), "Abdoun"); __type(__one("textarea[name=address], input[name=address]"), "Street 1, Building 2"); true`);
    await C.eval(`document.querySelector("input[name=payment][value=cod]").click(); true`);
    await C.eval(`__click(__one("#checkout-form button[type=submit], button[form=checkout-form]"))`);
    await C.waitFor(`location.pathname.startsWith("/order/")`, "order confirmation", 30_000);
    const id = (await C.path()).split("/")[2];
    const cart = await C.eval(`localStorage.getItem("jacketek-cart-v1")`);
    assert(cart === "[]", `cart after order: ${cart}`);
    await C.shot("18-order-confirmed");
    return { orderId: id };
  });

  // ---- 16. Languages and layouts
  await step("English and Iraqi Arabic, desktop and phone: direction, no sideways scroll, names isolated", async () => {
    const results = {};
    for (const locale of ["en", "ar-IQ"]) {
      await B.eval(`localStorage.setItem("jacketek.locale", ${JSON.stringify(locale)}); true`);
      for (const [w, h, mobile, tag] of [[1440, 900, false, "desktop"], [390, 844, true, "phone"]]) {
        await B.viewport(w, h, mobile);
        await B.goto(groupPath(groupId));
        await B.waitFor(`!!__one("[data-testid=my-section]")`, "group page");
        await sleep(400);
        const r = await B.eval(`({ dir: document.documentElement.dir || getComputedStyle(document.documentElement).direction, lang: document.documentElement.lang,
          // Phones: content wider than the screen widens the layout viewport itself (innerWidth), so compare with the device width too.
          overflow: Math.max(document.documentElement.scrollWidth, window.innerWidth) - ${w},
          heading: document.querySelector("h1").textContent.trim(),
          isolated: __all("bdi[dir=auto]").length,
          smallTargets: __all("main button, main a").filter((el) => { const b = el.getBoundingClientRect(); return b.height < 24 || b.width < 24; }).map((el) => el.textContent.trim().slice(0, 30)) })`);
        results[`${locale}-${tag}`] = r;
        assert(r.overflow <= 1, `${locale} ${tag}: horizontal overflow ${r.overflow}px`);
        assert(locale === "ar-IQ" ? r.dir === "rtl" : r.dir !== "rtl", `${locale} direction ${r.dir}`);
        assert(r.isolated > 0, "no isolated names");
        if (mobile) await B.shot(`19-group-${locale}-${tag}`); else await B.fullShot(`19-group-${locale}-${tag}`);
      }
    }
    // The Arabic pages that matter most for a newcomer: the invitation and the cart's start panel.
    const D2 = await openPage(ctxD, "D2");
    await D2.goto("/");
    await D2.eval(`localStorage.setItem("jacketek.locale", "ar-IQ"); true`);
    await D2.viewport(390, 844, true);
    await D2.goto(inviteUrl);
    await D2.waitFor(`!!__one("[data-testid=join-signin]")`, "Arabic invite");
    const inviteDir = await D2.eval(`document.documentElement.dir`);
    assert(inviteDir === "rtl", "invite page not RTL");
    const wide = (page) => page.eval(`({ overflow: Math.max(document.documentElement.scrollWidth, window.innerWidth) - 390,
      culprits: [...document.querySelectorAll("body *")].filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1); })
        .slice(0, 6).map((el) => el.tagName + "." + String(el.className).slice(0, 50) + " " + Math.round(el.getBoundingClientRect().width)) })`);
    const inviteWide = await wide(D2);
    assert(inviteWide.overflow <= 1, `Arabic invite on a phone overflows: ${JSON.stringify(inviteWide)}`);
    await D2.shot("20-invite-ar-phone");
    await A.eval(`localStorage.setItem("jacketek.locale", "ar-IQ"); true`);
    await A.viewport(390, 844, true);
    await A.goto("/cart");
    await A.waitFor(`!!__one(".jk-group-start")`, "Arabic cart start panel");
    const cartWide = await wide(A);
    assert(cartWide.overflow <= 1, `Arabic cart on a phone overflows: ${JSON.stringify(cartWide)}`);
    await A.eval(`__one(".jk-group-start").scrollIntoView({ block: "center" }); true`); await sleep(300); await A.shot("21-cart-start-ar-phone");
    await A.eval(`localStorage.setItem("jacketek.locale", "en"); true`);
    await A.viewport(1440, 900);
    return results;
  });

  await step("My groups lists the group for host and member, with links", async () => {
    await A.goto("/groups");
    // A also has the groups made by the two failure scenarios above (created, jackets not moved).
    await A.waitFor(`__all("[data-testid=group-row]").some((r) => r.textContent.includes("Section B"))`, "A's groups");
    const a = await A.eval(`__all("[data-testid=group-row]").find((r) => r.textContent.includes("Section B")).textContent`);
    assert(/hosting/i.test(a), `A row: ${a}`);
    await B.eval(`localStorage.setItem("jacketek.locale", "en"); true`);
    await B.viewport(1440, 900);
    await B.goto("/groups");
    await B.waitFor(`__all("[data-testid=group-row]").length === 1`, "B's groups");
    await B.eval(`__click(__one("[data-testid=group-row]"))`);
    await B.waitFor(`location.pathname === "/groups/${groupId}"`, "row opens the dashboard");
    await A.shot("22-my-groups");
    return a.trim();
  });

  assert(pageErrors.length === 0, `uncaught page errors:\n${pageErrors.join("\n")}`);
  console.log(`\nAll ${n} browser steps passed. Screenshots: ${OUT}`);
} finally {
  writeFileSync(join(OUT, "log.json"), JSON.stringify({ base: BASE, steps: log, pageErrors }, null, 2));
  try {
    ws.close();
  } catch {
    /* gone */
  }
  for (const c of children) c.kill();
  await sleep(500);
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}

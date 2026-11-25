#!/usr/bin/env node
// QA — NEW SYNTHETIC DESIGN, built in the REAL configurator (headless Chrome / Edge, throwaway
// profile). Only the plain garment choices are seeded (colours, materials, snaps, size); every
// embroidery element is made through the UI — ready-made picker, Front Letters initials, design
// colours (Fill / Outline), text editor, size slider and move buttons — exactly as a customer
// would. Writes the website screenshots and the configurator's own saved design (its draft).
// Nothing is ordered; nothing touches the server database.
//
//   node scripts/qa/new-design-website.mjs <siteUrl> <outDir>
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [BASE = "http://localhost:5173", OUT = "dev-output/qa-new-design/website"] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });

/** The design: deliberately unlike JK-261008-5V5E in every part. */
const GARMENT = {
  colours: { body: "fabric-forest", sleeves: "leather-white", trim: "fabric-mustard" },
  materials: { body: "felt", sleeves: "leather" },
  buttons: "silver",
  zipper: false,
  embroidery: [],
  size: "L",
  fit: "relaxed",
};
const BACK_DESIGN = { id: "31392f23-edf3-44b6-b862-357f6a45aee7", library: "مكتبة تصميمات الظهر" };
const FRONT_LETTERS = { id: "fc579418-5f3f-4c7f-a1f2-3a49dfb14e8a", library: "الحروف الامامية" };
const NUMBER = { id: "4d170dad-3819-4ea5-9db9-8242886801ed", library: "الارقام" };
const SLEEVE_ART = { id: "c7167980", library: "تصاميم الانمي" };

const exe = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const profile = mkdtempSync(join(tmpdir(), "jk-qa-design-"));
const port = 9498;
const browser = spawn(exe, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--window-size=1440,900", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars", "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 60 && !ws; i++) { try { const p = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch { /* starting */ } if (!ws) await sleep(300); }
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); const errors = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(`${r.result.exceptionDetails.exception?.description ?? "eval failed"}\n  in: ${expr.slice(0, 160)}`); return r.result?.result?.value; };
const shot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(join(OUT, `${name}.png`), Buffer.from(s.result.data, "base64")); };
const log = [];
const step = (msg, v) => { log.push({ step: msg, result: v }); console.log(msg, v === undefined ? "" : JSON.stringify(v)); if (v === false || v === null) throw new Error(`QA step failed: ${msg}`); };
await send("Runtime.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// In-page helpers (visible elements only).
const HELPERS = `
window.__vis = (el) => !!el && !!el.offsetParent;
window.__btn = (pred, root = document) => [...root.querySelectorAll("button")].find((b) => __vis(b) && pred(b));
window.__txt = (b) => (b.getAttribute("aria-label") || b.textContent || "").trim();
window.__click = (pred, root) => { const b = __btn(pred, root); if (!b) return false; b.click(); return true; };
window.__editor = () => [...document.querySelectorAll("section.jk-zone")].find(__vis) || document;
true`;
const seed = `new Promise((res, rej) => { const q = indexedDB.open("jacketek", 1); q.onupgradeneeded = () => q.result.createObjectStore("drafts"); q.onerror = () => rej(q.error);
  q.onsuccess = () => { const tx = q.result.transaction("drafts", "readwrite"); tx.objectStore("drafts").put({ version: 2, savedAt: Date.now(), config: ${JSON.stringify(GARMENT)}, step: "embroidery" }, "design-draft-v2"); tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error); }; })`;
const readDraft = () => ev(`new Promise((res) => { const q = indexedDB.open("jacketek", 1); q.onsuccess = () => { const g = q.result.transaction("drafts").objectStore("drafts").get("design-draft-v2"); g.onsuccess = () => res(g.result); }; })`);

await send("Page.navigate", { url: `${BASE}/` });
await sleep(2500);
await ev(`localStorage.setItem("jacketek.locale","en"); localStorage.setItem("jacketek.gestureHint.v1","1"); true`);
step("seed garment (colours / materials / snaps / size only)", await ev(seed));
await send("Page.navigate", { url: `${BASE}/design` });
await sleep(9000);
await ev(HELPERS);

const selectZone = async (name) => {
  let ok = false;
  for (let k = 0; k < 30 && !ok; k++) {
    ok = await ev(`(window.__click || (() => false))((b) => b.closest(".jk-zonemap") && __txt(b).startsWith(${JSON.stringify(name)}))`);
    if (!ok) { await sleep(500); await ev(HELPERS); }
  }
  await sleep(1800);
  return ok;
};
const mode = async (m) => { const ok = await ev(`__click((b) => b.getAttribute("role") === "radio" && b.textContent.trim().toLowerCase() === ${JSON.stringify(m)}, __editor())`); await sleep(900); return ok; };
const pick = async ({ id: designId, library }) => {
  await ev(`(() => { const b = __btn((x) => /ready-made designs/i.test(x.textContent) && x.getAttribute("aria-expanded") !== null, __editor()); if (b && b.getAttribute("aria-expanded") !== "true") b.click(); return true; })()`);
  await sleep(1500);
  const find = `[...document.querySelectorAll("img")].find((i) => __vis(i) && i.getAttribute("src")?.includes(${JSON.stringify(designId)}))`;
  if (!(await ev(`!!${find}`))) {
    await ev(`__click((b) => b.getAttribute("role") === "radio" && b.textContent.includes(${JSON.stringify(library)}))`);
    await sleep(1200);
    for (let k = 0; k < 40 && !(await ev(`!!${find}`)); k++) { await ev(`__click((b) => /more/i.test(b.textContent) && !b.getAttribute("role"))`); await sleep(500); }
  }
  const ok = await ev(`(() => { const i = ${find}; if (!i) return false; i.closest("button").click(); return true; })()`);
  await sleep(3500);
  return ok;
};
const swatch = async (group, colour) => {
  const ok = await ev(`(() => { const g = [...document.querySelectorAll('[role="radiogroup"]')].find((x) => __vis(x) && new RegExp(${JSON.stringify(group)}, "i").test(x.getAttribute("aria-label") || "")); if (!g) return false; const b = [...g.querySelectorAll("button")].find((x) => (x.getAttribute("aria-label") || x.textContent).trim().toLowerCase() === ${JSON.stringify(colour.toLowerCase())}); if (!b) return false; b.click(); return true; })()`);
  if (!ok) console.log("  visible colour groups:", JSON.stringify(await ev(`[...document.querySelectorAll('[role="radiogroup"]')].map((g) => ({ label: g.getAttribute("aria-label"), visible: __vis(g), first: [...g.querySelectorAll("button")].slice(0, 4).map((b) => (b.getAttribute("aria-label") || b.textContent).trim()) }))`)));
  await sleep(1500);
  return ok;
};
/** A design-colour slot by position (Fill = 0, Outline = 1, …): opens it, picks the thread; returns the slot's label. */
const slotColour = async (index, colour) => {
  const r = await ev(`(async () => {
    const slots = [...document.querySelectorAll(".jk-design-colours .jk-colour-slot")].filter(__vis);
    const slot = slots[${index}]; if (!slot) return { error: "no slot ${index}", slots: slots.length };
    let g = slot.querySelector('[role="radiogroup"]');
    if (!g || !__vis(g)) { const t = [...slot.querySelectorAll("button")].find(__vis); t && t.click(); await new Promise((r) => setTimeout(r, 700)); g = slot.querySelector('[role="radiogroup"]'); }
    if (!g || !__vis(g)) return { error: "palette closed", html: slot.textContent.slice(0, 80) };
    const b = [...g.querySelectorAll("button")].find((x) => (x.getAttribute("aria-label") || x.textContent).trim().toLowerCase() === ${JSON.stringify(colour.toLowerCase())});
    if (!b) return { error: "no swatch", first: [...g.querySelectorAll("button")].slice(0, 5).map((x) => (x.getAttribute("aria-label") || x.textContent).trim()) };
    b.click(); return { slot: g.getAttribute("aria-label") };
  })()`);
  await sleep(1500);
  if (r.error) { console.log("  slot problem:", JSON.stringify(r)); return false; }
  return r.slot;
};
const textThread = async (colour) => { const ok = await ev(`(() => { const b = __btn((x) => x.getAttribute("aria-label")?.toLowerCase() === ${JSON.stringify(colour.toLowerCase())} && x.closest(".jk-zone"), __editor()); if (!b) return false; b.click(); return true; })()`); await sleep(1000); return ok; };
const key = async (k) => { for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: k, text: type === "keyDown" && k.length === 1 ? k : undefined, code: k === "Enter" ? "Enter" : `Key${k.toUpperCase()}`, windowsVirtualKeyCode: k === "Enter" ? 13 : k.toUpperCase().charCodeAt(0) }); await sleep(120); };
const typeText = async (lines) => {
  step("focus text box", await ev(`(() => { const t = [...document.querySelectorAll("textarea")].find(__vis); if (!t) return false; t.focus(); t.select(); return true; })()`));
  for (let i = 0; i < lines.length; i++) { if (i) { await send("Input.insertText", { text: "\n" }); await sleep(200); } await send("Input.insertText", { text: lines[i] }); await sleep(300); }
  await sleep(2500);
};
const initials = async (a, b) => {
  for (const [i, ch] of [[0, a], [1, b]]) {
    await ev(`(() => { const f = [...document.querySelectorAll("input")].filter(__vis).find((x) => x.getAttribute("aria-label") === ${JSON.stringify(i ? "Second letter" : "First letter")}); f.focus(); return true; })()`);
    await key(ch);
    await sleep(1500);
  }
  return ev(`[...document.querySelectorAll("input")].filter(__vis).filter((x) => /letter/i.test(x.getAttribute("aria-label") || "")).map((x) => x.value).join("")`);
};
const placement = async ({ scale = null, moves = [] }) => {
  await ev(`(() => { const t = [...document.querySelectorAll(".jk-disclosure__toggle")].find(__vis); if (t && t.getAttribute("aria-expanded") !== "true") t.click(); return true; })()`);
  await sleep(700);
  if (scale !== null) {
    step(`size slider → ${scale}`, await ev(`(() => { const r = [...document.querySelectorAll('input[type="range"]')].find(__vis); if (!r) return null; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(r, ${JSON.stringify(String(scale))}); r.dispatchEvent(new Event("input", { bubbles: true })); return r.value; })()`));
    await sleep(900);
  }
  for (const [label, times] of moves) {
    let n = 0;
    for (let k = 0; k < times; k++) {
      const ok = await ev(`(() => { const b = [...document.querySelectorAll(".jk-nudge-pad button")].find((x) => __vis(x) && x.getAttribute("aria-label") === ${JSON.stringify(label)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
      if (!ok) break;
      n++;
      await sleep(160);
    }
    step(`${label} ×${n}${n < times ? " (stopped at the zone edge)" : ""}`);
  }
  await sleep(800);
};

// 1. Left Chest — Front Letters "M Z", Fill white / Outline navy, a little smaller and off-centre.
step("select Left Chest", await selectZone("Left Chest"));
step("design mode", await mode("design"));
step("pick Front Letters template 23.png (Fill + Outline)", await pick(FRONT_LETTERS));
step("initials", await initials("M", "Z"));
step("slot 1 (letter fill) → White", await slotColour(0, "White"));
step("slot 2 (outline) → Navy Blue", await slotColour(1, "Navy Blue"));
await placement({ scale: 80, moves: [["Move left", 2], ["Move down", 1]] });
// 2. Right Chest — one-line text, mustard thread, smaller, moved right.
step("select Right Chest", await selectZone("Right Chest"));
step("text mode", await mode("text"));
await typeText(["ALEX"]);
step("thread → Mustard", await textThread("Mustard"));
await placement({ scale: 70, moves: [["Move right", 3]] });
// 3. Main Back — a different back design with Fill / Outline colours, scaled close to the maximum.
step("select Main Back", await selectZone("Main Back"));
step("design mode", await mode("design"));
step("pick back design 3.PNG", await pick(BACK_DESIGN));
step("design colours present", await ev(`[...document.querySelectorAll('[role="radiogroup"]')].filter(__vis).map((g) => g.getAttribute("aria-label")).filter(Boolean)`));
step("slot 1 → Royal Blue", await slotColour(0, "Royal Blue"));
step("slot 2 → White", await slotColour(1, "White"));
await sleep(1500);
await placement({ scale: 96, moves: [] });
// 4. Lower Back Text — two lines, white thread.
step("select Lower Back Text", await selectZone("Lower Back Text"));
await typeText(["SENIORS", "2028"]);
step("thread → White", await textThread("White"));
// 5. Left Sleeve — Upper: a Number, moved to the zone's lower edge.
step("select Left Sleeve — Upper", await selectZone("Left Sleeve — Upper"));
step("design mode", await mode("design"));
step("pick number 3.PNG", await pick(NUMBER));
await placement({ scale: 75, moves: [["Move down", 40]] });
// 6. Right Sleeve — Middle: a ready-made design from another library, smaller, nudged up-left.
step("select Right Sleeve — Middle", await selectZone("Right Sleeve — Middle"));
step("design mode", await mode("design"));
step("pick anime design 1.webp", await pick(SLEEVE_ART));
await placement({ scale: 65, moves: [["Move up", 2], ["Move left", 1]] });

// Website ground truth: the four views.
const view = async (name) => { const ok = await ev(`(() => { const g = [...document.querySelectorAll('[role="radiogroup"]')].find((x) => /camera view/i.test(x.getAttribute("aria-label") || "")); const b = g && [...g.querySelectorAll("button")].find((x) => x.textContent.trim() === ${JSON.stringify(name)}); if (!b) return false; b.click(); return true; })()`); await sleep(3500); return ok; };
// Deselect the zone editor first where possible so the framing is the full view (Reset view).
const reset = async () => { await ev(`__click((b) => /reset view/i.test(b.textContent))`); await sleep(2500); };
step("view Front", await view("Front")); await reset(); await shot("website-front");
step("view Back", await view("Back")); await reset(); await shot("website-back");
step("select Left Sleeve — Upper (left side view)", await selectZone("Left Sleeve — Upper")); await sleep(2500); await shot("website-left-sleeve");
step("select Right Sleeve — Middle (right side view)", await selectZone("Right Sleeve — Middle")); await sleep(2500); await shot("website-right-sleeve");

const draft = await readDraft();
writeFileSync(join(OUT, "qa-design-config.json"), JSON.stringify(draft.config, null, 1));
writeFileSync(join(OUT, "website-steps.json"), JSON.stringify({ steps: log, jsErrors: errors }, null, 1));
console.log("elements:", draft.config.embroidery.map((e) => `${e.placement}:${e.kind}${e.image?.frontLetters ? "(letters " + e.image.frontLetters.letter1 + e.image.frontLetters.letter2 + ")" : ""} inZone=${JSON.stringify(e.inZone ?? null)}`).join(" | "));
console.log("js errors:", errors.length);
browser.kill();
await sleep(500);
try { rmSync(profile, { recursive: true, force: true }); } catch { /* locked */ }

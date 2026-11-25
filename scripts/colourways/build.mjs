// Builds the back-design colourways (Phase 1: Groups A and A+). For each design in
// specs.mjs it reads the ORIGINAL artwork (never written) and writes, beside it in a
// separate folder:
//   <library>/colourways/<designId>/colourway.json  — slots, labels, defaults, references
//   <library>/colourways/<designId>/regions.png     — per-pixel region map
//   <library>/colourways/index.json                 — which designs have a colourway
//   prototypes/colourways/<designId>/proof.png                      — validation sheet
// Fails (exit 1) when a design has a significant colour that belongs to no slot and isn't
// acknowledged, or when a self-test fails (identity, leaks, alpha).
// <library> = runtime-assets/embroidery-library, or EMBROIDERY_LIBRARY_DIR (server/embroideryLibrary.mjs).
// Usage: node scripts/colourways/build.mjs [--only <idPrefix,…>]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LIBRARY_DIR, LIBRARY_URL } from "../../server/embroideryLibrary.mjs";
import { COLOURWAY_SPECS } from "./specs.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const only = arg("--only")?.split(",");
const library = JSON.parse(readFileSync(join(LIBRARY_DIR, "library.json"), "utf8"));
/** The library folder relative to the project root (the page's output paths are). */
const libraryRel = relative(root, LIBRARY_DIR).replace(/\\/g, "/");

const { build } = await import("esbuild");
const bundle = await build({
  stdin: { contents: `import * as CW from "./src/features/configurator/library/colourwayRecolour.ts"; window.CW = CW;`, resolveDir: root, loader: "ts" },
  bundle: true, platform: "browser", format: "iife", write: false, logLevel: "silent",
});
const page = join(tmpdir(), "colourways-build.html");
writeFileSync(page, `<!doctype html><html><body><script>${bundle.outputFiles[0].text}</script><script>${readFileSync(join(here, "page", "segment.js"), "utf8")}</script></body></html>`);

const port = 9479, profile = join(tmpdir(), `edge-cdp-${port}`);
mkdirSync(profile, { recursive: true });
const edgePath = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].find(existsSync);
const edge = spawn(edgePath, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 50 && !ws; i++) { try { const p = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch { /* not up yet */ } if (!ws) await sleep(300); }
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Page.navigate", { url: "file:///" + page.replace(/\\/g, "/") });
await sleep(1000);

const index = {};
let failed = 0;
for (const spec of COLOURWAY_SPECS) {
  if (only && !only.some((p) => spec.id.startsWith(p))) continue;
  const d = library.designs.find((x) => x.designId.startsWith(spec.id));
  if (!d || d.originalFileName !== spec.file || !d.zones.includes("mainBack")) { failed++; console.error("design not found / not a back design:", spec.file, spec.id); continue; }
  const buf = readFileSync(join(LIBRARY_DIR, d.asset.slice(LIBRARY_URL.length + 1)));
  const input = {
    designId: d.designId, libraryId: d.libraryId, originalFileName: d.originalFileName, asset: d.asset, spec,
    src: `data:${d.asset.endsWith(".png") ? "image/png" : "image/webp"};base64,${buf.toString("base64")}`,
    base: `${libraryRel}/colourways/${d.designId}`, preview: `prototypes/colourways/${d.designId}`,
  };
  const r = await send("Runtime.evaluate", { expression: `window.BUILD(${JSON.stringify(input)})`, awaitPromise: true, returnByValue: true, timeout: 600000 });
  if (r.result?.exceptionDetails) { failed++; console.error(spec.file, r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text); continue; }
  const out = JSON.parse(r.result.result.value);
  const rep = out.report;
  const bad = [];
  if (rep.unmapped.length) bad.push(`UNMAPPED COLOURS (review, then map or acknowledge): ${JSON.stringify(rep.unmapped)}`);
  if (rep.identityChangedValues) bad.push(`identity changed ${rep.identityChangedValues} values`);
  for (const l of rep.leaks) { if (l.changedOutsideSlot) bad.push(`${l.slot} leaks into ${l.changedOutsideSlot} px`); if (l.alphaChanged) bad.push(`${l.slot} changed alpha`); }
  if (bad.length) { failed++; console.error("FAIL", spec.file, spec.id, bad.join(" | ")); continue; }
  for (const [name, url] of Object.entries(out.files)) {
    const target = join(root, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(url.split(",")[1], "base64"));
  }
  index[d.designId] = { file: `${d.designId}/colourway.json`, originalFileName: d.originalFileName, slots: spec.slots.map((s) => s.id) };
  console.log("ok", spec.file, spec.id, JSON.stringify(rep));
}
if (!only && !failed) writeFileSync(join(LIBRARY_DIR, "colourways", "index.json"), JSON.stringify({ version: 1, phase: 1, designs: index }, null, 1) + "\n");
edge.kill();
process.exit(failed ? 1 : 0);

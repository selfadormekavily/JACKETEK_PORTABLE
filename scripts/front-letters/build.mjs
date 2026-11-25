// Builds the Front Letters letter templates: for each of the 20 Front Letters designs,
// runs the glyph generator in headless Edge (canvas only — no fonts) against the
// design's original artwork (read only) and writes:
//   <library>/letter-templates/<designId>/template.json + glyphs/*.png
//   prototypes/front-letters/<designId>/sheet-A-Z.png, AA.png, AB.png, MK.png, SA.png, ZH.png
//   <library>/letter-templates/index.json (designId → style, approximation)
// <library> = runtime-assets/embroidery-library, or EMBROIDERY_LIBRARY_DIR (server/embroideryLibrary.mjs);
// with --out, the same paths relative to the project root are written under <dir> instead.
// Usage: node scripts/front-letters/build.mjs [--only <designId,…>] [--script <page.js>] [--out <dir>]
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { LIBRARY_DIR, LIBRARY_URL } from "../../server/embroideryLibrary.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
export const FRONT_LETTERS_LIBRARY = "23ff73fd-b78f-4718-9109-2b8f73076954";

const library = JSON.parse(readFileSync(join(LIBRARY_DIR, "library.json"), "utf8"));
/** The library folder relative to the project root (output paths are, under --out). */
const libraryRel = relative(root, LIBRARY_DIR).replace(/\\/g, "/");
const only = arg("--only")?.split(",");
const designs = library.designs.filter((d) => d.libraryId === FRONT_LETTERS_LIBRARY && (!only || only.includes(d.designId)));
const scripts = (arg("--script") ?? ["core.js", "roman.js", "families.js", "styles.js", "generate.js"].map((f) => join(here, "page", f)).join(",")).split(",");
const outRoot = arg("--out") ?? root;

const page = join(tmpdir(), "front-letters-build.html");
writeFileSync(page, `<!doctype html><html><body>${scripts.map((f) => `<script>${readFileSync(f, "utf8")}</script>`).join("")}</body></html>`);

const port = 9472;
const profile = join(tmpdir(), `edge-cdp-${port}`);
mkdirSync(profile, { recursive: true });
const edgePath = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].find(existsSync);
const edge = spawn(edgePath, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--window-size=800,800", "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 50 && !ws; i++) {
  try {
    const p = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
    if (p) ws = new WebSocket(p.webSocketDebuggerUrl);
  } catch { /* not up yet */ }
  if (!ws) await sleep(300);
}
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Page.navigate", { url: "file:///" + page.replace(/\\/g, "/") });
await sleep(1500);

const index = {};
let failed = 0;
for (const d of designs) {
  const file = join(LIBRARY_DIR, d.asset.slice(LIBRARY_URL.length + 1));
  const src = `data:image/webp;base64,${readFileSync(file).toString("base64")}`;
  const input = { designId: d.designId, libraryId: d.libraryId, originalFileName: d.originalFileName, asset: d.asset, base: `${libraryRel}/letter-templates/${d.designId}`, src, debug: process.argv.includes("--debug") };
  const r = await send("Runtime.evaluate", { expression: `window.RUN(${JSON.stringify(input)})`, awaitPromise: true, returnByValue: true, timeout: 600000 });
  if (r.result?.exceptionDetails) {
    failed++;
    console.error(d.originalFileName, d.designId, r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
    continue;
  }
  const out = JSON.parse(r.result.result.value);
  for (const [name, url] of Object.entries(out.files ?? {})) {
    const target = join(outRoot, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(url.split(",")[1], "base64"));
  }
  delete out.files;
  if (out.index) index[d.designId] = out.index;
  console.log(d.originalFileName, d.designId, JSON.stringify(out.report ?? out));
}
if (!only && !arg("--script") && !failed) {
  const target = join(outRoot, libraryRel, "letter-templates", "index.json");
  writeFileSync(target, JSON.stringify({ version: 1, libraryId: FRONT_LETTERS_LIBRARY, templates: index }, null, 1) + "\n");
}
edge.kill();
process.exit(failed ? 1 : 0);

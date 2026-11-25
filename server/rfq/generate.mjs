// generateRFQTechPack — stored order line → Manufacturing Spec JSON → validation
// → RFQ Tech Pack PDF. SERVER-SIDE ONLY.
//
//   server-data/techpacks/<designId>/RFQ-NN/
//     manufacturing-spec.json   the canonical spec (with its validation result)
//     JACKETEK-RFQ-Tech-Pack.pdf
//     artwork/                  every artwork file the spec names
//     previews/                 the base flats (canonical flat; no customer art; internal — not for sharing)
//
// Never trusts browser-sent manufacturing data: the design is read from the
// stored order; artwork is rebuilt / read on the server. A spec with any ERROR
// produces nothing. Revisions are never overwritten (RFQ-01, RFQ-02 …).
import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { withColourways } from "../colourways.mjs";
import { withLibraryAssets } from "../libraryAssets.mjs";
import { withTextArtwork } from "../textArtwork.mjs";
import { loadShared } from "../tsModule.mjs";
import { canonicalFlat, sleeveSvg, viewSvg } from "./flats.mjs";
import { renderRfqHtml } from "./render.mjs";

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const MASTER_SPEC_FILE = "garment-spec/jacketek-master-spec-v0.1.json";
export const PDF_NAME = "JACKETEK-RFQ-Tech-Pack.pdf";
export const SPEC_NAME = "manufacturing-spec.json";
export const DESIGN_ID = /^D-[0-9a-f]{12}$/;
export const REVISION = /^RFQ-\d{2}$/;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const BROWSERS = [
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
];

export class RfqError extends Error {
  constructor(message, { issues = [], status = 422 } = {}) {
    super(message);
    this.issues = issues;
    this.status = status;
  }
}

/** JSON with sorted keys (stable hashing). */
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

/** The design's stable id: the same customisation (and size) → the same id. */
export function designIdOf(line) {
  return `D-${createHash("sha256").update(stable({ size: line.size ?? null, customization: line.customization ?? null })).digest("hex").slice(0, 12)}`;
}

/** A data URL checked to be the image type it claims (magic bytes, size). Throws otherwise. */
export function decodeImageDataUrl(dataUrl, what) {
  const m = /^data:(image\/(?:png|jpeg|webp|gif|bmp|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl ?? "");
  if (!m) throw new RfqError(`${what}: not an embedded image`, { issues: [{ severity: "ERROR", code: "BROKEN_ASSET", path: what, message: "Not an embedded image." }] });
  const buf = Buffer.from(m[2], "base64");
  if (!buf.length || buf.length > MAX_IMAGE_BYTES) throw new RfqError(`${what}: image is empty or too large`);
  const mime = m[1];
  const sig = {
    "image/png": () => buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/jpeg": () => buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
    "image/gif": () => buf.subarray(0, 4).toString("latin1") === "GIF8",
    "image/webp": () => buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP",
    "image/bmp": () => buf.subarray(0, 2).toString("latin1") === "BM",
    "image/svg+xml": () => /<svg[\s>]/i.test(buf.toString("utf8", 0, 4096)) && !/<script|on\w+\s*=|javascript:/i.test(buf.toString("utf8")),
  }[mime];
  if (!sig()) throw new RfqError(`${what}: file content is not a valid ${mime}`, { issues: [{ severity: "ERROR", code: "MALFORMED_ARTWORK", path: what, message: `Not a valid ${mime}.` }] });
  const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/bmp": "bmp", "image/svg+xml": "svg" }[mime];
  const pixelSize = mime === "image/png" ? { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) } : null;
  return { buf, ext, pixelSize };
}

function readMaster() {
  const file = join(ROOT, MASTER_SPEC_FILE);
  const raw = readFileSync(file);
  const master = JSON.parse(raw.toString("utf8").replace(/^\uFEFF/, ""));
  return { master, sha256: createHash("sha256").update(raw).digest("hex") };
}

const browser = () => {
  const b = BROWSERS.find((p) => existsSync(p));
  if (!b) throw new RfqError("No Chrome / Edge available to print the PDF.", { status: 500 });
  return b;
};

/** Prints the HTML (after checking no page overflows). */
async function printPdf(htmlFile, pdfFile, profile) {
  const common = ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--run-all-compositor-stages-before-draw", "--virtual-time-budget=15000", `--user-data-dir=${profile}`];
  const { stdout } = await run(browser(), [...common, "--dump-dom", pathToFileURL(htmlFile).href], { maxBuffer: 256 * 1024 * 1024 });
  const ready = /data-ready="1"/.test(stdout);
  const overflow = /data-overflow="([^"]*)"/.exec(stdout)?.[1] ?? "";
  if (!ready) throw new RfqError("Layout check did not complete; PDF not printed.", { status: 500 });
  const pages = Number(/data-pages="(\d+)"/.exec(stdout)?.[1] ?? 0);
  if (overflow) {
    // Development aid: keep the refused HTML for inspection.
    if (process.env.RFQ_DEBUG_HTML) writeFileSync(process.env.RFQ_DEBUG_HTML, readFileSync(htmlFile));
    throw new RfqError(`Layout: content does not fit on page(s) ${overflow}; PDF not printed.`, { status: 500 });
  }
  await run(browser(), [...common, `--print-to-pdf=${pdfFile}`, pathToFileURL(htmlFile).href]);
  if (!existsSync(pdfFile)) throw new RfqError("The browser did not write the PDF.", { status: 500 });
  return pages;
}

let queue = Promise.resolve();

/**
 * Generates the RFQ Tech Pack for one stored order line.
 * `order` is the stored order (server DB) — never browser input.
 * Returns { designId, revision, dir, pdf, spec, validation }.
 */
export function generateRFQTechPack(order, { lineIndex = 0, outRoot, now = new Date(), testLabel = null } = {}) {
  const job = queue.then(() => generate(order, { lineIndex, outRoot, now, testLabel }));
  queue = job.catch(() => {});
  return job;
}

async function generate(sourceOrder, { lineIndex, outRoot, now, testLabel }) {
  if (!Number.isInteger(lineIndex) || lineIndex < 0) throw new RfqError("Invalid order line.", { status: 400 });
  const line = sourceOrder?.items?.[lineIndex];
  if (!line) throw new RfqError("Order line not found.", { status: 404 });
  if (!outRoot) throw new RfqError("No output folder.", { status: 500 });
  const designId = designIdOf(line);
  // Every drawing uses the canonical flat (licensed working copy, git-ignored): refuse early without it.
  try {
    canonicalFlat();
  } catch (err) {
    throw new RfqError(`The canonical technical flat is not installed (${err.message}).`, { status: 500 });
  }

  // Artwork resolved on the server: library files, text drawn in its font, colourways rebuilt.
  const withLib = withLibraryAssets(sourceOrder);
  const libraryOriginals = new Map();
  for (const e of withLib.items?.[lineIndex]?.customization?.embroidery ?? [])
    if (e.image?.library && e.image.src?.startsWith("data:")) libraryOriginals.set(e.id, e.image.src);
  const order = await withColourways(await withTextArtwork(withLib));

  const { master, sha256 } = readMaster();
  const shared = await loadShared();
  if (master.schema !== shared.MASTER_SCHEMA) throw new RfqError(`Master spec schema "${master.schema}" is not supported.`, { status: 500 });

  // Revision: the next RFQ-NN for this design; history from the latest one.
  const designDir = join(outRoot, designId);
  mkdirSync(designDir, { recursive: true });
  const existing = readdirSync(designDir).filter((d) => REVISION.test(d)).sort();
  const revision = `RFQ-${String(existing.length ? Number(existing.at(-1).slice(4)) + 1 : 1).padStart(2, "0")}`;
  let history = [];
  if (existing.length) {
    try {
      history = JSON.parse(readFileSync(join(designDir, existing.at(-1), SPEC_NAME), "utf8")).revisionHistory ?? [];
    } catch {
      history = existing.map((r) => ({ revision: r, date: "", specVersion: "", summary: "Earlier revision (history unreadable)" }));
    }
  }

  const stage = join(designDir, `.staging-${randomBytes(6).toString("hex")}`);
  mkdirSync(join(stage, "artwork"), { recursive: true });
  mkdirSync(join(stage, "previews"), { recursive: true });
  try {
    const base = {
      order,
      lineIndex,
      master,
      masterFile: { file: MASTER_SPEC_FILE, sha256 },
      designId,
      revision,
      createdAt: now.toISOString(),
      history,
    };
    // Pass 1: artwork ids; then the files; pass 2: the spec naming them.
    const first = shared.buildManufacturingSpec(base);
    const elements = new Map((order.items[lineIndex].customization?.embroidery ?? []).map((e) => [e.id, e]));
    const files = {};
    for (const a of first.artwork) {
      const e = elements.get(a.elementId);
      const src = e.kind === "text" ? e.textArtwork?.src : e.image?.src;
      const entry = { artwork: null, original: null, pixelSize: null };
      if (src) {
        const img = decodeImageDataUrl(src, a.artworkId);
        entry.artwork = `artwork/${a.artworkId}.${img.ext}`;
        entry.pixelSize = img.pixelSize;
        writeFileSync(join(stage, entry.artwork), img.buf);
      }
      const originalSrc = e.kind === "image" ? (e.image.original?.src ?? libraryOriginals.get(e.id) ?? null) : null;
      if (originalSrc && originalSrc !== src) {
        const img = decodeImageDataUrl(originalSrc, `${a.artworkId} original`);
        entry.original = `artwork/${a.artworkId}-original.${img.ext}`;
        writeFileSync(join(stage, entry.original), img.buf);
      }
      files[a.elementId] = entry;
    }
    const spec = shared.buildManufacturingSpec({ ...base, files });
    // QA / test documents (never a customer order): labelled in the spec and on every page.
    if (testLabel) spec.meta.testDocument = String(testLabel);
    const inside = (rel) => {
      const f = resolve(stage, rel);
      const r = relative(stage, f);
      return !!r && !r.startsWith("..") && !isAbsolute(r) && existsSync(f);
    };
    const validation = shared.validateManufacturingSpec(spec, { masterPomIds: master.poms.map((p) => p.id), fileExists: inside });
    spec.validation = validation;
    if (!validation.ok) throw new RfqError(`The Manufacturing Spec has ${validation.errors.length} error(s); no RFQ was generated.`, { issues: validation.errors });

    writeFileSync(join(stage, SPEC_NAME), `${JSON.stringify(spec, null, 2)}\n`);
    // Base flats only (customer art is layered on them in the PDF, never baked in).
    const plainZones = spec.embroideryZones.map((z, i) => ({ ...z, used: false, label: `Z${i + 1}` }));
    writeFileSync(join(stage, "previews", "flat-front.svg"), viewSvg("front", { wMm: 160, hMm: 200, zones: plainZones }));
    writeFileSync(join(stage, "previews", "flat-back.svg"), viewSvg("back", { wMm: 160, hMm: 200, zones: plainZones }));
    writeFileSync(join(stage, "previews", "flat-left-sleeve.svg"), sleeveSvg("leftSleeve", { wMm: 70, hMm: 200, zones: plainZones }));
    writeFileSync(join(stage, "previews", "flat-right-sleeve.svg"), sleeveSvg("rightSleeve", { wMm: 70, hMm: 200, zones: plainZones }));

    const { html, pageTitles } = renderRfqHtml(spec, { artDir: stage });
    const work = join(stage, ".print");
    mkdirSync(work);
    const htmlFile = join(work, "rfq.html");
    writeFileSync(htmlFile, html);
    const pageCount = await printPdf(htmlFile, join(stage, PDF_NAME), join(work, "profile"));
    rmSync(work, { recursive: true, force: true });

    const finalDir = join(designDir, revision);
    if (existsSync(finalDir)) throw new RfqError(`${revision} already exists; nothing was overwritten.`, { status: 409 });
    renameSync(stage, finalDir);
    return { designId, revision, dir: finalDir, pdf: join(finalDir, PDF_NAME), json: join(finalDir, SPEC_NAME), pages: pageCount, sections: pageTitles, validation, spec };
  } catch (err) {
    rmSync(stage, { recursive: true, force: true });
    throw err;
  }
}

/** The latest RFQ revision of a design: { revision, dir } or null. */
export function latestRfq(outRoot, designId) {
  if (!DESIGN_ID.test(designId)) return null;
  const dir = join(outRoot, designId);
  if (!existsSync(dir)) return null;
  const revs = readdirSync(dir).filter((d) => REVISION.test(d)).sort();
  if (!revs.length) return null;
  const r = revs.at(-1);
  return existsSync(join(dir, r, PDF_NAME)) ? { revision: r, dir: join(dir, r) } : null;
}

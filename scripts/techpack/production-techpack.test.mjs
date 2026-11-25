// Customer Production Tech Pack tests (server/productionTechpack/). node:test, no extra dependency.
//   node --test --test-concurrency=1 scripts/techpack/production-techpack.test.mjs   (needs Chrome or Edge)
// Runs against a TEMPORARY data folder (its own SQLite database): the shop's server-data is never touched.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TMP = mkdtempSync(join(tmpdir(), "jk-ptp-"));
process.env.DATA_DIR = join(TMP, "data");
const REF = JSON.parse(readFileSync(join(ROOT, "garment-spec/JACKETEK_R2_BUILD_SOURCES/reference-design/D-59a2a5aab079/DEV-01/design-config.json"), "utf8"));
// The reference design uses artwork from the full (licensed, not in Git) embroidery library. Without it the
// generation suite is skipped with this reason instead of failing (see README → External assets).
const LIB_DIR = resolve(ROOT, process.env.EMBROIDERY_LIBRARY_DIR ?? "runtime-assets/embroidery-library");
const MISSING_LIBRARY_ASSETS = [...new Set(JSON.stringify(REF).match(/\/embroidery-library\/assets\/[^"]+/g) ?? [])]
  .filter((u) => !existsSync(join(LIB_DIR, u.replace(/^\/embroidery-library\//, ""))));
const SKIP_GENERATION = MISSING_LIBRARY_ASSETS.length
  ? `full embroidery library not installed (${MISSING_LIBRARY_ASSETS.length} asset(s) of the reference design missing, e.g. ${MISSING_LIBRARY_ASSETS[0]})`
  : false;
const CHG04 = JSON.parse(readFileSync(join(ROOT, "garment-spec/JACKETEK_FACTORY_MASTER_ORIG_R2/traceability/design-change-CHG-04.json"), "utf8"));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const clone = (x) => structuredClone(x);

let orders, store, gen, routes, master, pdfText;
before(async () => {
  orders = await import("../../server/orders.mjs");
  store = await import("../../server/productionTechpack/store.mjs");
  gen = await import("../../server/productionTechpack/generate.mjs");
  routes = await import("../../server/productionTechpack/routes.mjs");
  master = await import("../../server/productionTechpack/master.mjs");
  // PDF text via the PDF's own content is compressed; read it with pymupdf when available, else skip text checks.
  pdfText = (file) => {
    try {
      const { execFileSync } = require("node:child_process");
      return execFileSync("python", ["-c", "import sys,pymupdf;print('\\n'.join(p.get_text() for p in pymupdf.open(sys.argv[1])))", file], { encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    } catch {
      return null;
    }
  };
});
after(() => {
  try { orders.db.close(); } catch {}
  try { rmSync(TMP, { recursive: true, force: true }); } catch {}
});
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

/** A stored order in the shape POST /api/orders stores (synthetic customer details). */
function placeOrder(designs) {
  return orders.createOrder({
    createdAt: "2026-11-25T10:00:00.000Z",
    status: "pending",
    items: designs.map(({ config, quantity = 1 }) => ({ productId: "fidelio-varsity", productName: "Varsity Jacket", size: config.size, quantity, unitPrice: null, lineTotal: null, customization: config })),
    pricing: { currency: "IQD", subtotal: null, delivery: null, total: null },
    customer: { fullName: "Test Customer", phone: "+9647700000000" },
    delivery: { city: "Test", area: "Test", address: "Test address 1", notes: "" },
    payment: { method: "cod", status: "due-on-delivery" },
  });
}
const approve = (order, line = 0) => store.recordApproval(order, line, { method: "test", at: new Date("2026-11-25T10:00:01Z") });
const readSpec = (r) => JSON.parse(readFileSync(join(process.env.DATA_DIR, r.dir, "production-spec.json"), "utf8"));
const pdfOf = (r) => join(process.env.DATA_DIR, r.dir, r.pdfName);

/** Variant A: navy / ivory, English name, right-chest flag moved and scaled, size L. */
function variantA() {
  const c = clone(REF.config);
  Object.assign(c, { size: "L", colours: { body: "fabric-navy", sleeves: "leather-white", trim: "fabric-navy" }, buttons: "silver" });
  const q = c.embroidery.find((e) => e.placement === "backQuote");
  q.text = "SARA AHMED";
  q.thread = "gold";
  const flag = c.embroidery.find((e) => e.placement === "rightChest");
  flag.inZone = { scale: 0.6, x: 0.1, y: 0.1 };
  return c;
}
/** Variant B: Arabic name on the left chest (instead of YO), artwork in a zone R2 has no position for, size S. */
function variantB() {
  const c = clone(REF.config);
  Object.assign(c, { size: "S", colours: { body: "fabric-black", sleeves: "leather-black", trim: "fabric-burgundy" } });
  const yo = c.embroidery.findIndex((e) => e.placement === "leftChest");
  const arabic = c.embroidery.find((e) => e.placement === "rightSleeveUpper");
  c.embroidery[yo] = { ...clone(arabic), id: "test-ar-chest", placement: "leftChest", text: "علي", inZone: { scale: 1, x: 0, y: 0 } };
  delete c.embroidery[yo].textArtwork;
  const emblem = c.embroidery.find((e) => e.placement === "leftSleeveUpper");
  emblem.placement = "leftSleeveLower";
  return c;
}

describe("active master", () => {
  test("registry: R2, pinned files verify, pending owner approval", () => {
    const { master: m } = master.loadMaster();
    assert.equal(m.revision, "R2");
    assert.equal(m.approval.status, "PENDING_OWNER_APPROVAL");
    assert.equal(m.supplierPackage.files.length, 19);
    for (const p of m.supplierPackage.files) assert.ok(existsSync(join(ROOT, p.path)), p.path);
    assert.equal(m.zoneReferences.length, 7);
    // YO (left chest) on the wearer's left front, flag on the wearer's right front.
    assert.equal(m.zoneReferences.find((z) => z.zoneId === "leftChest").piece, "JKT_FRONT_L");
    assert.equal(m.zoneReferences.find((z) => z.zoneId === "rightChest").piece, "JKT_FRONT_R");
  });
  test("a registry whose pinned hash no longer matches is refused", () => {
    const m = JSON.parse(readFileSync(join(ROOT, master.MASTER_FILE), "utf8"));
    m.engineeringData[0].sha256 = "0".repeat(64);
    const f = join(TMP, "bad-master.json");
    writeFileSync(f, JSON.stringify(m));
    assert.throws(() => master.loadMaster({ file: f }), /changed since the registry was built/);
  });
});

describe("approval gate", () => {
  test("checkout approval must match the design sent", () => {
    class E extends Error { constructor(s, m) { super(m); this.status = s; } }
    const c = REF.config;
    assert.deepEqual(routes.checkoutApprovals({ items: [{ customization: c }] }, E), []);
    assert.deepEqual(routes.checkoutApprovals({ items: [{ customization: c, designApproval: { confirmed: true, designSha256: store.designHash(c) } }] }, E), [{ index: 0 }]);
    const edited = { ...clone(c), size: "XL" };
    assert.throws(() => routes.checkoutApprovals({ items: [{ customization: edited, designApproval: { confirmed: true, designSha256: store.designHash(c) } }] }, E), /does not match/);
  });
  test("no approval → nothing generated", async () => {
    const order = placeOrder([{ config: REF.config }]);
    await assert.rejects(gen.generateJacketTechPack(order.id, 0), /no recorded customer design approval/);
    assert.equal(existsSync(join(process.env.DATA_DIR, gen.OUT_DIR_NAME, order.id)), false);
  });
});

describe("generation", { skip: SKIP_GENERATION }, () => {
  let refRun, aRun, bRun, refOrder;
  test("reference design reproduces R2 exactly (sizes, centres, pieces)", async () => {
    refOrder = placeOrder([{ config: REF.config, quantity: 2 }]);
    const ap = approve(refOrder);
    assert.equal(ap.jacketId, `${refOrder.id}-J1`);
    refRun = await gen.generateJacketTechPack(refOrder.id, 0);
    assert.equal(refRun.status, "GENERATED");
    assert.equal(refRun.masterRevision, "R2");
    const spec = readSpec(refRun);
    assert.equal(spec.artwork.length, 7);
    for (const a of spec.artwork) {
      const r = CHG04.artwork.find((x) => x.id.endsWith(a.artworkId.slice(7)));
      assert.ok(r, a.artworkId);
      assert.equal(a.placement.status, "R2_REFERENCE_EXACT", a.artworkId);
      assert.ok(Math.abs(a.sizeCm[0] - r.sizeCm[0]) < 0.011 && Math.abs(a.sizeCm[1] - r.sizeCm[1]) < 0.011, `${a.artworkId} size`);
      assert.deepEqual(a.placement.centreCm, r.centreCm);
      assert.ok(a.file && existsSync(join(process.env.DATA_DIR, refRun.dir, a.file)), `${a.artworkId} file`);
    }
    const yo = spec.artwork.find((a) => a.zoneId === "leftChest");
    assert.equal(yo.piece, "JKT_FRONT_L");
    assert.deepEqual(yo.sizeCm, [10, 8.12]);
    assert.equal(spec.artwork.find((a) => a.zoneId === "rightChest").piece, "JKT_FRONT_R");
    assert.equal(spec.jacket.quantity, 2);
    const snap = JSON.parse(readFileSync(join(process.env.DATA_DIR, refRun.dir, "snapshot.json"), "utf8"));
    assert.equal(store.snapshotHash(snap), refRun.snapshotSha256);
  });

  test("PDF: Jacket ID, order, master revision, status on the pages", (t) => {
    const txt = pdfText(pdfOf(refRun));
    if (txt === null) return t.skip("pymupdf not installed: PDF text not checked");
    assert.match(txt, new RegExp(refRun.jacketId));
    assert.match(txt, /JKT-VJ-01 Rev R2/);
    assert.match(txt, /PENDING OWNER APPROVAL/);
    assert.match(txt, /grading is\s+MISSING/);
    assert.equal(refRun.pages, 8);
  });

  test("retry is idempotent: same folder, same PDF bytes, no new files", async () => {
    const before = readdirSync(join(process.env.DATA_DIR, gen.OUT_DIR_NAME, refOrder.id, refRun.jacketId));
    const pdfSha = sha(readFileSync(pdfOf(refRun)));
    const again = await gen.generateJacketTechPack(refOrder.id, 0);
    assert.equal(again.reused, true);
    assert.equal(again.dir, refRun.dir);
    assert.equal(sha(readFileSync(pdfOf(refRun))), pdfSha);
    assert.deepEqual(readdirSync(join(process.env.DATA_DIR, gen.OUT_DIR_NAME, refOrder.id, refRun.jacketId)), before);
    assert.equal(store.listPacks(refOrder.id).length, 1);
  });

  test("regeneration is deterministic (same snapshot + master → identical spec and HTML hash)", async () => {
    const fileSpec = readSpec(refRun);
    const { master: m, sha256: msha } = master.loadMaster();
    const order = orders.getOrder(refOrder.id);
    const spec = await gen.buildProductionSpec({ order, line: 0, approval: store.getApproval(refOrder.id, 0), master: m, masterSha256: msha, snapshot: store.snapshotOf(order, 0) });
    for (const a of [...fileSpec.artwork, ...spec.artwork]) delete a.file, delete a.pixels;
    assert.deepEqual(spec, fileSpec);
    // The document re-rendered from the stored spec and artwork files gives the identical HTML (hash recorded at generation).
    const { renderProductionTechPack } = await import("../../server/productionTechpack/render.mjs");
    const { master: mm, path } = master.loadMaster();
    const stored = readSpec(refRun);
    const { html } = renderProductionTechPack(stored);
    assert.ok(path("technical flat — front"));
    assert.equal(sha(html), refRun.htmlSha256);
    assert.ok(mm);
  });

  test("approved PDF is immutable: a changed stored design is refused, the PDF stays", async () => {
    const pdfSha = sha(readFileSync(pdfOf(refRun)));
    orders.db.prepare("UPDATE order_items SET customization = ? WHERE order_id = ? AND line = 0").run(JSON.stringify({ ...REF.config, size: "XL" }), refOrder.id);
    await assert.rejects(gen.generateJacketTechPack(refOrder.id, 0), /no longer matches the approved snapshot/);
    assert.throws(() => approve(orders.getOrder(refOrder.id)), /approved with a different design/);
    assert.equal(sha(readFileSync(pdfOf(refRun))), pdfSha);
    orders.db.prepare("UPDATE order_items SET customization = ? WHERE order_id = ? AND line = 0").run(JSON.stringify(REF.config), refOrder.id);
  });

  test("two more customers on the same base model: own colours, artwork, sizes and positions", async (t) => {
    const order = placeOrder([{ config: variantA() }, { config: variantB() }]);
    approve(order, 0);
    approve(order, 1);
    aRun = await gen.generateJacketTechPack(order.id, 0);
    bRun = await gen.generateJacketTechPack(order.id, 1);
    assert.notEqual(aRun.jacketId, bRun.jacketId);
    assert.notEqual(aRun.dir, bRun.dir);
    const A = readSpec(aRun), B = readSpec(bRun);
    // Colours
    assert.equal(A.garment.colourway[0].id, "fabric-navy");
    assert.equal(A.garment.colourway[1].id, "leather-white");
    assert.equal(A.garment.colourway[3].id, "leather-white"); // stripes follow the sleeves
    assert.equal(B.garment.colourway[2].id, "fabric-burgundy");
    assert.equal(A.jacket.size, "L");
    assert.equal(B.jacket.size, "S");
    assert.ok(A.warnings.some((w) => /Size L.*grading is MISSING/.test(w)));
    // English personalised text: exact content, own thread
    const name = A.artwork.find((a) => a.zoneId === "backQuote");
    assert.equal(name.text.content, "SARA AHMED");
    assert.equal(name.threads[0].name, "Gold");
    assert.ok(name.file, "text drawn to an artwork file");
    // Moved / scaled flag: size from the live zone rule, centre derived from R2 (front right: x toward the side seam = −zone x)
    const flag = A.artwork.find((a) => a.zoneId === "rightChest");
    const ref = CHG04.artwork.find((x) => x.id === "ART-04-RIGHT_CHEST");
    assert.equal(flag.placement.status, "DERIVED_FROM_R2_REFERENCE");
    assert.ok(flag.sizeCm[0] < ref.sizeCm[0]);
    assert.ok(Math.abs(flag.sizeCm[0] / flag.sizeCm[1] - ref.sizeCm[0] / ref.sizeCm[1]) < 0.01, "flag proportions kept");
    assert.ok(flag.placement.centreCm.x < ref.centreCm.x, "zone +x on the wearer's right chest moves toward CF");
    assert.ok(flag.placement.centreCm.y < ref.centreCm.y, "zone +y moves up (less below HPS)");
    // Arabic text on the left chest: exact text, RTL
    const ar = B.artwork.find((a) => a.zoneId === "leftChest");
    assert.equal(ar.text.content, "علي");
    assert.equal(ar.text.direction, "rtl");
    assert.equal(ar.piece, "JKT_FRONT_L");
    assert.ok(ar.file, "Arabic text drawn to an artwork file");
    // Zone without an R2 position: flagged MISSING, never guessed
    const low = B.artwork.find((a) => a.zoneId === "leftSleeveLower");
    assert.equal(low.placement.status, "NO_R2_REFERENCE");
    assert.equal(low.placement.centreCm, null);
    const txt = pdfText(pdfOf(bRun));
    if (txt === null) return t.skip("pymupdf not installed: PDF text not checked");
    assert.match(txt, /علي/);
    assert.match(readFileSync(pdfOf(aRun)) && pdfText(pdfOf(aRun)), /SARA AHMED/);
  });
});

export { variantA, variantB };

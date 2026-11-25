// Order database: SQLite (Node's built-in node:sqlite — no extra
// dependency), one file at <DATA_DIR>/jacketek.db.
//
//   orders          one row per order: customer, delivery, payment, totals,
//                   and `data` — the complete order JSON as placed
//   order_items     one row per jacket: product, size, quantity, price and
//                   `customization` — the configurator's full design JSON
//   production_pdfs the Production Drawing PDF(s) made for an order
//
// PDFs, uploaded embroidery artwork and the production JSON are files in
// <DATA_DIR>/production/<ORDER_ID>/; the database records which belong
// to which order.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

// Relative to the project root (not the current directory), so the same
// database is used however the server is started.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = resolve(ROOT, process.env.DATA_DIR ?? "server-data");
const PRODUCTION = join(DATA_DIR, "production");
mkdirSync(PRODUCTION, { recursive: true });

export const DB_PATH = join(DATA_DIR, "jacketek.db");
/** The one database connection (also used by server/auth.mjs). */
export const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS orders (
    id             TEXT PRIMARY KEY,
    created_at     TEXT NOT NULL,
    status         TEXT NOT NULL,
    customer_name  TEXT NOT NULL,
    phone          TEXT NOT NULL,
    city           TEXT NOT NULL,
    area           TEXT NOT NULL,
    address        TEXT NOT NULL,
    notes          TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    currency       TEXT NOT NULL,
    subtotal       REAL,
    delivery       REAL,
    total          REAL,
    data           TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS order_items (
    order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    line          INTEGER NOT NULL,
    product_id    TEXT NOT NULL,
    product_name  TEXT NOT NULL,
    size          TEXT,
    quantity      INTEGER NOT NULL,
    unit_price    REAL,
    line_total    REAL,
    customization TEXT NOT NULL,
    PRIMARY KEY (order_id, line)
  );
  CREATE TABLE IF NOT EXISTS production_pdfs (
    order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    line          INTEGER NOT NULL,
    production_id TEXT NOT NULL,
    pdf_name      TEXT NOT NULL,
    artwork       TEXT NOT NULL,
    gaps          TEXT NOT NULL,
    generated_at  TEXT NOT NULL,
    PRIMARY KEY (order_id, line)
  );
  CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at DESC);
  CREATE TABLE IF NOT EXISTS embroidery_designs (
    order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    line          INTEGER NOT NULL,
    element_id    TEXT NOT NULL,
    design_id     TEXT NOT NULL,
    engine        TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    metadata      TEXT NOT NULL,
    dst           BLOB NOT NULL,
    preview_svg   TEXT NOT NULL,
    PRIMARY KEY (order_id, line, element_id)
  );
`);

export const ORDER_ID = /^[A-Z0-9][A-Z0-9-]{3,39}$/;

const insertOrder = db.prepare(`INSERT INTO orders
  (id, created_at, status, customer_name, phone, city, area, address, notes, payment_method, payment_status, currency, subtotal, delivery, total, data)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertItem = db.prepare(`INSERT INTO order_items
  (order_id, line, product_id, product_name, size, quantity, unit_price, line_total, customization)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const selectOrder = db.prepare("SELECT data FROM orders WHERE id = ?");
const selectAll = db.prepare("SELECT data FROM orders ORDER BY created_at DESC");
const selectItems = db.prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY line");
const selectPdfs = db.prepare("SELECT * FROM production_pdfs WHERE order_id = ? ORDER BY line");
const deletePdfs = db.prepare("DELETE FROM production_pdfs WHERE order_id = ?");
const insertPdf = db.prepare(`INSERT INTO production_pdfs
  (order_id, line, production_id, pdf_name, artwork, gaps, generated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
const exists = db.prepare("SELECT 1 FROM orders WHERE id = ?");

function transaction(fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/** JK-261002-7KQ4 — date, then 4 unambiguous characters. */
function newOrderId() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const d = new Date();
  const date = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  for (;;) {
    const id = `JK-${date}-${[...randomBytes(4)].map((b) => alphabet[b % alphabet.length]).join("")}`;
    if (!exists.get(id)) return id;
  }
}

function insert(order) {
  transaction(() => {
    insertOrder.run(
      order.id, order.createdAt, order.status, order.customer.fullName, order.customer.phone,
      order.delivery.city, order.delivery.area, order.delivery.address, order.delivery.notes ?? "",
      order.payment.method, order.payment.status, order.pricing.currency,
      order.pricing.subtotal, order.pricing.delivery, order.pricing.total, JSON.stringify(order)
    );
    order.items.forEach((item, line) =>
      insertItem.run(
        order.id, line, item.productId, item.productName, item.size, item.quantity,
        item.unitPrice, item.lineTotal, JSON.stringify(item.customization)
      )
    );
  });
}

/** Stores a new order (the server gives it its ID) and returns it. */
export function createOrder(order) {
  const stored = { ...order, id: newOrderId() };
  insert(stored);
  return stored;
}

/**
 * The order as placed, with each jacket's customisation read back from
 * its own row (so what production uses is exactly what was stored).
 */
export function getOrder(id) {
  if (!ORDER_ID.test(id)) return null;
  const row = selectOrder.get(id);
  if (!row) return null;
  const order = JSON.parse(row.data);
  const items = selectItems.all(id);
  order.items = order.items.map((item, i) => ({ ...item, customization: JSON.parse(items[i]?.customization ?? "null") ?? item.customization }));
  return order;
}

export function listOrders() {
  return selectAll.all().map((r) => JSON.parse(r.data));
}

export function productionDir(id) {
  return join(PRODUCTION, id);
}

export function getProduction(id) {
  const rows = selectPdfs.all(id);
  if (!rows.length) return null;
  return {
    generatedAt: rows[0].generated_at,
    files: rows.map((r) => ({
      line: r.line,
      productionId: r.production_id,
      pdfName: r.pdf_name,
      artwork: JSON.parse(r.artwork),
      gaps: JSON.parse(r.gaps),
    })),
  };
}

export function saveProduction(id, record) {
  transaction(() => {
    deletePdfs.run(id);
    for (const f of record.files)
      insertPdf.run(id, f.line, f.productionId, f.pdfName, JSON.stringify(f.artwork), JSON.stringify(f.gaps), record.generatedAt);
  });
}

// ---- Auto-digitized embroidery (one design per uploaded image) ----
// `stitches`: the exact stitch list the DST was written from (added later: older rows have none).
if (!db.prepare("PRAGMA table_info(embroidery_designs)").all().some((c) => c.name === "stitches"))
  db.exec("ALTER TABLE embroidery_designs ADD COLUMN stitches TEXT");
const selectDesigns = db.prepare("SELECT order_id, line, element_id, design_id, engine, created_at, metadata, stitches IS NOT NULL AS has_stitches FROM embroidery_designs WHERE order_id = ? ORDER BY line, design_id");
const selectDesign = db.prepare("SELECT * FROM embroidery_designs WHERE order_id = ? AND design_id = ?");
const upsertDesign = db.prepare(`INSERT OR REPLACE INTO embroidery_designs
  (order_id, line, element_id, design_id, engine, created_at, metadata, dst, preview_svg, stitches) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

/** The order's designs (metadata only). */
export function listDesigns(orderId) {
  return selectDesigns.all(orderId).map((r) => ({
    line: r.line, elementId: r.element_id, designId: r.design_id, engine: r.engine, createdAt: r.created_at, metadata: JSON.parse(r.metadata),
    hasStitches: Boolean(r.has_stitches),
  }));
}
/** One design with its files (DST bytes, preview SVG, stitch data). */
export function getDesign(orderId, designId) {
  const r = selectDesign.get(orderId, designId);
  return r && {
    line: r.line, elementId: r.element_id, designId: r.design_id, engine: r.engine, metadata: JSON.parse(r.metadata),
    dst: Buffer.from(r.dst), previewSvg: r.preview_svg, stitchData: r.stitches ?? null,
  };
}
export function saveDesign(orderId, d) {
  upsertDesign.run(orderId, d.line, d.elementId, d.designId, d.engine, d.metadata.createdAt, JSON.stringify(d.metadata), d.dst, d.previewSvg, d.stitchData ?? null);
}

/**
 * One-time import of orders saved by the earlier file-based storage
 * (server-data/orders/*.json), so nothing placed before is lost.
 */
(function importFileOrders() {
  const dir = join(DATA_DIR, "orders");
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json") || f.endsWith(".production.json")) continue;
    const order = JSON.parse(readFileSync(join(dir, f), "utf8"));
    if (!order?.id || exists.get(order.id)) continue;
    insert(order);
    const production = join(dir, `${order.id}.production.json`);
    if (existsSync(production)) saveProduction(order.id, JSON.parse(readFileSync(production, "utf8")));
    console.log(`imported order ${order.id} into the database`);
  }
})();

export { DATA_DIR };

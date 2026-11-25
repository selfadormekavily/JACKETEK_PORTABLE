// Jacket approvals and Production Tech Pack records (SQLite, the shop's one database).
//
//   jacket_approvals        one row per approved order line: its Jacket ID and the SHA-256 of the
//                           frozen design snapshot the customer approved. Never updated: a different
//                           snapshot for the same line is refused (a changed design needs a new order line).
//   jacket_techpacks        one row per generated Production Tech Pack: jacket + master revision +
//                           snapshot hash (primary key) → folder, PDF hash, status. A row in status
//                           GENERATED is never rewritten; retries return it.
//
// Additive only (CREATE TABLE IF NOT EXISTS): no existing table or column is changed.
import { createHash } from "node:crypto";
import { db } from "../orders.mjs";

db.exec(`
  CREATE TABLE IF NOT EXISTS jacket_approvals (
    order_id        TEXT NOT NULL REFERENCES orders(id),
    line            INTEGER NOT NULL,
    jacket_id       TEXT NOT NULL UNIQUE,
    snapshot_sha256 TEXT NOT NULL,
    method          TEXT NOT NULL,
    reference       TEXT NOT NULL DEFAULT '',
    approved_at     TEXT NOT NULL,
    PRIMARY KEY (order_id, line)
  );
  CREATE TABLE IF NOT EXISTS jacket_techpacks (
    jacket_id       TEXT NOT NULL,
    order_id        TEXT NOT NULL REFERENCES orders(id),
    line            INTEGER NOT NULL,
    master_revision TEXT NOT NULL,
    master_sha256   TEXT NOT NULL,
    snapshot_sha256 TEXT NOT NULL,
    status          TEXT NOT NULL,
    dir             TEXT,
    pdf_name        TEXT,
    pdf_sha256      TEXT,
    html_sha256     TEXT,
    pages           INTEGER,
    error           TEXT,
    created_at      TEXT NOT NULL,
    generated_at    TEXT,
    PRIMARY KEY (jacket_id, master_revision, snapshot_sha256)
  );
  CREATE INDEX IF NOT EXISTS jacket_techpacks_order ON jacket_techpacks(order_id, line);
`);

/** JSON with sorted keys (stable hashing). */
export function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
export const sha256 = (data) => createHash("sha256").update(data).digest("hex");

/** The hash a customer approves: the jacket's design exactly as stored (browser: same stable JSON, SHA-256). */
export const designHash = (customization) => sha256(stable(customization ?? null));

/** The frozen snapshot of one order line (what production is made from). */
export function snapshotOf(order, line) {
  const item = order.items[line];
  return {
    schema: "jacketek.jacket-snapshot/1",
    orderId: order.id,
    line: line + 1,
    productId: item.productId,
    productName: item.productName,
    size: item.size ?? null,
    quantity: item.quantity,
    designSha256: designHash(item.customization),
    customization: item.customization,
  };
}
export const snapshotHash = (snapshot) => sha256(stable(snapshot));

/** JK-261008-5V5E line 1 → JK-261008-5V5E-J1 (one Jacket ID per approved order line). */
export const jacketIdOf = (orderId, line) => `${orderId}-J${line + 1}`;

const selApproval = db.prepare("SELECT * FROM jacket_approvals WHERE order_id = ? AND line = ?");
const selApprovals = db.prepare("SELECT * FROM jacket_approvals WHERE order_id = ? ORDER BY line");
const insApproval = db.prepare("INSERT INTO jacket_approvals (order_id, line, jacket_id, snapshot_sha256, method, reference, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?)");

const approvalRow = (r) => r && { orderId: r.order_id, line: r.line, jacketId: r.jacket_id, snapshotSha256: r.snapshot_sha256, method: r.method, reference: r.reference, approvedAt: r.approved_at };
export const getApproval = (orderId, line) => approvalRow(selApproval.get(orderId, line));
export const listApprovals = (orderId) => selApprovals.all(orderId).map(approvalRow);

export class ApprovalConflict extends Error {
  status = 409;
}

/**
 * Records the customer's approval of one order line's frozen snapshot. Idempotent for the same
 * snapshot; a different snapshot for an already-approved line is refused (never overwritten).
 */
export function recordApproval(order, line, { method, reference = "", at = new Date() }) {
  const snap = snapshotHash(snapshotOf(order, line));
  const existing = getApproval(order.id, line);
  if (existing) {
    if (existing.snapshotSha256 !== snap) throw new ApprovalConflict(`Line ${line + 1} was approved with a different design; a changed design needs a new order line and a new approval.`);
    return existing;
  }
  insApproval.run(order.id, line, jacketIdOf(order.id, line), snap, method, String(reference).slice(0, 300), at.toISOString());
  return getApproval(order.id, line);
}

const selPack = db.prepare("SELECT * FROM jacket_techpacks WHERE jacket_id = ? AND master_revision = ? AND snapshot_sha256 = ?");
const selPacksOfOrder = db.prepare("SELECT * FROM jacket_techpacks WHERE order_id = ? ORDER BY line, created_at");
const selGeneratedOfJacket = db.prepare("SELECT * FROM jacket_techpacks WHERE jacket_id = ? AND status = 'GENERATED'");
const upsertPending = db.prepare(`INSERT INTO jacket_techpacks (jacket_id, order_id, line, master_revision, master_sha256, snapshot_sha256, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)
  ON CONFLICT (jacket_id, master_revision, snapshot_sha256) DO UPDATE SET status = 'PENDING', error = NULL WHERE jacket_techpacks.status != 'GENERATED'`);
const markGenerated = db.prepare(`UPDATE jacket_techpacks SET status = 'GENERATED', dir = ?, pdf_name = ?, pdf_sha256 = ?, html_sha256 = ?, pages = ?, generated_at = ?, error = NULL
  WHERE jacket_id = ? AND master_revision = ? AND snapshot_sha256 = ? AND status != 'GENERATED'`);
const markFailed = db.prepare(`UPDATE jacket_techpacks SET status = 'FAILED', error = ? WHERE jacket_id = ? AND master_revision = ? AND snapshot_sha256 = ? AND status != 'GENERATED'`);

const packRow = (r) => r && {
  jacketId: r.jacket_id, orderId: r.order_id, line: r.line, masterRevision: r.master_revision, masterSha256: r.master_sha256, snapshotSha256: r.snapshot_sha256,
  status: r.status, dir: r.dir, pdfName: r.pdf_name, pdfSha256: r.pdf_sha256, htmlSha256: r.html_sha256, pages: r.pages, error: r.error, createdAt: r.created_at, generatedAt: r.generated_at,
};
export const getPack = (jacketId, rev, snap) => packRow(selPack.get(jacketId, rev, snap));
export const listPacks = (orderId) => selPacksOfOrder.all(orderId).map(packRow);
export const generatedPacksOfJacket = (jacketId) => selGeneratedOfJacket.all(jacketId).map(packRow);
export const startPack = (k, at) => upsertPending.run(k.jacketId, k.orderId, k.line, k.masterRevision, k.masterSha256, k.snapshotSha256, at);
export const finishPack = (k, f) => markGenerated.run(f.dir, f.pdfName, f.pdfSha256, f.htmlSha256, f.pages, f.generatedAt, k.jacketId, k.masterRevision, k.snapshotSha256);
export const failPack = (k, message) => markFailed.run(String(message).slice(0, 1000), k.jacketId, k.masterRevision, k.snapshotSha256);

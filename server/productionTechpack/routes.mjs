// Customer Production Tech Pack: checkout approvals + admin API. Mounted from server/index.mjs.
//
// Checkout (POST /api/orders): an item may carry
//     designApproval: { confirmed: true, designSha256: "<sha-256 of the stable JSON of item.customization>" }
//   sent only after the customer explicitly confirmed the final design. A confirmed approval whose hash
//   does not match the design sent is refused (400) BEFORE the order is stored. Without it nothing
//   changes: the order is placed exactly as before and no Tech Pack is generated.
//
// Admin (admin session + X-Jacketek-Admin, inside the admin block of server/index.mjs):
//   GET  /api/admin/orders/:id/production-techpack                       approvals + generated packs
//   POST /api/admin/orders/:id/production-techpack {line, approvalReference?}
//        generate (idempotent). approvalReference records the customer's confirmation received
//        outside the website (e.g. "confirmed by phone 2026-11-25") when the line has none yet.
//   GET  /api/admin/orders/:id/production-techpack/:jacketId/:folder/pdf   download (?inline=1 to open)
import { createReadStream, statSync } from "node:fs";
import { generateJacketTechPack, packPdfFile, TechPackError } from "./generate.mjs";
import { ApprovalConflict, designHash, getApproval, listApprovals, listPacks, recordApproval } from "./store.mjs";
import { MasterError } from "./master.mjs";

/** Validates checkout approvals against the designs sent. Returns [{ index }] of confirmed lines. Throws on mismatch. */
export function checkoutApprovals(body, HttpError) {
  const items = Array.isArray(body?.items) ? body.items : [];
  const confirmed = [];
  items.forEach((item, index) => {
    const a = item?.designApproval;
    if (a === undefined || a === null) return;
    if (a.confirmed !== true || typeof a.designSha256 !== "string") throw new HttpError(400, `Jacket ${index + 1}: invalid design approval.`);
    if (a.designSha256 !== designHash(item.customization)) throw new HttpError(400, `Jacket ${index + 1}: the approved design does not match the design sent. Please review and confirm the design again.`);
    confirmed.push({ index });
  });
  return confirmed;
}

/** After the order is stored: record the confirmed lines and generate their Tech Packs in the background. */
export function afterOrderPlaced(order, confirmed, log = console) {
  const at = new Date();
  const lines = [];
  for (const { index } of confirmed) {
    try {
      recordApproval(order, index, { method: "Customer confirmed the final design at checkout", at });
      lines.push(index);
    } catch (err) {
      log.error(`approval of ${order.id} line ${index + 1} not recorded:`, err.message);
    }
  }
  // Never delays or fails checkout; a failure is recorded (status FAILED) and can be retried by the admin.
  for (const line of lines)
    generateJacketTechPack(order.id, line)
      .then((r) => log.log(`production tech pack ${r.jacketId} ${r.reused ? "already existed" : "generated"} (${order.id} line ${line + 1})`))
      .catch((err) => log.error(`production tech pack for ${order.id} line ${line + 1} failed:`, err.message));
  return lines;
}

/** Admin routes under /api/admin/orders/:id/production-techpack. Returns true when handled. */
export async function handleProductionTechPack(req, res, { order, parts, url, readJsonBody, send, HttpError }) {
  if (parts[4] !== "production-techpack") return false;
  const id = order.id;
  if (parts.length === 5 && req.method === "GET") return send(res, 200, { approvals: listApprovals(id), techpacks: listPacks(id) }), true;
  if (parts.length === 5 && req.method === "POST") {
    const body = (await readJsonBody(req, 4096)) ?? {};
    const line = Number(body.line ?? 1) - 1;
    if (!Number.isInteger(line) || line < 0 || line >= order.items.length) throw new HttpError(400, "Invalid order line.");
    try {
      if (!getApproval(id, line)) {
        const ref = typeof body.approvalReference === "string" ? body.approvalReference.trim() : "";
        if (ref.length < 5) throw new HttpError(409, "This jacket has no recorded customer approval. Send approvalReference (how and when the customer confirmed the final design) to record it.");
        recordApproval(order, line, { method: "Customer confirmation recorded by admin", reference: ref });
      }
      const r = await generateJacketTechPack(id, line);
      send(res, 200, { techpack: r, approvals: listApprovals(id), techpacks: listPacks(id) });
      return true;
    } catch (err) {
      if (err instanceof TechPackError || err instanceof ApprovalConflict || err instanceof MasterError) throw new HttpError(err.status, err.message);
      throw err;
    }
  }
  if (parts.length === 8 && parts[7] === "pdf" && req.method === "GET") {
    const file = packPdfFile(id, parts[5], parts[6]);
    if (!file) throw new HttpError(404, "Production Tech Pack not found.");
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${url.searchParams.get("inline") === "1" ? "inline" : "attachment"}; filename="JACKETEK_Production_Tech_Pack_${parts[5]}.pdf"`,
      "Content-Length": statSync(file).size,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    createReadStream(file).pipe(res);
    return true;
  }
  throw new HttpError(404, "Not found.");
}

// Admin API for DEVELOPMENT tech packs from the live configurator (server/techpack/development.mjs).
// Mounted inside the admin block of server/index.mjs (admin session + X-Jacketek-Admin required).
//
//   POST /api/admin/techpack/development                         {config} → generate the next DEV-NN
//   GET  /api/admin/techpack/development/:designId/:revision/pdf   download (?inline=1 to open)
//
// The browser only ever gets ids and an API URL — never a file system path. The PDF is found by a
// validated design id and revision only.
import { createReadStream, statSync } from "node:fs";
import { DesignInputError } from "./designInput.mjs";
import { DevTechPackError, developmentPdfFile, generateDevelopmentTechPack } from "./development.mjs";

/** Returns true when the request was a development tech pack route (handled), false otherwise. */
export async function handleDevelopmentTechPack(req, res, { parts, url, outRoot, readJsonBody, send, HttpError }) {
  if (parts[2] !== "techpack" || parts[3] !== "development") return false;
  if (parts.length === 4 && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body || typeof body !== "object" || !body.config) throw new HttpError(400, "Send the current design as { config }.");
    try {
      const r = await generateDevelopmentTechPack(body.config, { outRoot });
      console.log(`development tech pack ${r.designId} ${r.revision} generated (size ${r.report.selectedSize}, ${r.pages} pages)`);
      const qa = r.report.qa;
      send(res, 200, {
        designId: r.designId,
        revision: r.revision,
        size: r.report.selectedSize,
        pages: r.pages,
        artwork: r.report.artwork.length,
        pdfUrl: `/api/admin/techpack/development/${r.designId}/${r.revision}/pdf`,
        packageRef: `development-techpacks/${r.designId}/${r.revision}`,
        qa: { designToSpec: { ok: qa.designToSpec.ok, checks: qa.designToSpec.checks.length }, specToDrawing: { ok: qa.specToDrawing.ok, checks: qa.specToDrawing.checks.length } },
      });
      return true;
    } catch (err) {
      if (err instanceof DesignInputError || err instanceof DevTechPackError) throw new HttpError(err.status, err.message, { issues: err.issues });
      throw err;
    }
  }
  if (parts.length === 7 && parts[6] === "pdf" && req.method === "GET") {
    const file = developmentPdfFile(outRoot, parts[4], parts[5]);
    if (!file) throw new HttpError(404, "Development tech pack not found.");
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${url.searchParams.get("inline") === "1" ? "inline" : "attachment"}; filename="JACKETEK-Development-Tech-Pack-${parts[4]}-${parts[5]}.pdf"`,
      "Content-Length": statSync(file).size,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    createReadStream(file).pipe(res);
    return true;
  }
  throw new HttpError(404, "Not found.");
}

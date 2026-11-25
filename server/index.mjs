#!/usr/bin/env node
// JACKETEK server: order persistence, the protected admin API and
// server-side Production PDF generation. In production it also serves the
// built website (dist/). Node built-ins only.
//
//   node server/index.mjs     settings from the environment or .env.local / .env:
//     ADMIN_KEY  the admin sign-in key (16+ characters)   PORT  default 8787
//     DATA_DIR   default ./server-data (database + PDFs)
//
// Public:  POST /api/orders                 — checkout places an order
// Accounts (server/auth.mjs; HttpOnly session cookie):
//          GET  /api/auth/session            — the signed-in customer, or null
//          POST /api/auth/signup             — create an account (email OR phone + password)
//          POST /api/auth/login              — log in with email OR phone + password
//          POST /api/auth/logout             — end this browser's session
// Group orders (server/groupRoutes.mjs; signed-in customers): /api/groups/…
// Admin (session cookie from POST /api/admin/login {key}):
//          GET  /api/admin/session                        — signed in?
//          POST /api/admin/logout
//          GET  /api/admin/orders                         — list
//          GET  /api/admin/orders/:id                     — one order + measurements + its PDFs
//          POST /api/admin/orders/:id/production-pdf      — generate / regenerate
//          GET  /api/admin/orders/:id/production-pdf/:file — download (?inline=1 to open)
//          GET  /api/admin/orders/:id/embroidery/:designId/(preview.svg|design.dst|metadata.json)
//          POST /api/admin/orders/:id/rfq {line}          — generate the next RFQ Tech Pack revision
//          GET  /api/admin/orders/:id/rfq/:line/latest.pdf — download the latest RFQ (?inline=1 to open)
//          POST /api/admin/techpack/development {config}  — development tech pack of the live design (DEV-NN)
//          GET  /api/admin/techpack/development/:designId/:revision/pdf — download it (?inline=1 to open)
//                                                          — auto-digitized embroidery (prototype)
//
// Nothing is ever sent to a supplier: the admin downloads the PDF.
import "./env.mjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { generateProductionPdf, MissingOrderDataError } from "../scripts/production-pdf.mjs";
import { AuthError, checkSameSite, currentUser, logIn, logOut, publicUser, signUp } from "./auth.mjs";
import { digitizeOrder } from "./digitize.mjs";
import { isLibraryTraversal, LIBRARY_URL, servableLibraryFile } from "./embroideryLibrary.mjs";
import { createOrder, DATA_DIR, DB_PATH, getDesign, getOrder, getProduction, listDesigns, listOrders, ORDER_ID, productionDir, saveDesign, saveProduction } from "./orders.mjs";
import { designIdOf, generateRFQTechPack, latestRfq, PDF_NAME as RFQ_PDF, RfqError, SPEC_NAME as RFQ_SPEC } from "./rfq/generate.mjs";
import { loadShared } from "./tsModule.mjs";
import { handleDevelopmentTechPack } from "./techpack/routes.mjs";
import { closeAfterResponse, HttpError, readJsonBody, send } from "./http.mjs";
import { handleGroups } from "./groupRoutes.mjs";
import { afterOrderPlaced, checkoutApprovals, handleProductionTechPack } from "./productionTechpack/routes.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** RFQ Tech Packs: <DATA_DIR>/techpacks/<designId>/RFQ-NN/ (server/rfq/generate.mjs). */
const TECHPACKS = join(DATA_DIR, "techpacks");

/** The latest RFQ of each order line: { line, designId, revision, generatedAt, warnings } or null. */
function rfqSummary(order) {
  return order.items.map((item, i) => {
    const designId = designIdOf(item);
    const latest = latestRfq(TECHPACKS, designId);
    if (!latest) return { line: i + 1, designId, revision: null };
    let generatedAt = null, warnings = null;
    try {
      const spec = JSON.parse(readFileSync(join(latest.dir, RFQ_SPEC), "utf8"));
      generatedAt = spec.meta.createdAt;
      warnings = spec.validation?.warnings?.length ?? null;
    } catch {
      // The PDF exists; its spec is unreadable: show the revision only.
    }
    return { line: i + 1, designId, revision: latest.revision, generatedAt, warnings };
  });
}
const DIST = join(ROOT, "dist");
const PORT = Number(process.env.PORT ?? 8787);
const ADMIN_KEY = process.env.ADMIN_KEY ?? "";

// ---------------------------------------------------------------------------
// Admin access: the key (from the environment) is exchanged once for a
// session — a random token in an HttpOnly, SameSite=Strict cookie that
// scripts can't read and other sites can't send. Wrong keys are slowed
// down; sessions last 12 hours (and end when the server restarts).

const digest = (s) => createHash("sha256").update(s).digest();
const failures = new Map();
const sessions = new Map(); // token -> expiry (ms)
const SESSION_MS = 12 * 60 * 60 * 1000;
const COOKIE = "jk_admin";

const cookieOf = (req) =>
  Object.fromEntries((req.headers.cookie ?? "").split(";").map((c) => c.trim().split("=")).filter((p) => p.length === 2))[COOKIE];

function sessionCookie(req, token, maxAge) {
  const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${maxAge}${secure}`;
}

function checkConfigured() {
  if (ADMIN_KEY.length < 16) throw new HttpError(503, "Admin is not configured (set ADMIN_KEY, 16+ characters, e.g. in .env.local).");
}

function login(req, key) {
  checkConfigured();
  const ip = req.socket.remoteAddress ?? "?";
  const now = Date.now();
  const recent = (failures.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 10) throw new HttpError(429, "Too many attempts. Try again in a minute.");
  if (typeof key !== "string" || !timingSafeEqual(digest(key), digest(ADMIN_KEY))) {
    failures.set(ip, [...recent, now]);
    throw new HttpError(401, "Wrong access key.");
  }
  const token = randomBytes(32).toString("hex");
  sessions.set(token, now + SESSION_MS);
  return token;
}

function requireAdmin(req) {
  checkConfigured();
  const token = cookieOf(req);
  const expiry = token ? sessions.get(token) : undefined;
  if (!expiry || expiry < Date.now()) {
    if (token) sessions.delete(token);
    throw new HttpError(401, "Please sign in.");
  }
  // State-changing requests must come from the admin page itself.
  if (req.method !== "GET" && req.headers["x-jacketek-admin"] !== "1") throw new HttpError(403, "Forbidden.");
}

/**
 * The LEGACY production-drawing size chart (production-drawing/data/official_size_chart.json,
 * 2026-10-02). It conflicts with the Master Garment Spec v0.1, which is the measurement source
 * for RFQs; shown in the admin only, labelled as legacy.
 */
function measurementsFor(size) {
  const chart = JSON.parse(readFileSync(join(ROOT, "production-drawing/data/official_size_chart.json"), "utf8").replace(/^﻿/, ""));
  const chartSize = size === "XXL" ? "2XL" : size;
  const row = chart.rows.find((r) => r.size === chartSize);
  return row
    ? { size: row.size, chestWidthFlat: row.chest_width_flat, jacketLength: row.jacket_length, sleeveLength: row.sleeve_length, source: "Legacy production-drawing chart (2026-10-02) — conflicts with the Master Garment Spec v0.1; not used for RFQs" }
    : null;
}

// ---------------------------------------------------------------------------
// Orders

const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Checks an order from checkout and rebuilds it on the server: the server
 * sets the ID, date, status, product and prices; the customer's details
 * are checked; each jacket's customisation is stored exactly as sent.
 */
async function acceptOrder(body) {
  const { PRICING, PRODUCT, MAX_QUANTITY } = await loadShared();
  const errors = [];
  const fullName = text(body?.customer?.fullName, 120);
  const phone = text(body?.customer?.phone, 40);
  const city = text(body?.delivery?.city, 120);
  const area = text(body?.delivery?.area, 120);
  const address = text(body?.delivery?.address, 500);
  const notes = text(body?.delivery?.notes, 1000);
  const method = body?.payment?.method;

  if (fullName.length < 2) errors.push("Full name is required.");
  if (!/^\+?\d{9,15}$/.test(phone.replace(/[\s\-().]/g, ""))) errors.push("A valid phone number is required.");
  if (!city) errors.push("City is required.");
  if (!area) errors.push("Area is required.");
  if (address.length < 5) errors.push("Full address is required.");
  if (method === "card") errors.push("Card payment isn't available yet. Please choose Cash on Delivery.");
  else if (method !== "cod") errors.push("Choose a payment method.");

  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0 || items.length > 20) errors.push("The order must contain 1–20 jackets.");
  items.forEach((item, i) => {
    const c = item?.customization;
    if (!c || typeof c !== "object" || !c.colours || !c.materials) errors.push(`Jacket ${i + 1}: its design is missing.`);
    else if (!c.size) errors.push(`Jacket ${i + 1}: no size selected.`);
    if (!Number.isInteger(item?.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY)
      errors.push(`Jacket ${i + 1}: invalid quantity.`);
  });
  if (errors.length) throw new HttpError(400, errors.join(" "), { errors });

  const unit = PRICING.jacketPrice;
  const lines = items.map((item) => ({
    productId: PRODUCT.id,
    productName: PRODUCT.name,
    size: item.customization.size,
    quantity: item.quantity,
    unitPrice: unit,
    lineTotal: unit === null ? null : Math.round(unit * item.quantity * 100) / 100,
    customization: item.customization,
  }));
  const subtotal = lines.some((l) => l.lineTotal === null)
    ? null
    : Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
  const delivery = PRICING.deliveryFee;
  return {
    createdAt: new Date().toISOString(),
    status: "pending",
    items: lines,
    pricing: {
      currency: PRICING.currency,
      subtotal,
      delivery,
      total: subtotal === null || delivery === null ? null : Math.round((subtotal + delivery) * 100) / 100,
    },
    customer: { fullName, phone },
    delivery: { city, area, address, notes },
    payment: { method: "cod", status: "due-on-delivery" },
  };
}

/** A row of the admin list (with a short summary of each jacket's design). */
const summary = (o, summariseDesign) => ({
  id: o.id,
  createdAt: o.createdAt,
  customerName: o.customer?.fullName,
  phone: o.customer?.phone,
  product: o.items?.map((i) => i.productName).join(", "),
  size: o.items?.map((i) => i.size).join(", "),
  quantity: o.items?.reduce((n, i) => n + (i.quantity ?? 0), 0),
  design: o.items?.map((i) =>
    summariseDesign(i.customization)
      .filter((r) => r.label !== "Size")
      .map((r) => `${r.label}: ${r.value}`)
      .join(" · ")
  ),
  paymentMethod: o.payment?.method,
  status: o.status,
  productionPdf: Boolean(getProduction(o.id)),
});

/**
 * Auto-digitizes the order's uploaded images that have no stored design yet
 * (or one from an older engine) and stores them. Orders placed before
 * digitizing existed get theirs the first time they're needed.
 */
async function ensureDesigns(order) {
  const stored = listDesigns(order.id);
  // A stored design is reused only at the size production now asks for.
  const sameSize = (s, job) => Math.abs(s.metadata.designWidthMm - job.widthMm) < 0.05 && Math.abs(s.metadata.designHeightMm - job.heightMm) < 0.05;
  const fresh = await digitizeOrder(order, {
    skip: (job, engine) => stored.some((s) => s.line === job.line && s.elementId === job.elementId && s.designId === job.designId && s.engine === engine && s.hasStitches && sameSize(s, job)),
  });
  for (const d of fresh) saveDesign(order.id, d);
  if (fresh.length) console.log(`digitized ${fresh.length} embroidery design${fresh.length > 1 ? "s" : ""} for ${order.id}`);
  return listDesigns(order.id);
}

/** Generates (or regenerates) every line's drawing; replaces the old files. */
async function generateForOrder(order) {
  const dir = productionDir(order.id);
  const staging = `${dir}.new`;
  rmSync(staging, { recursive: true, force: true });
  const designs = (await ensureDesigns(order)).map((d) => getDesign(order.id, d.designId));
  try {
    const files = [];
    for (let line = 0; line < order.items.length; line++) {
      const r = await generateProductionPdf(order, { lineIndex: line, outDir: staging, designs });
      files.push({ line, productionId: r.productionId, pdfName: r.pdfName, artwork: r.artworkFiles.map((f) => basename(f)), gaps: r.gaps });
    }
    rmSync(dir, { recursive: true, force: true });
    renameSync(staging, dir);
    const record = { generatedAt: new Date().toISOString(), files };
    saveProduction(order.id, record);
    return record;
  } catch (err) {
    rmSync(staging, { recursive: true, force: true });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Static site (production build)

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".glb": "model/gltf-binary", ".json": "application/json",
  ".woff2": "font/woff2", ".ttf": "font/ttf", ".ico": "image/x-icon", ".mp4": "video/mp4",
};

function serveStatic(req, res, path) {
  // The embroidery library is not part of dist/: it is served from its own
  // folder (runtime-assets/embroidery-library or EMBROIDERY_LIBRARY_DIR),
  // colour layers overlay first — see embroideryLibrary.mjs. Only files
  // inside those folders are reachable; anything else under the prefix is 404.
  if (path.startsWith(`${LIBRARY_URL}/`)) {
    const file = servableLibraryFile(path);
    if (!file) return send(res, 404, { error: "Not found." });
    res.writeHead(200, {
      "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": statSync(file).size,
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      // Library files are data (images / JSON), never pages: no scripts even if opened directly.
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    });
    return createReadStream(file).pipe(res);
  }
  if (!existsSync(DIST)) return send(res, 404, { error: "Not found. (Run `npm run build` to serve the site from here.)" });
  let file = resolve(DIST, `.${decodeURIComponent(path)}`);
  if (!file.startsWith(DIST + sep) && file !== DIST) return send(res, 403, { error: "Forbidden" });
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, "index.html"); // client-side routes
  res.writeHead(200, {
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    "Cache-Control": file.includes(`${sep}assets${sep}`) ? "public, max-age=31536000, immutable" : "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(file).pipe(res);
}

// ---------------------------------------------------------------------------
// Routes

async function handle(req, res) {
  // Before URL parsing resolves "..": a library path that tries to leave the
  // library is refused, never answered with the site page.
  if (isLibraryTraversal(req.url)) return send(res, 404, { error: "Not found." });
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  const parts = path.split("/").filter(Boolean);

  if (!path.startsWith("/api/")) {
    if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "Method not allowed.");
    return serveStatic(req, res, path);
  }

  if (path === "/api/orders" && req.method === "POST") {
    const body = await readJsonBody(req);
    // Explicit final-design approvals (optional; checked before anything is stored).
    const approvals = checkoutApprovals(body, HttpError);
    const order = createOrder(await acceptOrder(body));
    console.log(`order ${order.id} placed (${order.items.length} line${order.items.length > 1 ? "s" : ""})`);
    // Approved lines: Jacket ID + frozen snapshot recorded; Production Tech Pack generated in the background.
    afterOrderPlaced(order, approvals);
    // Digitize uploaded artwork in the background (never delays or fails checkout;
    // anything missed is digitized when the order is next opened).
    ensureDesigns(order).catch((err) => console.error(`digitizing ${order.id} failed:`, err));
    return send(res, 201, { order });
  }

  if (parts[0] === "api" && parts[1] === "groups") return handleGroups(req, res, url, parts);

  if (parts[0] === "api" && parts[1] === "auth") {
    if (path === "/api/auth/session" && req.method === "GET") return send(res, 200, { user: publicUser(currentUser(req)) });
    if (req.method !== "POST") throw new HttpError(405, "Method not allowed.");
    checkSameSite(req);
    if (path === "/api/auth/signup") {
      const { user, cookie } = await signUp(req, await readJsonBody(req, 16 * 1024));
      return send(res, 201, { user }, { "Set-Cookie": cookie });
    }
    if (path === "/api/auth/login") {
      const { user, cookie } = await logIn(req, await readJsonBody(req, 16 * 1024));
      return send(res, 200, { user }, { "Set-Cookie": cookie });
    }
    if (path === "/api/auth/logout") return send(res, 200, { ok: true }, { "Set-Cookie": logOut(req).cookie });
    throw new HttpError(404, "Not found.");
  }

  if (path === "/api/admin/login" && req.method === "POST") {
    const { key } = await readJsonBody(req);
    const token = login(req, key);
    return send(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(req, token, SESSION_MS / 1000) });
  }

  if (parts[0] === "api" && parts[1] === "admin") {
    requireAdmin(req);
    if (path === "/api/admin/session" && req.method === "GET") return send(res, 200, { ok: true });
    if (path === "/api/admin/logout" && req.method === "POST") {
      sessions.delete(cookieOf(req));
      return send(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(req, "", 0) });
    }
    // Development tech packs from the live configurator (engineering only, kept apart from order documents):
    // <DATA_DIR>/development-techpacks/<designId>/DEV-NN/.
    if (await handleDevelopmentTechPack(req, res, { parts, url, outRoot: join(DATA_DIR, "development-techpacks"), readJsonBody, send, HttpError })) return;
    const id = parts[3];
    if (parts[2] !== "orders") throw new HttpError(404, "Not found.");
    if (!id && req.method === "GET") {
      const { summariseDesign } = await loadShared();
      return send(res, 200, { orders: listOrders().map((o) => summary(o, summariseDesign)) });
    }
    if (!id || !ORDER_ID.test(id)) throw new HttpError(404, "Order not found.");
    const order = getOrder(id);
    if (!order) throw new HttpError(404, "Order not found.");

    if (parts.length === 4 && req.method === "GET") {
      let embroidery, embroideryError = null;
      try {
        embroidery = await ensureDesigns(order);
      } catch (err) {
        console.error(`digitizing ${id} failed:`, err);
        embroidery = listDesigns(id);
        embroideryError = "Auto-digitizing failed for this order.";
      }
      return send(res, 200, {
        order,
        measurements: order.items.map((i) => measurementsFor(i.size)),
        production: getProduction(id),
        rfq: rfqSummary(order),
        embroidery,
        embroideryError,
      });
    }

    // Digitized design files: preview.svg, design.dst, metadata.json
    if (parts[4] === "embroidery" && parts.length === 7 && req.method === "GET") {
      const d = getDesign(id, parts[5]);
      if (!d) throw new HttpError(404, "Design not found.");
      const file = parts[6];
      const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
      if (file === "preview.svg") {
        res.writeHead(200, { ...headers, "Content-Type": "image/svg+xml", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" });
        return res.end(d.previewSvg);
      }
      if (file === "design.dst") {
        res.writeHead(200, { ...headers, "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${d.designId}.dst"`, "Content-Length": d.dst.length });
        return res.end(d.dst);
      }
      if (file === "metadata.json") return send(res, 200, d.metadata, { "Content-Disposition": `attachment; filename="${d.designId}.json"` });
      throw new HttpError(404, "Not found.");
    }

    if (parts[4] === "production-pdf" && parts.length === 5 && req.method === "POST") {
      try {
        const production = await generateForOrder(order);
        console.log(`production PDF generated for ${id}`);
        return send(res, 200, { production });
      } catch (err) {
        if (err instanceof MissingOrderDataError) throw new HttpError(422, err.message, { missing: err.missing });
        throw err;
      }
    }

    // Customer Production Tech Pack (active master + approved snapshot): server/productionTechpack/routes.mjs.
    if (await handleProductionTechPack(req, res, { order, parts, url, readJsonBody, send, HttpError })) return;

    // RFQ Tech Pack: generated from the STORED order (never from request data).
    if (parts[4] === "rfq" && parts.length === 5 && req.method === "POST") {
      const body = await readJsonBody(req, 1024);
      const line = Number(body?.line ?? 1);
      if (!Number.isInteger(line) || line < 1 || line > order.items.length) throw new HttpError(400, "Invalid order line.");
      try {
        const r = await generateRFQTechPack(order, { lineIndex: line - 1, outRoot: TECHPACKS });
        console.log(`RFQ ${r.designId} ${r.revision} generated for ${id} line ${line}`);
        const v = r.validation;
        return send(res, 200, { line, designId: r.designId, revision: r.revision, pages: r.pages, errors: v.errors.length, warnings: v.warnings.map((w) => w.message), info: v.info.length, rfq: rfqSummary(order) });
      } catch (err) {
        if (err instanceof RfqError) throw new HttpError(err.status, err.message, { issues: err.issues });
        throw err;
      }
    }
    if (parts[4] === "rfq" && parts.length === 7 && parts[6] === "latest.pdf" && req.method === "GET") {
      const line = Number(parts[5]);
      if (!Number.isInteger(line) || line < 1 || line > order.items.length) throw new HttpError(404, "Order line not found.");
      const designId = designIdOf(order.items[line - 1]);
      const latest = latestRfq(TECHPACKS, designId);
      if (!latest) throw new HttpError(404, "No RFQ generated yet.");
      const file = join(latest.dir, RFQ_PDF);
      const name = `JACKETEK-RFQ-${designId}-${latest.revision}.pdf`;
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${url.searchParams.get("inline") === "1" ? "inline" : "attachment"}; filename="${name}"`,
        "Content-Length": statSync(file).size,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      return createReadStream(file).pipe(res);
    }

    if (parts[4] === "production-pdf" && parts.length === 6 && req.method === "GET") {
      const production = getProduction(id);
      const name = parts[5];
      if (!production?.files.some((f) => f.pdfName === name)) throw new HttpError(404, "PDF not generated yet.");
      const file = join(productionDir(id), name);
      if (!existsSync(file)) throw new HttpError(404, "PDF not found. Generate it again.");
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${url.searchParams.get("inline") === "1" ? "inline" : "attachment"}; filename="${name}"`,
        "Content-Length": statSync(file).size,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      return createReadStream(file).pipe(res);
    }
  }
  throw new HttpError(404, "Not found.");
}

createServer((req, res) => {
  handle(req, res).catch((err) => {
    const status = err instanceof HttpError || err instanceof AuthError ? err.status : 500;
    if (status === 500) console.error(err);
    const extra = err instanceof AuthError ? (err.fields ? { fields: err.fields } : {}) : (err.extra ?? {});
    if (!res.headersSent) send(res, status, { error: status === 500 ? "Something went wrong." : err.message, ...extra }, closeAfterResponse(req, res));
    else res.end();
  });
}).listen(PORT, () => {
  console.log(`JACKETEK server on http://localhost:${PORT} — database ${DB_PATH}`);
  if (ADMIN_KEY.length < 16) console.warn("ADMIN_KEY is not set (16+ characters, e.g. in .env.local): admin sign-in is disabled.");
});

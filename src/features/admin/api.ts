import type { Order } from "@/features/cart/types";
import type { DigitizedMetadata } from "@/features/embroidery/types";

/**
 * The admin API (server/index.mjs). Signing in exchanges the access key
 * for a session cookie (HttpOnly — this code never sees or stores it);
 * the browser then sends it with every admin request.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly missing: string[] = []
  ) {
    super(message);
  }
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    credentials: "same-origin",
    // Marks state-changing requests as coming from this page (the server
    // refuses them otherwise).
    headers: { ...(init.headers ?? {}), "X-Jacketek-Admin": "1" },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; missing?: string[] } | null;
    throw new ApiError(body?.error ?? `Request failed (${res.status}).`, res.status, body?.missing);
  }
  return res;
}

export async function login(key: string) {
  await call("/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
}

export async function logout() {
  await call("/logout", { method: "POST" }).catch(() => undefined);
}

/** True when this browser has a valid admin session. */
export async function hasSession() {
  try {
    await call("/session");
    return true;
  } catch {
    return false;
  }
}

export type OrderRow = {
  id: string;
  createdAt: string;
  customerName: string;
  phone: string;
  product: string;
  size: string;
  quantity: number;
  /** One line per jacket: "Body: Black · Cotton Fabric · Sleeves: …". */
  design: string[];
  paymentMethod: "cod" | "card";
  status: string;
  productionPdf: boolean;
};

export type Measurements = {
  size: string;
  chestWidthFlat: string;
  jacketLength: string;
  sleeveLength: string;
  source: string;
};

export type ProductionRecord = {
  generatedAt: string;
  files: { line: number; productionId: string; pdfName: string; artwork: string[]; gaps: string[] }[];
};

export async function fetchOrders() {
  const res = await call("/orders");
  return ((await res.json()) as { orders: OrderRow[] }).orders;
}

/** An auto-digitized embroidery design stored with the order (prototype). */
export type EmbroideryDesign = {
  line: number;
  elementId: string;
  designId: string;
  engine: string;
  createdAt: string;
  metadata: DigitizedMetadata;
};

export async function fetchOrder(id: string) {
  const res = await call(`/orders/${encodeURIComponent(id)}`);
  return (await res.json()) as {
    order: Order;
    measurements: (Measurements | null)[];
    production: ProductionRecord | null;
    rfq?: RfqLine[];
    embroidery: EmbroideryDesign[];
    embroideryError: string | null;
  };
}

/** The latest RFQ Tech Pack of an order line (revision null = none yet). */
export type RfqLine = { line: number; designId: string; revision: string | null; generatedAt?: string | null; warnings?: number | null };

/** Generates the next RFQ revision for an order line, from the stored order. */
export async function generateRfq(id: string, line: number) {
  const res = await call(`/orders/${encodeURIComponent(id)}/rfq`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ line }) });
  return (await res.json()) as { line: number; designId: string; revision: string; pages: number; errors: number; warnings: string[]; rfq: RfqLine[] };
}

/** The latest RFQ PDF of an order line (the session cookie authorises it). */
export const rfqPdfUrl = (id: string, line: number, inline = false) =>
  `/api/admin/orders/${encodeURIComponent(id)}/rfq/${line}/latest.pdf${inline ? "?inline=1" : ""}`;

/** A digitized design's file: the stitch preview, the DST, or its metadata. */
export const embroideryFileUrl = (id: string, designId: string, file: "preview.svg" | "design.dst" | "metadata.json") =>
  `/api/admin/orders/${encodeURIComponent(id)}/embroidery/${encodeURIComponent(designId)}/${file}`;

export async function generateProductionPdf(id: string) {
  const res = await call(`/orders/${encodeURIComponent(id)}/production-pdf`, { method: "POST" });
  return ((await res.json()) as { production: ProductionRecord }).production;
}

/** The PDF's address (the session cookie authorises it). */
export const productionPdfUrl = (id: string, pdfName: string, inline = false) =>
  `/api/admin/orders/${encodeURIComponent(id)}/production-pdf/${encodeURIComponent(pdfName)}${inline ? "?inline=1" : ""}`;

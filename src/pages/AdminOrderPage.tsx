import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import AdminShell from "@/features/admin/AdminShell";
import {
  ApiError,
  embroideryFileUrl,
  fetchOrder,
  generateProductionPdf,
  generateRfq,
  productionPdfUrl,
  rfqPdfUrl,
  type EmbroideryDesign,
  type Measurements,
  type ProductionRecord,
  type RfqLine,
} from "@/features/admin/api";
import { formatPrice } from "@/features/cart/pricing";
import type { Order } from "@/features/cart/types";
import { describeDesign, describeEmbroidery, type DesignField } from "@/features/configurator";
import { getColour } from "@/features/configurator/model/catalog";
import type { JacketConfig } from "@/features/configurator/model/types";
import { DIGITIZING_STATUS } from "@/features/embroidery/types";
import { ROUTES } from "@/lib/routes";

const PAYMENT = { cod: "Cash on delivery", card: "Card / Visa" } as const;

/** /admin/orders/:orderId — one order: everything the customer submitted, and its PDF. */
export default function AdminOrderPage() {
  return (
    <AdminShell>
      <OrderDetail />
    </AdminShell>
  );
}

function OrderDetail() {
  const { orderId = "" } = useParams();
  const [data, setData] = useState<{
    order: Order;
    measurements: (Measurements | null)[];
    embroidery: EmbroideryDesign[];
    embroideryError: string | null;
  } | null>(null);
  const [production, setProduction] = useState<ProductionRecord | null>(null);
  const [rfq, setRfq] = useState<RfqLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrder(orderId).then(
      (r) => {
        setData({ order: r.order, measurements: r.measurements, embroidery: r.embroidery ?? [], embroideryError: r.embroideryError ?? null });
        setProduction(r.production);
        setRfq(r.rfq ?? []);
      },
      (err: Error) => setError(err.message)
    );
  }, [orderId]);

  const order = data?.order;

  return (
    <>
      <Link to={ROUTES.adminOrders} className="jk-label jk-link text-jk-ink">
        ← All orders
      </Link>
      {error && <p className="mt-8 text-[14px] text-jk-accent">{error}</p>}
      {!order && !error && <p className="jk-label mt-8 text-jk-muted">Loading…</p>}
      {order && data && (
        <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
          <div className="min-w-0">
            <p className="jk-label-xs text-jk-muted">Order</p>
            <h1 className="mt-1 text-[25px] font-medium tracking-[0.06em]">{order.id}</h1>
            <p className="mt-1 text-[13px] text-jk-muted">
              Placed {new Date(order.createdAt).toLocaleString("en-GB")} · <span className="capitalize">{order.status}</span>
            </p>

            <Section title="Customer and delivery">
              <Rows
                rows={[
                  { label: "Name", value: order.customer.fullName },
                  { label: "Phone", value: order.customer.phone },
                  { label: "City", value: order.delivery.city },
                  { label: "Area", value: order.delivery.area },
                  { label: "Full address", value: order.delivery.address },
                  { label: "Delivery notes", value: order.delivery.notes || "—" },
                ]}
              />
            </Section>

            <Section title="Payment">
              <Rows
                rows={[
                  { label: "Method", value: PAYMENT[order.payment.method] ?? order.payment.method },
                  { label: "Payment status", value: order.payment.status.replace(/-/g, " ") },
                  { label: "Subtotal", value: formatPrice(order.pricing.subtotal) },
                  { label: "Delivery", value: formatPrice(order.pricing.delivery) },
                  { label: "Total", value: formatPrice(order.pricing.total) },
                ]}
              />
            </Section>

            {order.items.map((item, i) => {
              const m = data.measurements[i];
              const config = item.customization;
              return (
                <Section key={i} title={order.items.length > 1 ? `Jacket ${i + 1} of ${order.items.length}` : "Jacket"}>
                  <Rows
                    rows={[
                      { label: "Product", value: item.productName },
                      { label: "Quantity", value: String(item.quantity) },
                      { label: "Unit price", value: formatPrice(item.unitPrice) },
                      { label: "Line total", value: formatPrice(item.lineTotal) },
                    ]}
                  />

                  <SubTitle>Measurements — legacy chart</SubTitle>
                  {m ? (
                    <Rows
                      rows={[
                        { label: "Size", value: m.size },
                        { label: "Chest width flat", value: m.chestWidthFlat },
                        { label: "Jacket length", value: m.jacketLength },
                        { label: "Sleeve length", value: m.sleeveLength },
                        { label: "Source", value: `${m.source} (customers choose a size; no custom measurements are taken)` },
                      ]}
                    />
                  ) : (
                    <p className="py-2 text-[14px] text-jk-accent">No legacy-chart measurements for size “{item.size ?? "—"}”.</p>
                  )}

                  {describeDesign(config).map((group) => (
                    <div key={group.title}>
                      <SubTitle>{group.title}</SubTitle>
                      <Rows rows={group.fields} />
                    </div>
                  ))}

                  <SubTitle>Embroidery ({config.embroidery.length})</SubTitle>
                  {config.embroidery.length === 0 ? (
                    <p className="py-2 text-[14px]">None</p>
                  ) : (
                    config.embroidery.map((e, j) => (
                      <div key={e.id} className="mt-3 flex gap-5 border border-[rgb(var(--t-head)/.12)] bg-jk-raised/60 p-4">
                        {e.kind === "image" && e.image && (
                          <img
                            src={e.image.src}
                            alt={`Embroidery artwork ${j + 1}`}
                            className="h-24 w-24 shrink-0 border border-[rgb(var(--t-head)/.12)] bg-white object-contain p-1"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="jk-label-xs text-jk-muted">Element {j + 1}</p>
                          <Rows rows={describeEmbroidery(e)} />
                        </div>
                      </div>
                    ))
                  )}

                  <DigitizedDesigns
                    orderId={order.id}
                    config={config}
                    designs={data.embroidery.filter((d) => d.line === i)}
                    error={data.embroideryError}
                  />

                  <details className="mt-6">
                    <summary className="jk-label cursor-pointer text-jk-muted">Stored customisation data (JSON)</summary>
                    <pre className="mt-3 max-h-[420px] overflow-auto border border-[rgb(var(--t-head)/.15)] bg-jk-raised p-4 text-[12px] leading-[1.5]">
                      {JSON.stringify(config, (k, v) => (k === "src" && typeof v === "string" ? `${v.slice(0, 48)}… (${v.length} chars)` : v), 2)}
                    </pre>
                  </details>
                </Section>
              );
            })}
          </div>

          <aside className="lg:sticky lg:top-8 lg:self-start">
            <ProductionPanel orderId={order.id} production={production} onChange={setProduction} />
            <RfqPanel orderId={order.id} lines={rfq} onChange={setRfq} />
          </aside>
        </div>
      )}
    </>
  );
}

/**
 * Embroidery production (prototype): for every uploaded image, the original
 * artwork next to its auto-digitized stitch preview, the stitch data, and
 * the DST / metadata downloads. Placement on the jacket: production PDF, page 4.
 */
function DigitizedDesigns({
  orderId,
  config,
  designs,
  error,
}: {
  orderId: string;
  config: JacketConfig;
  designs: EmbroideryDesign[];
  error: string | null;
}) {
  // Images, and text set in a library font (digitized from its drawn lettering).
  const images = config.embroidery.filter((e) => (e.kind === "image" && e.image) || (e.kind === "text" && e.textStyle && e.text.trim()));
  if (!images.length) return null;
  const ground = getColour(config.colours.body).hex;
  return (
    <>
      <SubTitle>Embroidery production — auto-digitized</SubTitle>
      <p className="border border-jk-accent px-3 py-2 text-[13px] font-medium text-jk-accent">{DIGITIZING_STATUS}</p>
      {error && <p className="mt-2 text-[13px] text-jk-accent">{error}</p>}
      {designs.map((d) => {
        const el = config.embroidery.find((e) => e.id === d.elementId);
        const src = el?.image?.original?.src ?? el?.image?.src;
        const m = d.metadata;
        return (
          <div key={d.designId} className="mt-3 border border-[rgb(var(--t-head)/.12)] bg-jk-raised/60 p-4">
            <p className="jk-label-xs text-jk-muted">{d.designId}</p>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <figure>
                {src && <img src={src} alt="Original artwork" className="aspect-square w-full border border-[rgb(var(--t-head)/.12)] bg-white object-contain p-2" />}
                <figcaption className="jk-label-xs mt-2 text-jk-muted">Original artwork (source)</figcaption>
              </figure>
              <figure>
                <img
                  src={embroideryFileUrl(orderId, d.designId, "preview.svg")}
                  alt="Digitized embroidery preview"
                  className="aspect-square w-full border border-[rgb(var(--t-head)/.12)] object-contain p-2"
                  style={{ background: ground }}
                />
                <figcaption className="jk-label-xs mt-2 text-jk-muted">Digitized embroidery (stitch file)</figcaption>
              </figure>
            </div>
            <Rows
              rows={[
                { label: "Stitches", value: `${m.stitchCount.toLocaleString("en-US")} · ${m.threads.length} colours · ${m.trims} trims · ${m.jumps} jumps` },
                { label: "Stitch field", value: `${(m.widthMm / 10).toFixed(1)} × ${(m.heightMm / 10).toFixed(1)} cm (as sewn, ${m.rotationDeg}° applied)` },
                { label: "Design size", value: `${(m.designWidthMm / 10).toFixed(1)} × ${(m.designHeightMm / 10).toFixed(1)} cm` },
                { label: "Stitch types", value: (["fill", "satin", "running", "underlay"] as const).filter((t) => m.stitchTypes[t]).map((t) => `${t} ${m.stitchTypes[t]}`).join(" · ") },
                { label: "Threads", value: m.threads.map((t) => `${t.hex} (${t.types.join("/")})`).join(", ") },
                {
                  label: "Placement",
                  value: !m.placement
                    ? "—"
                    : m.placement.belowSpCm != null
                      ? `${m.placement.zoneName}, centred on the sleeve's outer side, ${m.placement.belowSpCm} cm below the shoulder point`
                      : `${m.placement.zoneName}, ${m.placement.fromCentreCm} cm from centre, ${m.placement.belowHpsCm} cm below HPS`,
                },
                ...(m.warnings.length ? [{ label: "Warnings", value: m.warnings.join(" ") }] : []),
              ]}
            />
            <div className="mt-3 flex gap-6">
              <a href={embroideryFileUrl(orderId, d.designId, "design.dst")} download className="jk-label jk-link text-jk-ink">Download DST</a>
              <a href={embroideryFileUrl(orderId, d.designId, "metadata.json")} download className="jk-label jk-link text-jk-ink">Metadata JSON</a>
            </div>
          </div>
        );
      })}
      {designs.length < images.length && !error && <p className="mt-2 text-[13px] text-jk-muted">Some artwork isn't digitized yet — reload the page.</p>}
      <p className="mt-2 text-[12px] text-jk-muted">Placement on the jacket: production PDF, page 4.</p>
    </>
  );
}

/**
 * GENERATE PRODUCTION PDF → OPEN / DOWNLOAD PRODUCTION PDF, REGENERATE.
 * Nothing is sent anywhere: the admin downloads the file and forwards it.
 */
function ProductionPanel({
  orderId,
  production,
  onChange,
}: {
  orderId: string;
  production: ProductionRecord | null;
  onChange: (p: ProductionRecord) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; missing: string[] } | null>(null);

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      onChange(await generateProductionPdf(orderId));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? {
              message: err.missing.length
                ? "Production PDF cannot be generated because the following order data is missing:"
                : err.message,
              missing: err.missing,
            }
          : { message: "Something went wrong.", missing: [] }
      );
    } finally {
      setBusy(false);
    }
  }, [orderId, onChange]);

  const gaps = [...new Set(production?.files.flatMap((f) => f.gaps) ?? [])];

  return (
    <div className="border border-[rgb(var(--t-head)/.14)] bg-jk-raised/70 p-6">
      <h2 className="jk-label">Production drawing</h2>
      <p className="mt-2 text-[13px] text-jk-muted">
        {production ? `Generated ${new Date(production.generatedAt).toLocaleString("en-GB")}` : "Not generated yet."}
      </p>

      {production ? (
        <div className="mt-6 flex flex-col gap-4">
          {production.files.map((f) => (
            <div key={f.pdfName}>
              {production.files.length > 1 && <p className="jk-label-xs mb-2 text-jk-muted">{f.productionId}</p>}
              <a href={productionPdfUrl(orderId, f.pdfName)} download={f.pdfName} className="jk-btn-primary w-full">
                Download production PDF
              </a>
              <a
                href={productionPdfUrl(orderId, f.pdfName, true)}
                target="_blank"
                rel="noopener"
                className="jk-label jk-link mt-3 inline-block text-jk-ink"
              >
                Open PDF
              </a>
              <p className="mt-2 break-all text-[12px] text-jk-muted">{f.pdfName}</p>
            </div>
          ))}
          <button type="button" onClick={generate} disabled={busy} className="jk-label jk-link self-start text-jk-ink disabled:text-jk-muted">
            {busy ? "Generating…" : "Regenerate PDF"}
          </button>
        </div>
      ) : (
        <button type="button" onClick={generate} disabled={busy} className="jk-btn-primary mt-6 w-full">
          {busy ? "Generating…" : "Generate production PDF"}
        </button>
      )}

      {error && (
        <div role="alert" className="mt-5 text-[13px] leading-[1.5] text-jk-accent">
          <p>{error.message}</p>
          {error.missing.length > 0 && (
            <ul className="mt-1">
              {error.missing.map((m) => (
                <li key={m}>- {m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {production?.files.some((f) => f.artwork.length) && (
        <p className="mt-6 text-[13px] leading-[1.5] text-jk-muted">
          Embroidery artwork files saved with the PDF: {production.files.flatMap((f) => f.artwork).join(", ")}.
        </p>
      )}
      {gaps.length > 0 && (
        <details className="mt-6">
          <summary className="jk-label cursor-pointer text-jk-muted">To be confirmed ({gaps.length})</summary>
          <p className="mt-2 text-[13px] leading-[1.5] text-jk-muted">
            No approved value or order data yet, so printed as “TO BE CONFIRMED” in the PDF: {gaps.join(", ")}.
          </p>
        </details>
      )}
      <p className="mt-6 text-[12px] leading-[1.5] text-jk-muted">
        Nothing is sent automatically — download the PDF and send it to the supplier yourself.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="jk-label border-b border-jk-ink pb-2">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function SubTitle({ children }: { children: ReactNode }) {
  return <h3 className="jk-label-xs mt-6 text-jk-ink">{children}</h3>;
}

function Rows({ rows }: { rows: DesignField[] }) {
  return (
    <dl>
      {rows.map(({ label, value, hex }) => (
        <div key={label} className="jk-dashed-bottom grid grid-cols-[minmax(120px,200px)_1fr] gap-4 py-2">
          <dt className="jk-label-xs leading-[22px] text-jk-muted">{label}</dt>
          <dd className="flex items-center gap-2 whitespace-pre-line text-[14px] leading-[22px] [overflow-wrap:anywhere]">
            {hex && <span aria-hidden="true" className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-[rgb(var(--t-head)/.2)]" style={{ background: hex }} />}
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * RFQ TECH PACK (development / admin only): generated on the server from the
 * stored order, never from the browser. Each generation is a new revision
 * (RFQ-01, RFQ-02 …); every RFQ is "NOT FOR BULK PRODUCTION".
 */
function RfqPanel({ orderId, lines, onChange }: { orderId: string; lines: RfqLine[]; onChange: (l: RfqLine[]) => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  const generate = useCallback(
    async (line: number) => {
      setBusy(line);
      setMessage(null);
      try {
        const r = await generateRfq(orderId, line);
        onChange(r.rfq);
        setMessage({ error: false, text: `${r.revision} generated (${r.pages} pages, ${r.warnings.length} open items).` });
      } catch (err) {
        setMessage({ error: true, text: err instanceof Error ? err.message : "Something went wrong." });
      } finally {
        setBusy(null);
      }
    },
    [orderId, onChange]
  );

  return (
    <div className="mt-6 border border-[rgb(var(--t-head)/.14)] bg-jk-raised/70 p-6">
      <h2 className="jk-label">RFQ Tech Pack</h2>
      <p className="mt-2 text-[13px] text-jk-muted">For supplier quotations — not for bulk production.</p>
      <div className="mt-5 flex flex-col gap-5">
        {lines.map((l) => (
          <div key={l.line}>
            {lines.length > 1 && <p className="jk-label-xs mb-2 text-jk-muted">Jacket {l.line}</p>}
            {l.revision ? (
              <>
                <a href={rfqPdfUrl(orderId, l.line)} download className="jk-btn-primary w-full">
                  Download latest RFQ ({l.revision})
                </a>
                <a href={rfqPdfUrl(orderId, l.line, true)} target="_blank" rel="noopener" className="jk-label jk-link mt-3 inline-block text-jk-ink">
                  Open PDF
                </a>
                <p className="mt-2 break-all text-[12px] text-jk-muted">
                  {l.designId}
                  {l.generatedAt ? ` · ${new Date(l.generatedAt).toLocaleString("en-GB")}` : ""}
                  {l.warnings != null ? ` · ${l.warnings} open items` : ""}
                </p>
                <button type="button" onClick={() => generate(l.line)} disabled={busy !== null} className="jk-label jk-link mt-3 text-jk-ink disabled:text-jk-muted">
                  {busy === l.line ? "Generating…" : "Generate new revision"}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => generate(l.line)} disabled={busy !== null} className="jk-btn-primary w-full">
                {busy === l.line ? "Generating…" : "Generate RFQ Tech Pack"}
              </button>
            )}
          </div>
        ))}
      </div>
      {message && (
        <p role={message.error ? "alert" : "status"} className={`mt-5 text-[13px] leading-[1.5] ${message.error ? "text-jk-accent" : "text-jk-muted"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

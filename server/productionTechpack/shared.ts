/**
 * Website geometry and catalogue used by the customer Production Tech Pack
 * (server/productionTechpack/). Bundled for Node with esbuild on first use
 * (geometry.mjs). It only READS the configurator's own code, so the artwork sizes
 * in the Tech Pack are computed exactly as the live 3D jacket computes them
 * (EmbroideryLayer → zoneContent), the same rule the R2 master used (CHG-04).
 */
import { BUTTON_FINISHES, FITS, MATERIALS, SIZES, THREADS, getColour } from "@/features/configurator/model/catalog";
import { EMBROIDERY_ZONES_BY_ID, LEGACY_ZONES, stitchGridSize, zoneContent } from "@/features/configurator/model/embroideryGeometry";
import type { EmbroideryElement } from "@/features/configurator/model/types";

export { SIZES };

/** The artwork's width / height exactly as the configurator fits it (same rule as src/features/techpack/build.ts). */
export function aspectOf(e: EmbroideryElement): number {
  if (e.kind === "text") {
    if (e.textArtwork) return e.textArtwork.widthPx / e.textArtwork.heightPx;
    return e.textStyle?.aspect ?? 1;
  }
  const img = e.image!;
  if (!img.asUploaded && img.processed) {
    const [w, h] = stitchGridSize(img.processed.widthPx, img.processed.heightPx);
    return w / h;
  }
  return img.aspect || 1;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Size (cm) and in-zone offset (cm, website zone frame: +x = zone's right as seen
 * facing the zone, +y = up) of one artwork element, or a legacy / unknown zone marker.
 */
export function artworkGeometry(e: EmbroideryElement) {
  const fixed = (EMBROIDERY_ZONES_BY_ID as Record<string, (typeof EMBROIDERY_ZONES_BY_ID)[keyof typeof EMBROIDERY_ZONES_BY_ID] | undefined>)[e.placement];
  const aspect = aspectOf(e);
  if (!fixed) {
    const legacy = (LEGACY_ZONES as Record<string, { name: string; productionKey: string } | undefined>)[e.placement];
    return { fixedZone: false, zoneId: e.placement, zoneName: legacy?.name ?? e.placement, productionKey: legacy?.productionKey ?? "UNKNOWN_ZONE", side: null, aspect, sizeCm: null, offsetCm: null, transform: null };
  }
  const c = zoneContent(fixed.box, aspect, e.inZone);
  return {
    fixedZone: true,
    zoneId: fixed.id,
    zoneName: fixed.name,
    productionKey: fixed.productionKey,
    side: fixed.side,
    aspect,
    sizeCm: [r2(c.size[0] * 100), r2(c.size[1] * 100)] as [number, number],
    offsetCm: [r2(c.offset[0] * 100), r2(c.offset[1] * 100)] as [number, number],
    transform: c.transform,
  };
}

export const catalog = {
  colour: (id: string | null | undefined) => {
    if (!id) return null;
    const c = getColour(id);
    return c && c.id === id ? { id: c.id, name: c.name, hex: c.hex } : null;
  },
  thread: (id: string | null | undefined) => {
    const t = id ? THREADS.find((x) => x.id === id) : undefined;
    return t ? { id: t.id, name: t.name, hex: t.hex } : null;
  },
  material: (id: string | null | undefined) => MATERIALS.find((m) => m.id === id)?.name ?? null,
  finish: (id: string | null | undefined) => {
    const f = BUTTON_FINISHES.find((b) => b.id === id);
    return f ? { id: f.id, name: f.name, hex: f.hex } : null;
  },
  fit: (id: string | null | undefined) => FITS.find((f) => f.id === id)?.name ?? null,
};

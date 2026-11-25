/**
 * Order → digitizing jobs: one per customer-uploaded image, with the size,
 * rotation, thread and placement the production sheet uses (so the stitch
 * file matches the PDF). Pure data; the server decodes the PNG.
 */
import type { Order } from "@/features/cart/types";
import type { ZoneSide } from "@/features/configurator/model/types";
import { orderToProductionOrder } from "@/features/production/orderToProductionOrder";
import { digitizeRaster, type Raster } from "./digitize";
import type { DigitizedDesign } from "./types";

export type EmbroideryJob = {
  line: number;
  elementId: string;
  designId: string;
  /** The processed transparent PNG (data URL) — the digitizer's input. */
  src: string;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
  singleThread: { hex: string; name: string } | null;
  /**
   * Designs with colour layers (added by the server: element.image.colourRegions):
   * the region map (data URL) and each layer's thread — the stitch colours.
   */
  colourRegions?: { regions: string; threads: { hex: string; name: string }[] } | null;
  placement: { zone: string; zoneName: string; side: ZoneSide; fromCentreCm: number; belowHpsCm: number; belowSpCm: number | null };
};

export function embroideryJobs(order: Order): EmbroideryJob[] {
  const jobs: EmbroideryJob[] = [];
  order.items.forEach((item, line) => {
    const { sheet } = orderToProductionOrder(order, line);
    if (!sheet) return;
    for (const img of sheet.images) {
      const el = item.customization.embroidery.find((e) => e.id === img.elementId);
      // Image designs: their file; text embroidery: its text drawn in its font (server).
      const src = el?.image?.src ?? el?.textArtwork?.src;
      if (!src) continue;
      jobs.push({
        line,
        elementId: img.elementId,
        designId: `EMB-${sheet.productionId}-${String(img.n).padStart(2, "0")}`,
        src,
        widthMm: img.widthCm * 10,
        heightMm: img.heightCm * 10,
        rotationDeg: img.rotation,
        singleThread: img.thread ? { hex: img.thread.hex, name: img.thread.name } : null,
        colourRegions: el?.image?.colourRegions ?? null,
        placement: { zone: img.zone, zoneName: img.zoneName, side: img.side, fromCentreCm: img.fromCentreCm, belowHpsCm: img.belowHpsCm, belowSpCm: img.belowSpCm },
      });
    }
  });
  return jobs;
}

export function digitizeJob(job: EmbroideryJob, raster: Raster, createdAt?: string, regionMap?: Raster | null): DigitizedDesign {
  return digitizeRaster(raster, {
    regions: regionMap && job.colourRegions ? { map: regionMap, threads: job.colourRegions.threads } : null,
    designId: job.designId,
    widthMm: job.widthMm,
    heightMm: job.heightMm,
    rotationDeg: job.rotationDeg,
    singleThread: job.singleThread,
    placement: job.placement,
    createdAt,
  });
}

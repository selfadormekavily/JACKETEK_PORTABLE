/**
 * BACKGROUND REMOVAL for uploaded embroidery designs.
 *
 * `backgroundRemover` is the one implementation the app uses. The
 * default runs entirely in the browser and suits logos / artwork on a
 * plain background. To use a service (e.g. an AI matting API) instead,
 * swap it for `createApiRemover(url)` — nothing else changes.
 */

export type CutoutQuality =
  /** Background was plain and has been removed. */
  | "removed"
  /** The upload already had transparency; it was kept. */
  | "kept"
  /** Background wasn't uniform — result may include some of it. */
  | "uncertain";

export type CutoutResult = {
  /** The isolated design, trimmed to its content, transparent around. */
  canvas: HTMLCanvasElement;
  quality: CutoutQuality;
};

export interface BackgroundRemover {
  readonly name: string;
  remove(image: HTMLCanvasElement): Promise<CutoutResult>;
}

// ---------------------------------------------------------------------------
// Client-side: flood-fill the background from the image border.

const colourDistance = (d: Uint8ClampedArray, i: number, c: readonly number[]) =>
  Math.hypot(d[i] - c[0], d[i + 1] - c[1], d[i + 2] - c[2]);

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export const edgeFloodRemover: BackgroundRemover = {
  name: "edge-flood",
  async remove(source) {
    const { width: w, height: h } = source;
    const ctx = source.getContext("2d", { willReadFrequently: true })!;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    const border: number[] = [];
    for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);

    // Already transparent around the design? Keep the artist's alpha.
    const clearBorder = border.filter((p) => d[p * 4 + 3] < 20).length;
    if (clearBorder > border.length * 0.5) return { canvas: trim(source), quality: "kept" };

    // Background colour = median of the border; tolerance from its spread.
    const bg = [0, 1, 2].map((c) => median(border.map((p) => d[p * 4 + c])));
    const spread = border.map((p) => colourDistance(d, p * 4, bg)).sort((a, b) => a - b);
    const p90 = spread[Math.floor(spread.length * 0.9)];
    const uniform = p90 < 45;
    const tol = Math.max(30, Math.min(80, p90 * 1.6));

    // Flood from every border pixel that looks like background.
    const state = new Uint8Array(w * h); // 0 unknown, 1 background
    const stack: number[] = [];
    for (const p of border) {
      if (!state[p] && colourDistance(d, p * 4, bg) < tol) {
        state[p] = 1;
        stack.push(p);
      }
    }
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w;
      const y = (p - x) / w;
      const next = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const n of next) {
        if (n >= 0 && !state[n] && colourDistance(d, n * 4, bg) < tol) {
          state[n] = 1;
          stack.push(n);
        }
      }
    }
    // Enclosed background (e.g. inside letters) that closely matches.
    for (let p = 0; p < w * h; p++) {
      if (!state[p] && colourDistance(d, p * 4, bg) < tol * 0.45) state[p] = 1;
    }

    // Apply, with a one-pixel soft edge against the background.
    for (let p = 0; p < w * h; p++) {
      if (state[p]) {
        d[p * 4 + 3] = 0;
        continue;
      }
      const x = p % w;
      const touchesBg =
        (x > 0 && state[p - 1]) || (x < w - 1 && state[p + 1]) || state[p - w] || state[p + w];
      if (touchesBg) d[p * 4 + 3] = Math.min(d[p * 4 + 3], 170);
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: trim(source), quality: uniform ? "removed" : "uncertain" };
  },
};

// ---------------------------------------------------------------------------
// Service-backed: POST the image, receive a transparent PNG.

export function createApiRemover(endpoint: string): BackgroundRemover {
  return {
    name: `api:${endpoint}`,
    async remove(source) {
      const blob = await new Promise<Blob>((resolve, reject) =>
        source.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/png")
      );
      const response = await fetch(endpoint, { method: "POST", body: blob });
      if (!response.ok) throw new Error(`Background removal failed (${response.status})`);
      const bitmap = await createImageBitmap(await response.blob());
      const out = document.createElement("canvas");
      out.width = bitmap.width;
      out.height = bitmap.height;
      out.getContext("2d")!.drawImage(bitmap, 0, 0);
      return { canvas: trim(out), quality: "removed" };
    },
  };
}

/** The remover the app uses. Swap for createApiRemover(...) to use a service. */
export const backgroundRemover: BackgroundRemover = edgeFloodRemover;

// ---------------------------------------------------------------------------

/** Crops a canvas to its non-transparent content, with a small margin. */
function trim(source: HTMLCanvasElement) {
  const { width: w, height: h } = source;
  const d = source.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  if (maxX < 0) return source; // nothing left — keep as is
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.03) + 1;
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1 + pad * 2;
  out.height = maxY - minY + 1 + pad * 2;
  out.getContext("2d")!.drawImage(source, minX, minY, maxX - minX + 1, maxY - minY + 1, pad, pad, maxX - minX + 1, maxY - minY + 1);
  return out;
}

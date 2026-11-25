import { CanvasTexture, RepeatWrapping, type Texture } from "three";
import type { Finish } from "@/features/configurator";

/**
 * Small procedural textures generated on a <canvas> at runtime — no
 * image files to download. Used as bump maps to give each finish its
 * surface character (felt, leather grain, knit rib).
 */

type BumpFinish = Exclude<Finish, "thread">;

const cache: Partial<Record<BumpFinish, Texture>> = {};

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return { canvas, ctx };
}

function toTexture(canvas: HTMLCanvasElement, repeatX: number, repeatY: number) {
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  return texture;
}

/**
 * Tileable value noise over a `size`-pixel square with `cells` lattice
 * cells per side (smooth, wraps seamlessly). Returns 0–1.
 */
function tileNoise(size: number, cells: number) {
  const grid = Array.from({ length: cells * cells }, () => Math.random());
  const g = (i: number, j: number) => grid[(((j % cells) + cells) % cells) * cells + (((i % cells) + cells) % cells)];
  return (x: number, y: number) => {
    const fx = (x / size) * cells;
    const fy = (y / size) * cells;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = g(i, j);
    const b = g(i + 1, j);
    const c = g(i, j + 1);
    const d = g(i + 1, j + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

/** Felt: soft fibre fuzz over gentle density mottling (stand-in jacket). */
function feltBump() {
  const size = 256;
  const { canvas, ctx } = createCanvas(size, size);
  const image = ctx.createImageData(size, size);
  const mottle = tileNoise(size, 6);
  const fuzz = tileNoise(size, 48);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = 96 + mottle(x, y) * 40 + fuzz(x, y) * 50 + Math.random() * 24;
      const i = (y * size + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return toTexture(canvas, 8, 8);
}

/** Soft pebbled grain for leather. */
function leatherBump() {
  const size = 256;
  const { canvas, ctx } = createCanvas(size, size);
  ctx.fillStyle = "rgb(128,128,128)";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) {
    const r = 1.5 + Math.random() * 3.5;
    const shade = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},0.07)`;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(canvas, 6, 6);
}

/** Vertical knit ribs (cylinder UVs run around the circumference). */
function ribBump() {
  const width = 64;
  const { canvas, ctx } = createCanvas(width, 4);
  for (let x = 0; x < width; x++) {
    const v = Math.round(128 + 90 * Math.sin((x / width) * Math.PI * 2 * 4));
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, 0, 1, 4);
  }
  return toTexture(canvas, 14, 1);
}

const FACTORIES: Record<BumpFinish, () => Texture> = {
  felt: feltBump,
  leather: leatherBump,
  rib: ribBump,
};

export function getFinishBump(finish: Finish): Texture | null {
  if (finish === "thread") return null;
  return (cache[finish] ??= FACTORIES[finish]());
}

// ---------------------------------------------------------------------------
// Roughness micro-variation (for GLBs). A roughness map multiplies the
// material's roughness, so these sit close to white: they don't change
// how rough a surface is overall, they break up its highlight — which is
// what makes leather grain and felt read, and it works alongside
// the asset's own normal map (a bump map would be ignored there).

const roughCache: Partial<Record<BumpFinish, Texture>> = {};

/** Leather: pebbled grain, the pebble tops slightly smoother. */
function leatherRoughness() {
  const size = 256;
  const { canvas, ctx } = createCanvas(size, size);
  ctx.fillStyle = "rgb(242,242,242)";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const r = 1 + Math.random() * 2.6;
    const v = Math.random() > 0.55 ? 205 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(canvas, 22, 22);
}

/**
 * Felt: no weave — pressed fibres. Soft, irregular density mottling
 * (natural variation across the cloth) plus fine fibre noise, all kept
 * near white so the surface stays uniformly matte.
 */
function feltRoughness() {
  const size = 256;
  const { canvas, ctx } = createCanvas(size, size);
  const image = ctx.createImageData(size, size);
  const mottle = tileNoise(size, 5);
  const cloud = tileNoise(size, 14);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = 214 + mottle(x, y) * 22 + cloud(x, y) * 12 + Math.random() * 9;
      const i = (y * size + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = Math.min(255, v);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return toTexture(canvas, 6, 6);
}

/** Knit rib: soft variation along the ribs. */
function ribRoughness() {
  const width = 64;
  const { canvas, ctx } = createCanvas(width, 4);
  for (let x = 0; x < width; x++) {
    const v = Math.round(236 + 19 * Math.sin((x / width) * Math.PI * 2 * 4));
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, 0, 1, 4);
  }
  return toTexture(canvas, 40, 1);
}

const ROUGH_FACTORIES: Record<BumpFinish, () => Texture> = {
  felt: feltRoughness,
  leather: leatherRoughness,
  rib: ribRoughness,
};

export function getFinishRoughness(finish: Finish): Texture | null {
  if (finish === "thread") return null;
  return (roughCache[finish] ??= ROUGH_FACTORIES[finish]());
}

// ---------------------------------------------------------------------------
// Detail normal maps (for GLBs): fine surface texture — leather grain,
// felt fibres, knit — layered over the asset's own normal map in the
// shader (see materialMapping.ts). Tangent-space, tileable.

const detailCache: Partial<Record<BumpFinish, Texture>> = {};

/** Tileable height field → tangent-space normal map texture. */
function heightToNormal(size: number, height: (x: number, y: number) => number, strength: number) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = height(x, y);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  const { canvas, ctx } = createCanvas(size, size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = -(at(x + 1, y) - at(x - 1, y)) * strength;
      const ny = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** Leather: irregular pebbled cells (tileable Voronoi-style grain). */
function leatherDetail() {
  const size = 256;
  const points: [number, number][] = [];
  for (let i = 0; i < 420; i++) points.push([Math.random() * size, Math.random() * size]);
  return heightToNormal(
    size,
    (x, y) => {
      let d1 = Infinity;
      let d2 = Infinity;
      for (const [px, py] of points) {
        const dx = Math.min(Math.abs(x - px), size - Math.abs(x - px));
        const dy = Math.min(Math.abs(y - py), size - Math.abs(y - py));
        const d = dx * dx + dy * dy;
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) d2 = d;
      }
      // Raised pebbles with creases between them.
      return Math.min(1, (Math.sqrt(d2) - Math.sqrt(d1)) / 5);
    },
    0.9
  );
}

/**
 * Felt: a fuzzy micro-relief of matted fibres — multi-scale noise with
 * short, randomly oriented fibre strands pressed into it. No regular
 * pattern, so nothing reads as woven or printed.
 */
function feltDetail() {
  const size = 256;
  const fibres = new Float32Array(size * size);
  for (let n = 0; n < 1600; n++) {
    const angle = Math.random() * Math.PI;
    const length = 3 + Math.random() * 9;
    const x0 = Math.random() * size;
    const y0 = Math.random() * size;
    for (let s = 0; s < length; s++) {
      const x = Math.round(x0 + Math.cos(angle) * s);
      const y = Math.round(y0 + Math.sin(angle) * s);
      fibres[(((y % size) + size) % size) * size + (((x % size) + size) % size)] += 0.35;
    }
  }
  const coarse = tileNoise(size, 16);
  const fine = tileNoise(size, 64);
  return heightToNormal(
    size,
    (x, y) =>
      coarse(x, y) * 0.5 + fine(x, y) * 0.35 + Math.min(0.6, fibres[y * size + x]) + Math.random() * 0.12,
    1.0
  );
}

/** Knit rib: vertical ribs. */
function ribDetail() {
  const size = 64;
  return heightToNormal(size, (x) => Math.abs(Math.sin((x / size) * Math.PI * 4)), 2.2);
}

const DETAIL_FACTORIES: Record<BumpFinish, () => Texture> = {
  felt: feltDetail,
  leather: leatherDetail,
  rib: ribDetail,
};

export function getFinishDetailNormal(finish: Finish): Texture | null {
  if (finish === "thread") return null;
  return (detailCache[finish] ??= DETAIL_FACTORIES[finish]());
}

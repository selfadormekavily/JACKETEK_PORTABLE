import { CanvasTexture, SRGBColorSpace } from "three";

/**
 * EMBROIDERY MATERIAL MAPS — generated at runtime on <canvas>, no files.
 *
 * Everything derives from a STITCH SOURCE: an alpha mask (where thread
 * is), a colour per pixel, and a REGION id per pixel (areas sewn as one
 * block of stitches). Text is one source (one region, one colour); an
 * uploaded image is another (its own pixels, unchanged; tonal areas as
 * regions for the relief only). From the source:
 *
 *   height   a raised body per stroke (steep edge wall, rounded satin
 *            top, a groove where two regions meet) + thread ridges and
 *            stitch ends, each scaled to the artwork's feature size
 *   normal   derived from the height → raised look, stitch detail
 *   colour   thread colour, shaded along the stitches, alpha = mask
 *   rough    matte thread; ridge tops a touch smoother than the grooves
 *   ao       occlusion in grooves and between threads (lighting only)
 *   shadow   soft blurred mask, offset down: contact shadow on the fabric
 *            (greyscale, for use as an alphaMap)
 *
 * The output textures are plain canvases, so a finished design can later
 * be baked/exported for production from the same data.
 */

export type EmbroideryMaps = {
  map: CanvasTexture;
  normalMap: CanvasTexture;
  roughnessMap: CanvasTexture;
  aoMap: CanvasTexture;
  shadowMap: CanvasTexture;
  /** width / height of the stitched artwork. */
  aspect: number;
  dispose: () => void;
};

type StitchSource = {
  width: number;
  height: number;
  /** 0–1 coverage per pixel. */
  alpha: Float32Array;
  /** RGB per pixel (0–255). */
  rgb: Uint8ClampedArray;
  /** Region id per pixel. */
  region: Uint8Array;
  /** Typical stroke width in pixels (drives relief and stitch size). */
  feature: number;
  /**
   * Satin stitches follow each stroke (lettering), instead of one fixed
   * angle per colour block (images).
   */
  directional?: boolean;
  /**
   * Colour map = `rgb` exactly (an uploaded image keeps its own pixels);
   * the embroidered look then comes only from relief, sheen and shadow.
   */
  exactColour?: boolean;
};

function canvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas unavailable");
  return { c, ctx };
}

/** Alpha channel of a canvas as 0–1 floats. */
function alphaOf(c: HTMLCanvasElement) {
  const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  const out = new Float32Array(c.width * c.height);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 3] / 255;
  return out;
}

/** A blurred (and optionally offset) copy of a coverage mask. */
function blurred(alpha: Float32Array, width: number, height: number, radius: number, dx = 0, dy = 0) {
  const { c: src, ctx: sctx } = canvas(width, height);
  const img = sctx.createImageData(width, height);
  for (let i = 0; i < alpha.length; i++) img.data[i * 4 + 3] = alpha[i] * 255;
  sctx.putImageData(img, 0, 0);
  const { c, ctx } = canvas(width, height);
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(src, dx, dy);
  return alphaOf(c);
}

function texture(c: HTMLCanvasElement, srgb: boolean) {
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Deterministic hash noise in [0, 1) — stable between rebuilds. */
const noise = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Direction ACROSS the stroke at every pixel (radians, mod π) — the way
 * a satin stitch runs, edge to edge. From the structure tensor of the
 * mask, which (unlike a plain gradient) stays stable through the middle
 * of a stroke, where the two edges' gradients cancel out.
 */
function strokeOrientation(alpha: Float32Array, width: number, height: number, feature: number) {
  const base = blurred(alpha, width, height, Math.max(1, feature * 0.25));
  const n = width * height;
  const xx = new Float32Array(n);
  const yy = new Float32Array(n);
  const xy = new Float32Array(n);
  let max = 1e-6;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx = base[i + 1] - base[i - 1];
      const gy = base[i + width] - base[i - width];
      xx[i] = gx * gx;
      yy[i] = gy * gy;
      xy[i] = gx * gy;
      max = Math.max(max, xx[i], yy[i]);
    }
  }
  // Normalise into 0–1 for the (8-bit) canvas blur; xy is signed.
  for (let i = 0; i < n; i++) {
    xx[i] /= max;
    yy[i] /= max;
    xy[i] = (xy[i] / max) * 0.5 + 0.5;
  }
  const r = Math.max(2, feature * 0.45);
  const bxx = blurred(xx, width, height, r);
  const byy = blurred(yy, width, height, r);
  const bxy = blurred(xy, width, height, r);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const sxy = (bxy[i] - 0.5) * 2;
    out[i] = 0.5 * Math.atan2(2 * sxy, bxx[i] - byy[i]);
  }
  return out;
}

/** Stitch angles are laid in steps, like a machine's fill directions. */
const ANGLE_STEP = Math.PI / 12;

/**
 * Relief strengths, independent of the texture's pixel size (a 2048px
 * upload and 192px lettering get the same physical relief):
 *   MACRO  the stitched body — raised edge wall and rounded top — per
 *          unit of the artwork's feature size
 *   MICRO  thread ridges per unit of their spacing
 *   FIBRE  fixed per-pixel fuzz
 */
const MACRO_RELIEF = 0.5;
const MICRO_RELIEF = 0.14;
const FIBRE_RELIEF = 0.2;
/** Fill stitch length, in thread spacings (images: tatami-like rows). */
const STITCH_LENGTH = 4;

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Ambient occlusion from a height field: points lower than their
 * surroundings (grooves between blocks, between threads) receive less
 * ambient and environment light. Lighting only — colours are untouched.
 */
function cavityOcclusion(heightField: Float32Array, width: number, height: number, radius: number, depth: number) {
  const avg = blurred(heightField, width, height, radius);
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = 1 - Math.min(0.55, Math.max(0, avg[i] - heightField[i]) * depth);
  return out;
}

function buildMaps(src: StitchSource): EmbroideryMaps {
  const { width, height, alpha, rgb, region, feature, directional = false, exactColour = false } = src;
  const across = directional ? strokeOrientation(alpha, width, height, feature) : null;

  // Stroke "pillow": a blur of the mask, relative to stroke weight.
  const pillow = blurred(alpha, width, height, Math.max(1.5, feature * 0.3));
  // The thread's side wall: the mask, barely softened — a short, steep
  // rise from the fabric that gives the stitching visible thickness.
  const wall = blurred(alpha, width, height, Math.max(0.75, feature * 0.05));
  // Contact shadow: wider blur, nudged down and right (light from above)…
  const shade = blurred(alpha, width, height, Math.max(3, feature * 0.6), feature * 0.12, feature * 0.3);
  // …and a tight one hugging the edge, where the thread meets the fabric.
  const contact = blurred(alpha, width, height, Math.max(1, feature * 0.08), feature * 0.02, feature * 0.05);

  // Where one colour block meets another: a groove, softened to a
  // physical width so it reads at any texture resolution.
  const seam = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (alpha[i] === 0) continue;
      const r = region[i];
      seam[i] =
        (x > 0 && alpha[i - 1] > 0 && region[i - 1] !== r) ||
        (x < width - 1 && alpha[i + 1] > 0 && region[i + 1] !== r) ||
        (y > 0 && alpha[i - width] > 0 && region[i - width] !== r) ||
        (y < height - 1 && alpha[i + width] > 0 && region[i + width] !== r)
          ? 1
          : 0;
    }
  }
  const groove = blurred(seam, width, height, Math.max(0.75, feature * 0.06));

  const period = Math.max(3, feature * 0.26);
  /** The stitched body: wall, rounded top, grooves (0 = fabric). */
  const macro = new Float32Array(width * height);
  /** Thread ridges and stitch ends on top of the body (0–1). */
  const micro = new Float32Array(width * height);
  const stitch = new Float32Array(width * height);
  /** Satin sheen: strokes at different angles catch the light differently. */
  const sheen = new Float32Array(width * height).fill(1);
  const at = (x: number, y: number) => y * width + x;
  // Satin stitches: fine parallel ridges; each region is sewn at its own
  // angle, as a real machine would, which keeps shapes readable.
  const cosR = Array.from({ length: 256 }, (_, r) => Math.cos(((58 + r * 47) * Math.PI) / 180));
  const sinR = Array.from({ length: 256 }, (_, r) => Math.sin(((58 + r * 47) * Math.PI) / 180));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = at(x, y);
      if (wall[i] === 0) continue;
      // Body: a steep edge wall up to 40% of the height, then a rounded
      // (satin-pillow) top; grooves where colour blocks meet.
      const body = smoothstep(0.1, 0.9, wall[i]);
      const top = Math.sqrt(Math.min(1, Math.max(0, (pillow[i] - 0.5) * 2)));
      macro[i] = body * (0.4 + 0.6 * top) * (1 - 0.3 * Math.min(1, groove[i] * 2.5));
      if (alpha[i] === 0) continue;
      let cosA = cosR[region[i]];
      let sinA = sinR[region[i]];
      if (across) {
        // Threads run across the stroke; neighbouring threads sit side by
        // side along it — so the ridge coordinate runs along the stroke.
        const along = Math.round((across[i] + Math.PI / 2) / ANGLE_STEP) * ANGLE_STEP;
        cosA = Math.cos(along);
        sinA = Math.sin(along);
        sheen[i] = 0.9 + 0.1 * Math.cos(2 * (along - 0.5));
      }
      const u = (x * cosA + y * sinA) / period;
      const row = Math.floor(u);
      const jitter = noise(row + region[i] * 31, Math.floor((y * cosA - x * sinA) / 6)) * 0.35;
      const s = 0.5 + 0.5 * Math.cos((u - row - 0.5 + jitter * 0.3) * Math.PI * 2);
      stitch[i] = s;

      let thread = s;
      if (!across) {
        // Fill stitches have a length: needle points along each row,
        // staggered from row to row.
        const v = (y * cosA - x * sinA) / (period * STITCH_LENGTH) + noise(row, region[i] * 7 + 3);
        thread *= 1 - 0.45 * Math.pow(Math.abs(2 * (v - Math.floor(v)) - 1), 8);
      }
      // Uneven thread tension from row to row.
      thread *= 0.88 + 0.12 * noise(row * 1.7, region[i] + 11);
      // Lettering: softer ridges (they read as sheen at viewing distance,
      // not as grooves); image blocks keep their crisper relief.
      micro[i] = thread * smoothstep(0.1, 0.9, wall[i]) * (across ? 0.75 : 1);
    }
  }

  const { c: normalC, ctx: normalCtx } = canvas(width, height);
  const { c: colourC, ctx: colourCtx } = canvas(width, height);
  const { c: roughC, ctx: roughCtx } = canvas(width, height);
  const { c: shadowC, ctx: shadowCtx } = canvas(width, height);
  const normalImg = normalCtx.createImageData(width, height);
  const colourImg = colourCtx.createImageData(width, height);
  const roughImg = roughCtx.createImageData(width, height);
  const shadowImg = shadowCtx.createImageData(width, height);
  const { c: aoC, ctx: aoCtx } = canvas(width, height);
  const aoImg = aoCtx.createImageData(width, height);

  const clampedAt = (x: number, y: number) => at(Math.min(width - 1, Math.max(0, x)), Math.min(height - 1, Math.max(0, y)));
  /** Slope of a field along x and y (central differences, × strength). */
  const slope = (f: Float32Array, x: number, y: number, k: number) => [
    (f[clampedAt(x + 1, y)] - f[clampedAt(x - 1, y)]) * 0.5 * k,
    (f[clampedAt(x, y + 1)] - f[clampedAt(x, y - 1)]) * 0.5 * k,
  ];
  // Relief strength, scaled to the artwork's own feature size: a clearly
  // raised body with steep sides, finer thread ridges on top.
  const macroK = feature * MACRO_RELIEF;
  const microK = period * MICRO_RELIEF;

  // Occlusion: grooves and the valleys between threads (height in body units).
  const aoHeight = new Float32Array(width * height);
  for (let i = 0; i < aoHeight.length; i++) aoHeight[i] = macro[i] * 0.85 + micro[i] * 0.15;
  const ao = cavityOcclusion(aoHeight, width, height, Math.max(1, feature * 0.15), 2.2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = at(x, y);
      const p = i * 4;

      // Normal (tangent space, +Y up; canvas y runs down).
      const [mx, my] = slope(macro, x, y, macroK);
      const [tx, ty] = slope(micro, x, y, microK);
      const fibre = alpha[i] * FIBRE_RELIEF;
      const fx = (noise(x + 1, y) - noise(x - 1, y)) * 0.5 * fibre;
      const fy = (noise(x, y + 1) - noise(x, y - 1)) * 0.5 * fibre;
      const nx = -(mx + tx + fx);
      const ny = my + ty + fy;
      const len = Math.hypot(nx, ny, 1);
      normalImg.data[p] = ((nx / len) * 0.5 + 0.5) * 255;
      normalImg.data[p + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      normalImg.data[p + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      normalImg.data[p + 3] = 255;

      // Colour: thread, a touch darker in the grooves and at stroke edges
      // (kept close to the true thread colour — light threads stay light).
      const a = alpha[i];
      const shadeF = exactColour ? 1 : (0.9 + 0.1 * stitch[i]) * (0.92 + 0.08 * pillow[i]) * sheen[i];
      colourImg.data[p] = rgb[i * 3] * shadeF;
      colourImg.data[p + 1] = rgb[i * 3 + 1] * shadeF;
      colourImg.data[p + 2] = rgb[i * 3 + 2] * shadeF;
      colourImg.data[p + 3] = a * 255;

      // Roughness (green channel): matte thread; the ridge tops keep only a
      // faint, broad highlight.
      const rough = a > 0 ? 0.92 - 0.1 * stitch[i] * pillow[i] : 0.95;
      roughImg.data[p] = roughImg.data[p + 1] = roughImg.data[p + 2] = rough * 255;
      roughImg.data[p + 3] = 255;

      // Contact shadow: a soft cast shadow plus a tight one at the foot of
      // the raised edge.
      const s = 1 - (1 - Math.min(1, shade[i] * 1.2) * 0.55) * (1 - Math.min(1, contact[i] * 1.3) * 0.4);
      shadowImg.data[p] = shadowImg.data[p + 1] = shadowImg.data[p + 2] = s * 255;
      shadowImg.data[p + 3] = 255;

      aoImg.data[p] = aoImg.data[p + 1] = aoImg.data[p + 2] = ao[i] * 255;
      aoImg.data[p + 3] = 255;
    }
  }

  normalCtx.putImageData(normalImg, 0, 0);
  colourCtx.putImageData(colourImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);
  shadowCtx.putImageData(shadowImg, 0, 0);
  aoCtx.putImageData(aoImg, 0, 0);

  const maps = {
    map: texture(colourC, true),
    normalMap: texture(normalC, false),
    roughnessMap: texture(roughC, false),
    aoMap: texture(aoC, false),
    shadowMap: texture(shadowC, false),
  };
  return {
    ...maps,
    aspect: width / height,
    dispose: () => Object.values(maps).forEach((t) => t.dispose()),
  };
}

const hexRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// ---------------------------------------------------------------------------
// Text

const TEXT_HEIGHT_PX = 192;
const MAX_WIDTH_PX = 2048;
const FONT = (size: number) =>
  `800 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
/** Cap height of the lettering as a share of the canvas height. */
const FONT_SHARE = 0.62;

/**
 * Text embroidery. The artwork's width follows the text, so letters
 * always have the same size whatever their count (see `aspect`).
 */
export function createTextEmbroidery(text: string, threadHex: string): EmbroideryMaps {
  const height = TEXT_HEIGHT_PX;
  const fontSize = height * FONT_SHARE;
  const probe = canvas(8, 8).ctx;
  probe.font = FONT(fontSize);
  (probe as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0.07em";
  const width = Math.min(
    MAX_WIDTH_PX,
    Math.max(64, Math.ceil(probe.measureText(text).width + fontSize * 0.9))
  );

  const { c, ctx } = canvas(width, height);
  ctx.font = FONT(fontSize);
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0.07em";
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const x = width / 2;
  const y = height / 2 + fontSize * 0.04;
  ctx.fillText(text, x, y);
  // Embolden: embroidery lettering is chunkier than print (and system
  // fallbacks like Arial Bold are too light to carry satin stitches).
  // Kept modest so an "i"'s dot never fuses with its stem.
  ctx.lineWidth = fontSize * 0.035;
  ctx.lineJoin = "round";
  ctx.strokeText(text, x, y);

  const alpha = alphaOf(c);
  const [r, g, b] = hexRgb(threadHex);
  const rgb = new Uint8ClampedArray(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
  }
  return buildMaps({
    width,
    height,
    alpha,
    rgb,
    region: new Uint8Array(width * height),
    feature: fontSize * 0.15,
    directional: true,
  });
}

/**
 * Lettering already set in its font (src/features/embroidery/text/textArtwork.ts:
 * the shaped glyphs as a coverage mask) → satin-stitched text in one thread,
 * stitches running across each stroke — the same build as the text above.
 */
export function createLetteringEmbroidery(mask: HTMLCanvasElement, threadHex: string, strokePx: number): EmbroideryMaps {
  const { width, height } = mask;
  const alpha = alphaOf(mask);
  const [r, g, b] = hexRgb(threadHex);
  const rgb = new Uint8ClampedArray(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
  }
  return buildMaps({
    width,
    height,
    alpha,
    rgb,
    region: new Uint8Array(width * height),
    // The stroke itself sets relief and stitch size (thin scripts → finer stitches).
    feature: Math.max(4, strokePx),
    directional: true,
  });
}

// ---------------------------------------------------------------------------
// Image

/** Longest side the image's texture is built at (GPU-friendly; the file itself is untouched). */
const IMAGE_TEXTURE_MAX_PX = 2048;

/**
 * Image embroidery from the customer's uploaded image, shown AS IS: the
 * colour map is the image's own pixels and transparency — no colour
 * reduction, thresholding, cropping or recolouring. Only the presentation
 * is embroidered: satin-ridge relief (per tonal area, for direction
 * changes like a digitized design), thread sheen, a raised edge and a
 * contact shadow — all lighting, none of it painted into the colours.
 *
 * `threadHex` (the customer's explicit "one thread" choice) sews the
 * design's shape in that single thread instead.
 */
export function createImageEmbroidery(
  image: CanvasImageSource & { width: number; height: number; naturalWidth?: number; naturalHeight?: number },
  threadHex: string | null
): EmbroideryMaps {
  // The image's own proportions (SVGs without a size: the element's).
  const iw = image.naturalWidth || image.width || 1024;
  const ih = image.naturalHeight || image.height || 1024;
  const scale = Math.min(1, IMAGE_TEXTURE_MAX_PX / Math.max(iw, ih));
  const width = Math.max(8, Math.round(iw * scale));
  const height = Math.max(8, Math.round(ih * scale));
  const { ctx } = canvas(width, height);
  ctx.drawImage(image, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;

  // Relief only: tonal areas (from a slightly softened copy, so photo noise
  // doesn't become grooves) each get their own satin angle.
  const { ctx: softCtx } = canvas(width, height);
  softCtx.filter = `blur(${Math.max(1, Math.round(Math.max(width, height) / 400))}px)`;
  softCtx.drawImage(image, 0, 0, width, height);
  const soft = softCtx.getImageData(0, 0, width, height).data;

  const n = width * height;
  const alpha = new Float32Array(n);
  const region = new Uint8Array(n);
  const rgb = new Uint8ClampedArray(n * 3);
  const single = threadHex ? hexRgb(threadHex) : null;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    alpha[i] = data[p + 3] / 255;
    region[i] = Math.min(5, Math.floor((0.2126 * soft[p] + 0.7152 * soft[p + 1] + 0.0722 * soft[p + 2]) / 43));
    rgb[i * 3] = single ? single[0] : data[p];
    rgb[i * 3 + 1] = single ? single[1] : data[p + 1];
    rgb[i * 3 + 2] = single ? single[2] : data[p + 2];
  }
  const maps = buildMaps({
    width,
    height,
    alpha,
    rgb,
    region,
    feature: Math.max(width, height) * 0.035,
    exactColour: !single,
  });
  // The image's exact proportions (not the texture's rounded pixel grid).
  return { ...maps, aspect: iw / ih };
}

// ---------------------------------------------------------------------------
// Varsity lettering (tackle twill)

/** A tackle-twill piece: a woven twill patch, its satin-stitched border, and an optional outer outline. */
export type VarsityStyle = {
  /** The twill patch colour (the letter's face). */
  fill: string;
  /** The satin border sewn over the patch's cut edge. */
  border: string;
  /** Optional thin satin outline outside the border. */
  outline?: string;
  /** Border width as a share of the font size (default 0.03). */
  borderWeight?: number;
  /**
   * "collegiate": slab-serif block letters (chest letters);
   * "athletic": condensed block numerals (sleeve and back numbers).
   */
  face?: VarsityFace;
};

export type VarsityFace = "collegiate" | "athletic";
/** Both faces are loaded by index.html (Graduate for the logo tag, Anton for display words). */
export const VARSITY_FONTS: Record<VarsityFace, string> = { collegiate: "Graduate", athletic: "Anton" };
const VARSITY_FONT = (face: VarsityFace, size: number) =>
  `400 ${size}px "${VARSITY_FONTS[face]}", ${face === "athletic" ? '"Impact", "Arial Narrow"' : '"Rockwell", "Georgia"'}, sans-serif`;
const VARSITY_HEIGHT_PX = 320;
/** Cap height of the letters as a share of the artwork's height. */
export const VARSITY_CAP_SHARE = 0.56;

/**
 * Varsity embroidery, as on real graduation jackets: each letter is a
 * patch of woven twill (fine diagonal weave, matte, slightly padded)
 * whose cut edge is covered by a raised satin border — stitches running
 * across the border, a faint sheen, sitting proud of the patch — and, if
 * given, a thin second satin outline outside it. Three regions, each with
 * its own relief, sheen and thread direction.
 */
export function createVarsityEmbroidery(text: string, style: VarsityStyle): EmbroideryMaps {
  const height = VARSITY_HEIGHT_PX;
  const face = style.face ?? "collegiate";
  // Size the type so its cap height fills VARSITY_CAP_SHARE (measured:
  // the faces' cap heights differ).
  const measure = canvas(8, 8).ctx;
  measure.font = VARSITY_FONT(face, 100);
  const capEm = (measure.measureText("H").actualBoundingBoxAscent || 72) / 100;
  const fontSize = (height * VARSITY_CAP_SHARE) / capEm;
  // Half the band sits on the patch, half outside it.
  const border = fontSize * (style.borderWeight ?? 0.03);
  const outline = style.outline ? fontSize * 0.035 : 0;
  const pad = border * 2 + outline * 2 + fontSize * 0.16;

  const probe = canvas(8, 8).ctx;
  probe.font = VARSITY_FONT(face, fontSize);
  (probe as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0.04em";
  const width = Math.min(MAX_WIDTH_PX, Math.ceil(probe.measureText(text).width + pad * 2));

  /** One drawing of the text (filled and/or stroked at a width) → coverage. */
  const draw = (stroke: number, filled = true) => {
    const { c, ctx } = canvas(width, height);
    ctx.font = VARSITY_FONT(face, fontSize);
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0.04em";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#fff";
    ctx.lineJoin = "round";
    const x = width / 2;
    const y = height / 2 + (fontSize * capEm) / 2;
    if (filled) ctx.fillText(text, x, y);
    if (stroke > 0) {
      ctx.lineWidth = stroke;
      ctx.strokeText(text, x, y);
    }
    return alphaOf(c);
  };
  // The twill patch: the letter emboldened — real tackle-twill letters are
  // fat block shapes, much heavier than the typeface's strokes.
  // (The heavy athletic face needs barely any.)
  const patchMask = draw(fontSize * (face === "athletic" ? 0.012 : 0.075));
  // The satin band straddles the patch's cut edge: a blur of the patch
  // crosses 0.5 at the edge; the band is where it's between the two
  // thresholds (≈ `border` either side).
  const edge = blurred(patchMask, width, height, Math.max(1, border * 0.75));
  const outer = outline ? blurred(patchMask, width, height, Math.max(1, (border + outline) * 0.75)) : null;

  const n = width * height;
  const region = new Uint8Array(n); // 0 none · 1 twill · 2 border · 3 outline
  const alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const e = edge[i];
    if (e >= 0.86) region[i] = 1;
    else if (e > 0.14) region[i] = 2;
    else if (outer && outer[i] > 0.06) region[i] = 3;
    alpha[i] = region[i] ? 1 : 0;
  }

  const feature = border * 2;
  const ring = new Float32Array(n);
  const rim = new Float32Array(n);
  const fill = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    ring[i] = region[i] === 2 ? 1 : 0;
    rim[i] = region[i] === 3 ? 1 : 0;
    fill[i] = region[i] === 1 ? 1 : 0;
  }
  // Thread direction: across each satin column.
  const acrossRing = strokeOrientation(ring, width, height, feature);
  const acrossRim = outer ? strokeOrientation(rim, width, height, outline * 2) : null;
  const ringPillow = blurred(ring, width, height, Math.max(1.2, border * 0.35));
  const rimPillow = outer ? blurred(rim, width, height, Math.max(1, outline * 0.45)) : null;
  const patch = blurred(fill, width, height, Math.max(2, fontSize * 0.04));
  const shade = blurred(alpha, width, height, Math.max(3, fontSize * 0.05), fontSize * 0.012, fontSize * 0.03);

  const hField = new Float32Array(n);
  const ridgeF = new Float32Array(n);
  const satinPeriod = Math.max(2.4, fontSize * 0.022);
  const twillPeriod = Math.max(2.2, fontSize * 0.018);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const r = region[i];
      if (!r) continue;
      if (r === 1) {
        // Twill: a fine 45° weave, a soft felt fuzz, a gently padded patch.
        const t = 0.5 + 0.5 * Math.cos(((x + y) / twillPeriod) * Math.PI * 2 + noise(x >> 2, y >> 2) * 0.8);
        ridgeF[i] = t;
        hField[i] = 0.42 * Math.min(1, patch[i] * 1.25) + 0.05 * t + (noise(x, y) - 0.5) * 0.05;
      } else {
        // Satin: a raised rounded column, threads laid across it.
        const across = r === 2 ? acrossRing[i] : acrossRim![i];
        const along = Math.round((across + Math.PI / 2) / ANGLE_STEP) * ANGLE_STEP;
        const u = (x * Math.cos(along) + y * Math.sin(along)) / satinPeriod;
        const row = Math.floor(u);
        const jitter = noise(row + r * 17, Math.floor((y * Math.cos(along) - x * Math.sin(along)) / 5)) * 0.3;
        const s = 0.5 + 0.5 * Math.cos((u - row - 0.5 + jitter * 0.3) * Math.PI * 2);
        ridgeF[i] = s;
        const pillow = r === 2 ? ringPillow[i] : rimPillow![i];
        const lift = r === 2 ? 0.62 : 0.5;
        hField[i] = lift + 0.42 * Math.min(1, pillow * 1.3) * (0.8 + 0.2 * s) + (noise(x, y) - 0.5) * 0.03;
      }
    }
  }

  const { c: normalC, ctx: normalCtx } = canvas(width, height);
  const { c: colourC, ctx: colourCtx } = canvas(width, height);
  const { c: roughC, ctx: roughCtx } = canvas(width, height);
  const { c: shadowC, ctx: shadowCtx } = canvas(width, height);
  const normalImg = normalCtx.createImageData(width, height);
  const colourImg = colourCtx.createImageData(width, height);
  const roughImg = roughCtx.createImageData(width, height);
  const shadowImg = shadowCtx.createImageData(width, height);
  const { c: aoC, ctx: aoCtx } = canvas(width, height);
  const aoImg = aoCtx.createImageData(width, height);
  const ao = cavityOcclusion(hField, width, height, Math.max(1, fontSize * 0.03), 1.6);
  const colours = [null, hexRgb(style.fill), hexRgb(style.border), hexRgb(style.outline ?? style.border)];
  const hAt = (x: number, y: number) => hField[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))];
  const STRENGTH = 4.4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const p = i * 4;
      const nx = -(hAt(x + 1, y) - hAt(x - 1, y)) * STRENGTH;
      const ny = (hAt(x, y + 1) - hAt(x, y - 1)) * STRENGTH;
      const len = Math.hypot(nx, ny, 1);
      normalImg.data[p] = ((nx / len) * 0.5 + 0.5) * 255;
      normalImg.data[p + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      normalImg.data[p + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      normalImg.data[p + 3] = 255;

      const r = region[i];
      const col = colours[r] ?? [0, 0, 0];
      // Twill: matte, a whisper of weave; satin: shaded along the stitches.
      const f = r === 1 ? 0.93 + 0.07 * ridgeF[i] : (0.84 + 0.16 * ridgeF[i]) * (0.9 + 0.1 * (r === 2 ? ringPillow[i] : 1));
      colourImg.data[p] = col[0] * f;
      colourImg.data[p + 1] = col[1] * f;
      colourImg.data[p + 2] = col[2] * f;
      colourImg.data[p + 3] = r ? alpha[i] * 255 : 0;

      // Twill: fully matte; satin: matte thread with a faint ridge highlight.
      const rough = r === 1 ? 0.95 : r ? 0.88 - 0.1 * ridgeF[i] : 0.95;
      roughImg.data[p] = roughImg.data[p + 1] = roughImg.data[p + 2] = rough * 255;
      roughImg.data[p + 3] = 255;

      const s = Math.min(1, shade[i] * 1.25) * 0.6 * 255;
      shadowImg.data[p] = shadowImg.data[p + 1] = shadowImg.data[p + 2] = s;
      shadowImg.data[p + 3] = 255;

      aoImg.data[p] = aoImg.data[p + 1] = aoImg.data[p + 2] = ao[i] * 255;
      aoImg.data[p + 3] = 255;
    }
  }
  normalCtx.putImageData(normalImg, 0, 0);
  colourCtx.putImageData(colourImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);
  shadowCtx.putImageData(shadowImg, 0, 0);
  aoCtx.putImageData(aoImg, 0, 0);

  const maps = {
    map: texture(colourC, true),
    normalMap: texture(normalC, false),
    roughnessMap: texture(roughC, false),
    aoMap: texture(aoC, false),
    shadowMap: texture(shadowC, false),
  };
  return { ...maps, aspect: width / height, dispose: () => Object.values(maps).forEach((t) => t.dispose()) };
}

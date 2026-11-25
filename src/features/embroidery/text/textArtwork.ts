import { TEXT_MAX_CHARS, TEXT_MAX_LINES } from "../../configurator/model/embroideryGeometry";
import { baseDirection, fontStack, getEmbroideryFont, type EmbroideryFont } from "../fonts/fontLibrary";

/**
 * TEXT → STITCHABLE ARTWORK. The customer's text set in a library font, as a
 * coverage mask the embroidery pipeline sews (3D lettering, the digitizer,
 * the production sheet — all from this one function, in the browser or in
 * the server's headless browser).
 *
 * The text is shaped by the browser's text engine with the font's own data:
 * Arabic letters join in their contextual forms and ligatures, and
 * right-to-left / mixed text is ordered by the Unicode bidi algorithm (base
 * direction from the first strong letter). The shaped glyph outlines are
 * then filled — slightly emboldened for thin faces so satin stitches can
 * carry them — into a canvas cropped to the ink, so the lettering fills its
 * zone however long it is. The fonts must be loaded first (loadFonts.ts on
 * the site; the server page registers them itself).
 *
 * Text may run over up to TEXT_MAX_LINES lines, broken where the customer
 * pressed Enter (never automatically): each line is centred, in its own
 * reading direction, LINE_GAP of the tallest line below the one above. A
 * single line draws exactly as it always has.
 */

/** Font size the artwork is drawn at (px); long text is drawn smaller to stay within MAX_WIDTH_PX. */
export const TEXT_ARTWORK_FONT_PX = 220;
export const TEXT_ARTWORK_MAX_WIDTH_PX = 3200;
/** Longest text a zone takes (characters; line breaks not counted). */
export const TEXT_MAX_LENGTH = TEXT_MAX_CHARS;
export { TEXT_MAX_LINES };
/** The gap between lines, as a share of the tallest line's ink height (comfortable for satin lettering). */
export const LINE_GAP = 0.28;

export type TextArtwork = {
  canvas: HTMLCanvasElement;
  /** width / height of the ink (plus a small margin). */
  aspect: number;
  direction: "ltr" | "rtl";
  /** The fonts used: the chosen face, then any library fallback for a script it lacks. */
  fonts: EmbroideryFont[];
  /** Typical stroke width, px (drives stitch size and relief). */
  strokePx: number;
};

/** The CSS font for a stack of library faces (each registered for every weight, so none is faux-bolded). */
export const fontCss = (fonts: EmbroideryFont[], px: number) => `400 ${px}px ${fonts.map((f) => `"${f.family}"`).join(", ")}`;

/** Characters in a text, line breaks not counted (what the character limit counts). */
export const textLength = (text: string) => [...text.replace(/\n/g, "")].length;

/** Lines in a text. */
export const textLines = (text: string) => (text ? text.split("\n").length : 0);

/**
 * Normalises what the customer is typing: line breaks kept (\r\n → \n),
 * tabs as spaces, runs of spaces collapsed, at most TEXT_MAX_LINES lines and
 * `max` characters (line breaks not counted). Spaces at the ends of lines
 * are kept while typing; tidyText drops them.
 */
export function cleanText(text: string, max = TEXT_MAX_LENGTH) {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\t/g, " ").split("\n").slice(0, TEXT_MAX_LINES);
  let budget = max;
  return lines
    .map((line) => {
      const chars = [...line.replace(/ {2,}/g, " ")].slice(0, Math.max(0, budget));
      budget -= chars.length;
      return chars.join("");
    })
    .join("\n");
}

/** The text as stitched: cleaned, each line trimmed, empty lines dropped. */
export const tidyText = (text: string, max = TEXT_MAX_LENGTH) =>
  cleanText(text, max)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

export function drawTextArtwork(text: string, fontId: string, colour = "#fff"): TextArtwork | null {
  const value = tidyText(text);
  if (!value) return null;
  const lines = value.split("\n");
  const fonts = fontStack(getEmbroideryFont(fontId), value);
  const direction = baseDirection(value);
  // A line with no letters of its own (e.g. "2027") reads in the text's direction.
  const lineDirection = (line: string) => (/\p{L}/u.test(line) ? baseDirection(line) : direction);
  const probe = document.createElement("canvas").getContext("2d")!;
  const measure = (px: number) =>
    lines.map((line) => {
      probe.font = fontCss(fonts, px);
      probe.direction = lineDirection(line);
      probe.textAlign = "left";
      probe.textBaseline = "alphabetic";
      return probe.measureText(line);
    });
  const inkW = (mm: TextMetrics) => mm.actualBoundingBoxLeft + mm.actualBoundingBoxRight;
  const widest = (ms: TextMetrics[]) => Math.max(...ms.map(inkW));
  let px = TEXT_ARTWORK_FONT_PX;
  let m = measure(px);
  if (widest(m) > TEXT_ARTWORK_MAX_WIDTH_PX) {
    px = Math.max(24, Math.floor((px * TEXT_ARTWORK_MAX_WIDTH_PX) / widest(m)));
    m = measure(px);
  }
  const stroke = fonts[0].embolden * px;
  const pad = Math.ceil(stroke + px * 0.06);
  // Baselines: each line LINE_GAP of the tallest line's ink below the one above.
  const tallest = Math.max(...m.map((mm) => mm.actualBoundingBoxAscent + mm.actualBoundingBoxDescent));
  const baselines: number[] = [];
  m.forEach((mm, i) => {
    baselines.push(i === 0 ? 0 : baselines[i - 1] + m[i - 1].actualBoundingBoxDescent + tallest * LINE_GAP + mm.actualBoundingBoxAscent);
  });
  const top = Math.min(...m.map((mm, i) => baselines[i] - mm.actualBoundingBoxAscent));
  const bottom = Math.max(...m.map((mm, i) => baselines[i] + mm.actualBoundingBoxDescent));
  const blockW = widest(m);
  const width = Math.max(8, Math.ceil(blockW + pad * 2));
  const height = Math.max(8, Math.ceil(bottom - top + pad * 2));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.font = fontCss(fonts, px);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  lines.forEach((line, i) => {
    ctx.direction = lineDirection(line);
    // Centred: the line's ink in the middle of the block (one line: exactly at the pad, as always).
    const x = pad + (blockW - inkW(m[i])) / 2 + m[i].actualBoundingBoxLeft;
    const y = pad + baselines[i] - top;
    ctx.fillText(line, x, y);
    if (stroke > 0) {
      ctx.lineWidth = stroke;
      ctx.lineJoin = "round";
      ctx.strokeText(line, x, y);
    }
  });
  return { canvas, aspect: width / height, direction, fonts, strokePx: strokeWidth(ctx, width, height) || px * 0.12 };
}

/** Typical stroke width of the ink: 2 × area / outline length. */
function strokeWidth(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const d = ctx.getImageData(0, 0, w, h).data;
  let area = 0, edge = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4 + 3;
      if (d[i] < 128) continue;
      area++;
      if (d[i - 4] < 128 || d[i + 4] < 128 || d[i - w * 4] < 128 || d[i + w * 4] < 128) edge++;
    }
  return edge ? (2 * area) / edge : 0;
}

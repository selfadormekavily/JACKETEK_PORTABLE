/**
 * Stitch preview: every stitch drawn as a thread segment in its colour, in
 * sewing order (jumps and trims are not drawn). SVG in mm, y up → down.
 */
import type { DigitizedDesign } from "./types";

const f = (n: number) => (Math.round(n * 100) / 100).toString();

/**
 * The stitch field as an <svg> (viewBox = its extents in mm). No background:
 * place it on the garment colour. `withViewBox` false returns only the paths.
 */
export function stitchPreviewSvg(design: DigitizedDesign, { margin = 1 } = {}): string {
  const m = design.metadata;
  const e = m.extents;
  const paths: string[] = [];
  let colour = 0, d = "", pen = false;
  const flush = () => {
    if (!d) return;
    const hex = m.threads[colour]?.hex ?? "#000000";
    // a darker hairline under the thread keeps light threads visible on any ground
    paths.push(`<path d="${d}" stroke="#000" stroke-opacity="0.35" stroke-width="0.42"/><path d="${d}" stroke="${hex}" stroke-width="0.3"/>`);
    d = "";
  };
  let last: [number, number] | null = null;
  for (const s of design.stitches) {
    if (s.cmd === "color") { flush(); colour++; pen = false; continue; }
    if (s.cmd === "jump" || s.cmd === "trim") { pen = false; last = [s.x, s.y]; continue; }
    if (s.cmd === "end") break;
    if (!pen || !last) d += `M${f(s.x)} ${f(-s.y)}`;
    else d += `L${f(s.x)} ${f(-s.y)}`;
    pen = true;
    last = [s.x, s.y];
  }
  flush();
  const vb = `${f(e.minX - margin)} ${f(-e.maxY - margin)} ${f(e.maxX - e.minX + 2 * margin)} ${f(e.maxY - e.minY + 2 * margin)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" data-margin-mm="${margin}" fill="none" stroke-linecap="round" stroke-linejoin="round">${paths.join("")}</svg>`;
}

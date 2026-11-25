/**
 * Tajima DST writer (and reader, for verification).
 *
 * 512-byte ASCII header, then one 3-byte record per needle event: a move of
 * at most ±121 units (0.1 mm) on each axis in balanced ternary, flags for
 * jump and colour change, and 00 00 F3 at the end. Positions are written
 * from rounded absolute coordinates, so rounding never accumulates.
 * A trim is written as three short jumps (the common Tajima convention;
 * machines are set to trim after consecutive jumps).
 */
import type { DigitizedDesign, Stitch } from "./types";

const MAX = 121;

function encodeRecord(dx: number, dy: number, kind: "stitch" | "jump" | "color" | "end"): number[] {
  if (kind === "end") return [0x00, 0x00, 0xf3];
  let b0 = 0, b1 = 0, b2 = 0x03;
  if (kind === "jump") b2 |= 0x80;
  if (kind === "color") b2 |= 0xc0;
  let x = dx, y = dy;
  if (x > 40) { b2 |= 0x04; x -= 81; } if (x < -40) { b2 |= 0x08; x += 81; }
  if (x > 13) { b1 |= 0x04; x -= 27; } if (x < -13) { b1 |= 0x08; x += 27; }
  if (x > 4) { b0 |= 0x04; x -= 9; } if (x < -4) { b0 |= 0x08; x += 9; }
  if (x > 1) { b1 |= 0x01; x -= 3; } if (x < -1) { b1 |= 0x02; x += 3; }
  if (x > 0) { b0 |= 0x01; x -= 1; } if (x < 0) { b0 |= 0x02; x += 1; }
  if (y > 40) { b2 |= 0x20; y -= 81; } if (y < -40) { b2 |= 0x10; y += 81; }
  if (y > 13) { b1 |= 0x20; y -= 27; } if (y < -13) { b1 |= 0x10; y += 27; }
  if (y > 4) { b0 |= 0x20; y -= 9; } if (y < -4) { b0 |= 0x10; y += 9; }
  if (y > 1) { b1 |= 0x80; y -= 3; } if (y < -1) { b1 |= 0x40; y += 3; }
  if (y > 0) { b0 |= 0x80; y -= 1; } if (y < 0) { b0 |= 0x40; y += 1; }
  if (x !== 0 || y !== 0) throw new Error(`DST move out of range (${dx}, ${dy})`);
  return [b0, b1, b2];
}

/** The design as a DST file. */
export function encodeDst(design: DigitizedDesign, label = design.metadata.designId): Uint8Array {
  const recs: number[] = [];
  let cx = 0, cy = 0, count = 0, colours = 0;
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  const moveTo = (x: number, y: number, kind: "stitch" | "jump") => {
    // split anything longer than one record allows
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x - cx), Math.abs(y - cy)) / MAX));
    const sx = cx, sy = cy;
    for (let i = 1; i <= n; i++) {
      const tx = Math.round(sx + ((x - sx) * i) / n), ty = Math.round(sy + ((y - sy) * i) / n);
      recs.push(...encodeRecord(tx - cx, ty - cy, i < n ? "jump" : kind));
      cx = tx; cy = ty; count++;
      minX = Math.min(minX, cx); maxX = Math.max(maxX, cx); minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
    }
  };
  for (const s of design.stitches) {
    const x = Math.round(s.x * 10), y = Math.round(s.y * 10); // 0.1 mm
    if (s.cmd === "stitch") moveTo(x, y, "stitch");
    else if (s.cmd === "jump") moveTo(x, y, "jump");
    else if (s.cmd === "trim") {
      for (const [dx, dy] of [[2, 2], [-4, -4], [2, 2]]) { recs.push(...encodeRecord(dx, dy, "jump")); count++; }
    } else if (s.cmd === "color") { recs.push(...encodeRecord(0, 0, "color")); count++; colours++; }
    else if (s.cmd === "end") break;
  }
  recs.push(...encodeRecord(0, 0, "end"));
  const field = (k: string, v: string) => `${k}:${v}\r`;
  const num = (n: number, w: number) => String(Math.abs(Math.round(n))).padStart(w, " ");
  let header =
    field("LA", label.slice(0, 16).padEnd(16, " ")) +
    field("ST", String(count).padStart(7, " ")) +
    field("CO", String(colours).padStart(3, " ")) +
    field("+X", num(maxX, 5)) + field("-X", num(minX, 5)) + field("+Y", num(maxY, 5)) + field("-Y", num(minY, 5)) +
    field("AX", (cx < 0 ? "-" : "+") + num(cx, 5)) + field("AY", (cy < 0 ? "-" : "+") + num(cy, 5)) +
    field("MX", "+    0") + field("MY", "+    0") + field("PD", "******");
  header += "\x1a";
  const out = new Uint8Array(512 + recs.length);
  for (let i = 0; i < 512; i++) out[i] = i < header.length ? header.charCodeAt(i) & 0xff : 0x20;
  out.set(recs, 512);
  return out;
}

/** Reads a DST back (absolute 0.1 mm positions) — used to verify the writer. */
export function decodeDst(bytes: Uint8Array): { header: string; stitches: (Stitch & { raw: [number, number] })[] } {
  const header = String.fromCharCode(...bytes.slice(0, 512));
  const out: (Stitch & { raw: [number, number] })[] = [];
  let x = 0, y = 0;
  for (let i = 512; i + 2 < bytes.length; i += 3) {
    const [b0, b1, b2] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    if (b2 === 0xf3 && b0 === 0 && b1 === 0) { out.push({ x: x / 10, y: y / 10, cmd: "end", raw: [x, y] }); break; }
    const bit = (b: number, m: number) => ((b & m) !== 0 ? 1 : 0);
    const dx = bit(b0, 0x01) - bit(b0, 0x02) + 9 * (bit(b0, 0x04) - bit(b0, 0x08)) + 3 * (bit(b1, 0x01) - bit(b1, 0x02)) + 27 * (bit(b1, 0x04) - bit(b1, 0x08)) + 81 * (bit(b2, 0x04) - bit(b2, 0x08));
    const dy = bit(b0, 0x80) - bit(b0, 0x40) + 9 * (bit(b0, 0x20) - bit(b0, 0x10)) + 3 * (bit(b1, 0x80) - bit(b1, 0x40)) + 27 * (bit(b1, 0x20) - bit(b1, 0x10)) + 81 * (bit(b2, 0x20) - bit(b2, 0x10));
    x += dx; y += dy;
    const cmd = (b2 & 0xc0) === 0xc0 ? "color" : b2 & 0x80 ? "jump" : "stitch";
    out.push({ x: x / 10, y: y / 10, cmd, raw: [x, y] });
  }
  return { header, stitches: out };
}

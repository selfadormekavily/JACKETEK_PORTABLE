/**
 * Stored form of a design's stitches: the exact `Stitch[]` the DST is written
 * from, as compact JSON [[x×100, y×100, cmd, block], …]. Lossless — the
 * digitizer rounds positions to 0.01 mm.
 */
import type { Stitch, StitchCommand } from "./types";

const CMDS: StitchCommand[] = ["stitch", "jump", "trim", "color", "end"];

export function packStitches(stitches: Stitch[]): string {
  return JSON.stringify(stitches.map((s) => [Math.round(s.x * 100), Math.round(s.y * 100), CMDS.indexOf(s.cmd), s.b ?? -1]));
}

export function unpackStitches(data: string): Stitch[] {
  return (JSON.parse(data) as [number, number, number, number][]).map(([x, y, c, b]) => ({ x: x / 100, y: y / 100, cmd: CMDS[c], b }));
}

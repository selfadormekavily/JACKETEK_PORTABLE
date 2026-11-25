import { BufferGeometry, Float32BufferAttribute, Matrix4, Vector3 } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LEFT, RIGHT, type EdgeSegment } from "./frontRig";

/**
 * The hidden zipper, UNZIPPED into its two halves — each sewn beneath
 * its own panel's edge, under the placket (jacket space, cm):
 *
 *   tape   woven tape on the underside of the panel, set back from the
 *          edge fold;
 *   teeth  a #5 metal chain (≈3 mm pitch) along the edge, heads just
 *          past the fold, so they show when the panel opens; the two
 *          halves' teeth alternate, as they would interlock;
 *   slider + pull and the retainer box at the bottom of the right half,
 *          the pin at the bottom of the left half (a zipper at rest,
 *          undone).
 *
 * All of it lies ≥3 mm beneath the outer surface: invisible while the
 * jacket is closed. Built from the actual split edge of the body.
 */

const PITCH = 0.3;
/**
 * Depths below the outer surface (cm) — clear of the placket's stitched
 * ridge (≈3 mm) so nothing reaches the surface while closed.
 */
const TAPE_DEPTH = 0.7;
const TEETH_DEPTH = 0.58;
/** Vertical extent of the zipper (jacket z, cm): hem to below the collar. */
const Z_BOTTOM = -1.2;
const Z_TOP = -55;

type Frame = { p: Vector3; n: Vector3; t: Vector3; b: Vector3 };

/**
 * The split edge as an ordered line (bottom → top) with surface frames.
 * Built from the OUTER surface only: where the placket's stitched ridge
 * gives the shell a second layer a few millimetres deep, the plane cuts
 * both — mixing them would zig-zag the zipper into the fabric. So each
 * height band keeps its outermost crossing.
 */
const BAND = 0.35;

/** The outermost edge crossing in each height band. */
function outerCrossings(segments: readonly EdgeSegment[]) {
  const outer = new Map<number, EdgeSegment[number]>();
  for (const e of segments.flat()) {
    const k = Math.round(e.p[2] / BAND);
    const kept = outer.get(k);
    if (!kept || e.p[1] > kept.p[1]) outer.set(k, e);
  }
  return outer;
}

/** Segments of the outer surface only (drops the ridge's inner layer). */
function outerSegments(segments: readonly EdgeSegment[]) {
  const outer = outerCrossings(segments);
  const onOuter = (e: EdgeSegment[number]) =>
    (outer.get(Math.round(e.p[2] / BAND))?.p[1] ?? Infinity) - e.p[1] < 0.15;
  return segments.filter(([a, b]) => onOuter(a) && onOuter(b));
}

function edgeFrames(segments: readonly EdgeSegment[]): Frame[] {
  const outer = outerCrossings(segments.filter(([a]) => a.p[2] <= Z_BOTTOM && a.p[2] >= Z_TOP));
  const line = [...outer.values()]
    .filter((e) => e.p[2] <= Z_BOTTOM && e.p[2] >= Z_TOP)
    .sort((a, b) => b.p[2] - a.p[2]) // z descending = bottom → top
    .map((e) => ({ p: new Vector3(...e.p), n: new Vector3(...e.n).normalize() }));
  // Resample at the tooth pitch along the line.
  const frames: Frame[] = [];
  let carry = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const c = line[i + 1];
    const len = a.p.distanceTo(c.p);
    for (let s = carry; s < len; s += PITCH) {
      const f = s / len;
      const p = a.p.clone().lerp(c.p, f);
      const n = a.n.clone().lerp(c.n, f).normalize();
      const t = c.p.clone().sub(a.p).normalize();
      let b = new Vector3().crossVectors(t, n).normalize();
      if (b.x < 0) b = b.negate();
      const nn = new Vector3().crossVectors(b, t).normalize();
      frames.push({ p, n: nn.dot(n) < 0 ? nn.negate() : nn, t, b });
    }
    carry = (carry - len) % PITCH;
    if (carry < 0) carry += PITCH;
  }
  return frames;
}

const place = (f: Frame, across: number, along: number, depth: number) =>
  new Matrix4()
    .makeBasis(f.b, f.t, f.n)
    .setPosition(f.p.clone().addScaledVector(f.b, across).addScaledVector(f.t, along).addScaledVector(f.n, -depth));

/** A tape strip between two offsets across the edge. */
function tape(frames: Frame[], from: number, to: number) {
  const pos: number[] = [];
  const nrm: number[] = [];
  const index: number[] = [];
  frames.forEach((f) => {
    for (const x of [from, to]) {
      const v = f.p.clone().addScaledVector(f.b, x).addScaledVector(f.n, -TAPE_DEPTH);
      pos.push(v.x, v.y, v.z);
      nrm.push(f.n.x, f.n.y, f.n.z);
    }
  });
  for (let i = 0; i < frames.length - 1; i++) {
    const r = i * 2;
    // Columns across (+x), rows up the edge: wound to face outward.
    index.push(r, r + 1, r + 2, r + 1, r + 3, r + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(nrm, 3));
  g.setIndex(index);
  return g;
}

const withSide = (g: BufferGeometry, side: number) => {
  g.setAttribute("rigSide", new Float32BufferAttribute(new Array(g.getAttribute("position").count).fill(side), 1));
  return g;
};

/** Merges transformed copies of a shape. */
function copies(shape: BufferGeometry, matrices: Matrix4[]) {
  const parts = matrices.map((m) => shape.clone().applyMatrix4(m));
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

export type ZipperHalves = {
  /** Metal: teeth, slider, pull, stops — per panel. */
  metal: { left: BufferGeometry; right: BufferGeometry };
  /** Tape — per panel. */
  tape: { left: BufferGeometry; right: BufferGeometry };
  dispose: () => void;
};

export function createZipperHalves(segments: readonly EdgeSegment[]): ZipperHalves | null {
  const frames = edgeFrames(segments);
  if (frames.length < 10) return null;

  const tooth = new RoundedBoxGeometry(0.5, 0.19, 0.2, 2, 0.06);
  const leftTeeth: Matrix4[] = [];
  const rightTeeth: Matrix4[] = [];
  frames.forEach((f, i) =>
    // Heads reach across the edge line, alternating between the halves.
    (i % 2 === 0 ? leftTeeth : rightTeeth).push(place(f, i % 2 === 0 ? -0.1 : 0.1, 0, TEETH_DEPTH))
  );

  const bottom = frames[0];
  // Right half: retainer box, slider resting on it, pull lying up the tape.
  const box = new RoundedBoxGeometry(0.42, 0.7, 0.26, 2, 0.06);
  const slider = new RoundedBoxGeometry(0.95, 1.3, 0.34, 3, 0.12);
  const pull = new RoundedBoxGeometry(0.58, 1.9, 0.09, 2, 0.04);
  const rightExtras = [
    box.clone().applyMatrix4(place(bottom, 0.12, 0.1, TEETH_DEPTH)),
    slider.clone().applyMatrix4(place(bottom, 0, 1.0, TEETH_DEPTH - 0.02)),
    pull.clone().applyMatrix4(place(bottom, 0, 2.3, TEETH_DEPTH - 0.2)),
  ];
  // Left half: the insertion pin.
  const pin = new RoundedBoxGeometry(0.3, 0.9, 0.22, 2, 0.05);
  const leftExtras = [pin.clone().applyMatrix4(place(bottom, -0.08, 0.2, TEETH_DEPTH))];

  const leftMetal = withSide(mergeGeometries([copies(tooth, leftTeeth), ...leftExtras]), LEFT);
  const rightMetal = withSide(mergeGeometries([copies(tooth, rightTeeth), ...rightExtras]), RIGHT);
  [tooth, box, slider, pull, pin, ...rightExtras, ...leftExtras].forEach((g) => g.dispose());

  // Tapes run back under each panel from the chain.
  const leftTape = withSide(tape(frames, 0.12, 1.15), LEFT);
  const rightTape = withSide(tape(frames, -1.15, -0.12), RIGHT);

  const all = [leftMetal, rightMetal, leftTape, rightTape];
  return {
    metal: { left: leftMetal, right: rightMetal },
    tape: { left: leftTape, right: rightTape },
    dispose: () => all.forEach((g) => g.dispose()),
  };
}

/**
 * The fold along each panel's edge: a narrow band from just under the
 * surface down to the zipper tape, so an opened panel shows cloth with
 * thickness, not a razor edge. Wound to face the opening.
 */
export function createEdgeFolds(allSegments: readonly EdgeSegment[]) {
  const segments = outerSegments(allSegments);
  // Starts below the placket's stitched ridge (≈3 mm): measured from
  // the ridge top, a shallower start would reach the fabric beside it.
  const top = 0.4;
  const depth = TAPE_DEPTH + 0.05;
  const make = (side: number) => {
    const facing = side === LEFT ? -1 : 1;
    const pos: number[] = [];
    const nrm: number[] = [];
    for (const [a, b] of segments) {
      const at = (e: typeof a, d: number) => [e.p[0] - e.n[0] * d, e.p[1] - e.n[1] * d, e.p[2] - e.n[2] * d];
      const quad = [at(a, top), at(b, top), at(b, depth), at(a, depth)];
      const e1 = quad[1].map((v, k) => v - quad[0][k]);
      const e2 = quad[2].map((v, k) => v - quad[0][k]);
      const gx = e1[1] * e2[2] - e1[2] * e2[1];
      const order = gx * facing >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      for (const k of order) {
        pos.push(quad[k][0], quad[k][1], quad[k][2]);
        nrm.push(facing, 0, 0);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new Float32BufferAttribute(nrm, 3));
    return withSide(g, side);
  };
  return { left: make(LEFT), right: make(RIGHT) };
}

import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  type Material,
  type Mesh,
  type Object3D,
  type TypedArray,
} from "three";
import { addShaderHook, type ShaderHook } from "./shaderHooks";

/**
 * FRONT RIG — the jacket's front as two panels that can open.
 *
 * The v09 GLB has no separate front panels: its "Body", "Trim" and
 * "Stripe" parts each run continuously across the centre front, and the
 * "Snaps" (7 snaps) sit on the centre line. So the panels are made from
 * that geometry:
 *
 *  - SPLIT: Body/Trim/Stripe are divided along a vertical plane at the
 *    placket edge — the snaps' measured outer edge plus the placket
 *    margin — into processed copies (the loaded asset is never changed).
 *    The wearer's-right panel therefore carries the placket and all the
 *    snaps, like a real overlapping placket. Cut vertices are duplicated
 *    at identical positions (one per panel), so the closed jacket is
 *    watertight and identical to the original.
 *
 *  - PIVOTS: each panel swings rigidly about a vertical hinge at its side
 *    seam (PANEL_HINGE). Only close to the hinge, where the movement is
 *    tiny, does the rotation blend into the fixed back — the fabric bends
 *    there instead of stretching. The hem opens fully and the neck only a
 *    little (the collar stays on), so the front falls open in a V. Back,
 *    shoulders and sleeves stay put; every part (sleeves, collar, snaps,
 *    embroidery) follows the same field, so seams never open.
 *
 * The motion runs in the vertex shader (like skinning), driven by one
 * uniform (0 closed → 1 open). Jacket space: centimetres, x across
 * (+x = wearer's left), y depth (+y = front), z height (0 hem, −65 top).
 */

/** How far the placket extends beyond the snaps (cm). */
const PLACKET_MARGIN = 1.0;
/** Hinge line of each panel: at its side seam, a little to the front. */
const PANEL_HINGE = { x: 15.5, y: 1.0 };
/** Panel swing at the hem (radians); the neck opens a fraction of this. */
const PANEL_SWING = 0.62;

export type RigUniforms = { rigOpen: { value: number }; rigCut: { value: number } };

/** rigSide attribute: 0 = by position, +1 left panel, −1 right panel. */
export const LEFT = 1;
export const RIGHT = -1;

const GLSL = /* glsl */ `
uniform float rigOpen;
uniform float rigCut;
attribute float rigSide;
float rigSideOf( vec3 p ) {
  return abs( rigSide ) > 0.5 ? rigSide : ( p.x > rigCut ? 1.0 : -1.0 );
}
float rigAngle( vec3 p, float s ) {
  if ( rigOpen <= 0.0 ) return 0.0;
  float front = smoothstep( -2.0, 6.0, p.y );
  float panel = 1.0 - smoothstep( ${(PANEL_HINGE.x - 2.5).toFixed(1)}, ${(PANEL_HINGE.x + 2.0).toFixed(1)}, s * p.x );
  float fall = 0.35 + 0.65 * ( 1.0 - smoothstep( 30.0, 62.0, -p.z ) );
  return -s * ${PANEL_SWING.toFixed(3)} * rigOpen * front * panel * fall;
}
vec2 rigTurn( vec2 v, float a ) {
  float c = cos( a ), sn = sin( a );
  return vec2( v.x * c - v.y * sn, v.x * sn + v.y * c );
}
vec3 rigMove( vec3 v, vec3 rest ) {
  float s = rigSideOf( rest );
  float a = rigAngle( rest, s );
  if ( a == 0.0 ) return v;
  vec2 hinge = vec2( s * ${PANEL_HINGE.x.toFixed(1)}, ${PANEL_HINGE.y.toFixed(1)} );
  return vec3( hinge + rigTurn( v.xy - hinge, a ), v.z );
}
vec3 rigNormal( vec3 n, vec3 rest ) {
  float a = rigAngle( rest, rigSideOf( rest ) );
  return a == 0.0 ? n : vec3( rigTurn( n.xy, a ), n.z );
}
`;

export const RIG_HOOK_KEY = "fidelio-front-rig";

// The same motion on the CPU (keep in step with the GLSL above) — for
// parts that move rigidly with a panel, e.g. embroidery on the chest.
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Panel swing (radians) at a rest point, for the current opening. */
export function panelAngle(p: readonly number[], open: number, cut: number) {
  if (open <= 0) return 0;
  const s = p[0] > cut ? 1 : -1;
  const front = smooth(-2, 6, p[1]);
  const panel = 1 - smooth(PANEL_HINGE.x - 2.5, PANEL_HINGE.x + 2, s * p[0]);
  const fall = 0.35 + 0.65 * (1 - smooth(30, 62, -p[2]));
  return -s * PANEL_SWING * open * front * panel * fall;
}

const turn = new Matrix4();
const back = new Matrix4();

/** The rigid motion of the panel at `p` (jacket space), written to `out`. */
export function panelMotion(p: readonly number[], uniforms: RigUniforms, out: Matrix4) {
  const a = panelAngle(p, uniforms.rigOpen.value, uniforms.rigCut.value);
  if (a === 0) return out.identity();
  const hx = (p[0] > uniforms.rigCut.value ? 1 : -1) * PANEL_HINGE.x;
  const hy = PANEL_HINGE.y;
  return out
    .makeTranslation(hx, hy, 0)
    .multiply(turn.makeRotationZ(a))
    .multiply(back.makeTranslation(-hx, -hy, 0));
}

export function rigHook(uniforms: RigUniforms): ShaderHook {
  return (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${GLSL}`)
      .replace(
        "#include <beginnormal_vertex>",
        "#include <beginnormal_vertex>\nobjectNormal = rigNormal( objectNormal, position );"
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed = rigMove( transformed, position );");
  };
}

export function addRig(material: Material, uniforms: RigUniforms) {
  addShaderHook(material, RIG_HOOK_KEY, rigHook(uniforms));
}

// ---------------------------------------------------------------------------
// Split

/** A piece of the split line (for the fold and zipper along the edge). */
export type EdgePoint = { p: [number, number, number]; n: [number, number, number]; uv: [number, number] };
export type EdgeSegment = [EdgePoint, EdgePoint];

/**
 * Divides the front of a part along x = cut. Front triangles crossing the
 * plane are split exactly on it; the new vertices exist twice (one per
 * panel, same position). Everything else is copied as is.
 */
export function splitFront(source: BufferGeometry, cut: number) {
  const index = source.getIndex();
  if (!index) return { geometry: source, segments: [] as EdgeSegment[] };
  const names = Object.keys(source.attributes);
  const sizes = names.map((n) => source.getAttribute(n).itemSize);
  const data = names.map((n) => Array.from(source.getAttribute(n).array as TypedArray));
  const P = data[names.indexOf("position")];
  const UV = names.includes("uv") ? data[names.indexOf("uv")] : null;
  let count = source.getAttribute("position").count;
  const sides: number[] = new Array(count).fill(0);
  const out: number[] = [];
  const segments: EdgeSegment[] = [];

  const lerp = (a: number, b: number, t: number, side: number) => {
    names.forEach((_, k) => {
      const s = sizes[k];
      const arr = data[k];
      for (let c = 0; c < s; c++) arr.push(arr[a * s + c] + (arr[b * s + c] - arr[a * s + c]) * t);
    });
    P[count * 3] = cut;
    sides.push(side);
    return count++;
  };
  const cache = new Map<string, { left: number; right: number }>();
  const edge = (a: number, b: number) => {
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const key = `${lo}_${hi}`;
    let hit = cache.get(key);
    if (!hit) {
      const t = (cut - P[lo * 3]) / (P[hi * 3] - P[lo * 3]);
      hit = { left: lerp(lo, hi, t, LEFT), right: lerp(lo, hi, t, RIGHT) };
      cache.set(key, hit);
    }
    return hit;
  };
  // "Outward" along the edge, for layers built beneath the surface: the
  // horizontal direction away from the torso's axis — not the stored
  // vertex normal, which on the placket's stitched ridge points sideways
  // (and on this double-sided asset isn't reliably outward at all).
  const point = (i: number): EdgePoint => {
    const x = P[i * 3];
    const y = P[i * 3 + 1];
    const len = Math.hypot(x, y) || 1;
    return {
      p: [x, y, P[i * 3 + 2]],
      n: [x / len, y / len, 0],
      uv: UV ? [UV[i * 2], UV[i * 2 + 1]] : [0, 0],
    };
  };

  const idx = index.array;
  for (let t = 0; t < idx.length; t += 3) {
    const tri = [idx[t], idx[t + 1], idx[t + 2]];
    const left = tri.map((i) => P[i * 3] > cut);
    const front = (P[tri[0] * 3 + 1] + P[tri[1] * 3 + 1] + P[tri[2] * 3 + 1]) / 3 > 0;
    if (!front || left.every(Boolean) || !left.some(Boolean)) {
      out.push(tri[0], tri[1], tri[2]);
      continue;
    }
    // Clip the triangle into its left and right parts (winding kept).
    const polys = { L: [] as number[], R: [] as number[] };
    const onCut: number[] = [];
    for (let e = 0; e < 3; e++) {
      const a = tri[e];
      const b = tri[(e + 1) % 3];
      (left[e] ? polys.L : polys.R).push(a);
      if (left[e] !== left[(e + 1) % 3]) {
        const hit = edge(a, b);
        polys.L.push(hit.left);
        polys.R.push(hit.right);
        onCut.push(hit.left);
      }
    }
    for (const poly of [polys.L, polys.R])
      for (let k = 1; k < poly.length - 1; k++) out.push(poly[0], poly[k], poly[k + 1]);
    if (onCut.length === 2) segments.push([point(onCut[0]), point(onCut[1])]);
  }

  const geometry = new BufferGeometry();
  names.forEach((name, k) =>
    geometry.setAttribute(name, new Float32BufferAttribute(data[k], sizes[k], source.getAttribute(name).normalized))
  );
  geometry.setAttribute("rigSide", new Float32BufferAttribute(sides, 1));
  geometry.setIndex(out);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, segments };
}

// ---------------------------------------------------------------------------
// Preparing a loaded jacket

export type RigPart = {
  mesh: Mesh;
  original: BufferGeometry;
  split: BufferGeometry;
  segments: EdgeSegment[];
  material: Material;
};

export type FrontRig = {
  uniforms: RigUniforms;
  /** The node holding the jacket's parts (jacket space). */
  parent: Object3D;
  cut: number;
  /** Body, trim and stripe parts, split into panels. */
  parts: { body: RigPart; trim?: RigPart; stripe?: RigPart };
  /** Uses the split geometry (true) or the untouched original. */
  setSplit: (on: boolean) => void;
};

const NAMES = { body: /^body$/i, trim: /^trim$/i, stripe: /^stripe$/i, snaps: /snap|button/i };

/**
 * Rigs a freshly cloned jacket (its own materials): finds the parts,
 * measures the placket from the snaps, splits the fronts and installs the
 * rig on every material. Null if the asset lacks the expected parts.
 */
export function prepareFrontRig(root: Object3D): FrontRig | null {
  const meshes: Mesh[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh) meshes.push(o as Mesh);
  });
  const find = (re: RegExp) =>
    meshes.find((m) => !Array.isArray(m.material) && re.test((m.material as Material).name ?? ""));
  const bodyMesh = find(NAMES.body);
  const snapsMesh = find(NAMES.snaps);
  if (!bodyMesh?.parent || !snapsMesh) return null;

  // The placket edge: the snaps' outer edge (toward the wearer's left)
  // plus the placket margin.
  snapsMesh.geometry.computeBoundingBox();
  const cut = snapsMesh.geometry.boundingBox!.max.x + PLACKET_MARGIN;

  const part = (mesh: Mesh | undefined): RigPart | undefined => {
    if (!mesh) return undefined;
    const { geometry, segments } = splitFront(mesh.geometry, cut);
    return { mesh, original: mesh.geometry, split: geometry, segments, material: mesh.material as Material };
  };
  const parts = { body: part(bodyMesh)!, trim: part(find(NAMES.trim)), stripe: part(find(NAMES.stripe)) };

  const uniforms: RigUniforms = { rigOpen: { value: 0 }, rigCut: { value: cut } };
  for (const m of meshes)
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => addRig(mat, uniforms));
  for (const m of meshes) m.userData.frontRig = uniforms;

  const all = [parts.body, parts.trim, parts.stripe].filter((p): p is RigPart => Boolean(p));
  return {
    uniforms,
    parent: bodyMesh.parent,
    cut,
    parts,
    setSplit: (on) => all.forEach((p) => (p.mesh.geometry = on ? p.split : p.original)),
  };
}

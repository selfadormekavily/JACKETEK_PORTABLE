import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Decal } from "@react-three/drei";
import { BufferAttribute, CanvasTexture, Color, Euler, Matrix4, Vector2, Vector3, type Mesh } from "three";
import type { EmbroideryMaps } from "../embroidery/embroideryMaps";
import {
  registerStitch,
  stitchRevealHook,
  type StitchUniform,
} from "../embroidery/stitchReveal";
import { panelMotion, type RigUniforms } from "./frontRig";
import { composeHooks } from "./shaderHooks";

export type Vec3 = [number, number, number];

/** Where and how large an embroidery decal sits on its parent mesh. */
export type DecalPlacement = {
  /** In the parent mesh's local space, on its surface. */
  position: Vec3;
  /** Orientation; the decal projects along its local z axis. */
  rotation: Vec3;
  /** Width and height of the artwork. */
  size: [number, number];
  /** Projection depth; keep it shallow so it never reaches the far side. */
  depth: number;
};

type PointerHandler = (e: ThreeEvent<PointerEvent>) => void;

type EmbroideryDecalProps = DecalPlacement & {
  /** The element's id (lets a scene animate its stitching-in). */
  id?: string;
  /** The jacket's front rig, if it can open (the decal moves with it). */
  rig?: RigUniforms;
  maps: EmbroideryMaps;
  /** Tints the sheen; null (an image's own colours) uses neutral sheen. */
  threadHex: string | null;
  /** Shows a hairline guide frame around the artwork. */
  selected?: boolean;
  onPointerDown?: PointerHandler;
  onPointerMove?: PointerHandler;
  onPointerUp?: PointerHandler;
  onLostPointerCapture?: PointerHandler;
};

const NORMAL_SCALE = new Vector2(1, 1);
/**
 * Steepest fabric a decal is projected onto: cos of the angle between the
 * surface and the projection axis (0.2 ≈ 78°). Beyond it the artwork
 * would only be smeared across the fold.
 */
const MIN_FACING = 0.2;

/**
 * Keeps only the triangles of a projected decal that face its projector.
 * DecalGeometry projects onto every triangle inside its box, whichever
 * way it faces; where the box reaches round a tight curve (the upper
 * sleeve folding toward the armhole), the fabric at and past the fold
 * would carry a second, partial, smeared copy of the artwork. Runs after drei's
 * <Decal> builds its geometry (child layout effects run first); filtering
 * an already-filtered geometry changes nothing.
 */
function keepFacingTriangles(mesh: Mesh | null, rotation: Vec3) {
  const geometry = mesh?.geometry;
  const position = geometry?.getAttribute("position");
  if (!geometry || !position || geometry.index) return;
  const axis = new Vector3(0, 0, 1).applyEuler(new Euler(...rotation));
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const keep: number[] = [];
  for (let t = 0; t < position.count / 3; t++) {
    a.fromBufferAttribute(position, t * 3);
    b.fromBufferAttribute(position, t * 3 + 1).sub(a);
    c.fromBufferAttribute(position, t * 3 + 2).sub(a);
    if (b.cross(c).normalize().dot(axis) > MIN_FACING) keep.push(t);
  }
  if (keep.length * 3 === position.count) return;
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    if (!(attribute instanceof BufferAttribute)) continue;
    const size = attribute.itemSize;
    const src = attribute.array;
    const out = new Float32Array(keep.length * 3 * size);
    keep.forEach((t, k) => out.set(src.subarray(t * 3 * size, (t + 1) * 3 * size), k * 3 * size));
    geometry.setAttribute(name, new BufferAttribute(out, size));
  }
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
}

/**
 * Embroidery projected onto the surface of its PARENT mesh (render it as
 * a child of the mesh it decorates). The projected geometry follows the
 * fabric's curvature, so it never floats and stays attached however the
 * jacket moves.
 *
 * Layers (maps from embroidery/embroideryMaps.ts):
 *  1. a soft contact shadow on the fabric under the thread;
 *  2. the thread — satin-stitch colour, a normal map for the raised,
 *     stitched relief, occlusion in its grooves, matte per-ridge
 *     roughness and a soft fibre sheen;
 *  3. when selected, a hairline guide frame (also projected).
 */
export default function EmbroideryDecal({
  id,
  rig,
  maps,
  threadHex,
  selected = false,
  position,
  rotation,
  size,
  depth,
  ...handlers
}: EmbroideryDecalProps) {
  const [width, height] = size;
  const scale = useMemo<Vec3>(() => [width, height, depth], [width, height, depth]);
  const frameScale = useMemo<Vec3>(
    () => [width + height * 0.3, height * 1.3, depth],
    [width, height, depth]
  );
  const sheenColor = useMemo(
    () => new Color(threadHex ?? "#ffffff").lerp(new Color("#ffffff"), 0.35),
    [threadHex]
  );
  const frame = useMemo(() => (selected ? createFrameTexture(frameScale[0] / frameScale[1]) : null), [
    selected,
    frameScale,
  ]);
  useEffect(() => () => frame?.dispose(), [frame]);

  // Fully stitched unless a scene animates it (see stitchReveal.ts).
  const reveal = useMemo<StitchUniform>(() => ({ value: 1 }), []);
  const revealHooks = useMemo(
    () => composeHooks([["fidelio-stitch-reveal", stitchRevealHook(reveal)]]),
    [reveal]
  );
  useEffect(() => (id ? registerStitch(id, reveal) : undefined), [id, reveal]);

  // On an opening jacket the embroidery rides its front panel: chest
  // pieces sit on the panel's rigid part, so they take its motion as a
  // whole (decal meshes are built in the parent's space, at identity).
  const shadowRef = useRef<Mesh>(null);
  const threadRef = useRef<Mesh>(null);
  const frameRef = useRef<Mesh>(null);
  const motion = useMemo(() => new Matrix4(), []);
  // One copy of the artwork, on the face it's sewn on (see keepFacingTriangles).
  useLayoutEffect(() => {
    for (const m of [shadowRef.current, threadRef.current, frameRef.current]) keepFacingTriangles(m, rotation);
  });
  // Marked as embroidery so jacket-wide shadow settings skip it.
  useEffect(() => {
    for (const m of [shadowRef.current, threadRef.current, frameRef.current]) {
      if (!m) continue;
      m.userData.embroidery = true;
      m.castShadow = false;
    }
  });
  useFrame(() => {
    if (!rig) return;
    panelMotion(position, rig, motion);
    for (const m of [shadowRef.current, threadRef.current, frameRef.current]) {
      if (!m) continue;
      m.matrixAutoUpdate = false;
      m.matrix.copy(motion);
    }
  });

  return (
    <>
      <Decal ref={shadowRef} position={position} rotation={rotation} scale={scale} renderOrder={1}>
        <meshBasicMaterial
          {...revealHooks}
          color="#000000"
          alphaMap={maps.shadowMap}
          transparent
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          toneMapped={false}
        />
      </Decal>
      <Decal ref={threadRef} position={position} rotation={rotation} scale={scale} renderOrder={2} {...handlers}>
        <meshPhysicalMaterial
          {...revealHooks}
          map={maps.map}
          normalMap={maps.normalMap}
          normalScale={NORMAL_SCALE}
          roughnessMap={maps.roughnessMap}
          roughness={1}
          metalness={0}
          aoMap={maps.aoMap}
          // Matte thread: weak highlights and reflections (the fabric's
          // are set in jacket/materialMapping.ts), a soft fibre sheen at
          // grazing angles — never a printed, plastic gloss. (Specular
          // intensity, not envMapIntensity: that would also dim the
          // ambient light on the thread and so darken its colours.)
          specularIntensity={0.3}
          sheen={0.3}
          sheenRoughness={0.8}
          sheenColor={sheenColor}
          transparent
          alphaTest={0.02}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-4}
        />
      </Decal>
      {frame && (
        <Decal ref={frameRef} position={position} rotation={rotation} scale={frameScale} renderOrder={3}>
          <meshBasicMaterial
            // Mid-grey reads on black, navy and ivory fabric alike.
            color="#9a9a9a"
            alphaMap={frame}
            transparent
            opacity={0.95}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-6}
            toneMapped={false}
          />
        </Decal>
      )}
    </>
  );
}

/**
 * A fixed embroidery zone's box outlined on the fabric (the same hairline
 * frame with corner ticks), exactly the zone's size: shows the area a
 * design is fitted into, whether or not the zone holds one yet.
 */
export function ZoneFrameDecal({ rig, position, rotation, size, depth }: DecalPlacement & { rig?: RigUniforms }) {
  const [width, height] = size;
  const scale = useMemo<Vec3>(() => [width, height, depth], [width, height, depth]);
  const frame = useMemo(() => createFrameTexture(width / height), [width, height]);
  useEffect(() => () => frame.dispose(), [frame]);
  const ref = useRef<Mesh>(null);
  const motion = useMemo(() => new Matrix4(), []);
  useLayoutEffect(() => keepFacingTriangles(ref.current, rotation));
  useEffect(() => {
    if (!ref.current) return;
    ref.current.userData.embroidery = true;
    ref.current.castShadow = false;
  });
  useFrame(() => {
    if (!rig || !ref.current) return;
    panelMotion(position, rig, motion);
    ref.current.matrixAutoUpdate = false;
    ref.current.matrix.copy(motion);
  });
  return (
    <Decal ref={ref} position={position} rotation={rotation} scale={scale} renderOrder={3}>
      <meshBasicMaterial
        color="#9a9a9a"
        alphaMap={frame}
        transparent
        opacity={0.95}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-6}
        toneMapped={false}
      />
    </Decal>
  );
}

/** Hairline frame with corner ticks (greyscale, for an alphaMap). */
function createFrameTexture(aspect: number) {
  const h = 128;
  const w = Math.max(32, Math.round(h * aspect));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#fff";
  ctx.setLineDash([4, 5]);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(2, 2, w - 4, h - 4);
  ctx.setLineDash([]);
  ctx.lineWidth = 3;
  const t = Math.min(w, h) * 0.18;
  for (const [x, y, dx, dy] of [
    [2, 2, 1, 1],
    [w - 2, 2, -1, 1],
    [2, h - 2, 1, -1],
    [w - 2, h - 2, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * t, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * t);
    ctx.stroke();
  }
  return new CanvasTexture(c);
}

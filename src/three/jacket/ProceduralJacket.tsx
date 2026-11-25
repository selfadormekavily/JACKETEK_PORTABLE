import { useEffect, useMemo } from "react";
import {
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  LatheGeometry,
  SphereGeometry,
  SplineCurve,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
} from "three";
import type { JacketAppearance } from "@/features/configurator";
import type { Vec3 } from "./EmbroideryDecal";
import { useJacketMaterials } from "./materials";
import {
  getJacketDimensions,
  type JacketDimensions,
  type JacketSilhouette,
} from "./silhouettes";

/**
 * TEMPORARY stand-in for the real jacket GLB: a varsity jacket built
 * from primitives — lathed body, set-in sleeves, knit rib collar, cuffs
 * and waistband, snap placket and leather-trimmed welt pockets.
 *
 * It exposes the same colour zones (body / sleeves / trim) as the real
 * asset. It is only a fallback if the GLB fails to load, so it doesn't
 * render embroidery (that needs the real garment surface).
 */

type ProceduralJacketProps = {
  appearance: JacketAppearance;
  silhouette: JacketSilhouette;
};

export default function ProceduralJacket({
  appearance,
  silhouette,
}: ProceduralJacketProps) {
  const dims = useMemo(
    () => getJacketDimensions(silhouette, appearance.fit),
    [silhouette, appearance.fit]
  );
  const parts = useMemo(() => buildParts(dims), [dims]);
  useEffect(() => () => parts.dispose(), [parts]);

  const materials = useJacketMaterials(appearance.surfaces);

  const { sleeveLength: len, cuffH } = dims;
  const g = parts.geometries;

  return (
    <group>
      <mesh geometry={g.body} material={materials.body} />

      <mesh
        geometry={g.neckLining}
        material={materials.lining}
        position-y={dims.height - 0.02}
      />
      <mesh
        geometry={g.collar}
        material={materials.trim}
        position-y={dims.height + dims.collarH / 2 - 0.012}
      />
      <mesh
        geometry={g.waistband}
        material={materials.trim}
        position-y={-dims.waistbandH / 2}
      />
      {/* A raised seam in the body fabric, not a contrasting line. */}
      <mesh geometry={g.placket} material={materials.body} />

      {parts.snaps.map((position, i) => (
        <mesh
          key={i}
          geometry={g.snap}
          material={materials.hardware}
          position={position}
          rotation-x={Math.PI / 2}
        />
      ))}

      {parts.pockets.map(({ position, rotation }, i) => (
        <mesh
          key={i}
          geometry={g.welt}
          material={materials.sleeves}
          position={position}
          rotation={rotation}
        />
      ))}

      {([1, -1] as const).map((side) => (
        <group
          key={side}
          position={[side * dims.sleeveX, dims.sleeveY, 0]}
          rotation={[dims.sleeveForward, 0, side * dims.sleeveAngle]}
        >
          {/* Sleeve head, flattened so it sits inside the shoulder line. */}
          <mesh
            geometry={g.shoulderCap}
            material={materials.sleeves}
            scale-y={0.7}
          />
          <mesh
            geometry={g.sleeve}
            material={materials.sleeves}
            position-y={-len / 2}
          />
          <mesh
            geometry={g.cuff}
            material={materials.trim}
            position-y={-len - cuffH / 2}
          />
          <mesh
            geometry={g.cuffLining}
            material={materials.lining}
            position-y={-len - cuffH + 0.002}
          />
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Geometry

function buildParts(d: JacketDimensions) {
  const H = d.height;

  // Body: a lathed profile from waistband to neckline, flattened
  // front-to-back into an ellipse.
  const profile = new SplineCurve([
    new Vector2(d.waistR, 0),
    new Vector2(d.waistR + (d.chestR - d.waistR) * 0.45, H * 0.25),
    new Vector2(d.chestR, H * 0.55),
    new Vector2(d.shoulderR, H * 0.72),
    new Vector2(d.shoulderR * 0.96, H * 0.86),
    new Vector2(d.shoulderR * 0.76, H * 0.945),
    new Vector2(d.neckR + 0.04, H * 0.985),
    new Vector2(d.neckR, H),
  ]).getPoints(48);

  const body = new LatheGeometry(profile, 96);
  body.scale(1, 1, d.depth);

  const radiusAt = (y: number) => {
    for (let i = 1; i < profile.length; i++) {
      const a = profile[i - 1];
      const b = profile[i];
      if (y <= b.y) return a.x + ((y - a.y) / (b.y - a.y || 1)) * (b.x - a.x);
    }
    return profile[profile.length - 1].x;
  };
  // Front surface z at (x, y) on the elliptical body.
  const surfaceZ = (x: number, y: number) => {
    const r = radiusAt(y);
    return d.depth * Math.sqrt(Math.max(r * r - x * x, 0));
  };
  // Rotation about y that makes a flat piece face the body's normal.
  const normalYaw = (x: number, y: number) => {
    const r = radiusAt(y);
    const z = surfaceZ(x, y);
    return Math.atan2(x / (r * r), z / (r * r * d.depth * d.depth));
  };

  const ellipseDisc = (radius: number, facingUp: boolean) => {
    const g = new CircleGeometry(radius, 48);
    g.rotateX(facingUp ? -Math.PI / 2 : Math.PI / 2);
    g.scale(1, 1, d.depth);
    return g;
  };

  const collar = new CylinderGeometry(
    d.neckR * 1.03,
    d.neckR * 1.1,
    d.collarH,
    72,
    1,
    true
  );
  collar.scale(1, 1, d.depth);

  const waistband = new CylinderGeometry(
    d.waistR * 0.995,
    d.waistR * 0.95,
    d.waistbandH,
    96,
    1,
    true
  );
  waistband.scale(1, 1, d.depth);

  // Centre-front seam where the snap placket closes.
  const placketPoints: Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const y = (i / 24) * H * 0.965;
    placketPoints.push(new Vector3(0, y, surfaceZ(0, y) + 0.003));
  }
  const placket = new TubeGeometry(
    new CatmullRomCurve3(placketPoints),
    64,
    0.0028,
    6
  );

  const snaps: Vec3[] = [0.1, 0.28, 0.46, 0.64, 0.8].map((t) => {
    const y = H * t;
    return [0, y, surfaceZ(0, y) + 0.005];
  });

  const pocketY = H * 0.3;
  const pockets = ([1, -1] as const).map((side) => {
    const x = side * d.chestR * 0.55;
    return {
      position: [x, pocketY, surfaceZ(x, pocketY) + 0.004] as Vec3,
      rotation: [0, normalYaw(x, pocketY), -side * 0.28] as Vec3,
    };
  });

  const geometries = {
    body,
    neckLining: ellipseDisc(d.neckR, true),
    collar,
    waistband,
    placket,
    snap: new CylinderGeometry(0.013, 0.013, 0.008, 24),
    welt: new BoxGeometry(0.028, 0.17, 0.012),
    shoulderCap: new SphereGeometry(d.sleeveTopR, 40, 20),
    sleeve: new CylinderGeometry(
      d.sleeveTopR,
      d.sleeveCuffR,
      d.sleeveLength,
      48,
      12,
      true
    ),
    cuff: new CylinderGeometry(
      d.sleeveCuffR * 1.01,
      d.sleeveCuffR * 0.94,
      d.cuffH,
      48,
      1,
      true
    ),
    cuffLining: (() => {
      const g = new CircleGeometry(d.sleeveCuffR * 0.93, 32);
      g.rotateX(Math.PI / 2);
      return g;
    })(),
  };

  return {
    geometries,
    snaps,
    pockets,
    dispose: () =>
      Object.values(geometries).forEach((g: BufferGeometry) => g.dispose()),
  };
}

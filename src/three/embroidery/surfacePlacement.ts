import {
  Euler,
  Matrix4,
  Mesh,
  Raycaster,
  Vector3,
  type Object3D,
} from "three";
import type { DisplayPlacementId, PlacementId } from "@/features/configurator";
import {
  EMBROIDERY_ZONE_LIST,
  LEGACY_ZONES,
  type EmbroideryZone,
} from "@/features/configurator/model/embroideryGeometry";
import type { DecalPlacement } from "../jacket/EmbroideryDecal";

/**
 * EMBROIDERY SURFACE PLACEMENT — where embroidery sits on a real jacket
 * GLB, found at runtime (no anchor objects needed in the file).
 *
 * Zones are authored in the jacket's NORMALISED space (metres, hem at
 * y = 0, centred, front facing +z — see GltfJacket's fit). To place an
 * element, a ray is cast at its point from the front (or back) onto the
 * body panels; the hit gives the exact surface point and normal. The
 * result is expressed in the hit mesh's own local space, so a decal
 * rendered as that mesh's child stays attached through any rotation,
 * camera move or animation.
 */

export type JacketFit = { scale: number; offset: readonly [number, number, number] };

export type ZoneSpec = {
  /** Zone centre: x (+ = wearer's left) and y (up from the hem), metres. */
  point: [number, number];
  /** Which way the zone faces: rays come from the front (+z) or back. */
  side: "front" | "back";
  /**
   * Sleeve zones: the direction the zone faces, radians around the
   * vertical from the front (+ toward the wearer's left), and the depth
   * (z) of the sleeve's centre line. The ray is aimed at (x, y, z).
   */
  yaw?: number;
  /** …and how far it tilts up toward the sky (radians; shoulders face up-and-out). */
  pitch?: number;
  z?: number;
  /** Which part of the garment carries it (default: the body panels). */
  surface?: "body" | "sleeves";
  /**
   * A fixed zone's box, [width, height] metres: an image is fitted into it
   * (proportions kept, centred). Absent on display spots, which size
   * images by `imageSize` × scale instead.
   */
  box?: [number, number];
  /** Capital-letter height of text at scale 1, metres. */
  textHeight: number;
  /** Longest side of an image design at scale 1, metres. */
  imageSize: number;
  /** Widest an element may get here (long text shrinks to fit), metres. */
  maxWidth: number;
  /** Minimum projection depth, metres (grows with width to follow curves). */
  depth: number;
};

/**
 * The ten fixed zones, from the single definition shared with the saved
 * order and production (model/embroideryGeometry.ts). Body zones are hit
 * straight on from the front or back; sleeve zones from the side, facing
 * straight out from the sleeve's outer side (so designs read upright on
 * the hanging sleeve).
 */
const fixedZone = (zone: EmbroideryZone): ZoneSpec => {
  const sleeve = zone.side === "leftSleeve" || zone.side === "rightSleeve";
  const [w, h] = zone.box;
  const sized = { box: zone.box, imageSize: Math.max(w, h), maxWidth: w, textHeight: h * 0.45 };
  if (!sleeve) {
    return { point: zone.point, side: zone.side as "front" | "back", ...sized, depth: zone.side === "back" ? 0.06 : 0.04 };
  }
  return {
    point: zone.point,
    side: "front",
    yaw: zone.side === "leftSleeve" ? Math.PI / 2 : -Math.PI / 2,
    pitch: 0,
    z: zone.aimZ ?? 0,
    surface: "sleeves",
    ...sized,
    depth: 0.05,
  };
};

export const EMBROIDERY_ZONES: Record<DisplayPlacementId, ZoneSpec> = {
  ...(Object.fromEntries(EMBROIDERY_ZONE_LIST.map((z) => [z.id, fixedZone(z)])) as Record<PlacementId, ZoneSpec>),
  // Display only (the homepage; designs saved before the fixed zones, if
  // ever shown): the old free zones, sized freely.
  upperBack: { ...LEGACY_ZONES.upperBack, depth: 0.06 },
  centerChest: { ...LEGACY_ZONES.centerChest, depth: 0.05 },
  // The shoulders: on the sleeve cap just below the shoulder seam, facing
  // out and a little up — where a varsity shoulder number is sewn. Seen
  // from the front, they turn away with the shoulder's curve.
  leftSleeve: { point: [0.27, 0.548], side: "front", yaw: 0.44, pitch: 0.2, z: 0.03, surface: "sleeves", textHeight: 0.07, imageSize: 0.09, maxWidth: 0.11, depth: 0.05 },
  rightSleeve: { point: [-0.27, 0.548], side: "front", yaw: -0.44, pitch: 0.2, z: 0.03, surface: "sleeves", textHeight: 0.07, imageSize: 0.09, maxWidth: 0.11, depth: 0.05 },
};

export type ResolvedPlacement = { mesh: Mesh; placement: DecalPlacement };

const raycaster = new Raycaster();

/** Zone-relative offset (facing the zone) → normalised jacket point. */
function zonePoint(zone: ZoneSpec, [ox, oy]: readonly [number, number]): [number, number] {
  const facing = zone.side === "front" ? 1 : -1;
  return [zone.point[0] + ox * facing, zone.point[1] + oy];
}

/**
 * The inverse of placeOnSurface's aim: a point on the garment (world
 * space) → its offset from the zone's centre, metres, facing the zone
 * (x → right, y → up) — the same frame the content is placed in (body
 * zones: mirrored on the back; sleeve zones: along the sleeve's outer side).
 */
export function zoneOffsetAt(root: Object3D, fit: JacketFit, zone: ZoneSpec, worldPoint: Vector3): [number, number] {
  const local = root.worldToLocal(worldPoint.clone());
  const n = new Vector3(local.x * fit.scale + fit.offset[0], local.y * fit.scale + fit.offset[1], local.z * fit.scale + fit.offset[2]);
  if (zone.yaw !== undefined) {
    const across = new Vector3(Math.cos(zone.yaw), 0, -Math.sin(zone.yaw));
    const centre = new Vector3(zone.point[0], zone.point[1], zone.z ?? 0);
    return [n.clone().sub(centre).dot(across), n.y - zone.point[1]];
  }
  const facing = zone.side === "front" ? 1 : -1;
  return [(n.x - zone.point[0]) * facing, n.y - zone.point[1]];
}

/**
 * Where on the garment an element goes: the surface point under
 * `zone + offset`, oriented to the fabric, turned by `rotation`
 * (radians, counter-clockwise facing the zone), `size` metres wide/high.
 *
 * @param root   the jacket's root object (inside the fit transform)
 * @param panels meshes that can carry embroidery (body panels)
 */
export function placeOnSurface(
  root: Object3D,
  panels: readonly Mesh[],
  fit: JacketFit,
  zone: ZoneSpec,
  offset: readonly [number, number],
  rotation: number,
  size: [number, number]
): ResolvedPlacement | null {
  // Matrices relative to the jacket root, independent of wherever the
  // root currently sits (or turns) in the scene.
  root.updateMatrixWorld(true);
  const rootInverse = new Matrix4().copy(root.matrixWorld).invert();

  const facing = zone.side === "front" ? 1 : -1;
  let origin: Vector3;
  let direction: Vector3;
  /** Shoulder zones: the reading direction, along the shoulder (root space). */
  let reading: Vector3 | null = null;
  if (zone.yaw !== undefined) {
    // Aimed at the zone's point from the direction it faces.
    const pitch = zone.pitch ?? 0;
    const f = new Vector3(Math.sin(zone.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(zone.yaw) * Math.cos(pitch));
    const across = new Vector3(Math.cos(zone.yaw), 0, -Math.sin(zone.yaw));
    const target = new Vector3(zone.point[0], zone.point[1] + offset[1], zone.z ?? 0).addScaledVector(across, offset[0]);
    const start = target.clone().addScaledVector(f, 3);
    origin = new Vector3(
      (start.x - fit.offset[0]) / fit.scale,
      (start.y - fit.offset[1]) / fit.scale,
      (start.z - fit.offset[2]) / fit.scale
    );
    direction = f.negate();
    reading = across;
  } else {
    const [nx, ny] = zonePoint(zone, offset);
    // Normalised → root space.
    origin = new Vector3(
      (nx - fit.offset[0]) / fit.scale,
      (ny - fit.offset[1]) / fit.scale,
      (3 * facing - fit.offset[2]) / fit.scale
    );
    direction = new Vector3(0, 0, -facing);
  }
  raycaster.set(origin, direction);

  let best: { mesh: Mesh; relative: Matrix4; point: Vector3; normal: Vector3; distance: number } | null =
    null;
  for (const mesh of panels) {
    const relative = new Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld);
    // A probe sharing the geometry, placed in root space.
    const probe = new Mesh(mesh.geometry, mesh.material);
    probe.matrixAutoUpdate = false;
    probe.matrixWorld.copy(relative);
    const hit = raycaster.intersectObject(probe, false)[0];
    if (hit?.face && (!best || hit.distance < best.distance)) {
      best = { mesh, relative, point: hit.point, normal: hit.face.normal.clone(), distance: hit.distance };
    }
  }
  if (!best) return null;

  const { mesh, relative } = best;
  const toLocal = new Matrix4().copy(relative).invert();
  const position = best.point.clone().applyMatrix4(toLocal);

  // Face normals can point inwards on double-sided cloth: face the ray.
  const zAxis = best.normal.normalize();
  if (zAxis.clone().transformDirection(relative).dot(direction) > 0) zAxis.negate();

  // Upright on the fabric, then turned about the surface normal. On a
  // shoulder the surface faces up, so "upright" is undefined there: the
  // lettering instead runs along the shoulder (its horizontal tangent),
  // with up following the surface toward the neck.
  let xUp: Vector3;
  let yUp: Vector3;
  if (reading) {
    const r = reading.clone().transformDirection(toLocal);
    xUp = r.sub(zAxis.clone().multiplyScalar(r.dot(zAxis))).normalize();
    yUp = new Vector3().crossVectors(zAxis, xUp).normalize();
  } else {
    const up = new Vector3(0, 1, 0).transformDirection(toLocal);
    yUp = up.sub(zAxis.clone().multiplyScalar(up.dot(zAxis))).normalize();
    xUp = new Vector3().crossVectors(yUp, zAxis).normalize();
  }
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  const xAxis = xUp.clone().multiplyScalar(c).addScaledVector(yUp, s);
  const yAxis = yUp.clone().multiplyScalar(c).addScaledVector(xUp, -s);
  const euler = new Euler().setFromRotationMatrix(new Matrix4().makeBasis(xAxis, yAxis, zAxis));

  // Real-world size → mesh-local units.
  const localPerMetre = 1 / (fit.scale * relative.getMaxScaleOnAxis());
  // Deep enough to reach round the chest's curve at the element's edges,
  // shallow enough never to reach the far side of the garment.
  const depth = Math.max(zone.depth, Math.max(size[0], size[1]) * 0.7);

  return {
    mesh,
    placement: {
      position: [position.x, position.y, position.z],
      rotation: [euler.x, euler.y, euler.z],
      size: [size[0] * localPerMetre, size[1] * localPerMetre],
      depth: depth * localPerMetre,
    },
  };
}

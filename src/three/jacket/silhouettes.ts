import type { FitId } from "@/features/configurator";

/**
 * Proportions for the two jacket cuts. Plain numbers only (no three.js
 * import), so layout code can use them without loading the 3D bundle.
 *
 * Units are scene units (~0.55 m). The jacket stands with the top of
 * the waistband at y = 0 and faces +z.
 */

export type JacketSilhouette = "male" | "female";

export type JacketDimensions = {
  /** Waistband top (y = 0) to neckline. */
  height: number;
  /** Front-to-back depth as a fraction of width. */
  depth: number;
  waistR: number;
  chestR: number;
  shoulderR: number;
  neckR: number;
  sleeveLength: number;
  sleeveTopR: number;
  sleeveCuffR: number;
  /** Outward swing of the sleeves (radians). */
  sleeveAngle: number;
  /** Forward swing of the sleeves (radians, negative = forward). */
  sleeveForward: number;
  /** Shoulder pivot the sleeves hang from. */
  sleeveX: number;
  sleeveY: number;
  waistbandH: number;
  cuffH: number;
  collarH: number;
};

type BaseCut = Pick<
  JacketDimensions,
  | "height"
  | "waistR"
  | "chestR"
  | "shoulderR"
  | "neckR"
  | "sleeveLength"
  | "sleeveTopR"
  | "sleeveCuffR"
>;

const CUTS: Record<JacketSilhouette, BaseCut> = {
  male: {
    height: 1,
    waistR: 0.4,
    chestR: 0.445,
    shoulderR: 0.45,
    neckR: 0.17,
    sleeveLength: 0.9,
    sleeveTopR: 0.145,
    sleeveCuffR: 0.108,
  },
  female: {
    height: 0.95,
    waistR: 0.345,
    chestR: 0.4,
    shoulderR: 0.395,
    neckR: 0.155,
    sleeveLength: 0.84,
    sleeveTopR: 0.13,
    sleeveCuffR: 0.096,
  },
};

export function getJacketDimensions(
  silhouette: JacketSilhouette,
  fit: FitId = "regular"
): JacketDimensions {
  const cut = CUTS[silhouette];
  // Relaxed: a little more room through the body and sleeves.
  const ease = fit === "relaxed" ? 1.05 : 1;

  const waistR = cut.waistR * ease;
  const chestR = cut.chestR * ease;
  const shoulderR = cut.shoulderR * ease;

  return {
    ...cut,
    depth: 0.6,
    waistR,
    chestR,
    shoulderR,
    sleeveTopR: cut.sleeveTopR * ease,
    sleeveCuffR: cut.sleeveCuffR * ease,
    sleeveAngle: 0.1,
    sleeveForward: -0.07,
    sleeveX: shoulderR * 0.8,
    sleeveY: cut.height * 0.78,
    waistbandH: 0.11,
    cuffH: 0.09,
    collarH: 0.062,
  };
}

/** Axis-aligned size of the front-facing jacket, for camera framing. */
export function getJacketBounds(d: JacketDimensions) {
  const sleeveDrop = Math.cos(d.sleeveAngle) * d.sleeveLength + d.cuffH;
  const halfWidth =
    d.sleeveX + Math.sin(d.sleeveAngle) * d.sleeveLength + d.sleeveCuffR;
  const top = d.height + d.collarH;
  const bottom = Math.min(-d.waistbandH, d.sleeveY - sleeveDrop);
  return {
    width: halfWidth * 2,
    height: top - bottom,
    centerY: (top + bottom) / 2,
    bottom,
  };
}

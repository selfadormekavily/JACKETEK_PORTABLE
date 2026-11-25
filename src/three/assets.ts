import type { JacketSilhouette } from "./jacket/silhouettes";

/** public/models/fidelio jacket_REALISM_PHASE2B.glb (the space is URL-encoded). Kept as backup. */
const FIDELIO_JACKET_PHASE2B = encodeURI("/models/fidelio jacket_REALISM_PHASE2B.glb");
/** public/models/fidelio jacket_REALISM_PHASE5_CLOTH_LOWRES.glb. Kept as backup. */
const FIDELIO_JACKET_PHASE5 = encodeURI(
  "/models/fidelio jacket_REALISM_PHASE5_CLOTH_LOWRES.glb"
);
/**
 * public/models/fidelio jacket_REALISM_PHASE8_ORIGINAL_COLLAR_RESTORED.glb.
 * Kept as backup.
 */
const FIDELIO_JACKET_PHASE8 = encodeURI(
  "/models/fidelio jacket_REALISM_PHASE8_ORIGINAL_COLLAR_RESTORED.glb"
);
/**
 * public/models/fidelio_varsity_v09.glb — current jacket: the GLB export
 * of Fidelio_Varsity_RealisticFit_v09.blend (approved, geometry frozen).
 * One mesh, one material per part — Body, Sleeves, Trim (collar / cuff /
 * waistband rib), Stripe (the rib stripes) and Snaps — with neutral white
 * base colours so zone tinting shows true colours; fabric detail is in
 * the normal map.
 */
const FIDELIO_JACKET_V09 = "/models/fidelio_varsity_v09.glb";

/**
 * THE list of 3D asset files. Files live in /public/models/ and are
 * referenced by URL.
 *
 * - configuratorJacket: the jacket used on the Design page AND in the
 *   homepage hero (two instances).
 * - jackets.*: optional per-cut jacket files; while null, JacketModel
 *   falls back to the procedural stand-in for that cut.
 *
 * Export conventions: glTF 2.0 binary, metres, Y up, facing +Z, origin
 * on the floor. Files that don't follow them can be adjusted at load
 * time via MODEL_FILE_OPTIONS below.
 */
export const MODEL_ASSETS: {
  jackets: Record<JacketSilhouette, string | null>;
  /** The jacket on the Design page and in the hero. */
  configuratorJacket: string | null;
} = {
  jackets: {
    female: null,
    male: null,
  },
  // Previous: FIDELIO_JACKET_PHASE8, before that PHASE5 and PHASE2B
  configuratorJacket: FIDELIO_JACKET_V09,
};

/** Per-file load options, for files that need adjusting at load time. */
export type ModelFileOptions = {
  /** Node names to leave out (e.g. leftovers from the source scene). */
  exclude?: readonly string[];
  /**
   * Recentre the model on the origin (hem on the floor) and scale it to
   * this height in metres — for files not exported per the conventions.
   */
  fitHeight?: number;
};

export const MODEL_FILE_OPTIONS: Record<string, ModelFileOptions> = {
  [FIDELIO_JACKET_PHASE2B]: {
    // A default Blender cube and the original Sketchfab jacket
    // (Object_2–Object_5) are still in this export; the Jacket_* meshes
    // with FID_* materials are the real model.
    exclude: ["Cube", "Object_2", "Object_3", "Object_4", "Object_5"],
    // Exported at 0.15 scale, ~450 units from the origin.
    fitHeight: 0.74,
  },
  [FIDELIO_JACKET_PHASE5]: {
    // Same leftovers as PHASE2B, plus a studio backdrop box, plus two
    // byte-identical copies of the outer sleeves (z-fighting, extra cost).
    exclude: [
      "Cube",
      "FID_Backdrop",
      "Object_2",
      "Object_3",
      "Object_4",
      "Object_5",
      "Jacket_Sleeve_L_Outer_W",
      "Jacket_Sleeve_R_Outer_W",
    ],
    // Same normalisation as PHASE2B (identical jacket bounds), so the
    // new jacket sits in exactly the same place at the same scale.
    fitHeight: 0.74,
  },
  [FIDELIO_JACKET_PHASE8]: {
    // Same leftovers as PHASE5; the backdrop now sits under a
    // FID_Studio_Pivot empty, which is dropped with it.
    exclude: [
      "Cube",
      "FID_Studio_Pivot",
      "Object_2",
      "Object_3",
      "Object_4",
      "Object_5",
      "Jacket_Sleeve_L_Outer_W",
      "Jacket_Sleeve_R_Outer_W",
    ],
    // Normalised like the previous jackets, so it keeps their framing.
    fitHeight: 0.74,
  },
  [FIDELIO_JACKET_V09]: {
    // Exported with only the jacket, but in centimetres under a rotated
    // node. 0.718 m is its true height (collar top to cuff bottom), so
    // this recentres it without resizing.
    fitHeight: 0.718,
  },
};

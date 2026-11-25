import type { CameraView, ColourZone, PlacementId } from "../model/types";

/**
 * Naming contract for the future jacket .glb asset.
 *
 * Hand this to the 3D artist: meshes and empties in the exported file
 * must use these names so the viewer can recolour zones, attach
 * embroidery and frame camera views without per-asset code.
 */

/** Mesh names whose material is recoloured for each zone. */
export const ZONE_MESHES: Record<ColourZone, readonly string[]> = {
  body: ["Body"],
  sleeves: ["Sleeve_L", "Sleeve_R"],
  trim: ["Collar", "Cuff_L", "Cuff_R", "Waistband"],
};

/**
 * Optional locator objects for embroidery zones. Not required: zones are
 * found on the real garment surface at runtime
 * (three/embroidery/surfacePlacement.ts). Reserved names, should a
 * future asset want to pin zones precisely.
 */
export const EMBROIDERY_ANCHORS: Record<PlacementId, string> = {
  leftChest: "Anchor_Chest_L",
  rightChest: "Anchor_Chest_R",
  mainBack: "Anchor_Back",
  backQuote: "Anchor_Back_Quote",
  leftSleeveUpper: "Anchor_Sleeve_L_1",
  leftSleeveMiddle: "Anchor_Sleeve_L_2",
  leftSleeveLower: "Anchor_Sleeve_L_3",
  rightSleeveUpper: "Anchor_Sleeve_R_1",
  rightSleeveMiddle: "Anchor_Sleeve_R_2",
  rightSleeveLower: "Anchor_Sleeve_R_3",
};

/** Camera objects (or targets) for each fixed view. */
export const CAMERA_TARGETS: Record<CameraView, string> = {
  front: "Cam_Front",
  threeQuarter: "Cam_ThreeQuarter",
  back: "Cam_Back",
  left: "Cam_Left",
  right: "Cam_Right",
};

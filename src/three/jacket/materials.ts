import { useEffect, useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import {
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from "three";
import type {
  ColourZone,
  Finish,
  SurfaceAppearance,
} from "@/features/configurator";
import { getFinishBump } from "./textures";

/**
 * Materials for the procedural stand-in jacket: one per colour zone,
 * created once and updated in place when the design changes (no
 * remounts, no shader churn beyond what a finish change requires).
 * Real GLBs keep their own materials and are tinted instead — see
 * materialMapping.ts.
 */
export type JacketMaterials = Record<ColourZone, MeshPhysicalMaterial> & {
  /** Inside of the jacket (neck, cuff openings) and seams. */
  lining: MeshStandardMaterial;
  /** Snaps. */
  hardware: MeshStandardMaterial;
};

type FinishParams = {
  roughness: number;
  sheen: number;
  sheenRoughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  bumpScale: number;
};

const FINISHES: Record<Exclude<Finish, "thread">, FinishParams> = {
  felt: {
    roughness: 0.95,
    sheen: 0.6,
    sheenRoughness: 0.75,
    clearcoat: 0,
    clearcoatRoughness: 0,
    bumpScale: 0.6,
  },
  leather: {
    // Matches the GLB leather response: soft, uncoated (no clearcoat).
    roughness: 0.64,
    sheen: 0,
    sheenRoughness: 0,
    clearcoat: 0,
    clearcoatRoughness: 0,
    bumpScale: 0.25,
  },
  rib: {
    roughness: 0.95,
    sheen: 0.4,
    sheenRoughness: 0.85,
    clearcoat: 0,
    clearcoatRoughness: 0,
    bumpScale: 1.2,
  },
};

const WHITE = new Color("#ffffff");

function createMaterials(): JacketMaterials {
  const zone = () => new MeshPhysicalMaterial({ side: DoubleSide });
  return {
    body: zone(),
    sleeves: zone(),
    trim: zone(),
    lining: new MeshStandardMaterial({ color: "#0d0d0d", roughness: 1 }),
    hardware: new MeshStandardMaterial({
      color: "#bdbdbd",
      metalness: 1,
      roughness: 0.32,
    }),
  };
}

export function applySurface(
  material: MeshPhysicalMaterial,
  { hex, finish }: SurfaceAppearance
) {
  const params = finish === "thread" ? FINISHES.felt : FINISHES[finish];
  material.color.set(hex);
  // Fabric sheen reads best as a slightly lighter tint of the base.
  material.sheenColor.set(hex).lerp(WHITE, 0.3);
  Object.assign(material, params);

  const bump = getFinishBump(finish);
  if (material.bumpMap !== bump) {
    material.bumpMap = bump;
    material.needsUpdate = true;
  }
}

export function useJacketMaterials(
  surfaces: Record<ColourZone, SurfaceAppearance>
) {
  const materials = useMemo(createMaterials, []);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    applySurface(materials.body, surfaces.body);
    applySurface(materials.sleeves, surfaces.sleeves);
    applySurface(materials.trim, surfaces.trim);
    invalidate(); // on-demand canvases need a nudge after mutation
  }, [materials, surfaces, invalidate]);

  useEffect(
    () => () => Object.values(materials).forEach((m) => m.dispose()),
    [materials]
  );

  return materials;
}

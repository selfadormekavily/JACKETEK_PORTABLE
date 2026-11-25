import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, type MeshPhysicalMaterial, type MeshStandardMaterial } from "three";
import type { HardwareFinish } from "@/features/configurator";

/**
 * Metal hardware — the snaps (the GLB's own "Snaps" parts). Real metal:
 * fully metallic, lit by the studio environment, with finish-specific
 * polish; black is a lacquered black nickel, not flat paint.
 */

type HardwareParams = { color: string; metalness: number; roughness: number; envMapIntensity: number };

export const HARDWARE_PARAMS: Record<HardwareFinish, HardwareParams> = {
  black: { color: "#1c1c1f", metalness: 0.75, roughness: 0.34, envMapIntensity: 1 },
  silver: { color: "#d4d6d8", metalness: 1, roughness: 0.24, envMapIntensity: 1.1 },
  gold: { color: "#c9a364", metalness: 1, roughness: 0.28, envMapIntensity: 1.1 },
  gunmetal: { color: "#55585e", metalness: 1, roughness: 0.32, envMapIntensity: 1.05 },
};

type Target = { color: Color; metalness: number; roughness: number; envMapIntensity: number };
type HardwareMaterial = MeshStandardMaterial | MeshPhysicalMaterial;

const EASE = 7;

/**
 * Applies a finish to hardware materials, easing between finishes (the
 * first application is instant). Only these materials are touched.
 */
export function useHardwareFinish(materials: readonly HardwareMaterial[], finish: HardwareFinish | undefined) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!finish) return;
    const p = HARDWARE_PARAMS[finish];
    for (const m of materials) {
      const data = m.userData as { hardwareTarget?: Target };
      const first = !data.hardwareTarget;
      const target = (data.hardwareTarget ??= {
        color: new Color(),
        metalness: 0,
        roughness: 0,
        envMapIntensity: 1,
      });
      target.color.set(p.color);
      target.metalness = p.metalness;
      target.roughness = p.roughness;
      target.envMapIntensity = p.envMapIntensity;
      if (first) {
        m.color.copy(target.color);
        m.metalness = target.metalness;
        m.roughness = target.roughness;
        m.envMapIntensity = target.envMapIntensity;
        if ((m as MeshPhysicalMaterial).isMeshPhysicalMaterial) {
          const physical = m as MeshPhysicalMaterial;
          // Metals: the asset's dull dielectric specular must not apply.
          physical.specularIntensity = 1;
          physical.specularColor.setScalar(1);
          physical.clearcoat = 0;
          physical.sheen = 0;
        }
      }
    }
    invalidate();
  }, [materials, finish, invalidate]);

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-Math.min(delta, 1 / 30) * EASE);
    let moving = false;
    for (const m of materials) {
      const t = (m.userData as { hardwareTarget?: Target }).hardwareTarget;
      if (!t) continue;
      const dc = Math.abs(m.color.r - t.color.r) + Math.abs(m.color.g - t.color.g) + Math.abs(m.color.b - t.color.b);
      const dm = Math.abs(m.metalness - t.metalness) + Math.abs(m.roughness - t.roughness);
      if (dc + dm < 0.002) {
        m.color.copy(t.color);
        m.metalness = t.metalness;
        m.roughness = t.roughness;
        continue;
      }
      m.color.lerp(t.color, k);
      m.metalness += (t.metalness - m.metalness) * k;
      m.roughness += (t.roughness - m.roughness) * k;
      m.envMapIntensity += (t.envMapIntensity - m.envMapIntensity) * k;
      moving = true;
    }
    if (moving) invalidate();
  });
}

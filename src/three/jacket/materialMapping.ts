import { useEffect, useLayoutEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Color,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
  type Mesh,
  type Object3D,
  type Texture,
} from "three";
import type {
  ColourZone,
  Finish,
  SurfaceAppearance,
} from "@/features/configurator";
import { ZONE_MESHES } from "@/features/configurator/viewer/assetContract";
import { addShaderHook } from "./shaderHooks";
import { getFinishDetailNormal, getFinishRoughness } from "./textures";

/**
 * MATERIAL-MAPPING LAYER — how a loaded GLB's parts become the
 * configurator's colour zones (body / sleeves / trim).
 *
 * Nothing here assumes specific names. Each mesh/material is matched,
 * in order of confidence:
 *   1. exact mesh name from the asset contract (e.g. "Sleeve_L")
 *   2. exact material name listed below
 *   3. a name pattern on the mesh, then on the material
 * Unmatched parts keep their original material untouched.
 *
 * Matched materials are CLONED and TINTED, never replaced: the model's
 * own textures (normal, roughness, fabric detail) are preserved, only
 * colour and finish change. For accurate colours, the jacket's base
 * colour textures should be neutral (white/grey).
 *
 * In development the discovered structure is logged to the console
 * ("[jacket] material map"), so matchers can be adjusted here without
 * touching any UI code.
 */

type ZoneMatcher = {
  materialNames: readonly string[];
  patterns: readonly RegExp[];
};

/** Checked in this order: most specific zone first (a "Sleeve_Cuff" is trim). */
const ZONE_ORDER: readonly ColourZone[] = ["trim", "sleeves", "body"];

export const ZONE_MATCHERS: Record<ColourZone, ZoneMatcher> = {
  trim: {
    materialNames: ["Trim", "Rib", "Ribbing"],
    patterns: [/collar/i, /cuff/i, /waist ?band/i, /\bhem\b/i, /\brib/i, /trim/i],
  },
  sleeves: {
    materialNames: ["Sleeves", "Sleeve"],
    patterns: [/sleeve/i, /\barm/i],
  },
  body: {
    materialNames: ["Body", "Shell", "Main"],
    patterns: [/body/i, /torso/i, /shell/i, /front/i, /back/i, /panel/i],
  },
};

/**
 * Parts that take a zone's COLOUR but keep their own finish, by exact
 * material name: the rib stripes are sewn in the sleeve colour, but
 * they're still knit, not leather.
 */
const ACCENTS: Record<string, { zone: ColourZone; finish: Finish }> = {
  Stripe: { zone: "sleeves", finish: "rib" },
};

export type ZoneBinding = {
  mesh: Mesh;
  /** Index into the mesh's material array, or -1 for a single material. */
  slot: number;
  zone: ColourZone;
  /** How it was matched — useful when tuning the matchers. */
  via: "accent" | "mesh-name" | "material-name" | "mesh-pattern" | "material-pattern";
  /** Overrides the zone's finish (accents). */
  finish?: Finish;
  /** The accent's material name (e.g. "Stripe"), for accents. */
  accent?: string;
  material: TintableMaterial;
};

type TintableMaterial = MeshStandardMaterial | MeshPhysicalMaterial;

const isTintable = (m: Material): m is TintableMaterial =>
  (m as MeshStandardMaterial).isMeshStandardMaterial === true;

function matchZone(meshName: string, materialName: string) {
  for (const zone of ZONE_ORDER) {
    if (ZONE_MESHES[zone].includes(meshName)) return { zone, via: "mesh-name" as const };
  }
  for (const zone of ZONE_ORDER) {
    if (ZONE_MATCHERS[zone].materialNames.includes(materialName))
      return { zone, via: "material-name" as const };
  }
  for (const zone of ZONE_ORDER) {
    if (ZONE_MATCHERS[zone].patterns.some((p) => p.test(meshName)))
      return { zone, via: "mesh-pattern" as const };
  }
  for (const zone of ZONE_ORDER) {
    if (ZONE_MATCHERS[zone].patterns.some((p) => p.test(materialName)))
      return { zone, via: "material-pattern" as const };
  }
  return null;
}

/**
 * Finds every tintable material in `root` that belongs to a zone and
 * swaps in a private clone of it (so two instances of the same GLB can
 * be coloured independently).
 */
export function bindZones(root: Object3D): ZoneBinding[] {
  const bindings: ZoneBinding[] = [];
  const report: Record<string, string>[] = [];

  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const slots = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    slots.forEach((original, i) => {
      const accent = ACCENTS[original.name];
      const match = accent
        ? { zone: accent.zone, via: "accent" as const }
        : matchZone(mesh.name, original.name);
      report.push({
        mesh: mesh.name || "(unnamed)",
        material: original.name || "(unnamed)",
        type: original.type,
        zone: match ? `${match.zone} (${match.via})` : "— unmapped",
      });
      if (!match || !isTintable(original)) return;

      const material = original.clone() as TintableMaterial;
      if (Array.isArray(mesh.material)) mesh.material[i] = material;
      else mesh.material = material;
      bindings.push({
        mesh,
        slot: Array.isArray(mesh.material) ? i : -1,
        zone: match.zone,
        via: match.via,
        finish: accent?.finish,
        accent: accent ? original.name : undefined,
        material,
      });
    });
  });

  if (import.meta.env.DEV) {
    console.groupCollapsed("[jacket] material map");
    console.table(report);
    const missing = ZONE_ORDER.filter((z) => !bindings.some((b) => b.zone === z));
    if (missing.length)
      console.warn(`[jacket] no parts matched: ${missing.join(", ")} — see ZONE_MATCHERS`);
    console.groupEnd();
  }
  return bindings;
}

/**
 * How each finish responds to light. Clothing is never coated: there is
 * no clearcoat anywhere (a smooth coat mirrors the studio's light strips
 * as hard white streaks — the "plastic" look).
 *
 * roughness        base roughness (a roughness map, if any, multiplies it)
 * envMapIntensity  how much of the studio environment the surface mirrors
 * specular         strength of direct highlights (0–1)
 * sheen            soft, velvety grazing-angle glow of fibres
 */
type FinishResponse = {
  roughness: number;
  envMapIntensity: number;
  specular: number;
  /**
   * Specular tint strength (grey level). Assets may bake a very low value
   * (v09: 0.15 everywhere), which makes every part equally dull and
   * clay-like; each finish sets its own.
   */
  specularColor: number;
  sheen: number;
  sheenRoughness: number;
  /** Fine surface texture layered over the asset's normal map. */
  detail: { strength: number; repeat: number };
};

const FINISH_RESPONSE: Record<Finish, FinishResponse> = {
  // Wool felt: pressed, non-woven fibres. Very rough, almost no direct
  // highlight or reflection; its only glow is the soft, fuzzy sheen of
  // fibre ends at grazing angles. Fine fibre relief + gentle mottling
  // (see textures.ts) keep it reading as textile, never as a coating.
  felt: {
    roughness: 0.94,
    envMapIntensity: 0.28,
    specular: 0.18,
    specularColor: 0.4,
    sheen: 0.55,
    sheenRoughness: 0.9,
    detail: { strength: 0.45, repeat: 44 },
  },
  // Leather: a touch smoother than the fabric — broad, soft highlights,
  // broken up by visible grain — but never glossy.
  leather: {
    roughness: 0.55,
    envMapIntensity: 1,
    specular: 0.8,
    specularColor: 1,
    // Effectively none — but not 0: crossing zero switches shader
    // variants, which would hitch a leather ↔ felt transition.
    sheen: 0.01,
    sheenRoughness: 0.5,
    detail: { strength: 0.45, repeat: 26 },
  },
  // Knit rib: the most matte of all.
  rib: {
    roughness: 0.9,
    envMapIntensity: 0.4,
    specular: 0.3,
    specularColor: 0.5,
    sheen: 0.35,
    sheenRoughness: 0.85,
    detail: { strength: 0.5, repeat: 90 },
  },
  thread: {
    roughness: 0.7,
    envMapIntensity: 0.6,
    specular: 0.5,
    specularColor: 0.8,
    sheen: 0.4,
    sheenRoughness: 0.5,
    detail: { strength: 0, repeat: 1 },
  },
};

type DetailUniforms = {
  detailNormalMap: { value: Texture | null };
  detailNormalStrength: { value: number };
  detailNormalScale: { value: number };
};

/**
 * Layers a fine detail normal map (leather grain, weave, knit) over the
 * material's own normal map — three.js has no built-in second normal
 * layer. Installed once per material; later finish changes only update
 * uniforms (no shader recompile). Only affects materials that have a
 * tangent-space normal map; others are left untouched.
 */
function setDetailNormal(material: TintableMaterial, finish: Finish) {
  const { strength, repeat } = FINISH_RESPONSE[finish].detail;
  let uniforms = material.userData.detailUniforms as DetailUniforms | undefined;
  if (!uniforms) {
    if (!material.normalMap) return;
    uniforms = {
      detailNormalMap: { value: null },
      detailNormalStrength: { value: 0 },
      detailNormalScale: { value: 1 },
    };
    material.userData.detailUniforms = uniforms;
    const detail = uniforms;
    addShaderHook(material, "fidelio-detail-normal", (shader) => {
      Object.assign(shader.uniforms, detail);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <normalmap_pars_fragment>",
          `#include <normalmap_pars_fragment>
uniform sampler2D detailNormalMap;
uniform float detailNormalStrength;
uniform float detailNormalScale;`
        )
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
#ifdef USE_NORMALMAP_TANGENTSPACE
{
  vec3 detailN = texture2D( detailNormalMap, vNormalMapUv * detailNormalScale ).xyz * 2.0 - 1.0;
  normal = normalize( normal + tbn * vec3( detailN.xy * detailNormalStrength, 0.0 ) );
}
#endif`
        );
    });
  }
  uniforms.detailNormalMap.value = getFinishDetailNormal(finish);
  uniforms.detailNormalStrength.value = uniforms.detailNormalMap.value ? strength : 0;
  uniforms.detailNormalScale.value = repeat;
}

const WHITE = new Color("#ffffff");

/**
 * Colour + finish onto a GLB material: the finish's light response (see
 * FINISH_RESPONSE), keeping the asset's own normal map.
 *
 * Sheen COLOUR always follows the chosen colour: assets bake it for
 * their original colourway (PHASE5's is pale blue), which would glow
 * through a different colour — e.g. turn a black body navy.
 */
function tint(material: TintableMaterial, { hex, finish }: SurfaceAppearance) {
  setColourTarget(material, hex);
  material.metalness = 0;
  if ((material as MeshPhysicalMaterial).isMeshPhysicalMaterial)
    (material as MeshPhysicalMaterial).clearcoat = 0;
  // Remember the asset's own roughness map before anything replaces it.
  material.userData.authored ??= { roughnessMap: material.roughnessMap };

  const data = material.userData as { finish?: Finish; finishTransition?: FinishTransition };
  if (data.finish === finish) return;
  if (!data.finish) {
    // First paint: no transition.
    applyFinishTextures(material, finish);
    applyFinishResponse(material, blendableOf(finish));
  } else {
    // A material change (e.g. leather ↔ felt sleeves) blends over a
    // moment instead of popping; see stepFinish().
    data.finishTransition = {
      from: currentResponse(material),
      to: blendableOf(finish),
      finish,
      t: 0,
      swapped: false,
    };
  }
  data.finish = finish;
}

/** The part of a finish's light response that can blend smoothly. */
type Blendable = {
  roughness: number;
  envMapIntensity: number;
  specular: number;
  specularColor: number;
  sheen: number;
  sheenRoughness: number;
  detail: number;
};

type FinishTransition = {
  from: Blendable;
  to: Blendable;
  finish: Finish;
  /** 0 → 1 through the transition. */
  t: number;
  /** Whether the finish's textures have been swapped in yet. */
  swapped: boolean;
};

/** Duration of a material change. */
const FINISH_SECONDS = 0.32;

const BLENDABLE_KEYS = [
  "roughness",
  "envMapIntensity",
  "specular",
  "specularColor",
  "sheen",
  "sheenRoughness",
] as const;

const blendableOf = (finish: Finish): Blendable => {
  const r = FINISH_RESPONSE[finish];
  return {
    roughness: r.roughness,
    envMapIntensity: r.envMapIntensity,
    specular: r.specular,
    specularColor: r.specularColor,
    sheen: r.sheen,
    sheenRoughness: r.sheenRoughness,
    detail: r.detail.strength,
  };
};

const hasAuthoredRoughness = (material: TintableMaterial) =>
  Boolean((material.userData.authored as { roughnessMap: unknown } | undefined)?.roughnessMap);

function currentResponse(material: TintableMaterial): Blendable {
  const physical = material as MeshPhysicalMaterial;
  const isPhysical = physical.isMeshPhysicalMaterial === true;
  const uniforms = material.userData.detailUniforms as DetailUniforms | undefined;
  return {
    roughness: material.roughness,
    envMapIntensity: material.envMapIntensity,
    specular: isPhysical ? physical.specularIntensity : 0,
    specularColor: isPhysical ? physical.specularColor.r : 0,
    sheen: isPhysical ? physical.sheen : 0,
    sheenRoughness: isPhysical ? physical.sheenRoughness : 0,
    detail: uniforms?.detailNormalStrength.value ?? 0,
  };
}

/** Numeric light response (see FINISH_RESPONSE). */
function applyFinishResponse(material: TintableMaterial, r: Blendable) {
  material.envMapIntensity = r.envMapIntensity;
  // An authored roughness map is kept, just never glossy.
  material.roughness = hasAuthoredRoughness(material)
    ? Math.max(material.roughness, 0.85)
    : r.roughness;
  const uniforms = material.userData.detailUniforms as DetailUniforms | undefined;
  if (uniforms) uniforms.detailNormalStrength.value = uniforms.detailNormalMap.value ? r.detail : 0;
  if ((material as MeshPhysicalMaterial).isMeshPhysicalMaterial) {
    const physical = material as MeshPhysicalMaterial;
    physical.specularIntensity = r.specular;
    physical.specularColor.setScalar(r.specularColor);
    physical.sheen = r.sheen;
    physical.sheenRoughness = r.sheenRoughness;
  }
}

/**
 * A finish's surface textures: where the asset has no roughness map, a
 * subtle procedural grain (so leather and felt break up their
 * highlights instead of reading as a smooth shell), and the fine detail
 * normal (leather grain / weave / knit). Texture swaps only — no shader
 * recompile.
 */
function applyFinishTextures(material: TintableMaterial, finish: Finish) {
  if (!hasAuthoredRoughness(material)) {
    const grain = getFinishRoughness(finish);
    if (material.roughnessMap !== grain) {
      const wasNull = !material.roughnessMap;
      material.roughnessMap = grain;
      if (wasNull) material.needsUpdate = true;
    }
  }
  setDetailNormal(material, finish);
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Advances a material change. Light response (roughness, specular,
 * reflections, sheen) blends across the whole transition; the fine
 * surface detail fades out, swaps, and fades back in, so the grain never
 * pops. Returns true while still changing.
 */
function stepFinish(material: TintableMaterial, delta: number) {
  const data = material.userData as { finishTransition?: FinishTransition };
  const tr = data.finishTransition;
  if (!tr) return false;
  tr.t = Math.min(1, tr.t + delta / FINISH_SECONDS);
  if (tr.t >= 0.5 && !tr.swapped) {
    applyFinishTextures(material, tr.finish);
    tr.swapped = true;
  }
  const e = smooth(tr.t);
  const blended = { detail: 0 } as Blendable;
  for (const k of BLENDABLE_KEYS) blended[k] = tr.from[k] + (tr.to[k] - tr.from[k]) * e;
  blended.detail =
    tr.t < 0.5 ? tr.from.detail * (1 - smooth(tr.t * 2)) : tr.to.detail * smooth(tr.t * 2 - 1);
  applyFinishResponse(material, blended);
  if (tr.t >= 1) delete data.finishTransition;
  return true;
}

type ColourTargets = { colour: Color; sheen: Color };

/**
 * Colour changes don't snap: tint() only sets where the colour is
 * heading, and useZoneTinting eases it there over ~half a second — dye
 * settling into cloth. The very first tint applies instantly.
 */
function setColourTarget(material: TintableMaterial, hex: string) {
  const data = material.userData as { colourTargets?: ColourTargets };
  const first = !data.colourTargets;
  const targets = (data.colourTargets ??= { colour: new Color(), sheen: new Color() });
  targets.colour.set(hex);
  targets.sheen.set(hex).lerp(WHITE, 0.3);
  if (first) {
    material.color.copy(targets.colour);
    if ((material as MeshPhysicalMaterial).isMeshPhysicalMaterial)
      (material as MeshPhysicalMaterial).sheenColor.copy(targets.sheen);
  }
}

/** Per second: how quickly colours ease toward their target. */
const COLOUR_EASE = 7;

const distance = (a: Color, b: Color) =>
  Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);

/** Moves `current` toward `target`; returns true while still moving. */
function easeColour(current: Color, target: Color, k: number) {
  if (distance(current, target) < 0.002) {
    current.copy(target);
    return false;
  }
  current.lerp(target, k);
  return true;
}

/**
 * Binds `root`'s parts to zones once, then re-tints them whenever the
 * design changes. Returns the bindings (e.g. for debugging).
 */
export function useZoneTinting(
  root: Object3D,
  surfaces: Record<ColourZone, SurfaceAppearance>,
  /** The rib stripes' own colour (omitted: their zone's). */
  stripe?: string
) {
  const invalidate = useThree((s) => s.invalidate);
  const bindings = useMemo(() => bindZones(root), [root]);

  useLayoutEffect(() => {
    bindings.forEach((b) => {
      const surface = surfaces[b.zone];
      const hex = b.accent === "Stripe" && stripe ? stripe : surface.hex;
      tint(b.material, { hex, finish: b.finish ?? surface.finish });
    });
    invalidate();
  }, [bindings, surfaces, stripe, invalidate]);

  // Ease colours toward their targets; keeps requesting frames (for
  // on-demand canvases) only while something is still changing.
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * COLOUR_EASE);
    let moving = false;
    for (const { material } of bindings) {
      // Capped: the first frame after an on-demand pause reports the
      // whole pause as its delta.
      if (stepFinish(material, Math.min(delta, 1 / 30))) moving = true;
      const targets = (material.userData as { colourTargets?: ColourTargets }).colourTargets;
      if (!targets) continue;
      if (easeColour(material.color, targets.colour, k)) moving = true;
      if ((material as MeshPhysicalMaterial).isMeshPhysicalMaterial) {
        if (easeColour((material as MeshPhysicalMaterial).sheenColor, targets.sheen, k)) moving = true;
      }
    }
    if (moving) invalidate();
  });

  useEffect(
    () => () => bindings.forEach((b) => b.material.dispose()),
    [bindings]
  );

  return bindings;
}

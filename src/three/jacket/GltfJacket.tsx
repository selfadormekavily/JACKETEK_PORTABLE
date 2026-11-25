import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Vector3, type Material, type Mesh, type MeshStandardMaterial } from "three";
import type { JacketAppearance } from "@/features/configurator";
import { MODEL_FILE_OPTIONS } from "../assets";
import EmbroideryLayer, { type EmbroideryLayerProps } from "../embroidery/EmbroideryLayer";
import type { Vec3 } from "./EmbroideryDecal";
import { prepareFrontRig } from "./frontRig";
import { useHardwareFinish } from "./hardware";
import JacketClosure from "./JacketClosure";
import { useZoneTinting } from "./materialMapping";

/** Interaction hooks for editable embroidery (the configurator). */
export type EmbroideryInteraction = Pick<EmbroideryLayerProps, "selectedZone" | "onSelectZone" | "onMoveInZone">;

type GltfJacketProps = {
  url: string;
  appearance: JacketAppearance;
  castShadow?: boolean;
  embroidery?: EmbroideryInteraction;
  /** Front open (with the hidden zipper). */
  open?: boolean;
};

/** Relaxed fit: a little more room through body and sleeves. */
const FIT_EASE = { regular: 1, relaxed: 1.04 } as const;

/**
 * Renders a real jacket GLB, driven by the same appearance data as the
 * procedural stand-in:
 * - colour zones are found and tinted by the material-mapping layer
 *   (materialMapping.ts), which preserves the asset's own textures;
 * - embroidery elements are stitched onto the body panels by the
 *   embroidery layer (embroidery/EmbroideryLayer): placed by ray-casting
 *   the real surface, projected as children of the garment mesh;
 * - fit scales the garment's width slightly;
 * - per-file options (assets.ts) can drop leftover nodes and recentre /
 *   rescale a file that wasn't exported to the conventions.
 *
 * The dev console prints the discovered material map on load.
 */
export default function GltfJacket({
  url,
  appearance,
  castShadow = false,
  embroidery,
  open = false,
}: GltfJacketProps) {
  const { scene } = useGLTF(url);
  // The front rig exists only where the closure is configurable.
  const rigged = Boolean(appearance.closure);

  // Clone so two instances (e.g. the hero pair) never share mutated
  // nodes OR materials (scene.clone shares materials by default, so
  // fading or tinting one instance would affect the other); then apply
  // this file's load options (see assets.ts).
  const { root, fit, ownMaterials, snaps, rig } = useMemo(() => {
    const options = MODEL_FILE_OPTIONS[url] ?? {};
    const clone = scene.clone(true);
    // Removed, not hidden: bounding boxes (camera framing) include hidden nodes.
    options.exclude?.forEach((name) => clone.getObjectByName(name)?.removeFromParent());

    const ownMaterials: Material[] = [];
    clone.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      const copy = (m: Material) => {
        const c = m.clone(); // textures stay shared
        ownMaterials.push(c);
        return c;
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(copy)
        : copy(mesh.material);
    });

    let fit = { scale: 1, offset: [0, 0, 0] as Vec3 };
    if (options.fitHeight) {
      clone.updateMatrixWorld(true);
      const box = new Box3().setFromObject(clone);
      const size = box.getSize(new Vector3());
      const center = box.getCenter(new Vector3());
      const scale = size.y > 0 ? options.fitHeight / size.y : 1;
      fit = {
        scale,
        offset: [-center.x * scale, -box.min.y * scale, -center.z * scale],
      };
    }
    // The snaps: the asset's own button meshes (their material only is
    // refinished — geometry and positions are never touched).
    const snaps = ownMaterials.filter(
      (m): m is MeshStandardMaterial => SNAPS.test(m.name) && (m as MeshStandardMaterial).isMeshStandardMaterial
    );
    // Front panels that can open (hidden zipper) — see frontRig.ts.
    const rig = rigged ? prepareFrontRig(clone) : null;
    return { root: clone, fit, ownMaterials, snaps, rig };
  }, [scene, url, rigged]);
  useHardwareFinish(snaps, appearance.hardware);
  useEffect(() => () => ownMaterials.forEach((m) => m.dispose()), [ownMaterials]);
  useEffect(() => {
    root.traverse((node) => {
      // Embroidery decals sit on the fabric and never cast shadows (their
      // projection box would throw a dark rectangle onto the garment).
      if ((node as Mesh).isMesh && !node.userData.embroidery) node.castShadow = castShadow;
    });
  }, [root, castShadow]);
  const bindings = useZoneTinting(root, appearance.surfaces, appearance.stripe);

  // The panels embroidery can be stitched onto: body fabric, not trims.
  const panels = useMemo(
    () => [
      ...new Set(
        bindings
          .filter((b) => b.zone === "body" && !NOT_A_PANEL.test(b.mesh.name))
          .map((b) => b.mesh)
      ),
    ],
    [bindings]
  );
  const sleevePanels = useMemo(
    () => [...new Set(bindings.filter((b) => b.zone === "sleeves" && !NOT_A_PANEL.test(b.mesh.name)).map((b) => b.mesh))],
    [bindings]
  );

  const ease = FIT_EASE[appearance.fit];

  return (
    <group scale={[ease, 1, ease]}>
      <group position={fit.offset} scale={fit.scale}>
        <primitive object={root} />
      </group>
      <EmbroideryLayer
        root={root}
        fit={fit}
        panels={panels}
        sleevePanels={sleevePanels}
        elements={appearance.embroidery}
        {...embroidery}
      />
      {rig && (
        <JacketClosure
          rig={rig}
          zipper={appearance.closure?.zipper ?? false}
          open={open}
          hardware={appearance.hardware}
        />
      )}
    </group>
  );
}

/** Body-zone meshes that are trims/details, not panels to embroider on. */
const NOT_A_PANEL = /seam|edge|placket|pocket|welt|stitch|inner/i;
/** The button/snap material(s), by name. */
const SNAPS = /snap|button/i;

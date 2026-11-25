import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial, type Group, type Material } from "three";
import type { HardwareFinish } from "@/features/configurator";
import { addRig, type FrontRig } from "./frontRig";
import { useHardwareFinish } from "./hardware";
import { createEdgeFolds, createZipperHalves } from "./zipperHalves";

/** Seconds to open (or close) the jacket — slow and even. */
const OPEN_SECONDS = 1.8;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type JacketClosureProps = {
  rig: FrontRig;
  /** The hidden zipper is part of the design. */
  zipper: boolean;
  /** Show the jacket open (needs the zipper). */
  open: boolean;
  hardware?: HardwareFinish;
};

/**
 * The hidden zipper and the opening of the front (see frontRig.ts):
 * - without the zipper the jacket is exactly the original model;
 * - with it, the front is split into its two panels and each panel
 *   carries its half of the zipper beneath the placket — invisible while
 *   closed, revealed when the panels swing open;
 * - opening and closing ease smoothly and return exactly to closed.
 */
export default function JacketClosure({ rig, zipper, open, hardware }: JacketClosureProps) {
  const invalidate = useThree((s) => s.invalidate);
  const progress = useRef(0);
  // Split geometry + zipper exist while the zipper is chosen, and stay
  // until the panels are fully closed (nothing disappears mid-motion).
  const [present, setPresent] = useState(zipper);
  if (zipper && !present) setPresent(true);

  useLayoutEffect(() => {
    rig.setSplit(present);
    invalidate();
  }, [rig, present, invalidate]);
  // Development only: lets automated visual checks read the motion (and
  // hide the closure parts to inspect the split shell on its own).
  const partsRef = useRef<Group>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __fidelioRig?: unknown };
    w.__fidelioRig = { uniforms: rig.uniforms, progress, parts: partsRef, invalidate };
    return () => void delete w.__fidelioRig;
  }, [rig, invalidate]);
  useLayoutEffect(
    () => () => {
      rig.setSplit(false);
      rig.uniforms.rigOpen.value = 0;
    },
    [rig]
  );

  const target = zipper && open ? 1 : 0;
  useEffect(() => invalidate(), [target, invalidate]);
  useFrame((_, delta) => {
    const p = progress.current;
    if (p === target) {
      if (p === 0 && !zipper && present) setPresent(false);
      return;
    }
    // Capped step: a slow frame never jumps the motion.
    const step = Math.min(delta, 1 / 30) / OPEN_SECONDS;
    progress.current = target > p ? Math.min(target, p + step) : Math.max(target, p - step);
    rig.uniforms.rigOpen.value = easeInOut(progress.current);
    invalidate();
  });

  // --- Geometry built from the split edge ---------------------------------
  const built = useMemo(() => {
    const zip = createZipperHalves(rig.parts.body.segments);
    const folds = [rig.parts.body, rig.parts.trim, rig.parts.stripe]
      .filter((p): p is NonNullable<typeof p> => Boolean(p && p.segments.length))
      .map((p) => ({ source: p.material, ...createEdgeFolds(p.segments) }));
    return {
      zip,
      folds,
      dispose: () => {
        zip?.dispose();
        folds.forEach((f) => {
          f.left.dispose();
          f.right.dispose();
        });
      },
    };
  }, [rig]);
  useEffect(() => () => built.dispose(), [built]);

  // --- Materials ------------------------------------------------------------
  // Folds mirror their part's fabric (colour, finish, sheen) every frame,
  // without its normal map (tied to the part's own UV layout).
  const folds = useMemo(
    () =>
      built.folds.map((f) => {
        const material = new MeshPhysicalMaterial({ side: DoubleSide });
        addRig(material, rig.uniforms);
        return { ...f, material, source: f.source as MeshPhysicalMaterial };
      }),
    [built, rig]
  );
  const zipMaterials = useMemo(() => {
    const metal = new MeshPhysicalMaterial({ metalness: 1, roughness: 0.28, color: "#d4d6d8" });
    const tape = new MeshStandardMaterial({ color: "#1f1e1c", roughness: 0.92, side: DoubleSide });
    addRig(metal, rig.uniforms);
    addRig(tape, rig.uniforms);
    return { metal, tape };
  }, [rig]);
  useEffect(
    () => () => {
      folds.forEach((f) => f.material.dispose());
      zipMaterials.metal.dispose();
      zipMaterials.tape.dispose();
    },
    [folds, zipMaterials]
  );
  // The fold gives an OPENED edge its thickness; while the panels are
  // together there is no edge to see (and the snaps' raised bases sit
  // right beside it), so it only appears once they part.
  const foldsRef = useRef<Group>(null);
  useFrame(() => {
    if (foldsRef.current) foldsRef.current.visible = rig.uniforms.rigOpen.value > 0.002;
    for (const { source, material } of folds) {
      material.color.copy(source.color);
      material.roughness = source.roughness;
      material.envMapIntensity = source.envMapIntensity;
      if (source.isMeshPhysicalMaterial) {
        material.sheen = source.sheen;
        material.sheenRoughness = source.sheenRoughness;
        material.sheenColor.copy(source.sheenColor);
        material.specularIntensity = source.specularIntensity;
        material.specularColor.copy(source.specularColor);
      }
    }
  });
  // The zipper's metal matches the snaps.
  const metals = useMemo<Material[]>(() => [zipMaterials.metal], [zipMaterials]);
  useHardwareFinish(metals as MeshPhysicalMaterial[], hardware);

  if (!present || !built.zip) return null;
  const { zip } = built;
  return createPortal(
    <group ref={partsRef}>
      <group ref={foldsRef} visible={false}>
        {folds.map((f, i) => (
          <group key={i}>
            <mesh geometry={f.left} material={f.material} />
            <mesh geometry={f.right} material={f.material} />
          </group>
        ))}
      </group>
      <mesh geometry={zip.tape.left} material={zipMaterials.tape} />
      <mesh geometry={zip.tape.right} material={zipMaterials.tape} />
      <mesh geometry={zip.metal.left} material={zipMaterials.metal} />
      <mesh geometry={zip.metal.right} material={zipMaterials.metal} />
    </group>,
    rig.parent
  );
}

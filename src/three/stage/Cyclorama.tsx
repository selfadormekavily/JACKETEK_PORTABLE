import { useEffect, useMemo, type Ref } from "react";
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  type MeshStandardMaterial,
} from "three";

type CycloramaProps = {
  /** Height of the floor. */
  floorY: number;
  /** z of the back wall. */
  backZ: number;
  /** z where the floor ends towards (and past) the camera. */
  frontZ: number;
  /** Half-width along x. */
  halfWidth: number;
  /** Top of the back wall. */
  top: number;
  /** Radius of the floor-to-wall curve (a seamless "infinity cove"). */
  radius?: number;
  color: string;
  /** Access to the cove's material (e.g. to tint it as a story moves). */
  materialRef?: Ref<MeshStandardMaterial>;
  /**
   * Shadow catcher: the cove itself is invisible and only the shadows it
   * receives are drawn (in `color`, at this opacity) — for a transparent
   * canvas over a background drawn by the page.
   */
  shadowOnly?: number;
};

/**
 * A photo-studio infinity cove: floor sweeping up into the back wall
 * with no visible seam. Matte, and it receives the scene's shadows, so
 * objects sit in a space instead of floating on a flat page.
 */
export default function Cyclorama({
  floorY,
  backZ,
  frontZ,
  halfWidth,
  top,
  radius = 0.8,
  color,
  materialRef,
  shadowOnly,
}: CycloramaProps) {
  const geometry = useMemo(() => {
    // Profile in (z, y), from the front of the floor to the top of the wall.
    const profile: { z: number; y: number; nz: number; ny: number }[] = [];
    profile.push({ z: frontZ, y: floorY, nz: 0, ny: 1 });
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * (Math.PI / 2);
      profile.push({
        z: backZ + radius - Math.sin(a) * radius,
        y: floorY + radius - Math.cos(a) * radius,
        nz: Math.sin(a),
        ny: Math.cos(a),
      });
    }
    profile.push({ z: backZ, y: top, nz: 1, ny: 0 });

    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    profile.forEach((p) => {
      positions.push(-halfWidth, p.y, p.z, halfWidth, p.y, p.z);
      normals.push(0, p.ny, p.nz, 0, p.ny, p.nz);
    });
    for (let i = 0; i < profile.length - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }

    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(positions, 3));
    g.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    g.setIndex(indices);
    return g;
  }, [floorY, backZ, frontZ, halfWidth, top, radius]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} receiveShadow>
      {shadowOnly !== undefined ? (
        <shadowMaterial color={color} opacity={shadowOnly} transparent depthWrite={false} />
      ) : (
        <meshStandardMaterial ref={materialRef} color={color} roughness={1} metalness={0} side={DoubleSide} />
      )}
    </mesh>
  );
}

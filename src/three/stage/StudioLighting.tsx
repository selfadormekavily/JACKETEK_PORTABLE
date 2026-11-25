import { Environment, Lightformer } from "@react-three/drei";

/**
 * Soft, neutral photo-studio lighting: a directional key for form, low
 * fill, and strong rim strips so dark fabrics keep their silhouette
 * against the off-white page. Reflections come from an environment map
 * rendered once from in-scene light panels — no HDR file download, no
 * per-frame cost.
 */
export default function StudioLighting() {
  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight position={[3, 3.5, 2.5]} intensity={2} />
      <directionalLight position={[-3, 1.5, 2]} intensity={0.45} />
      <directionalLight position={[0, 3, -4]} intensity={1.4} />

      <Environment resolution={256} frames={1}>
        {/* overhead softbox */}
        <Lightformer
          form="rect"
          intensity={2}
          position={[0, 5, 1]}
          rotation-x={Math.PI / 2}
          scale={[8, 3, 1]}
        />
        {/* key, front-right */}
        <Lightformer
          form="rect"
          intensity={1.4}
          position={[4, 1.5, 3]}
          rotation-y={-Math.PI / 4}
          scale={[3, 5, 1]}
        />
        {/* rim strips, behind left and right */}
        <Lightformer
          form="rect"
          intensity={3.2}
          position={[4.5, 1, -2]}
          rotation-y={-Math.PI / 2.5}
          scale={[1.2, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2.6}
          position={[-4.5, 1, -2]}
          rotation-y={Math.PI / 2.5}
          scale={[1.2, 6, 1]}
        />
        {/* low front fill */}
        <Lightformer
          form="rect"
          intensity={0.35}
          position={[0, 0.5, 6]}
          scale={[10, 4, 1]}
        />
      </Environment>
    </>
  );
}

import type { WebGLProgramParametersWithUniforms } from "three";

/**
 * "Being stitched" reveal for embroidery decals: the artwork appears
 * left to right with a slightly serrated front, row by row, like a
 * machine laying satin stitches. 1 = fully stitched (the default — the
 * configurator never touches it); a scene can drive it from 0 to 1.
 *
 * Decals register their uniform under their element id; anything can
 * then set the reveal by id without threading props through the jacket.
 */

export type StitchUniform = { value: number };

const registry = new Map<string, Set<StitchUniform>>();

export function registerStitch(id: string, uniform: StitchUniform) {
  let set = registry.get(id);
  if (!set) registry.set(id, (set = new Set()));
  set.add(uniform);
  return () => {
    set.delete(uniform);
    if (!set.size) registry.delete(id);
  };
}

/** Sets how much of element `id` is stitched (0–1). */
export function setStitchReveal(id: string, value: number) {
  registry.get(id)?.forEach((u) => (u.value = value));
}

/** Shader hook that applies the reveal (see shaderHooks.composeHooks). */
export function stitchRevealHook(uniform: StitchUniform) {
  return (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.stitchReveal = uniform;
    shader.fragmentShader = `uniform float stitchReveal;\n${shader.fragmentShader}`.replace(
      "#include <clipping_planes_fragment>",
      `#include <clipping_planes_fragment>
{
#if defined( USE_MAP )
  vec2 stitchUv = vMapUv;
#elif defined( USE_ALPHAMAP )
  vec2 stitchUv = vAlphaMapUv;
#else
  vec2 stitchUv = vec2( 0.0 );
#endif
  float stitchRow = ( fract( stitchUv.y * 36.0 ) - 0.5 ) * 0.012;
  if ( stitchUv.x + stitchRow > stitchReveal * 1.04 ) discard;
}`
    );
  };
}

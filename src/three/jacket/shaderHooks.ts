import type { Material, WebGLProgramParametersWithUniforms } from "three";

/**
 * Several independent shader modifications can apply to one material
 * (fine detail normals, embroidery stitching-in…). three.js has a
 * single onBeforeCompile slot, so hooks
 * are registered by key here and run together; the program cache key is
 * the set of hooks, so materials with the same hooks share programs.
 */

export type ShaderHook = (shader: WebGLProgramParametersWithUniforms) => void;

type HookedData = { shaderHooks?: Map<string, ShaderHook> };

/** Adds (or replaces) a hook on a material; recompiles it if needed. */
export function addShaderHook(material: Material, key: string, hook: ShaderHook) {
  const data = material.userData as HookedData;
  let hooks = data.shaderHooks;
  if (!hooks) {
    hooks = new Map();
    // Not enumerable: Material.clone() JSON-copies userData.
    Object.defineProperty(data, "shaderHooks", { value: hooks, enumerable: false });
    const registry = hooks;
    material.onBeforeCompile = (shader) => registry.forEach((h) => h(shader));
    material.customProgramCacheKey = () => [...registry.keys()].sort().join("|");
  }
  const isNew = !hooks.has(key);
  hooks.set(key, hook);
  if (isNew) material.needsUpdate = true;
}

/** Hooks for a material declared in JSX: spread onto the material. */
export function composeHooks(entries: readonly (readonly [string, ShaderHook])[]) {
  const key = entries.map(([k]) => k).sort().join("|");
  return {
    onBeforeCompile: (shader: WebGLProgramParametersWithUniforms) =>
      entries.forEach(([, hook]) => hook(shader)),
    customProgramCacheKey: () => key,
  };
}

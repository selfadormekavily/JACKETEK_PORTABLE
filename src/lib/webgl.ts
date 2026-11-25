let supported: boolean | undefined;

/**
 * Whether this browser can create a WebGL context. Checked once and
 * cached; lets 3D components fall back gracefully instead of crashing.
 */
export function canUseWebGL() {
  if (supported !== undefined) return supported;
  try {
    const canvas = document.createElement("canvas");
    supported = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    supported = false;
  }
  return supported;
}

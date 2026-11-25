/**
 * A still image of the jacket as currently shown in the configurator's
 * viewer (for the cart). The 3D viewer registers how to take one while
 * it's mounted; without it (2D fallback, not loaded) there's no image.
 */
let capture: (() => string | null) | null = null;

export function registerSnapshot(fn: (() => string | null) | null) {
  capture = fn;
}

export function takeSnapshot(): string | null {
  try {
    return capture?.() ?? null;
  } catch {
    return null;
  }
}

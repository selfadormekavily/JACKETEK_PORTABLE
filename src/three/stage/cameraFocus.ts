import type { Vector3 } from "three";

/**
 * Lets something in the scene suggest where the camera should look — e.g.
 * the embroidery zone being edited — so ProductControls can travel to it.
 * The point is in the product's own (unturned) space: ProductControls
 * turns it with the view the product is turning to. Per canvas.
 *
 * A suggestion, not a constraint: ProductControls applies it once — when
 * a new `key` arrives, the view is requested again, or the user asks for
 * it — by setting its own zoom and pan, which the user then owns.
 *
 * `framing`: how much of the product to show around the point — shares of
 * its height and of its on-screen width (whichever needs more room wins),
 * so the zone shows clearly with its surroundings.
 */
export type CameraFocus = {
  point: Vector3 | null;
  /** Identifies the suggestion (e.g. the zone id): the same key is applied once. */
  key?: string;
  framing?: { height: number; width: number };
};

const focus = new WeakMap<HTMLElement, CameraFocus>();

export function setCameraFocus(canvas: HTMLElement, value: CameraFocus | null) {
  if (value?.point) focus.set(canvas, value);
  else focus.delete(canvas);
}

export const getCameraFocus = (canvas: HTMLElement): CameraFocus => focus.get(canvas) ?? { point: null };

/** Marks the object whose local space focus points are given in (the turning product). */
export const PRODUCT_GROUP = "productGroup";

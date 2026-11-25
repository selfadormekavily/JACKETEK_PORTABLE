/**
 * Lets an object in the scene "claim" the current pointer gesture on a
 * canvas — e.g. dragging embroidery — so canvas-wide controls (the
 * turntable in ProductControls) stand down for that gesture.
 */
const claimed = new WeakSet<HTMLElement>();

export const claimPointer = (canvas: HTMLElement) => claimed.add(canvas);
export const releasePointer = (canvas: HTMLElement) => claimed.delete(canvas);
export const isPointerClaimed = (canvas: HTMLElement) => claimed.has(canvas);

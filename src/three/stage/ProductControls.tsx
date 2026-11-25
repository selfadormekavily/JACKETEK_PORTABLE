import { useEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Box3,
  MathUtils,
  Vector3,
  type Group,
  type Object3D,
  type PerspectiveCamera,
} from "three";
import type { CameraView } from "@/features/configurator";
import { getCameraFocus, PRODUCT_GROUP } from "./cameraFocus";
import { isPointerClaimed } from "./pointerClaim";

/** Model rotation (about y) that presents each view to the camera. */
const VIEW_YAW: Record<CameraView, number> = {
  front: 0,
  threeQuarter: -0.65,
  back: Math.PI,
  left: -Math.PI / 2, // wearer's left (+x) turned to camera
  right: Math.PI / 2,
};

const ROTATE_PER_PX = 0.008;
const FLING = 6;
const EASE = 5; // higher = snappier
const FRAME_MARGIN = 1.32;

/** Idle sway: starts after a pause, gently, and yields to any input. */
const IDLE_DELAY_MS = 5000;
const IDLE_AMPLITUDE = 0.12; // radians
const IDLE_SPEED = 0.35; // radians of phase per second

/**
 * Zoom (user inspection). 1 = the default framing; smaller = closer.
 * The closest the camera may come is the product's own radius plus this
 * clearance — so however it turns, nothing passes through the lens.
 */
const ZOOM_CLEARANCE = 0.1;
const ZOOM_EASE = 7;
const WHEEL_SPEED = 0.0011;
/** Below this the view counts as "zoomed in" (reset control, panning). */
const ZOOMED = 0.97;
/** How far the camera travels towards a focus point (1 = centred on it), so its surroundings show too. */
const FOCUS_SHARE = 0.85;
/**
 * Safe pan limits: how far towards the product's edges the view's centre
 * may travel (share of half its size) — the jacket can't be lost. Full
 * reach from FULL_PAN_ZOOM in; none at the default framing.
 */
const PAN_REACH = 0.9;
const FULL_PAN_ZOOM = 0.75;
/** Double-click / double-tap close-up. */
const CLOSE_UP = 0.45;

export type ProductBounds = {
  width: number;
  height: number;
  depth: number;
  centerY: number;
  bottom: number;
};

type ProductControlsProps = {
  view: CameraView;
  /** Changes whenever a view is (re)requested, even the same one. */
  viewRequest?: number;
  /** <1 moves the camera closer (e.g. to show embroidery). */
  zoom?: number;
  /** Change to return a zoomed-in view to the default framing. */
  zoomReset?: number;
  /** Reports when the user zooms in / returns to the default framing. */
  onZoomedChange?: (zoomed: boolean) => void;
  /** Gentle idle sway after a few seconds without interaction. */
  idle?: boolean;
  /** Change when the product's size may change (e.g. fit). */
  fitKey?: unknown;
  /** Reports the product's measured (front-facing) bounds. */
  onMeasure?: (bounds: ProductBounds) => void;
  /** Air around the product in the default framing (1 = edge to edge). */
  frameMargin?: number;
  /** A band at the top of the canvas (px) that UI floats over: the product is framed below it. */
  insetTop?: number;
  /** Change to return to the scene's focus suggestion (cameraFocus), e.g. "Focus zone". */
  focusRequest?: number;
  /** Reports whether the camera is at the focus suggestion (false once the user moves it). */
  onAtFocusChange?: (atFocus: boolean) => void;
  /** Reduced motion: requested views and focus cut straight to their framing. */
  instant?: boolean;
  children: ReactNode;
};

function countNodes(node: Object3D) {
  let n = 0;
  node.traverse(() => n++);
  return n;
}

/**
 * Turntable-style product controls, reusable for any object:
 * - drag (mouse or one finger) spins the product about its vertical
 *   axis, with a little inertia;
 * - wheel / trackpad (over the viewer) and pinch zoom in toward the
 *   point under the cursor or fingers, damped, within safe limits; at
 *   the limits the wheel is handed back to the page;
 * - while zoomed in, a vertical drag (mouse or one finger) travels along
 *   the product (collar ↔ cuffs), and two fingers (or a right / shift
 *   drag) move the view in any direction — always within the product, so
 *   it can't be lost;
 * - a focus point suggested by the scene (cameraFocus: the embroidery zone
 *   being edited) is applied once — on a new zone, a requested view or
 *   `focusRequest` — as zoom and pan the user then owns: never re-applied
 *   while they move, and never a limit on where they can go;
 *   double-click / double-tap toggles a close-up;
 * - touches that start on the viewer belong to it (touch-action: none):
 *   no page scroll, no pull-to-refresh from a gesture on the jacket — the
 *   viewer is a pinned stage; the page scrolls from the controls;
 * - `view` eases the product to a preset angle by the shortest turn;
 * - the camera frames whatever is inside (measured, so a real GLB of
 *   any size is framed correctly) for any canvas aspect ratio.
 *
 * Works with frameloop="demand": it only requests frames while
 * something is actually moving.
 */
export default function ProductControls({
  view,
  viewRequest,
  zoom = 1,
  zoomReset,
  onZoomedChange,
  idle = false,
  fitKey,
  onMeasure,
  frameMargin = FRAME_MARGIN,
  insetTop = 0,
  focusRequest,
  onAtFocusChange,
  instant = false,
  children,
}: ProductControlsProps) {
  const group = useRef<Group>(null);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  const motion = useRef({
    yaw: VIEW_YAW[view],
    targetYaw: VIEW_YAW[view],
    dragging: false,
    lastX: 0,
    lastY: 0,
    velocity: 0,
    lastInput: performance.now(),
    lookY: 0,
    lookX: 0,
    initialised: false,
    // User zoom and the (zoomed-in only) pan offset, with their targets.
    zoom: 1,
    zoomTarget: 1,
    ox: 0,
    oy: 0,
    oxTarget: 0,
    oyTarget: 0,
    /** Closest allowed zoom for the current framing (set per frame). */
    minZoom: 0.5,
    /** Default-framing camera distance (set per frame). */
    baseDistance: 1,
    zoomed: false,
    // Panning with the mouse (right button / shift + drag) rather than turning.
    panning: false,
    // The scene's focus suggestion: the last one applied, one due, and
    // whether the camera is still where it put it.
    focusKey: null as string | null,
    focusDue: false,
    atFocus: false,
    // Reduced motion: the next frame cuts straight to the targets.
    snap: false,
  });
  const measured = useRef<{ bounds: ProductBounds; signature: string } | null>(null);
  const goal = useRef(new Vector3());
  const idleTimer = useRef<number>();
  const zoomedListener = useRef(onZoomedChange);
  const atFocusListener = useRef(onAtFocusChange);
  const instantRef = useRef(instant);
  const viewRef = useRef(view);
  useEffect(() => {
    zoomedListener.current = onZoomedChange;
    atFocusListener.current = onAtFocusChange;
    instantRef.current = instant;
    viewRef.current = view;
  });
  useEffect(() => () => window.clearTimeout(idleTimer.current), []);
  // Focus points (cameraFocus) are given in this group's own space.
  useEffect(() => {
    if (group.current) group.current.userData[PRODUCT_GROUP] = true;
  }, []);

  // Snap toward the requested view by the shortest rotation; a new view
  // also returns to the default framing — or to the scene's focus
  // suggestion, when it has one on the side now facing (next frame).
  useEffect(() => {
    const m = motion.current;
    turnTo(view);
    m.zoomTarget = 1;
    m.oxTarget = m.oyTarget = 0;
    m.focusDue = true;
    m.snap = instantRef.current;
    m.lastInput = performance.now();
    leaveFocus();
    reportZoomed();
    invalidate();
  }, [view, viewRequest, invalidate]);

  // Reset view: the whole product, default framing.
  useEffect(() => {
    if (zoomReset === undefined) return;
    const m = motion.current;
    m.zoomTarget = 1;
    m.oxTarget = m.oyTarget = 0;
    m.snap = instantRef.current;
    leaveFocus();
    reportZoomed();
    invalidate();
  }, [zoomReset, invalidate]);

  // Back to the focus suggestion (e.g. "Focus zone"): turned back to the
  // view it was suggested for, then framed (next frame). Still only a
  // suggestion — zoom, pan and turn stay the user's.
  useEffect(() => {
    if (!focusRequest) return;
    turnTo(viewRef.current);
    motion.current.focusDue = true;
    motion.current.lastInput = performance.now();
    invalidate();
  }, [focusRequest, invalidate]);

  /** Turns toward a preset view by the shortest rotation. */
  function turnTo(target: CameraView) {
    const m = motion.current;
    const yaw = VIEW_YAW[target];
    const turns = Math.round((m.yaw - yaw) / (Math.PI * 2));
    m.targetYaw = yaw + turns * Math.PI * 2;
  }

  useEffect(() => invalidate(), [zoom, idle, fitKey, size, frameMargin, insetTop, invalidate]);

  /** Tells the page (once per change) whether the view is zoomed in. */
  function reportZoomed() {
    const m = motion.current;
    const zoomed = m.zoomTarget < ZOOMED;
    if (zoomed !== m.zoomed) {
      m.zoomed = zoomed;
      zoomedListener.current?.(zoomed);
    }
  }

  /** The user (or a reset) has moved the camera from the focus suggestion: theirs now. */
  function leaveFocus() {
    const m = motion.current;
    if (!m.atFocus) return;
    m.atFocus = false;
    atFocusListener.current?.(false);
  }

  /**
   * Safe pan limits: the view's centre stays within the product (up to
   * PAN_REACH of its half-size once zoomed in to FULL_PAN_ZOOM, less on
   * the way out, none at the default framing) — the jacket can't be lost.
   */
  function clampPan() {
    const m = motion.current;
    const b = measured.current?.bounds;
    if (!b) return;
    const s = MathUtils.clamp((1 - m.zoomTarget) / (1 - FULL_PAN_ZOOM), 0, 1) * PAN_REACH;
    m.oxTarget = MathUtils.clamp(m.oxTarget, (-b.width / 2) * s, (b.width / 2) * s);
    m.oyTarget = MathUtils.clamp(m.oyTarget, (-b.height / 2) * s, (b.height / 2) * s);
  }

  useEffect(() => {
    const el = gl.domElement;
    const m = motion.current;
    // Gestures on the jacket are the jacket's (see above).
    el.style.touchAction = "none";
    el.style.cursor = "grab";
    const pointers = new Set<number>();
    const tanHalf = () => Math.tan(MathUtils.degToRad(camera.fov / 2));
    /** World units per screen pixel at the current zoom. */
    const worldPerPx = () => (2 * m.baseDistance * m.zoomTarget * tanHalf()) / Math.max(1, el.clientHeight);

    /**
     * Zooms to `next`, keeping the point under (clientX, clientY) where
     * it is on screen — the product stays under the user's attention.
     */
    const zoomAt = (next: number, clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = 1 - ((clientY - rect.top) / rect.height) * 2;
      const aspect = rect.width / Math.max(rect.height, 1);
      const shrink = m.baseDistance * (m.zoomTarget - next) * tanHalf();
      m.oxTarget += nx * aspect * shrink;
      m.oyTarget += ny * shrink;
      m.zoomTarget = next;
      clampPan();
      m.lastInput = performance.now();
      leaveFocus();
      reportZoomed();
      invalidate();
    };

    const wheel = (e: WheelEvent) => {
      let dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      if (e.ctrlKey) dy *= 4; // trackpad pinch arrives as ctrl + wheel
      const next = MathUtils.clamp(m.zoomTarget * Math.exp(dy * WHEEL_SPEED), m.minZoom, 1);
      // Already at the limit in this direction: let the page scroll.
      if (Math.abs(next - m.zoomTarget) < 1e-4) return;
      e.preventDefault();
      zoomAt(next, e.clientX, e.clientY);
    };

    const dblclick = (e: MouseEvent) => {
      if (m.zoomTarget < ZOOMED) {
        m.zoomTarget = 1;
        m.oxTarget = m.oyTarget = 0;
        leaveFocus();
        reportZoomed();
        invalidate();
      } else {
        zoomAt(Math.max(m.minZoom, CLOSE_UP), e.clientX, e.clientY);
      }
    };

    // Two fingers: pinch to zoom around their midpoint, and move the
    // midpoint to move the view (within the product).
    let pinch: { distance: number; zoom: number; mx: number; my: number } | null = null;
    const spread = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const touchstart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      pinch = {
        distance: spread(e.touches),
        zoom: m.zoomTarget,
        mx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        my: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      m.dragging = false;
      m.velocity = 0;
    };
    const touchmove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const next = MathUtils.clamp(
        (pinch.zoom * pinch.distance) / Math.max(1, spread(e.touches)),
        m.minZoom,
        1
      );
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      zoomAt(next, mx, my);
      // The view follows the fingers (the product moves with them).
      const k = worldPerPx();
      m.oxTarget -= (mx - pinch.mx) * k;
      m.oyTarget += (my - pinch.my) * k;
      pinch.mx = mx;
      pinch.my = my;
      clampPan();
      invalidate();
    };
    const touchend = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };

    const down = (e: PointerEvent) => {
      pointers.add(e.pointerId);
      if (pointers.size > 1) {
        // A second finger: a pinch, not a spin.
        m.dragging = false;
        m.velocity = 0;
        return;
      }
      m.dragging = true;
      // Mouse: the right button, or shift + drag, moves the view instead of turning.
      m.panning = e.pointerType === "mouse" && (e.button === 2 || e.shiftKey);
      m.lastX = e.clientX;
      m.lastY = e.clientY;
      m.velocity = 0;
      m.lastInput = performance.now();
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const move = (e: PointerEvent) => {
      if (!m.dragging || pointers.size > 1) return;
      // Something in the scene (e.g. embroidery) owns this gesture.
      if (isPointerClaimed(el)) {
        m.lastX = e.clientX;
        m.lastY = e.clientY;
        m.velocity = 0;
        return;
      }
      if (e.clientX !== m.lastX || e.clientY !== m.lastY) leaveFocus();
      if (m.panning) {
        const k = worldPerPx();
        m.oxTarget -= (e.clientX - m.lastX) * k;
        m.oyTarget += (e.clientY - m.lastY) * k;
        clampPan();
        m.lastX = e.clientX;
        m.lastY = e.clientY;
        m.lastInput = performance.now();
        invalidate();
        return;
      }
      const delta = (e.clientX - m.lastX) * ROTATE_PER_PX;
      // Zoomed in: vertical drags (mouse or one finger) travel along the jacket.
      if (m.zoomTarget < ZOOMED) {
        m.oyTarget += (e.clientY - m.lastY) * worldPerPx();
        clampPan();
      }
      m.lastX = e.clientX;
      m.lastY = e.clientY;
      m.targetYaw += delta;
      m.velocity = delta;
      m.lastInput = performance.now();
      invalidate();
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (!m.dragging) return;
      m.dragging = false;
      if (!isPointerClaimed(el) && !m.panning) m.targetYaw += m.velocity * FLING;
      m.panning = false;
      m.lastInput = performance.now();
      el.style.cursor = "grab";
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      invalidate();
    };

    // (The right button pans: no context menu over the jacket.)
    const contextmenu = (e: MouseEvent) => e.preventDefault();

    el.addEventListener("pointerdown", down);
    el.addEventListener("contextmenu", contextmenu);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("dblclick", dblclick);
    el.addEventListener("touchstart", touchstart, { passive: false });
    el.addEventListener("touchmove", touchmove, { passive: false });
    el.addEventListener("touchend", touchend);
    el.addEventListener("touchcancel", touchend);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("contextmenu", contextmenu);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("dblclick", dblclick);
      el.removeEventListener("touchstart", touchstart);
      el.removeEventListener("touchmove", touchmove);
      el.removeEventListener("touchend", touchend);
      el.removeEventListener("touchcancel", touchend);
    };
  }, [gl, camera, invalidate]);

  useFrame((_, delta) => {
    const m = motion.current;
    const node = group.current;
    if (!node) return;

    // Measure the product front-on whenever its contents change.
    const signature = `${countNodes(node)}|${String(fitKey)}`;
    if (measured.current?.signature !== signature) {
      const saved = node.rotation.y;
      node.rotation.y = 0;
      node.updateMatrixWorld(true);
      const box = new Box3().setFromObject(node);
      node.rotation.y = saved;
      if (box.isEmpty()) {
        invalidate();
        return;
      }
      const bounds: ProductBounds = {
        width: box.max.x - box.min.x,
        height: box.max.y - box.min.y,
        depth: box.max.z - box.min.z,
        centerY: (box.max.y + box.min.y) / 2,
        bottom: box.min.y,
      };
      if (!measured.current) m.lookY = bounds.centerY;
      measured.current = { bounds, signature };
      onMeasure?.(bounds);
      // Measured again (e.g. still loading) while the camera is at the focus
      // suggestion: re-frame it for the product's real size. Never once the
      // user has moved the camera.
      if (m.atFocus) m.focusDue = true;
    }
    const { bounds } = measured.current;

    // Framing: fit height and width to the viewport, within sane limits.
    const tanHalf = Math.tan(MathUtils.degToRad(camera.fov / 2));
    const aspect = size.width / Math.max(size.height, 1);
    // (A band at the top that UI floats over: fit the height below it.)
    const usable = Math.max(0.4, 1 - insetTop / Math.max(size.height, 1));
    const fit = Math.max(
      bounds.height / 2 / (tanHalf * usable),
      bounds.width / 2 / (tanHalf * aspect)
    );
    const extent = Math.max(bounds.width, bounds.height);
    const framed = MathUtils.clamp(fit * frameMargin * zoom, extent, extent * 20);
    // Zoom limit: never closer than the product's turning radius allows.
    const closest = Math.max(bounds.width, bounds.depth) / 2 + ZOOM_CLEARANCE;
    m.baseDistance = framed;
    m.minZoom = Math.min(1, closest / framed);
    if (m.zoomTarget < m.minZoom) m.zoomTarget = m.minZoom;

    // The scene's focus suggestion (the embroidery zone being edited): applied
    // once — for a new zone, a requested view, or "Focus zone" — as the zoom
    // and pan below, which the user then owns. Never re-applied while they move.
    const focus = getCameraFocus(gl.domElement);
    if (!focus.point) m.focusKey = null;
    else if (focus.key !== m.focusKey) m.focusDue = true;
    if (m.focusDue) {
      m.focusDue = false;
      if (focus.point) {
        m.focusKey = focus.key ?? null;
        // The point as seen in the view the product is turning to.
        const cos = Math.cos(m.targetYaw);
        const sin = Math.sin(m.targetYaw);
        const across = focus.point.x * cos + focus.point.z * sin;
        const towards = focus.point.z * cos - focus.point.x * sin;
        // Only when it faces the camera (a view of the other side keeps the whole product).
        if (towards > 0) {
          const framing = focus.framing ?? { height: 0.6, width: 0.8 };
          const onScreenWidth = Math.abs(bounds.width * cos) + Math.abs(bounds.depth * sin);
          const want = Math.max(
            (framing.height * bounds.height) / (2 * tanHalf * usable),
            (framing.width * onScreenWidth) / (2 * tanHalf * aspect)
          );
          m.zoomTarget = MathUtils.clamp(want / framed, m.minZoom, 1);
          m.oxTarget = across * FOCUS_SHARE;
          m.oyTarget = (focus.point.y - bounds.centerY) * FOCUS_SHARE;
          clampPan();
          m.snap = instant;
          if (!m.atFocus) {
            m.atFocus = true;
            atFocusListener.current?.(true);
          }
          reportZoomed();
        }
      }
    }

    const cut = !m.initialised || m.snap;
    m.snap = false;
    const t = cut ? 1 : 1 - Math.exp(-delta * EASE);
    const tz = cut ? 1 : 1 - Math.exp(-delta * ZOOM_EASE);
    m.zoom += (m.zoomTarget - m.zoom) * tz;
    m.ox += (m.oxTarget - m.ox) * tz;
    m.oy += (m.oyTarget - m.oy) * tz;
    const distance = Math.max(closest, framed * m.zoom);
    // Centre the product in the area below the top band (look a little higher).
    const lift = (insetTop / 2) * ((2 * distance * tanHalf) / Math.max(size.height, 1));
    const centreY = bounds.centerY + lift;
    goal.current.set(m.ox, centreY + m.oy + distance * 0.12, distance);

    // Idle sway on top of the chosen angle (not while inspecting).
    const now = performance.now();
    const idleFor = now - m.lastInput - IDLE_DELAY_MS;
    const swaying = idle && !m.dragging && idleFor > 0 && m.zoomTarget >= ZOOMED;
    const sway = swaying
      ? Math.min(1, idleFor / 3000) *
        IDLE_AMPLITUDE *
        Math.sin((idleFor / 1000) * IDLE_SPEED)
      : 0;
    const yawGoal = m.targetYaw + sway;

    m.initialised = true;

    m.yaw += (yawGoal - m.yaw) * t;
    m.lookY += (centreY + m.oy - m.lookY) * t;
    m.lookX += (m.ox - m.lookX) * t;
    camera.position.lerp(goal.current, t);
    camera.lookAt(m.lookX, m.lookY, 0);
    node.rotation.y = m.yaw;

    const near = distance / 50;
    if (Math.abs(camera.near - near) / near > 0.05) {
      camera.near = near;
      camera.far = Math.max(distance, extent) * 20;
      camera.updateProjectionMatrix();
    }

    const settled =
      !swaying &&
      !m.dragging &&
      Math.abs(yawGoal - m.yaw) < 1e-4 &&
      Math.abs(centreY + m.oy - m.lookY) < 1e-4 &&
      Math.abs(m.ox - m.lookX) < 1e-4 &&
      Math.abs(m.zoomTarget - m.zoom) < 1e-4 &&
      Math.abs(m.oxTarget - m.ox) < 1e-5 &&
      Math.abs(m.oyTarget - m.oy) < 1e-5 &&
      camera.position.distanceTo(goal.current) < 1e-4;
    if (!settled) {
      invalidate();
    } else if (idle && idleFor <= 0 && m.zoomTarget >= ZOOMED) {
      // On-demand canvas at rest: check back when the sway is due.
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(invalidate, -idleFor + 16);
    }
  });

  return <group ref={group}>{children}</group>;
}

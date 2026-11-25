import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { registerSnapshot } from "@/features/configurator/viewer/snapshot";
import { ContactShadows } from "@react-three/drei";
import { NeutralToneMapping } from "three";
import type { JacketViewerProps } from "@/features/configurator";
import { useInView } from "@/hooks/useInView";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/useI18n";
import { MODEL_ASSETS } from "./assets";
import JacketModel from "./jacket/JacketModel";
import LoadingIndicator from "./stage/LoadingIndicator";
import ProductControls, { type ProductBounds } from "./stage/ProductControls";
import StudioLighting from "./stage/StudioLighting";

const EDGE_FADE = "linear-gradient(to bottom, transparent 0, #000 7%, #000 97%, transparent 100%)";
const ZOOMED_EDGES = { maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE };

/**
 * The configurator's 3D viewer ("jacket scene"). Implements
 * JacketViewerProps, the same contract as the 2D fallback, and is
 * lazy-loaded by JacketViewer.
 */
export default function ThreeJacketViewer({
  appearance,
  view,
  viewRequest,
  focus,
  className = "",
  selectedZone = null,
  onSelectZone,
  onMoveInZone,
  onZoomedChange,
  jacketOpen = false,
  frame,
}: JacketViewerProps) {
  const { t } = useI18n();
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0, once: false });
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [bounds, setBounds] = useState<ProductBounds | null>(null);
  // Inspection zoom: a quiet way back once the user has zoomed in.
  const [zoomed, setZoomed] = useState(false);
  const [zoomReset, setZoomReset] = useState(0);
  const handleZoomed = useCallback(
    (value: boolean) => {
      setZoomed(value);
      onZoomedChange?.(value);
    },
    [onZoomedChange]
  );

  // Editing an embroidery zone: the camera is offered a framing of it once
  // (EmbroideryLayer's suggestion, applied by ProductControls; the view has
  // already turned to the zone's side) and is the user's from then on; the
  // zone's fixed box is outlined. "Focus zone" brings the framing back.
  const editing = Boolean(selectedZone) && focus?.kind === "placement";
  const zoom = !editing && focus?.kind === "placement" ? 0.9 : 1;
  const [atFocus, setAtFocus] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const offerFocus = editing && !atFocus;
  const embroidery = useMemo(
    () => ({ selectedZone: editing ? selectedZone : null, onSelectZone, onMoveInZone: editing ? onMoveInZone : undefined }),
    [editing, selectedZone, onSelectZone, onMoveInZone]
  );

  return (
    <div ref={ref} className={`relative h-full w-full ${className}`}>
      <Canvas
        // Soft top/bottom edges while zoomed in: the jacket fades out at
        // the frame instead of being cut by a hard line.
        style={zoomed ? ZOOMED_EDGES : undefined}
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ fov: 28, position: [0, 0.6, 5] }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = NeutralToneMapping;
        }}
        resize={{ offsetSize: true, scroll: false }}
      >
        <StudioLighting />
        <SnapshotBridge />
        <Suspense fallback={null}>
          <ProductControls
            view={view}
            viewRequest={viewRequest}
            zoom={zoom}
            zoomReset={zoomReset}
            onZoomedChange={handleZoomed}
            // Hold still while an embroidery zone is being edited.
            idle={inView && !reducedMotion && !editing}
            fitKey={appearance.fit}
            onMeasure={setBounds}
            frameMargin={frame?.margin}
            insetTop={frame?.insetTop}
            focusRequest={focusRequest}
            onAtFocusChange={setAtFocus}
            instant={reducedMotion}
          >
            <JacketModel
              appearance={appearance}
              silhouette="male"
              url={MODEL_ASSETS.configuratorJacket}
              embroidery={embroidery}
              open={jacketOpen}
            />
          </ProductControls>
        </Suspense>
        {bounds && (
          <ContactShadows
            position={[0, bounds.bottom - bounds.height * 0.1, 0]}
            opacity={0.24}
            scale={Math.max(bounds.width, bounds.height) * 2.4}
            blur={3}
            far={bounds.height}
            resolution={512}
            color="#000000"
          />
        )}
      </Canvas>

      <LoadingIndicator />

      <GestureHint />

      {/* Phones and tablets: at the bottom corner (the step map floats over the top). */}
      <div className="pointer-events-none absolute bottom-3 end-3 flex gap-2 md:end-8 cfg:bottom-auto cfg:top-4">
        {/* Once the user has moved away from the zone's framing: back to it. */}
        <button
          type="button"
          onClick={() => setFocusRequest((n) => n + 1)}
          aria-hidden={!offerFocus}
          tabIndex={offerFocus ? 0 : -1}
          className={`jk-label-xs flex min-h-[40px] items-center bg-jk-paper/90 px-[14px] py-[9px] text-jk-ink transition-[opacity,transform] duration-500 hover:text-jk-accent cfg:bg-jk-paper ${
            offerFocus ? "pointer-events-auto translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
          }`}
        >
          {t("configurator.stage.focusZone")}
        </button>
        <button
          type="button"
          onClick={() => setZoomReset((n) => n + 1)}
          aria-hidden={!zoomed}
          tabIndex={zoomed ? 0 : -1}
          className={`jk-label-xs jk-reset-view flex min-h-[40px] items-center gap-3 bg-jk-paper/90 px-[14px] py-[9px] text-jk-ink transition-[opacity,transform] duration-500 hover:text-jk-accent cfg:bg-jk-paper ${
            zoomed ? "pointer-events-auto translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
          }`}
        >
          <span aria-hidden="true" className="h-px w-5 bg-jk-rule" />
          {t("configurator.stage.resetView")}
        </button>
      </div>
    </div>
  );
}

/** Longest side of the cart's still image, in pixels. */
const SNAPSHOT_SIZE = 640;

/**
 * Lets the cart take a still of the jacket as shown: renders a fresh
 * frame and copies it, scaled down, in the same task (the drawing
 * buffer isn't kept between frames).
 */
function SnapshotBridge() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    registerSnapshot(() => {
      gl.render(scene, camera);
      const source = gl.domElement;
      // Copy the frame, then crop to the jacket (the canvas is transparent
      // around it) with a little air, so it fills the cart's tile.
      const full = document.createElement("canvas");
      full.width = source.width;
      full.height = source.height;
      const ctx = full.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(source, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, full.width, full.height);
      let x0 = width, y0 = height, x1 = -1, y1 = -1;
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          if (data[(y * width + x) * 4 + 3] > 24) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) return null;
      const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.08);
      x0 = Math.max(0, x0 - pad);
      y0 = Math.max(0, y0 - pad);
      x1 = Math.min(width, x1 + pad);
      y1 = Math.min(height, y1 + pad);
      const k = Math.min(1, SNAPSHOT_SIZE / Math.max(x1 - x0, y1 - y0));
      const out = document.createElement("canvas");
      out.width = Math.round((x1 - x0) * k);
      out.height = Math.round((y1 - y0) * k);
      out.getContext("2d")?.drawImage(full, x0, y0, x1 - x0, y1 - y0, 0, 0, out.width, out.height);
      return out.toDataURL("image/webp", 0.85);
    });
    return () => registerSnapshot(null);
  }, [gl, scene, camera]);
  return null;
}

const HINT_SEEN = "jacketek.gestureHint.v1";

/**
 * Touch screens: how to handle the jacket, once — "Drag to rotate · Pinch
 * to zoom · Two fingers to move" — fading after a few seconds or at the
 * first touch on the jacket. A small "?" brings it back.
 */
function GestureHint() {
  const { t } = useI18n();
  const touch = useMediaQuery("(pointer: coarse)");
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!touch) return;
    let seen = false;
    try {
      seen = localStorage.getItem(HINT_SEEN) === "1";
    } catch {
      /* storage blocked: show it */
    }
    if (!seen) setShown(true);
  }, [touch]);

  useEffect(() => {
    if (!shown) return;
    const hide = () => setShown(false);
    const timer = window.setTimeout(hide, 5000);
    // Any touch on the jacket (the canvas) counts as having seen it.
    const onTouch = (e: PointerEvent) => {
      if (e.target instanceof HTMLCanvasElement) window.setTimeout(hide, 1200);
    };
    window.addEventListener("pointerdown", onTouch);
    try {
      localStorage.setItem(HINT_SEEN, "1");
    } catch {
      /* fine */
    }
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", onTouch);
    };
  }, [shown]);

  if (!touch) return null;
  return (
    <>
      <p role="status" aria-live="polite" className="jk-gesture-hint" data-shown={shown || undefined}>
        {shown ? t("configurator.stage.gestureHint") : ""}
      </p>
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={t("configurator.stage.gestureHelp")}
        aria-expanded={shown}
        className="jk-gesture-help"
      >
        ?
      </button>
    </>
  );
}

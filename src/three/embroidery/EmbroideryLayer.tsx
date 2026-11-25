import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal, useThree, type ThreeEvent } from "@react-three/fiber";
import { Raycaster, Vector3, type Mesh, type Object3D } from "three";
import type { EmbroideryAppearance, PlacementId } from "@/features/configurator";
import { imageEmbroiderySize, zoneContent } from "@/features/configurator/model/embroideryGeometry";
import { claimPointer, releasePointer } from "../stage/pointerClaim";
import { PRODUCT_GROUP, setCameraFocus } from "../stage/cameraFocus";
import EmbroideryDecal, { ZoneFrameDecal } from "../jacket/EmbroideryDecal";
import type { RigUniforms } from "../jacket/frontRig";
import { getEmbroideryFont } from "@/features/embroidery/fonts/fontLibrary";
import { loadEmbroideryFonts } from "@/features/embroidery/fonts/loadFonts";
import { drawTextArtwork } from "@/features/embroidery/text/textArtwork";
import {
  createImageEmbroidery,
  createLetteringEmbroidery,
  createTextEmbroidery,
  createVarsityEmbroidery,
  VARSITY_CAP_SHARE,
  VARSITY_FONTS,
  type EmbroideryMaps,
} from "./embroideryMaps";
import { EMBROIDERY_ZONES, placeOnSurface, zoneOffsetAt, type JacketFit } from "./surfacePlacement";

const raycaster = new Raycaster();

export type EmbroideryLayerProps = {
  /** The jacket's root object (inside the fit transform). */
  root: Object3D;
  fit: JacketFit;
  /** Meshes that can carry embroidery (body panels). */
  panels: readonly Mesh[];
  /** Sleeve meshes (for sleeve zones). */
  sleevePanels?: readonly Mesh[];
  elements: readonly EmbroideryAppearance[];
  /** The fixed zone being edited: its box is outlined on the fabric. */
  selectedZone?: PlacementId | null;
  /** A design was picked on the jacket: select its zone. */
  onSelectZone?: (placement: PlacementId) => void;
  /** The selected zone's content was dragged: its new centre, relative to the zone (see JacketViewerProps). */
  onMoveInZone?: (placement: PlacementId, x: number, y: number) => void;
};

/**
 * The embroidery on top of a jacket: every element is stitched onto the
 * real garment surface, as a child of the mesh it sits on, so it stays
 * attached through any rotation or camera move. Configurator designs sit
 * in fixed zones — fitted into the zone's box and centred, unless placed
 * inside it (smaller, moved — never past the box). Picking one on the
 * jacket selects its zone; in the selected zone, dragging moves the content
 * within the zone (the zone itself never moves).
 */
export default function EmbroideryLayer({
  root,
  fit,
  panels,
  sleevePanels = [],
  elements,
  selectedZone = null,
  onSelectZone,
  onMoveInZone,
}: EmbroideryLayerProps) {
  const panelsFor = (placement: EmbroideryAppearance["placement"]) =>
    EMBROIDERY_ZONES[placement].surface === "sleeves" ? sleevePanels : panels;
  return (
    <>
      {elements.map((element) => (
        <EmbroideredElement
          key={element.id}
          element={element}
          root={root}
          fit={fit}
          panels={panelsFor(element.placement)}
          onSelectZone={onSelectZone}
          onMoveInZone={element.placement === selectedZone ? onMoveInZone : undefined}
        />
      ))}
      {selectedZone && <ZoneFrame zone={selectedZone} root={root} fit={fit} panels={panelsFor(selectedZone)} />}
    </>
  );
}

/** Share of the text artwork's height taken by capital letters. */
const CAP_SHARE = 0.45;

function EmbroideredElement({
  element,
  root,
  fit,
  panels,
  onSelectZone,
  onMoveInZone,
}: {
  element: EmbroideryAppearance;
  root: Object3D;
  fit: JacketFit;
  panels: readonly Mesh[];
  onSelectZone?: (placement: PlacementId) => void;
  onMoveInZone?: (placement: PlacementId, x: number, y: number) => void;
}) {
  const zone = EMBROIDERY_ZONES[element.placement];
  const image = useDecodedImage(element.image?.src ?? null);
  const varsity = element.varsity;
  // Varsity lettering is drawn in the collegiate face: wait for it.
  const fontReady = useFontReady(varsity ? VARSITY_FONTS[varsity.face ?? "collegiate"] : null);
  // Zone text: its library font (and any script fallback) must be loaded.
  const textStyle = element.kind === "text" ? element.textStyle : undefined;
  const libraryFontsReady = useLibraryFonts(textStyle ? [textStyle.fontId, ...textStyle.fallbackFontIds] : null);

  // Stitch maps: rebuilt only when the artwork or thread changes.
  const maps = useMemo<EmbroideryMaps | null>(() => {
    if (element.kind === "text") {
      if (!element.text) return null;
      if (varsity) return fontReady ? createVarsityEmbroidery(element.text, varsity) : null;
      if (textStyle) {
        // Text → its font's shaped glyphs (a coverage mask) → satin stitches.
        if (!libraryFontsReady) return null;
        const art = drawTextArtwork(element.text, textStyle.fontId);
        if (!art) return null;
        const k = Math.min(1, LETTERING_TEXTURE_MAX_PX / art.canvas.width);
        return createLetteringEmbroidery(scaledCanvas(art.canvas, k), element.threadHex ?? "#ECE7DC", art.strokePx * k);
      }
      return createTextEmbroidery(element.text, element.threadHex ?? "#ECE7DC");
    }
    return image ? createImageEmbroidery(image, element.threadHex) : null;
  }, [element.kind, element.text, element.threadHex, image, varsity, fontReady, textStyle, libraryFontsReady]);
  useEffect(() => () => maps?.dispose(), [maps]);
  // On-demand canvases (the configurator) redraw only when asked.
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [maps, invalidate]);

  // Real-world size of the artwork on the garment, and its centre's offset
  // from the zone centre (metres, facing the zone).
  const inZone = element.inZone;
  const layout = useMemo<{ size: [number, number]; offset: [number, number] } | null>(() => {
    if (!maps) return null;
    if (varsity) {
      // Real varsity pieces are sized by their letters' height.
      const h = (varsity.capHeight / VARSITY_CAP_SHARE) * element.scale;
      return { size: [h * maps.aspect, h], offset: element.offset };
    }
    if (zone.box && (element.kind !== "text" || textStyle)) {
      // A fixed zone: fitted into its box and placed inside it — the same
      // geometry the order saves (model/embroideryGeometry.ts zoneContent).
      const c = zoneContent(zone.box, maps.aspect, inZone);
      return { size: c.size, offset: c.offset };
    }
    if (element.kind !== "text") return { size: imageEmbroiderySize(zone, element.scale, maps.aspect), offset: element.offset };
    const h = (zone.textHeight / CAP_SHARE) * element.scale;
    const w = h * maps.aspect;
    // Long text shrinks to fit the zone.
    const shrink = Math.min(1, zone.maxWidth / w);
    return { size: [w * shrink, h * shrink], offset: element.offset };
  }, [maps, element.kind, element.scale, element.offset, zone, varsity, textStyle, inZone]);

  const target = useMemo(
    () => (layout ? placeOnSurface(root, panels, fit, zone, layout.offset, element.rotation, layout.size) : null),
    [root, panels, fit, zone, element.rotation, layout]
  );

  // Dragging the content within its zone (the selected zone only).
  const gl = useThree((s) => s.gl);
  const drag = useRef({ active: false, frame: 0, grab: [0, 0] as [number, number], pending: null as [number, number] | null });
  useEffect(() => {
    const d = drag.current;
    return () => {
      cancelAnimationFrame(d.frame);
      if (d.active) releasePointer(gl.domElement);
    };
  }, [gl]);

  if (!maps || !target || !layout) return null;

  const facesViewer = (e: ThreeEvent<PointerEvent>) =>
    !e.face || e.face.normal.clone().transformDirection(e.object.matrixWorld).dot(e.ray.direction) < 0;
  // Configurator zones only (display spots aren't selectable).
  const placement = element.placement as PlacementId;
  const movable = !!onMoveInZone && !!zone.box;
  const endDrag = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    releasePointer(gl.domElement);
    gl.domElement.style.cursor = movable ? "grab" : "";
  };
  const onPointerDown = onSelectZone
    ? (e: ThreeEvent<PointerEvent>) => {
        if (!facesViewer(e)) return; // e.g. a back design seen through the jacket
        e.stopPropagation();
        onSelectZone(placement);
        if (!movable) return;
        // Held where it was grabbed: the content doesn't jump to the pointer.
        const [ox, oy] = zoneOffsetAt(root, fit, zone, e.point);
        drag.current.grab = [ox - layout.offset[0], oy - layout.offset[1]];
        drag.current.active = true;
        claimPointer(gl.domElement);
        gl.domElement.style.cursor = "grabbing";
        (e.target as unknown as Element).setPointerCapture(e.pointerId);
      }
    : undefined;
  const onPointerMove = movable
    ? (e: ThreeEvent<PointerEvent>) => {
        const d = drag.current;
        if (!d.active || !zone.box) return;
        e.stopPropagation();
        raycaster.set(e.ray.origin, e.ray.direction);
        const hit = raycaster.intersectObjects(panels as Mesh[], false)[0];
        if (!hit) return;
        const [ox, oy] = zoneOffsetAt(root, fit, zone, hit.point);
        // Relative to the zone; the receiver keeps it inside (clampInZone).
        d.pending = [(ox - d.grab[0]) / zone.box[0], (oy - d.grab[1]) / zone.box[1]];
        // At most one update per frame.
        if (!d.frame)
          d.frame = requestAnimationFrame(() => {
            d.frame = 0;
            if (d.pending && onMoveInZone) onMoveInZone(placement, d.pending[0], d.pending[1]);
          });
      }
    : undefined;

  // Rendered as a child of the garment mesh: it inherits every
  // transform, so it stays on the fabric through any movement.
  return createPortal(
    <EmbroideryDecal
      id={element.id}
      // Moves with its front panel when the jacket opens (if rigged).
      rig={target.mesh.userData.frontRig as RigUniforms | undefined}
      maps={maps}
      threadHex={varsity ? varsity.border : element.threadHex}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={movable ? endDrag : undefined}
      onLostPointerCapture={movable ? endDrag : undefined}
      {...target.placement}
    />,
    target.mesh
  );
}

/**
 * How much of the jacket the camera suggestion shows around a zone: shares
 * of the jacket's height and of its on-screen width (see cameraFocus).
 * Close enough to read the zone, with its surroundings for context:
 * - chest: most of the upper torso — collar, both chests, the sleeves' tops;
 * - main back: both shoulders and most of the body;
 * - lower back text: the lower back with most of the back above it;
 * - sleeves (from the side): the whole sleeve with some torso around it,
 *   moved towards the zone (upper / middle / lower), never a close-up.
 */
function zoneFraming(id: PlacementId, zone: (typeof EMBROIDERY_ZONES)[PlacementId]) {
  if (zone.yaw !== undefined) return { height: 1, width: 1.3 };
  if (id === "backQuote") return { height: 0.9, width: 0.95 };
  if (zone.side === "back") return { height: 0.95, width: 1 };
  return { height: 0.82, width: 0.9 };
}

/** The selected zone's fixed box, outlined on the fabric. */
function ZoneFrame({
  zone: id,
  root,
  fit,
  panels,
}: {
  zone: PlacementId;
  root: Object3D;
  fit: JacketFit;
  panels: readonly Mesh[];
}) {
  const zone = EMBROIDERY_ZONES[id];
  const target = useMemo(
    () => (zone.box ? placeOnSurface(root, panels, fit, zone, [0, 0], 0, zone.box) : null),
    [root, panels, fit, zone]
  );
  const invalidate = useThree((s) => s.invalidate);
  const canvas = useThree((s) => s.gl.domElement);
  useEffect(() => {
    invalidate();
    return () => invalidate();
  }, [target, invalidate]);
  // Suggests the camera travel to the zone being edited (ProductControls
  // applies it once per zone; the user then moves freely): its centre, in
  // the turning product's own space, with the zone's framing.
  useEffect(() => {
    if (!target) return;
    let product: Object3D | null = target.mesh;
    while (product && !product.userData[PRODUCT_GROUP]) product = product.parent;
    if (!product) return;
    target.mesh.updateWorldMatrix(true, false);
    const world = new Vector3(...target.placement.position).applyMatrix4(target.mesh.matrixWorld);
    setCameraFocus(canvas, { point: product.worldToLocal(world), key: id, framing: zoneFraming(id, zone) });
    return () => setCameraFocus(canvas, null);
  }, [target, canvas, zone, id]);
  if (!target) return null;
  return createPortal(
    <ZoneFrameDecal rig={target.mesh.userData.frontRig as RigUniforms | undefined} {...target.placement} />,
    target.mesh
  );
}

/** Decoded images, shared across renders and viewers. */
const imageCache = new Map<string, HTMLImageElement>();

function useDecodedImage(src: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(() =>
    src ? imageCache.get(src) ?? null : null
  );
  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    const cached = imageCache.get(src);
    if (cached) {
      setImage(cached);
      return;
    }
    let live = true;
    const img = new Image();
    img.src = src;
    img
      .decode()
      .then(() => {
        imageCache.set(src, img);
        if (live) setImage(img);
      })
      .catch(() => live && setImage(null));
    return () => {
      live = false;
    };
  }, [src]);
  return image;
}

/** Longest side the lettering's stitch maps are built at. */
const LETTERING_TEXTURE_MAX_PX = 2048;

function scaledCanvas(c: HTMLCanvasElement, k: number) {
  if (k >= 1) return c;
  const out = document.createElement("canvas");
  out.width = Math.max(8, Math.round(c.width * k));
  out.height = Math.max(8, Math.round(c.height * k));
  out.getContext("2d")!.drawImage(c, 0, 0, out.width, out.height);
  return out;
}

/** True once these embroidery-library fonts are loaded (null: nothing to wait for). */
function useLibraryFonts(ids: string[] | null) {
  const key = ids ? ids.join(",") : "";
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    loadEmbroideryFonts(key.split(",").map((id) => getEmbroideryFont(id)))
      .catch(() => undefined)
      .then(() => live && setLoaded(key));
    return () => {
      live = false;
    };
  }, [key]);
  return !key || loaded === key;
}

/** True once a web font has loaded (null: nothing to wait for). */
function useFontReady(family: string | null) {
  const [ready, setReady] = useState(() => !family || document.fonts.check(`400 64px "${family}"`));
  useEffect(() => {
    if (!family || ready) return;
    let live = true;
    document.fonts
      .load(`400 64px "${family}"`)
      .catch(() => undefined)
      .then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [family, ready]);
  return ready;
}

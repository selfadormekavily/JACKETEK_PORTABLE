import { getPlacement, matchColour, paletteFor, PLACEMENTS } from "../model/catalog";
import { createDefaultConfig, createZoneDesign, createZoneText, withProductionData } from "../model/config";
import type {
  CameraView,
  ColourId,
  ColourZone,
  EmbroideryImage,
  FitId,
  FocusTarget,
  HardwareFinish,
  JacketConfig,
  MaterialId,
  MaterialZone,
  PlacementId,
  SizeId,
  TextEmbroideryStyle,
  ThreadId,
  ZoneTransform,
} from "../model/types";
import { getStep, type StepId } from "./steps";

/** Thread a new text embroidery starts in (the customer can change it). */
export const DEFAULT_TEXT_THREAD: ThreadId = "ivory";

/**
 * `config` is the customer's design (what gets ordered).
 * `ui` is transient presentation state (what's on screen right now)
 * and is intentionally kept separate so it never leaks into an order.
 */
export type ConfiguratorState = {
  config: JacketConfig;
  ui: {
    step: StepId;
    view: CameraView;
    focus: FocusTarget | null;
    /** The embroidery zone being edited (outlined on the jacket). */
    selectedZone: PlacementId | null;
    /** Bumped on every view request (see JacketViewerProps). */
    viewRequest: number;
    /** Jacket shown open — a preview, not part of the order. */
    jacketOpen: boolean;
  };
};

export type ConfiguratorAction =
  | { type: "setColour"; zone: ColourZone; colour: ColourId }
  | { type: "setMaterial"; zone: MaterialZone; material: MaterialId }
  | { type: "setButtons"; finish: HardwareFinish }
  | { type: "setZipper"; zipper: boolean }
  | { type: "setJacketOpen"; open: boolean }
  /** Assigns an image design to a fixed zone (replacing the zone's design or text, if any). */
  | { type: "setZoneDesign"; placement: PlacementId; image: EmbroideryImage }
  /** Sets a zone's text and font (replacing its design, if any; empty text clears the zone). */
  | { type: "setZoneText"; placement: PlacementId; text: string; style: Omit<TextEmbroideryStyle, "fitScale"> }
  /**
   * Thread colour: text embroidery's (always one), or an uploaded image's —
   * null stitches it in its own colours (ready-made designs: colourways).
   */
  | { type: "setEmbroideryThread"; id: string; thread: ThreadId | null }
  | { type: "removeEmbroidery"; id: string }
  | { type: "selectZone"; placement: PlacementId | null }
  /**
   * Places the zone's content inside the zone (size, position — relative
   * to the zone; kept inside it). Null: back to the default (auto-fit,
   * centred). The zone itself never changes.
   */
  | { type: "setZoneTransform"; placement: PlacementId; transform: Partial<ZoneTransform> | null }
  | { type: "setSize"; size: SizeId }
  | { type: "setFit"; fit: FitId }
  | { type: "goToStep"; step: StepId }
  | { type: "setView"; view: CameraView }
  | { type: "reset" }
  /** Restore a saved draft design (state/draft.ts) without touching anything else. */
  | { type: "hydrate"; config: JacketConfig; step?: StepId };

export function createInitialState(): ConfiguratorState {
  return {
    config: createDefaultConfig(),
    ui: {
      step: "body",
      view: "front",
      focus: { kind: "zone", id: "body" },
      selectedZone: null,
      viewRequest: 0,
      jacketOpen: false,
    },
  };
}

type UI = ConfiguratorState["ui"];

/** Turns the jacket to show an embroidery zone, and marks it selected. */
function presentZone(ui: UI, placement: PlacementId | null): UI {
  if (!placement) return { ...ui, selectedZone: null, focus: null };
  return {
    ...ui,
    selectedZone: placement,
    view: getPlacement(placement).view,
    viewRequest: ui.viewRequest + 1,
    focus: { kind: "placement", id: placement },
  };
}

export function configuratorReducer(
  state: ConfiguratorState,
  action: ConfiguratorAction
): ConfiguratorState {
  const { config, ui } = state;

  switch (action.type) {
    case "setColour":
      return {
        config: {
          ...config,
          colours: { ...config.colours, [action.zone]: action.colour },
        },
        ui: { ...ui, focus: { kind: "zone", id: action.zone } },
      };

    case "setMaterial":
      // Only the chosen zone changes; the other keeps its material. Its
      // colour moves to the new material's palette (the same colour, or
      // the closest one there).
      return {
        config: {
          ...config,
          materials: { ...config.materials, [action.zone]: action.material },
          colours: {
            ...config.colours,
            [action.zone]: matchColour(config.colours[action.zone], paletteFor(action.material)).id,
          },
        },
        ui: { ...ui, focus: { kind: "zone", id: action.zone } },
      };

    case "setZoneDesign": {
      // One design per zone: a new design replaces the zone's design or
      // text. Image designs are stitched in their own colours. A zone that
      // takes no designs (text only) ignores it.
      if (!getPlacement(action.placement).accepts.design) return state;
      // The same design again with other colours / letters keeps where the
      // customer placed it; a different design starts at the default.
      const previous = config.embroidery.find((e) => e.placement === action.placement);
      const sameDesign = !!previous?.image?.library && previous.image.library.id === action.image.library?.id;
      const element = createZoneDesign(action.placement, action.image, sameDesign ? previous?.inZone : undefined);
      return {
        config: {
          ...config,
          embroidery: [...config.embroidery.filter((e) => e.placement !== action.placement), element],
        },
        // In the zone being edited (new colours, letters, another design): the
        // view stays where the customer put it — only another zone is presented.
        ui: ui.selectedZone === action.placement ? ui : presentZone(ui, action.placement),
      };
    }

    case "setZoneText": {
      // Edited in place (same element, same thread) so the jacket updates
      // as the customer types; the view isn't moved on every keystroke.
      // Text replaces an image design in the zone.
      if (!getPlacement(action.placement).accepts.text) return state;
      const previous = config.embroidery.find((e) => e.placement === action.placement);
      const others = config.embroidery.filter((e) => e.placement !== action.placement);
      if (!action.text.trim()) {
        // Clearing the text leaves a design in the zone alone.
        return previous?.kind === "text" ? { ...state, config: { ...config, embroidery: others } } : state;
      }
      const reuse = previous?.kind === "text" ? previous : null;
      const element = createZoneText(action.placement, action.text, action.style, reuse?.thread ?? DEFAULT_TEXT_THREAD, reuse?.id, reuse?.inZone);
      return {
        config: { ...config, embroidery: [...others, element] },
        ui: ui.selectedZone === action.placement ? ui : presentZone(ui, action.placement),
      };
    }

    case "setEmbroideryThread":
      return {
        ...state,
        config: {
          ...config,
          embroidery: config.embroidery.map((e) =>
            e.id === action.id && (e.kind === "text" ? action.thread !== null : !e.image?.library) ? { ...e, thread: action.thread } : e
          ),
        },
      };

    case "removeEmbroidery":
      // The zone stays selected (now empty), ready for another design.
      return { ...state, config: { ...config, embroidery: config.embroidery.filter((e) => e.id !== action.id) } };

    case "selectZone":
      // The zone already being edited (e.g. grabbing its design on the jacket
      // to move it): nothing to present — the camera stays where the user put it.
      if (action.placement && action.placement === ui.selectedZone && ui.focus?.kind === "placement" && ui.focus.id === action.placement) return state;
      return { ...state, ui: presentZone(ui, action.placement) };

    case "setZoneTransform": {
      const current = config.embroidery.find((e) => e.placement === action.placement);
      if (!current) return state;
      const next = action.transform ? { ...(current.inZone ?? { scale: 1, x: 0, y: 0 }), ...action.transform } : undefined;
      const rest = { ...current };
      delete rest.inZone;
      const element = withProductionData(next ? { ...rest, inZone: next } : rest);
      return {
        ...state,
        config: { ...config, embroidery: config.embroidery.map((e) => (e.id === current.id ? element : e)) },
      };
    }

    case "setSize":
      return { ...state, config: { ...config, size: action.size } };

    case "setFit":
      return { ...state, config: { ...config, fit: action.fit } };

    case "setButtons":
      return {
        config: { ...config, buttons: action.finish },
        ui: { ...ui, focus: null },
      };

    case "setZipper":
      // Without the zipper the jacket can't open: switching it off closes it.
      return {
        config: { ...config, zipper: action.zipper },
        ui: { ...ui, jacketOpen: action.zipper && ui.jacketOpen },
      };

    case "setJacketOpen":
      // Opening faces the jacket to the viewer.
      return {
        ...state,
        ui: {
          ...ui,
          jacketOpen: action.open && config.zipper,
          view: "front",
          viewRequest: ui.viewRequest + 1,
        },
      };

    case "goToStep": {
      // Opening a section turns the jacket to where that edit shows; the
      // jacket closes outside the closure section (embroidery is placed on
      // the closed jacket).
      const step = getStep(action.step);
      const jacketOpen = step.id === "closure" && ui.jacketOpen;
      if (step.id === "embroidery") {
        // Opens on the zone last edited, else the first zone with a
        // design, else the first zone.
        const zone = ui.selectedZone ?? config.embroidery[0]?.placement ?? PLACEMENTS[0].id;
        return { ...state, ui: presentZone({ ...ui, step: step.id, jacketOpen }, zone) };
      }
      return {
        ...state,
        ui: {
          ...ui,
          step: step.id,
          view: step.view,
          viewRequest: ui.viewRequest + 1,
          focus: step.zone ? { kind: "zone", id: step.zone } : null,
          jacketOpen,
        },
      };
    }

    case "setView":
      return {
        ...state,
        ui: { ...ui, view: action.view, viewRequest: ui.viewRequest + 1 },
      };

    case "reset":
      return createInitialState();

    case "hydrate":
      return {
        ...state,
        config: action.config,
        ui: { ...ui, step: action.step ?? ui.step, selectedZone: null, viewRequest: ui.viewRequest + 1 },
      };
  }
}

import { FITS, MATERIALS, matchColour, paletteFor, SIZES } from "../model/catalog";
import { createDefaultConfig, withProductionData } from "../model/config";
import { EMBROIDERY_ZONE_LIST, EMBROIDERY_ZONES_BY_ID, isFixedZone } from "../model/embroideryGeometry";
import type { ColourZone, EmbroideryElement, JacketConfig, PlacementId } from "../model/types";

/**
 * DESIGN MIGRATION — brings a saved design (an IndexedDB draft, possibly
 * made before the fixed embroidery zones and the material palettes) up to
 * today's model, keeping everything the customer made:
 *
 * - Colours: ids from the original single palette ("navy") → the closest
 *   colour in the part's material palette (felt / leather; rib trim: felt).
 * - Embroidery: one design per fixed zone, centred in it. A design on a
 *   removed zone moves to its nearest zone (Upper Back → Main Back; Centre
 *   Chest → a free chest zone, else Main Back); free-placement offsets,
 *   turns and sizes are reset (the zone fits the design). A design whose
 *   zone is taken moves to the next free zone that takes it. Only a design
 *   no zone can take is left out — reported in `unplaced`, never dropped
 *   silently (state/draft.ts keeps the original draft).
 * - Size / fit / materials no longer offered → the default (size: none,
 *   so the customer picks one again).
 *
 * Pure and idempotent: a current design comes back unchanged. Text saved
 * before the font library keeps its text; draft.ts then sets it in a
 * library font (textStyle.ts) — that needs the browser's fonts.
 */

/** Zones a design on a removed or taken zone tries, in order (then any free zone that takes it). */
const PREFERRED: Record<string, readonly PlacementId[]> = {
  upperBack: ["mainBack"],
  centerChest: ["leftChest", "rightChest", "mainBack"],
};

export type MigrationResult = {
  config: JacketConfig;
  /** Anything changed (the caller re-saves). */
  changed: boolean;
  /** Designs no zone could take (more designs than zones that accept them). */
  unplaced: EmbroideryElement[];
};

const isElement = (e: unknown): e is EmbroideryElement =>
  !!e && typeof e === "object" && ((e as EmbroideryElement).kind === "text" || (e as EmbroideryElement).kind === "image");

const hasContent = (e: EmbroideryElement) => (e.kind === "text" ? typeof e.text === "string" && e.text.trim() !== "" : !!e.image?.src);

const takes = (zone: PlacementId, e: EmbroideryElement) => {
  const z = EMBROIDERY_ZONES_BY_ID[zone];
  return e.kind === "text" ? z.accepts.text && e.text.length <= z.textMaxLength : z.accepts.design;
};

export function migrateConfig(saved: Partial<JacketConfig> | null | undefined): MigrationResult {
  const base = createDefaultConfig();
  const raw = (saved && typeof saved === "object" ? saved : {}) as Partial<JacketConfig>;
  let changed = false;

  const materials = { ...base.materials, ...raw.materials };
  for (const zone of ["body", "sleeves"] as const) {
    if (!MATERIALS.some((m) => m.id === materials[zone])) {
      materials[zone] = base.materials[zone];
      changed = true;
    }
  }

  const colours = { ...base.colours, ...raw.colours };
  for (const zone of ["body", "sleeves", "trim"] as ColourZone[]) {
    const palette = paletteFor(zone === "trim" ? "rib" : materials[zone]);
    if (!palette.some((c) => c.id === colours[zone])) {
      colours[zone] = matchColour(colours[zone], palette).id;
      changed = true;
    }
  }

  let size = raw.size ?? null;
  if (size !== null && !SIZES.includes(size)) {
    size = null;
    changed = true;
  }
  let fit = raw.fit ?? base.fit;
  if (!FITS.some((f) => f.id === fit)) {
    fit = base.fit;
    changed = true;
  }

  // Embroidery: designs already on a fixed zone keep it (first come); the
  // rest then take their preferred zone, else the first free one.
  const elements = (Array.isArray(raw.embroidery) ? raw.embroidery : []).filter(isElement);
  const withContent = elements.filter(hasContent);
  if (withContent.length !== elements.length) changed = true; // empty text / missing image: nothing to stitch
  const taken = new Set<PlacementId>();
  const placed = new Map<EmbroideryElement, PlacementId>();
  for (const e of withContent) {
    if (isFixedZone(e.placement) && !taken.has(e.placement) && takes(e.placement, e)) {
      taken.add(e.placement);
      placed.set(e, e.placement);
    }
  }
  const unplaced: EmbroideryElement[] = [];
  for (const e of withContent) {
    if (placed.has(e)) continue;
    const candidates = [...(PREFERRED[e.placement] ?? []), ...EMBROIDERY_ZONE_LIST.map((z) => z.id)];
    const zone = candidates.find((id) => !taken.has(id) && takes(id, e));
    if (!zone) {
      unplaced.push(e);
      continue;
    }
    taken.add(zone);
    placed.set(e, zone);
  }
  if (unplaced.length) changed = true;

  // An in-zone placement must be three numbers; anything else falls back to the default (auto-fit, centred).
  const validPlacement = (t: unknown) =>
    !!t && typeof t === "object" && ["scale", "x", "y"].every((k) => typeof (t as Record<string, unknown>)[k] === "number" && Number.isFinite((t as Record<string, number>)[k]));
  const embroidery = withContent
    .filter((e) => placed.has(e))
    .map((original) => {
      const placement = placed.get(original)!;
      let e = original;
      if (e.inZone !== undefined && !validPlacement(e.inZone)) {
        changed = true;
        e = { ...e };
        delete e.inZone;
      }
      const fixed = e.placement === placement && e.offset?.[0] === 0 && e.offset?.[1] === 0 && e.rotation === 0 && e.scale === 1;
      if (fixed) return e;
      changed = true;
      return withProductionData({ ...e, placement, offset: [0, 0], rotation: 0, scale: 1 });
    });

  return {
    config: { ...base, ...raw, materials, colours, size, fit, embroidery },
    changed,
    unplaced,
  };
}

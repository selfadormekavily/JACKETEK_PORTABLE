import { idbDelete, idbGet, idbSet } from "@/lib/idb";
import { textStyleFor } from "@/features/embroidery/text/textStyle";
import { createZoneText } from "../model/config";
import type { EmbroideryElement, JacketConfig } from "../model/types";
import { migrateConfig } from "./migrateDesign";
import { STEPS, type StepId } from "./steps";

/**
 * The customer's work-in-progress design, kept in this browser (IndexedDB:
 * uploaded artwork makes it too big for localStorage) so it survives
 * leaving /design, logging in or out, and a page refresh. Only the design
 * itself: no account or session data ever goes in here.
 *
 * Versions: v1 drafts were made before the fixed embroidery zones and the
 * material palettes. On first load one is copied, untouched, to
 * BACKUP_V1_KEY (never read by the site — a safety copy), migrated
 * (state/migrateDesign.ts), saved as v2 and removed.
 */
const KEY = "design-draft-v2";
const V1_KEY = "design-draft-v1";
const BACKUP_V1_KEY = "design-draft-v1-backup";
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

/** Font text saved before the font library is set in: the closest face to the old heavy sans lettering. */
const LEGACY_TEXT_FONT_ID = "montserrat";

type Draft = { version: 2; savedAt: number; config: JacketConfig; step: StepId };
type DraftV1 = { version: 1; savedAt: number; config: JacketConfig; step: StepId };

export const saveDraft = (config: JacketConfig, step: StepId) =>
  idbSet(KEY, { version: 2, savedAt: Date.now(), config, step } satisfies Draft);

export const clearDraft = () => Promise.all([idbDelete(KEY), idbDelete(V1_KEY)]).then(() => undefined);

const fresh = (d: { savedAt: number } | null) => !!d && typeof d.savedAt === "number" && Date.now() - d.savedAt <= MAX_AGE_MS;
const validStep = (step: unknown): StepId | undefined => STEPS.find((s) => s.id === step)?.id;

/**
 * The saved design brought up to today's model (tolerates older drafts),
 * or null. A v1 draft is migrated once and re-saved as v2.
 */
export async function loadDraft(): Promise<{ config: JacketConfig; step?: StepId } | null> {
  const draft = await idbGet<Draft>(KEY);
  if (draft?.version === 2 && typeof draft.config === "object" && fresh(draft)) {
    // Current drafts pass through unchanged; this only guards against
    // catalog changes since the draft was saved.
    const { config } = migrateConfig(draft.config);
    return { config: await setLegacyText(config), step: validStep(draft.step) };
  }

  const v1 = await idbGet<DraftV1>(V1_KEY);
  if (!v1 || v1.version !== 1 || typeof v1.config !== "object" || !fresh(v1)) return null;
  await idbSet(BACKUP_V1_KEY, v1);
  const { config: migrated, unplaced } = migrateConfig(v1.config);
  if (unplaced.length) console.warn(`Design draft: ${unplaced.length} design(s) had no free zone; the original draft is kept (${BACKUP_V1_KEY}).`);
  const config = await setLegacyText(migrated);
  const step = validStep(v1.step);
  await saveDraft(config, step ?? "body");
  await idbDelete(V1_KEY);
  return { config, step };
}

/**
 * Text saved before the font library (no `textStyle`) → the same text set
 * in a library font, fitted into its zone like newly typed text. If that
 * fails, the text stays as it was (it still renders, in its old lettering).
 */
async function setLegacyText(config: JacketConfig): Promise<JacketConfig> {
  if (!config.embroidery.some((e) => e.kind === "text" && !e.textStyle)) return config;
  const embroidery = await Promise.all(
    config.embroidery.map(async (e): Promise<EmbroideryElement> => {
      if (e.kind !== "text" || e.textStyle) return e;
      try {
        const { text, style } = await textStyleFor(e.text, LEGACY_TEXT_FONT_ID);
        if (!text) return e;
        return createZoneText(e.placement, text, style, e.thread ?? "ivory", e.id);
      } catch {
        return e;
      }
    })
  );
  return { ...config, embroidery };
}

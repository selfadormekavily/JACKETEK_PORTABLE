import type { JacketConfig } from "@/features/configurator";
import { migrateConfig } from "@/features/configurator/state/migrateDesign";
import type { StepId } from "@/features/configurator/state/steps";
import { idbDelete, idbGet, idbSet } from "@/lib/idb";
import { newRequestId } from "./api";

/**
 * Designs in progress FOR A GROUP, kept in this browser (IndexedDB) apart
 * from the personal draft (configurator/state/draft.ts, "design-draft-v2"),
 * which group work may copy from but never writes:
 *
 *   group-draft-new:<groupId>    a new jacket for that group. Starts as a
 *                                copy of the personal draft (the customer
 *                                may have designed first). Keeps the request
 *                                id its Add uses, so a retry after a refresh
 *                                or a lost answer never adds the jacket twice.
 *   group-draft-item:<itemId>    edits to an existing own jacket, with the
 *                                jacket version they started from (saved
 *                                with expectedVersion, so a newer version
 *                                saved elsewhere is never overwritten).
 *
 * Both survive leaving the page and logging in or out; they are removed
 * once the server has the jacket.
 */
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

type Stored = {
  version: 1;
  savedAt: number;
  config: JacketConfig;
  step: StepId;
  clientRequestId?: string;
  baseVersion?: number;
};

export type Loaded = { config: JacketConfig; step?: StepId };

export const newJacketKey = (groupId: string) => `group-draft-new:${groupId}`;
export const editKey = (itemId: string) => `group-draft-item:${itemId}`;

async function read(key: string): Promise<Stored | null> {
  const d = await idbGet<Stored>(key);
  if (!d || d.version !== 1 || typeof d.config !== "object" || Date.now() - d.savedAt > MAX_AGE_MS) return null;
  return { ...d, config: migrateConfig(d.config).config };
}

export type DraftSession = ReturnType<typeof draftSession>;

/**
 * One group design's draft. `seed` gives the starting design when there is
 * no usable draft. For edits (`baseVersion` set), a draft made from an older
 * version of the jacket is not resumed: the jacket as saved now is the start.
 */
export function draftSession(key: string, seed: () => Promise<Loaded | null>, baseVersion?: number) {
  const meta: { clientRequestId?: string; baseVersion?: number } = { baseVersion };
  // Once the jacket is on the server, a late autosave must not bring the draft back.
  let closed = false;
  const save = async (config: JacketConfig, step: StepId) => {
    if (closed) return;
    await idbSet(key, { version: 1, savedAt: Date.now(), config, step, ...meta } satisfies Stored);
  };
  return {
    key,
    baseVersion,
    async load(): Promise<Loaded | null> {
      const d = await read(key);
      if (d && d.baseVersion === baseVersion) {
        meta.clientRequestId = d.clientRequestId;
        return { config: d.config, step: d.step };
      }
      // Edits made from an older version of the jacket: replaced by the jacket as saved now.
      if (d) await idbDelete(key);
      return seed();
    },
    save,
    /** The Add request id: made once, stored with the draft before the request goes out. */
    async requestId(config: JacketConfig, step: StepId) {
      meta.clientRequestId ??= newRequestId();
      await save(config, step);
      return meta.clientRequestId;
    },
    /** The design is safely on the server: forget the draft. */
    async clear() {
      closed = true;
      await idbDelete(key);
    },
  };
}

import { createContext, useContext } from "react";
import type { DraftSession } from "./groupDraft";

/**
 * Where the configurator's design goes. "cart" is the normal journey (the
 * personal cart and personal draft, unchanged). "group" is set by /design?group=…
 * (a new jacket) or /design?group=…&item=… (editing one's own jacket).
 */
export type DesignTarget =
  | { kind: "cart" }
  | {
      kind: "group";
      groupId: string;
      groupName: string | null;
      session: DraftSession;
      /** Editing this own jacket (saved with `baseVersion` as expectedVersion). */
      itemId?: string;
      baseVersion?: number;
      /** The server allows the change now (group OPEN, still a member). Otherwise why not, as an error code. */
      blockedCode: string | null;
    };

export const DesignTargetContext = createContext<DesignTarget>({ kind: "cart" });
export const useDesignTarget = () => useContext(DesignTargetContext);

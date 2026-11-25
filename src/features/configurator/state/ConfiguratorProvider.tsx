import { useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type { JacketConfig } from "../model/types";
import { ConfiguratorContext } from "./context";
import { loadDraft, saveDraft } from "./draft";
import { configuratorReducer, createInitialState } from "./reducer";
import type { StepId } from "./steps";

/** Where the design in progress is kept. Default: the customer's personal draft (state/draft.ts). */
export type DraftPersistence = {
  load: () => Promise<{ config: JacketConfig; step?: StepId } | null>;
  save: (config: JacketConfig, step: StepId) => Promise<unknown>;
};
const PERSONAL_DRAFT: DraftPersistence = { load: loadDraft, save: saveDraft };

export default function ConfiguratorProvider({
  children,
  persistence = PERSONAL_DRAFT,
}: {
  children: ReactNode;
  /** A group jacket keeps its own draft (features/groups/groupDraft.ts); the personal one is never touched. */
  persistence?: DraftPersistence;
}) {
  const [state, dispatch] = useReducer(
    configuratorReducer,
    undefined,
    createInitialState
  );
  const value = useMemo(() => ({ state, dispatch }), [state]);

  // Restore the customer's saved design once, then keep saving it (state/draft.ts).
  // Saving waits for the restore, so the defaults never overwrite a draft.
  const restored = useRef(false);
  useEffect(() => {
    let live = true;
    void persistence.load().then((draft) => {
      if (!live) return;
      if (draft) dispatch({ type: "hydrate", config: draft.config, step: draft.step });
      restored.current = true;
    });
    return () => {
      live = false;
    };
  }, [persistence]);

  const { config } = state;
  const { step } = state.ui;
  useEffect(() => {
    if (!restored.current) return;
    const timer = window.setTimeout(() => void persistence.save(config, step), 300);
    return () => window.clearTimeout(timer);
  }, [config, step, persistence]);

  return (
    <ConfiguratorContext.Provider value={value}>
      {children}
    </ConfiguratorContext.Provider>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { GroupApiError, groupsApi } from "./api";
import type { GroupView } from "./types";

/** How often an open group page asks for changes (only while the tab is visible). */
const POLL_MS = 10_000;

export type GroupState =
  | { phase: "loading" }
  | { phase: "ready"; view: GroupView; stale: boolean }
  | { phase: "error"; error: GroupApiError };

/**
 * One group, kept current: loaded, then refreshed every few seconds while
 * the page is visible (and when the tab comes back), asking only for
 * changes (?since=revision → 304 when nothing changed). A failed refresh
 * keeps the last good view, marked stale. Other tabs and other members'
 * changes arrive this way; after the viewer's own change, `refresh()`.
 */
export function useGroup(groupId: string) {
  const [state, setState] = useState<GroupState>({ phase: "loading" });
  const revision = useRef<number | undefined>(undefined);
  const inFlight = useRef(false);

  const refresh = useCallback(
    async (full = false) => {
      if (inFlight.current && !full) return;
      inFlight.current = true;
      try {
        const view = await groupsApi.get(groupId, full ? undefined : revision.current);
        if (view) {
          revision.current = view.group.revision;
          setState({ phase: "ready", view, stale: false });
        } else setState((s) => (s.phase === "ready" && s.stale ? { ...s, stale: false } : s));
      } catch (err) {
        const error = err instanceof GroupApiError ? err : new GroupApiError(String(err), 0, "UNKNOWN");
        // Lost connection: keep showing what we had. Anything else (removed, not found…) replaces the page.
        setState((s) => (s.phase === "ready" && error.code === "NETWORK" ? { ...s, stale: true } : { phase: "error", error }));
        if (error.code !== "NETWORK") revision.current = undefined;
      } finally {
        inFlight.current = false;
      }
    },
    [groupId],
  );

  useEffect(() => {
    revision.current = undefined;
    setState({ phase: "loading" });
    void refresh(true);
    const tick = () => document.visibilityState === "visible" && void refresh();
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [refresh]);

  return { state, refresh: () => refresh(true) };
}

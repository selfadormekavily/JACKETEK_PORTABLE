import { useEffect, useState } from "react";
import { hasSession } from "@/features/admin/api";
import { DevTechPackError, generateDevTechPack, type DevTechPackResult } from "@/features/admin/devTechPack";
import { useConfigurator } from "../state/context";
import "@/styles/dev-techpack.css";

type Status =
  | { kind: "idle" }
  | { kind: "generating"; size: string | null }
  | { kind: "ready"; result: DevTechPackResult }
  | { kind: "error"; message: string; details: string[] };

/**
 * GENERATE TECH PACK (Development) — admin only. Shown on the Review step to a browser with a valid
 * admin session (the same session as the admin pages); everyone else sees nothing. It sends a frozen
 * copy of the design exactly as displayed and never touches the design, the cart or Add to Cart.
 */
export function DevTechPackPanel() {
  const { state } = useConfigurator();
  const [admin, setAdmin] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    let live = true;
    void hasSession().then((ok) => {
      if (live) setAdmin(ok);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!admin) return null;

  const generate = async () => {
    if (status.kind === "generating") return;
    // Freeze the design now: later edits in the configurator can't change this request.
    const snapshot = structuredClone(state.config);
    setStatus({ kind: "generating", size: snapshot.size });
    try {
      const result = await generateDevTechPack(snapshot);
      setStatus({ kind: "ready", result });
    } catch (err) {
      const e = err instanceof DevTechPackError ? err : new DevTechPackError(String(err), 0);
      setStatus({ kind: "error", message: e.message, details: e.issues.slice(0, 6).map((i) => `${i.path ? `${i.path} ` : ""}${i.message}`) });
    }
  };

  return (
    <div className="jk-devtp" data-testid="dev-techpack">
      <div className="jk-devtp__row">
        <button type="button" className="jk-devtp__button" onClick={() => void generate()} disabled={status.kind === "generating"} data-testid="generate-techpack">
          {status.kind === "generating" ? "Generating Tech Pack…" : "Generate Tech Pack"}
        </button>
        <span className="jk-devtp__tag">Development · admin</span>
      </div>
      <p className="jk-devtp__status" aria-live="polite">
        {status.kind === "generating" && <>Generating Tech Pack for size {status.size ?? "—"}… (this can take a minute)</>}
        {status.kind === "ready" && (
          <>
            <b>Tech Pack generated successfully</b> — {status.result.designId} · {status.result.revision} · size {status.result.size} · {status.result.pages} pages ·{" "}
            <a href={`${status.result.pdfUrl}?inline=1`} target="_blank" rel="noreferrer">
              Open PDF
            </a>{" "}
            · <a href={status.result.pdfUrl}>Download</a>
            <span className="jk-devtp__ref">Package: server-data/{status.result.packageRef}</span>
          </>
        )}
        {status.kind === "error" && (
          <>
            <b>Tech Pack not generated:</b> {status.message}
            {status.details.length > 0 && <span className="jk-devtp__ref">{status.details.join(" · ")}</span>}
          </>
        )}
      </p>
    </div>
  );
}

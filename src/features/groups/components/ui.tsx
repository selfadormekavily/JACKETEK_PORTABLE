import { useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/useI18n";
import type { GroupStatus } from "../types";

/**
 * Small pieces of the group pages (styles/group.css), in the cart's
 * materials. Customer text (group names, people's names, embroidery) is
 * always isolated with dir="auto", so Latin names sit cleanly in Arabic
 * and the other way round.
 */

/** The group's name, or "Group order" when it has none. */
export function GroupName({ name }: { name: string | null }) {
  const { t } = useI18n();
  return name ? <bdi dir="auto">{name}</bdi> : <>{t("group.untitled")}</>;
}

export function StatusPatch({ status }: { status: GroupStatus }) {
  const { t } = useI18n();
  return <span className={`jk-status jk-status--${status}`}>{t(`group.status.${status}`)}</span>;
}

/** A quiet notice; `attention` for things the customer must act on or know. */
export function Notice({ children, attention = false, live = false }: { children: ReactNode; attention?: boolean; live?: boolean }) {
  return (
    <p className={`jk-group-note ${attention ? "jk-group-note--attention" : ""}`} role={live ? "status" : undefined} aria-live={live ? "polite" : undefined}>
      {children}
    </p>
  );
}

/**
 * A button that asks first (for anything that can't simply be undone):
 * pressing it shows the question with Yes / No in its place. Focus moves to
 * "No" so a stray Enter never confirms.
 */
export function ConfirmAction({
  label,
  question,
  onConfirm,
  danger = false,
  disabled = false,
  className = "jk-btn-quiet",
}: {
  label: string;
  question: string;
  onConfirm: () => void | Promise<void>;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!asking)
    return (
      <button type="button" className={`${className} ${danger && className === "jk-btn-quiet" ? "jk-btn-quiet--danger" : ""}`} disabled={disabled} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  return (
    <div className="jk-confirm" role="group" aria-label={label}>
      <p className="jk-confirm__question">{question}</p>
      <div className="jk-confirm__buttons">
        <button
          type="button"
          className={`jk-btn-quiet ${danger ? "jk-btn-quiet--danger" : ""}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
              setAsking(false);
            }
          }}
        >
          {t("group.host.confirm")}
        </button>
        <button type="button" className="jk-btn-quiet" autoFocus disabled={busy} onClick={() => setAsking(false)}>
          {t("group.host.keep")}
        </button>
      </div>
    </div>
  );
}

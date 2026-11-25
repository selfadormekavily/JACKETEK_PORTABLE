import { useEffect, useId, useRef, useState } from "react";
import { Receipt } from "@/features/cart/components/editorial";
import { useI18n } from "@/i18n/useI18n";

/**
 * The invite link, on a woven card: Copy, and Share where the device offers
 * its own share sheet (phones). The link always reads left-to-right.
 */
export function InvitePanel({ path, groupName }: { path: string; groupName: string }) {
  const { t } = useI18n();
  const url = `${window.location.origin}${path}`;
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
  const linkRef = useRef<HTMLParagraphElement>(null);
  const labelId = useId();
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("ok");
    } catch {
      // No clipboard access: select the link so it can be copied by hand.
      const range = document.createRange();
      if (linkRef.current) {
        range.selectNodeContents(linkRef.current);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
      setCopied("failed");
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: groupName, text: t("group.invite.shareText", { name: groupName }), url });
    } catch {
      /* dismissed */
    }
  };

  return (
    <Receipt title={t("group.invite.title")}>
      <p className="text-[14px] leading-[1.5] text-jk-ink">{t("group.invite.body")}</p>
      <p className="jk-label-xs mt-5 text-jk-muted" id={labelId}>
        {t("group.invite.label")}
      </p>
      <p ref={linkRef} dir="ltr" className="jk-invite__link" aria-labelledby={labelId} data-testid="invite-url">
        {url}
      </p>
      <div className="jk-invite__actions">
        <button type="button" className="jk-btn-quiet" onClick={() => void copy()}>
          {t("group.invite.copy")}
        </button>
        {canShare && (
          <button type="button" className="jk-btn-quiet" onClick={() => void share()}>
            {t("group.invite.share")}
          </button>
        )}
      </div>
      <p className="mt-3 min-h-[20px] text-[13px] text-jk-ink" role="status" aria-live="polite">
        {copied === "ok" ? t("group.invite.copied") : copied === "failed" ? t("group.invite.copyFailed") : ""}
      </p>
    </Receipt>
  );
}

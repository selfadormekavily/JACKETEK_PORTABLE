import { useContext, useEffect } from "react";
import { I18nContext } from "@/i18n/context";
import type { TKey } from "@/i18n/context";

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/**
 * The document title for a page, in the current language; restores the
 * site default when the page unmounts.
 */
export function useDocumentTitle(key: TKey) {
  const { t } = useI18n();
  const title = t(key);
  const fallback = t("meta.title.default");
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = fallback;
    };
  }, [title, fallback]);
}

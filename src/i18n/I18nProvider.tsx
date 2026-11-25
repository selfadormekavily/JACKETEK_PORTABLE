import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyDocumentLocale, LOCALES, readStoredLocale, storeLocale, type Locale } from "@/i18n/config";
import { I18nContext, type I18nValue } from "@/i18n/context";
import { interpolate, isPluralForms, lookup, selectPlural } from "@/i18n/format";
import type { Vars } from "@/i18n/types";
import { MESSAGES } from "@/locales";

/**
 * The locale for the whole customer site. Switching only re-renders: the
 * route, cart, session, configurator state and saved draft live in their
 * own providers/storage and are untouched. index.html sets <html lang dir>
 * from the saved choice before React loads, so there is no LTR flash.
 */
export default function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  useEffect(() => applyDocumentLocale(locale), [locale]);

  const setLocale = useCallback((next: Locale) => {
    storeLocale(next);
    setLocaleState(next);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const own = MESSAGES[locale];
    const source = MESSAGES.en;
    const lang = LOCALES[locale].htmlLang;
    const raw = (key: string) => {
      const v = lookup(own, key);
      return v === undefined ? lookup(source, key) : v;
    };
    const tMaybe = (key: string, vars?: Vars) => {
      const v = raw(key);
      return typeof v === "string" ? interpolate(v, vars) : undefined;
    };
    return {
      locale,
      dir: LOCALES[locale].dir,
      isRtl: LOCALES[locale].dir === "rtl",
      setLocale,
      tMaybe,
      t: (key, vars) => tMaybe(key, vars) ?? key,
      tp: (key, count, vars) => {
        const v = raw(key);
        if (!isPluralForms(v)) return key;
        return interpolate(selectPlural(v, count, lang), { count, ...vars });
      },
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

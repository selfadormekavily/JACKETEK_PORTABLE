/**
 * Locales the customer site ships in. English is the source locale: every
 * key exists there first, and any key missing in another locale falls back
 * to it. Adding a language = one entry here + one folder in src/locales.
 */
export const LOCALES = {
  en: { htmlLang: "en", dir: "ltr", label: "English" },
  "ar-IQ": { htmlLang: "ar-IQ", dir: "rtl", label: "عربي" },
} as const;

export type Locale = keyof typeof LOCALES;
export type Dir = "ltr" | "rtl";

export const DEFAULT_LOCALE: Locale = "en";

/** Only the locale preference lives here — never auth or session data. */
export const LOCALE_STORAGE_KEY = "jacketek.locale";

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && v in LOCALES;

/** The saved preference, or English. Storage can throw (private mode): ignore. */
export function readStoredLocale(): Locale {
  try {
    const v = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(v) ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function storeLocale(locale: Locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* the choice still applies for this visit */
  }
}

/** <html lang dir>: the document-level switch every RTL rule keys off. */
export function applyDocumentLocale(locale: Locale) {
  const { htmlLang, dir } = LOCALES[locale];
  const root = document.documentElement;
  root.lang = htmlLang;
  root.dir = dir;
}

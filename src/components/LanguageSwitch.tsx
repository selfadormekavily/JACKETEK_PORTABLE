import { LOCALES, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/useI18n";

const ORDER: Locale[] = ["en", "ar-IQ"];

/**
 * English | عربي. Each option is labelled in its own language (never
 * translated). Switching re-renders in place: same route, cart, session,
 * configurator state and draft.
 *
 * "toggle": the phones' top bar — one compact button naming the other
 * language ("عربي" on the English site, "EN" on the Arabic one).
 */
export default function LanguageSwitch({ variant = "nav", tabIndex }: { variant?: "nav" | "sheet" | "toggle"; tabIndex?: number }) {
  const { locale, setLocale, t } = useI18n();
  if (variant === "toggle") {
    const next: Locale = locale === "en" ? "ar-IQ" : "en";
    return (
      <button
        type="button"
        lang={next === "en" ? "en" : "ar"}
        dir={LOCALES[next].dir}
        onClick={() => setLocale(next)}
        aria-label={t("language.switchTo", { language: LOCALES[next].label })}
        className="jk-lang-toggle jk-hit"
        tabIndex={tabIndex}
      >
        {next === "en" ? "EN" : LOCALES[next].label}
      </button>
    );
  }
  return (
    <div role="group" aria-label={t("language.switchAria")} className={`jk-lang ${variant === "sheet" ? "jk-lang--sheet" : ""}`}>
      {ORDER.map((code) => (
        <button
          key={code}
          type="button"
          lang={code === "en" ? "en" : "ar"}
          dir={LOCALES[code].dir}
          aria-pressed={locale === code}
          onClick={() => locale !== code && setLocale(code)}
          className="jk-lang__opt jk-hit"
          tabIndex={tabIndex}
        >
          {LOCALES[code].label}
        </button>
      ))}
    </div>
  );
}

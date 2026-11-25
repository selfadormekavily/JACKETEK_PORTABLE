import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";
import type { Locale } from "@/i18n/config";

/**
 * Every country the phone library knows (with its dialling code), named by
 * the browser's own Intl.DisplayNames in the active language. English names
 * are kept as well, so a search in either language finds a country. Flags
 * are the regional-indicator emoji (polyfilled with a self-hosted flag font
 * where the system has none, e.g. Windows).
 */
export type Country = { code: CountryCode; name: string; nameEn: string; dial: string; flag: string };

const displayNames = (lang: string) => {
  try {
    return new Intl.DisplayNames([lang], { type: "region" });
  } catch {
    return null;
  }
};

const flagOf = (code: string) => String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

const CODES = getCountries();
const CODE_SET = new Set<string>(CODES);

/** Folds case, Arabic marks and letter variants (أ إ آ → ا, ة → ه, ى → ي) so search is forgiving. */
const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");

type Entry = Country & { search: string };
const tables = new Map<Locale, { list: Entry[]; byCode: Map<CountryCode, Entry> }>();

/** The country list for a language, built once and cached. */
function table(locale: Locale) {
  let t = tables.get(locale);
  if (!t) {
    const lang = locale === "ar-IQ" ? "ar" : "en";
    const own = displayNames(lang);
    const en = lang === "en" ? own : displayNames("en");
    const list = CODES.map((code) => {
      const nameEn = en?.of(code) ?? code;
      const name = own?.of(code) ?? nameEn;
      return { code, name, nameEn, dial: `+${getCountryCallingCode(code)}`, flag: flagOf(code), search: fold(`${name} ${nameEn}`) };
    }).sort((a, b) => a.name.localeCompare(b.name, lang));
    t = { list, byCode: new Map(list.map((c) => [c.code, c])) };
    tables.set(locale, t);
  }
  return t;
}

export const countryOf = (code: CountryCode, locale: Locale): Country => {
  const { byCode } = table(locale);
  return byCode.get(code) ?? byCode.get("JO")!;
};

/** A sensible first choice: the browser's region if we know it, else Jordan. */
export function defaultCountry(): CountryCode {
  const region = typeof navigator !== "undefined" ? navigator.language.split("-")[1]?.toUpperCase() : undefined;
  return region && CODE_SET.has(region) ? (region as CountryCode) : "JO";
}

/** Matches "jor", "الأردن", "962", "+962" or "JO", in either language. */
export function searchCountries(query: string, locale: Locale): Country[] {
  const { list } = table(locale);
  const raw = query.trim().replace(/^\+/, "");
  if (!raw) return list;
  const q = fold(raw);
  return list.filter((c) => c.search.includes(q) || c.dial.slice(1).startsWith(raw) || c.code.toLowerCase() === raw.toLowerCase());
}

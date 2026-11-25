import type { PluralForms, Vars } from "@/i18n/types";

/** Walk a dotted path through a message tree. */
export function lookup(tree: unknown, key: string): unknown {
  let node: unknown = tree;
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/** "{count} items" + { count: 2 } → "2 items". Unknown placeholders stay visible. */
export function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

const rulesCache = new Map<string, Intl.PluralRules>();
function pluralRules(lang: string) {
  let r = rulesCache.get(lang);
  if (!r) {
    r = new Intl.PluralRules(lang);
    rulesCache.set(lang, r);
  }
  return r;
}

/** Arabic has six plural forms (zero, one, two, few, many, other). */
export function selectPlural(forms: PluralForms, count: number, lang: string): string {
  const cat = pluralRules(lang).select(count) as keyof PluralForms;
  // An explicit zero form is used for 0 even where CLDR says "other" (English).
  if (count === 0 && forms.zero) return forms.zero;
  return forms[cat] ?? forms.other;
}

export const isPluralForms = (v: unknown): v is PluralForms =>
  typeof v === "object" && v !== null && typeof (v as PluralForms).other === "string";

/**
 * Numbers in both locales use Western digits (the convention on modern
 * Iraqi and Jordanian e-commerce): never Arabic-Indic.
 */
const NUM = new Intl.NumberFormat("en-US");
export const formatNumber = (n: number) => NUM.format(n);
/** "02": the two-digit counters used across the design. */
export const pad2 = (n: number) => String(n).padStart(2, "0");

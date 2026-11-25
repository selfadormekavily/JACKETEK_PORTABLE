import { createContext } from "react";
import type { Dir, Locale } from "@/i18n/config";
import type { PluralKey, StringKey, Vars } from "@/i18n/types";
import type { EnMessages } from "@/locales/en";

export type TKey = StringKey<EnMessages>;
export type TPluralKey = PluralKey<EnMessages>;

export type I18nValue = {
  locale: Locale;
  dir: Dir;
  isRtl: boolean;
  setLocale: (locale: Locale) => void;
  /** A message, with {placeholders} filled. */
  t: (key: TKey, vars?: Vars) => string;
  /** A plural message: picks the form for `count` (also available as {count}). */
  tp: (key: TPluralKey, count: number, vars?: Vars) => string;
  /** A message chosen at runtime (catalog ids, server codes); undefined if absent. */
  tMaybe: (key: string, vars?: Vars) => string | undefined;
};

export const I18nContext = createContext<I18nValue | null>(null);

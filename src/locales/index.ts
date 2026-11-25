import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/types";
import arIQ from "@/locales/ar-IQ";
import en, { type EnMessages } from "@/locales/en";

/** All message trees, by locale. */
export const MESSAGES: Record<Locale, Messages<EnMessages>> = {
  en,
  "ar-IQ": arIQ,
};

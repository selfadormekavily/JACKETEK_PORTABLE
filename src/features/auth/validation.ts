import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Client-side checks, mirroring server/auth.mjs (which re-checks
 * everything: these only give instant feedback).
 */
export const PASSWORD_MIN = 7;

/** Practical email check: something@domain.tld, no spaces, no empty labels. */
export function isValidEmail(raw: string): boolean {
  const email = raw.trim();
  if (!email || email.length > 254) return false;
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return false;
  const local = email.slice(0, at);
  const labels = email.slice(at + 1).split(".");
  if (local.length > 64 || /\s/.test(local) || local.includes("@")) return false;
  if (labels.length < 2 || labels.some((l) => !/^[a-z0-9¡-￿](?:[a-z0-9¡-￿-]*[a-z0-9¡-￿])?$/i.test(l))) return false;
  return labels[labels.length - 1].length >= 2;
}

/** The number in E.164 (e.g. +962791234567), or null if it isn't valid for the country. */
export function toE164(number: string, country: CountryCode): string | null {
  const parsed = parsePhoneNumberFromString(number, country);
  return parsed?.isValid() ? parsed.number : null;
}

export const passwordLongEnough = (password: string) => [...password].length >= PASSWORD_MIN;

import type { I18nValue } from "@/i18n/context";

/**
 * The API answers in English (backend unchanged). Known messages map to
 * locale keys here; anything unknown becomes the localized generic error,
 * so customers never see raw technical English. Order validation joins
 * several messages with spaces — each sentence is mapped on its own.
 */
const EXACT: Record<string, string> = {
  "That password is too long.": "passwordLong",
  "Too many sign-ups from here. Try again in a few minutes.": "signupRateLimit",
  "Enter your first name.": "firstNameRequired",
  "Enter your last name.": "lastNameRequired",
  "That name is too long.": "nameTooLong",
  "Enter a valid mobile number for the selected country.": "phoneInvalid",
  "Enter a valid email address, like name@example.com.": "emailInvalid",
  "Enter a valid email address.": "emailInvalidShort",
  "Please check the highlighted fields.": "checkFields",
  "An account already uses this email.": "emailTaken",
  "An account already uses this email. Log in instead.": "emailTakenLogIn",
  "An account already uses this number.": "phoneTaken",
  "An account already uses this number. Log in instead.": "phoneTakenLogIn",
  "An account already uses these details. Log in instead.": "detailsTaken",
  "Email/phone or password is incorrect.": "loginFailed",
  "Too many attempts. Try again in a minute.": "loginRateLimitIp",
  "Too many attempts for this account. Try again in 15 minutes.": "loginRateLimitAccount",
  "Forbidden.": "forbidden",
  Forbidden: "forbidden",
  "Full name is required.": "orderFullName",
  "A valid phone number is required.": "orderPhone",
  "City is required.": "orderCity",
  "Area is required.": "orderArea",
  "Full address is required.": "orderAddress",
  "Card payment isn't available yet. Please choose Cash on Delivery.": "orderCardUnavailable",
  "Choose a payment method.": "orderPaymentMethod",
  "The order must contain 1–20 jackets.": "orderItemCount",
  "This order is too large.": "orderTooLarge",
  "Something went wrong.": "generic",
};

const PATTERNS: [RegExp, string, (m: RegExpMatchArray) => Record<string, string>][] = [
  [/^Use at least (\d+) characters\.$/, "passwordShort", (m) => ({ min: m[1] })],
  [/^Jacket (\d+): its design is missing\.$/, "orderDesignMissing", (m) => ({ n: m[1] })],
  [/^Jacket (\d+): no size selected\.$/, "orderNoSize", (m) => ({ n: m[1] })],
  [/^Jacket (\d+): invalid quantity\.$/, "orderBadQuantity", (m) => ({ n: m[1] })],
];

type I18nLike = Pick<I18nValue, "tMaybe" | "t">;

function one(sentence: string, { tMaybe }: I18nLike): string | undefined {
  const s = sentence.trim();
  if (EXACT[s]) return tMaybe(`serverErrors.${EXACT[s]}`);
  for (const [re, key, vars] of PATTERNS) {
    const m = s.match(re);
    if (m) return tMaybe(`serverErrors.${key}`, vars(m));
  }
  return undefined;
}

/** Sentences of a joined message: "A. B." → ["A.", "B."] (keeps "1–20"). */
const sentences = (msg: string) => msg.split(/(?<=\.)\s+(?=[A-Z])/);

/** A server message in the current language (or the localized generic error). */
export function localizeServerMessage(message: string | null | undefined, i18n: I18nLike): string {
  if (!message) return i18n.t("serverErrors.generic");
  const whole = one(message, i18n);
  if (whole) return whole;
  const parts = sentences(message);
  if (parts.length > 1) {
    const mapped = parts.map((p) => one(p, i18n));
    if (mapped.every(Boolean)) return mapped.join(" ");
  }
  return i18n.t("serverErrors.generic");
}

/** Per-field server errors ({ email: "…" }) in the current language. */
export function localizeFieldErrors<K extends string>(
  fields: Partial<Record<K, string>> | null | undefined,
  i18n: I18nLike,
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  if (!fields) return out;
  for (const k of Object.keys(fields) as K[]) {
    const v = fields[k];
    if (v) out[k] = localizeServerMessage(v, i18n);
  }
  return out;
}

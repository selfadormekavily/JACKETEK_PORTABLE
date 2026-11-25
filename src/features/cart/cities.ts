/**
 * Jordan's main cities, offered as suggestions at checkout (any city can
 * be typed). `value` is what the order records — the usual English name,
 * in every language; the shown name comes from `checkout.cities.<key>`.
 */
export const CITIES = [
  { key: "Amman", value: "Amman" },
  { key: "Zarqa", value: "Zarqa" },
  { key: "Irbid", value: "Irbid" },
  { key: "Aqaba", value: "Aqaba" },
  { key: "Salt", value: "Salt" },
  { key: "Madaba", value: "Madaba" },
  { key: "Jerash", value: "Jerash" },
  { key: "Ajloun", value: "Ajloun" },
  { key: "Karak", value: "Karak" },
  { key: "Mafraq", value: "Mafraq" },
  { key: "Tafilah", value: "Tafilah" },
  { key: "Maan", value: "Ma'an" },
] as const;

export type CityKey = (typeof CITIES)[number]["key"];

/** Arabic letters compared without vowel marks/shadda or tatweel. */
const bare = (s: string) => s.trim().replace(/[ً-ْـ]/g, "");

/**
 * What to record for a typed city: a suggested city chosen by its shown
 * (e.g. Arabic) name becomes its usual English name, so orders stay
 * consistent for the team; anything else is kept as typed.
 */
export function cityValue(typed: string, shownName: (key: CityKey) => string): string {
  const b = bare(typed);
  return CITIES.find((c) => bare(shownName(c.key)) === b)?.value ?? typed;
}

/** The key of a recorded city value ("Ma'an" → "Maan"), for showing it localized. */
export function cityKey(value: string): CityKey | undefined {
  const v = value.trim().toLowerCase();
  return CITIES.find((c) => c.value.toLowerCase() === v)?.key;
}

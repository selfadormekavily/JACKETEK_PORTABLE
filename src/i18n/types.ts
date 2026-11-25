/**
 * Message typing. English (src/locales/en) is the source of truth; other
 * locales must provide the same tree (checked by `Messages`).
 *
 * A leaf is either a string — with optional {placeholders} and simple
 * <tags> for rich text — or a plural set (CLDR forms, `other` required).
 */
export type PluralForms = {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};

type Leaf = string | PluralForms;
export type MessageTree = { [key: string]: Leaf | MessageTree };

/** The shape another locale must match: same keys, any wording. */
export type Messages<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends { other: string } ? PluralForms : Messages<T[K]>;
};

/** Dotted paths to string leaves ("nav.cart"). */
export type StringKey<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends { other: string }
      ? never
      : StringKey<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Dotted paths to plural leaves ("cart.jacketCount"). */
export type PluralKey<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? never
    : T[K] extends { other: string }
      ? `${P}${K}`
      : PluralKey<T[K], `${P}${K}.`>;
}[keyof T & string];

export type Vars = Record<string, string | number>;

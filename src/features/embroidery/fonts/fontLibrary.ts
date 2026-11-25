/**
 * THE EMBROIDERY FONT LIBRARY — the faces a customer can stitch text in.
 *
 * One list, shared by the configurator (picker + 3D lettering), the order
 * (which font was chosen) and production (the server redraws the text in the
 * same font for the PDF and the digitizer). Pure data: no DOM.
 *
 * Every font is a self-hosted file in public/fonts/embroidery/ (all SIL Open
 * Font License, from Google Fonts; fetched by scripts/fetch-embroidery-fonts.mjs).
 * To add a font: add an entry here, run the script, done — the picker, the
 * search/filters, the jacket and production pick it up from this list.
 */

export type FontCategory = "varsity" | "athletic" | "block" | "gothic" | "vintage" | "script" | "modern" | "arabic";
export type FontScript = "latin" | "arabic";

export type EmbroideryFont = {
  /** Stable id stored in orders. Never change an existing one. */
  id: string;
  /** Shown to the customer and on the production sheet. */
  name: string;
  /** The CSS family it is registered under (unique to this library). */
  family: string;
  /** Served from public/. */
  file: string;
  weight: number;
  categories: readonly FontCategory[];
  /** Scripts the face itself draws. */
  scripts: readonly FontScript[];
  /**
   * Extra stroke weight for stitching, as a share of the font size: thin
   * faces get a little bolder so satin stitches can carry them (0 = as drawn).
   */
  embolden: number;
  license: "OFL-1.1";
  source: { provider: "Google Fonts"; family: string; weight: number };
};

const font = (
  id: string,
  name: string,
  googleFamily: string,
  weight: number,
  categories: FontCategory[],
  scripts: FontScript[],
  embolden = 0.02
): EmbroideryFont => ({
  id,
  name,
  family: `JK Embroidery ${name}`,
  file: `/fonts/embroidery/${id}.ttf`,
  weight,
  categories,
  scripts,
  embolden,
  license: "OFL-1.1",
  source: { provider: "Google Fonts", family: googleFamily, weight },
});

export const EMBROIDERY_FONTS: readonly EmbroideryFont[] = [
  // Varsity / collegiate
  font("graduate", "Varsity", "Graduate", 400, ["varsity", "block"], ["latin"], 0.01),
  font("alfa-slab", "College Slab", "Alfa Slab One", 400, ["varsity", "block", "vintage"], ["latin"], 0),
  font("ultra", "Heritage Slab", "Ultra", 400, ["varsity", "vintage"], ["latin"], 0),
  // Athletic
  font("anton", "Athletic", "Anton", 400, ["athletic", "block"], ["latin"], 0.01),
  font("bebas", "Jersey", "Bebas Neue", 400, ["athletic", "modern"], ["latin"], 0.02),
  font("teko", "Scoreboard", "Teko", 600, ["athletic"], ["latin"], 0.02),
  font("staatliches", "Team Block", "Staatliches", 400, ["athletic", "block"], ["latin"], 0.015),
  // Block
  font("bungee", "Block", "Bungee", 400, ["block"], ["latin"], 0),
  font("black-ops", "Stencil Block", "Black Ops One", 400, ["block", "athletic"], ["latin"], 0),
  font("archivo-black", "Heavy Sans", "Archivo Black", 400, ["block", "modern"], ["latin"], 0),
  // Gothic
  font("unifraktur", "Old English", "UnifrakturMaguntia", 400, ["gothic", "vintage"], ["latin"], 0.015),
  font("pirata", "Blackletter", "Pirata One", 400, ["gothic"], ["latin"], 0.02),
  font("grenze-gotisch", "Gothic Bold", "Grenze Gotisch", 700, ["gothic"], ["latin"], 0.01),
  // Vintage
  font("rye", "Western", "Rye", 400, ["vintage"], ["latin"], 0.01),
  font("abril", "Fashion Serif", "Abril Fatface", 400, ["vintage"], ["latin"], 0.015),
  font("playfair", "Classic Serif", "Playfair Display", 800, ["vintage", "modern"], ["latin"], 0.015),
  // Script
  font("lobster", "Retro Script", "Lobster", 400, ["script", "vintage"], ["latin"], 0.015),
  font("pacifico", "Surf Script", "Pacifico", 400, ["script"], ["latin"], 0.01),
  font("dancing", "Hand Script", "Dancing Script", 700, ["script"], ["latin"], 0.03),
  font("yellowtail", "Baseball Script", "Yellowtail", 400, ["script", "athletic"], ["latin"], 0.035),
  font("great-vibes", "Elegant Script", "Great Vibes", 400, ["script"], ["latin"], 0.045),
  // Clean modern
  font("montserrat", "Modern Sans", "Montserrat", 800, ["modern"], ["latin"], 0.01),
  font("poppins", "Geometric Sans", "Poppins", 700, ["modern"], ["latin"], 0.015),
  // Arabic + English
  font("cairo", "Cairo", "Cairo", 800, ["arabic", "modern"], ["arabic", "latin"], 0.015),
  font("tajawal", "Tajawal", "Tajawal", 800, ["arabic", "modern"], ["arabic", "latin"], 0.02),
  font("changa", "Changa", "Changa", 800, ["arabic", "athletic"], ["arabic", "latin"], 0.01),
  font("lalezar", "Lalezar", "Lalezar", 400, ["arabic", "block"], ["arabic", "latin"], 0),
  font("reem-kufi", "Reem Kufi", "Reem Kufi", 700, ["arabic", "modern"], ["arabic", "latin"], 0.02),
  font("kufam", "Kufam", "Kufam", 800, ["arabic", "gothic"], ["arabic", "latin"], 0.015),
  font("el-messiri", "El Messiri", "El Messiri", 700, ["arabic", "vintage"], ["arabic", "latin"], 0.02),
  font("rakkas", "Rakkas", "Rakkas", 400, ["arabic", "vintage"], ["arabic", "latin"], 0.01),
  font("amiri", "Amiri Naskh", "Amiri", 700, ["arabic", "vintage"], ["arabic", "latin"], 0.03),
  font("aref-ruqaa", "Ruqaa Script", "Aref Ruqaa", 700, ["arabic", "script"], ["arabic", "latin"], 0.03),
  font("noto-naskh", "Naskh", "Noto Naskh Arabic", 700, ["arabic"], ["arabic", "latin"], 0.03),
  // Added: varsity / collegiate
  font("holtwood", "Collegiate Wide", "Holtwood One SC", 400, ["varsity", "vintage"], ["latin"], 0),
  font("rammetto", "Retro Collegiate", "Rammetto One", 400, ["varsity", "block", "vintage"], ["latin"], 0),
  font("bowlby", "Classic Block", "Bowlby One SC", 400, ["varsity", "block", "athletic"], ["latin"], 0),
  // Added: athletic / sports
  font("racing-sans", "Racing", "Racing Sans One", 400, ["athletic"], ["latin"], 0.01),
  font("squada", "Sports Condensed", "Squada One", 400, ["athletic", "modern"], ["latin"], 0.015),
  font("bangers", "Comic Sports", "Bangers", 400, ["athletic", "block"], ["latin"], 0.01),
  font("audiowide", "90s Tech", "Audiowide", 400, ["block", "modern"], ["latin"], 0.02),
  // Added: western / vintage / classic serif
  font("sancreek", "Western Saloon", "Sancreek", 400, ["vintage"], ["latin"], 0.01),
  font("smokum", "Frontier", "Smokum", 400, ["vintage"], ["latin"], 0.015),
  font("cinzel", "Roman Capitals", "Cinzel", 700, ["vintage", "modern"], ["latin"], 0.02),
  font("shrikhand", "Retro Bold", "Shrikhand", 400, ["vintage", "script"], ["latin"], 0.01),
  // Added: gothic
  font("new-rocker", "Rock Gothic", "New Rocker", 400, ["gothic", "vintage"], ["latin"], 0.015),
  font("germania", "Gothic Block", "Germania One", 400, ["gothic", "block"], ["latin"], 0.01),
  // Added: handwritten / script
  font("kaushan", "Brush Script", "Kaushan Script", 400, ["script"], ["latin"], 0.02),
  font("damion", "Ballpark Script", "Damion", 400, ["script", "athletic"], ["latin"], 0.025),
  font("permanent-marker", "Marker", "Permanent Marker", 400, ["script", "modern"], ["latin"], 0.01),
];

export const DEFAULT_TEXT_FONT_ID = "graduate";

/**
 * Where a face doesn't draw a script, that part of the text is set in this
 * library font instead (never a system font), so mixed Arabic + English
 * always renders — and renders the same in production.
 */
export const SCRIPT_FALLBACK: Record<FontScript, string> = { arabic: "cairo", latin: "montserrat" };

export const FONT_CATEGORIES: readonly { id: FontCategory; name: string }[] = [
  { id: "varsity", name: "Varsity" },
  { id: "athletic", name: "Athletic" },
  { id: "block", name: "Block" },
  { id: "gothic", name: "Gothic" },
  { id: "vintage", name: "Vintage" },
  { id: "script", name: "Script" },
  { id: "modern", name: "Modern" },
  { id: "arabic", name: "Arabic" },
];

export const getEmbroideryFont = (id: string | undefined): EmbroideryFont =>
  EMBROIDERY_FONTS.find((f) => f.id === id) ?? EMBROIDERY_FONTS.find((f) => f.id === DEFAULT_TEXT_FONT_ID)!;

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN = /[A-Za-zÀ-ɏ]/;

/** The scripts a text uses. */
export function scriptsOf(text: string): FontScript[] {
  const out: FontScript[] = [];
  if (LATIN.test(text)) out.push("latin");
  if (ARABIC.test(text)) out.push("arabic");
  return out;
}

/** The fonts a text is drawn with: the chosen face, then a library fallback for each script it lacks. */
export function fontStack(font: EmbroideryFont, text: string): EmbroideryFont[] {
  const stack = [font];
  for (const s of scriptsOf(text)) if (!font.scripts.includes(s)) stack.push(getEmbroideryFont(SCRIPT_FALLBACK[s]));
  return stack;
}

/** Base direction of a text: right-to-left when its first strong letter is Arabic. */
export function baseDirection(text: string): "rtl" | "ltr" {
  for (const ch of text) {
    if (ARABIC.test(ch)) return "rtl";
    if (LATIN.test(ch)) return "ltr";
  }
  return "ltr";
}

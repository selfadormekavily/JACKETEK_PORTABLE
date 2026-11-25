import type { TextEmbroideryStyle } from "@/features/configurator/model/types";
import { fontStack, getEmbroideryFont } from "../fonts/fontLibrary";
import { loadEmbroideryFonts } from "../fonts/loadFonts";
import { drawTextArtwork, tidyText } from "./textArtwork";

/**
 * Text + a library font → how the text is set (font, script fallbacks,
 * direction, proportions): what a text embroidery element stores. Loads
 * the fonts it needs first. `text` is "" (and `aspect` 1) when nothing is
 * left to stitch once cleaned. Shared by the text editor and the draft
 * migration, so migrated text is set exactly as typed text is.
 */
export async function textStyleFor(
  value: string,
  fontId: string
): Promise<{ text: string; style: Omit<TextEmbroideryStyle, "fitScale"> }> {
  const clean = tidyText(value);
  const font = getEmbroideryFont(fontId);
  const stack = fontStack(font, clean);
  await loadEmbroideryFonts(stack).catch(() => undefined);
  const art = clean ? drawTextArtwork(clean, font.id) : null;
  return {
    text: art ? clean : "",
    style: {
      fontId: font.id,
      fontName: font.name,
      fallbackFontIds: stack.slice(1).map((f) => f.id),
      alignment: "center",
      direction: art?.direction ?? "ltr",
      aspect: art ? Math.round(art.aspect * 10000) / 10000 : 1,
    },
  };
}

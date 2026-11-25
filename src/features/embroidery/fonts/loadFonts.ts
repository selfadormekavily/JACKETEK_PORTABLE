import { EMBROIDERY_FONTS, type EmbroideryFont } from "./fontLibrary";

/**
 * Registers library fonts with the page (FontFace API — no stylesheet), each
 * once, from its self-hosted file. Every face is registered for the whole
 * weight range, so the browser never synthesises a fake bold.
 */
const loading = new Map<string, Promise<void>>();

export function loadEmbroideryFont(font: EmbroideryFont): Promise<void> {
  let p = loading.get(font.id);
  if (!p) {
    const face = new FontFace(font.family, `url(${font.file})`, { weight: "1 1000", display: "block" });
    p = face.load().then((f) => {
      document.fonts.add(f);
    });
    p.catch(() => loading.delete(font.id));
    loading.set(font.id, p);
  }
  return p;
}

export const loadEmbroideryFonts = (fonts: readonly EmbroideryFont[]) => Promise.all(fonts.map(loadEmbroideryFont)).then(() => undefined);

/** Loads every library font (the picker's previews). */
export const loadAllEmbroideryFonts = () => loadEmbroideryFonts(EMBROIDERY_FONTS);

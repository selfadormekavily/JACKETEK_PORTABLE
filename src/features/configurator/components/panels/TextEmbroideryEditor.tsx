import { useEffect, useMemo, useRef, useState } from "react";
import { useCatalogNames } from "@/i18n/useCatalogNames";
import { useI18n } from "@/i18n/useI18n";
import { formatNumber } from "@/i18n/format";
import {
  DEFAULT_TEXT_FONT_ID,
  EMBROIDERY_FONTS,
  FONT_CATEGORIES,
  fontStack,
  getEmbroideryFont,
  scriptsOf,
  type FontCategory,
} from "@/features/embroidery/fonts/fontLibrary";
import { loadAllEmbroideryFonts, loadEmbroideryFonts } from "@/features/embroidery/fonts/loadFonts";
import { cleanText, drawTextArtwork, LINE_GAP, textLength, textLines, TEXT_MAX_LINES, tidyText } from "@/features/embroidery/text/textArtwork";
import { textStyleFor } from "@/features/embroidery/text/textStyle";
import { getColour, getThread, THREADS, type PlacementOption } from "../../model/catalog";
import { zoneContent } from "../../model/embroideryGeometry";
import type { EmbroideryElement, ZoneTransform } from "../../model/types";
import ZonePlacement from "./ZonePlacement";
import { DEFAULT_TEXT_THREAD } from "../../state/reducer";
import { useConfigurator } from "../../state/context";
import { OptionGroup, Swatch } from "../ui";

const cm = (metres: number) => formatNumber(Math.round(metres * 1000) / 10);

/** Letters smaller than this (cap height, mm) may not stitch cleanly in satin. */
const MIN_LETTER_MM = 5;
/** Approximate capital-letter height (mm) of lettering `heightCm` tall over `lines` lines. */
const letterHeightMm = (heightCm: number, lines: number) => ((heightCm * 10) / (Math.max(1, lines) + Math.max(0, lines - 1) * LINE_GAP)) * 0.72;
const quietAction =
  "jk-cfg-meta jk-hit text-[10px] uppercase tracking-widest2 text-jk-muted transition-colors duration-300 hover:text-jk-accent";

/**
 * Text in a zone: the customer types their text (English, Arabic or both)
 * and picks a face from the embroidery font library; the jacket shows it
 * stitched, fitted into the zone. A face that can't draw a script hands
 * those letters to the library's fallback for it — and says so.
 */
export default function TextEmbroideryEditor({ zone, design }: { zone: PlacementOption; design: EmbroideryElement | null }) {
  const { state, dispatch } = useConfigurator();
  const { t, isRtl } = useI18n();
  const names = useCatalogNames();
  const current = design?.kind === "text" ? design : null;
  const [text, setText] = useState(current?.text ?? "");
  const [fontId, setFontId] = useState(current?.textStyle?.fontId ?? DEFAULT_TEXT_FONT_ID);
  const [pickerOpen, setPickerOpen] = useState(false);
  const font = getEmbroideryFont(fontId);
  const fontName = (f: { id: string; name: string }) => names.font(f.id, f.name);
  const [w, h] = zone.box;
  const max = zone.textMaxLength;
  // A limit the customer just ran into (shown until the next accepted keystroke).
  const [limit, setLimit] = useState<"chars" | "lines" | null>(null);

  // Text + font → the zone's text element, once the fonts it needs have
  // loaded (typing is settled briefly first; only the latest request applies).
  const request = useRef(0);
  const apply = (value: string, id: string) => {
    const n = ++request.current;
    void textStyleFor(value, id).then(({ text: clean, style }) => {
      if (n !== request.current) return;
      dispatch({ type: "setZoneText", placement: zone.id, text: clean, style });
    });
  };
  const typing = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (typing.current) window.clearTimeout(typing.current);
    },
    []
  );
  const onType = (value: string) => {
    const next = cleanText(value, max);
    // Typed past a limit: kept to it, and the customer told which.
    const lines = value.replace(/\r\n?/g, "\n").split("\n").length;
    setLimit(lines > TEXT_MAX_LINES ? "lines" : textLength(value) > max ? "chars" : null);
    setText(next);
    if (typing.current) window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => apply(next, fontId), 160);
  };
  const onFont = (id: string) => {
    setFontId(id);
    if (tidyText(text)) apply(text, id);
  };
  const lineCount = Math.max(1, textLines(text));
  // Lettering this small may not stitch cleanly: say so (the customer decides).
  const letterMm = current?.physicalSize ? letterHeightMm(current.physicalSize.heightCm, textLines(current.text)) : null;

  const missing = scriptsOf(text).filter((s) => !font.scripts.includes(s));
  const fallback = missing.length ? fontStack(font, text).slice(1).map(fontName).join(isRtl ? "، " : ", ") : null;
  const threadId = current?.thread ?? DEFAULT_TEXT_THREAD;
  const thread = getThread(threadId);
  const replacesDesign = design?.kind === "image" && !!design.image;

  return (
    <>
      <p className="text-[13px] leading-[1.6] text-jk-muted">{t("configurator.text.area", { w: cm(w), h: cm(h) })}</p>
      {replacesDesign && <p className="jk-cfg-note">{t("configurator.text.replacesDesign")}</p>}

      <OptionGroup
        label={t("configurator.text.label")}
        value={<bdi dir="ltr">{t("configurator.text.count", { n: formatNumber(textLength(text)), max: formatNumber(max) })}</bdi>}
      >
        <label htmlFor={`text-${zone.id}`} className="sr-only">
          {t("configurator.text.label")}
        </label>
        {/* Enter starts a new line (up to TEXT_MAX_LINES): the customer breaks the lines, never the site. */}
        <textarea
          id={`text-${zone.id}`}
          dir="auto"
          rows={Math.min(TEXT_MAX_LINES, lineCount + (lineCount < TEXT_MAX_LINES ? 1 : 0))}
          value={text}
          placeholder={t("configurator.text.placeholder")}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`text-${zone.id}-rules`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && lineCount >= TEXT_MAX_LINES) {
              e.preventDefault();
              setLimit("lines");
            }
          }}
          onChange={(e) => onType(e.target.value)}
          className="jk-text-input w-full resize-none border-b border-fidelio-black/15 bg-transparent pb-3 text-lg leading-[1.45] text-fidelio-black outline-none transition-colors duration-300 placeholder:text-jk-muted/60 focus:border-fidelio-black"
        />
        <p id={`text-${zone.id}-rules`} className="text-[12px] text-jk-muted">
          <bdi dir="ltr">{t("configurator.text.lines", { n: formatNumber(lineCount), max: formatNumber(TEXT_MAX_LINES) })}</bdi> ·{" "}
          {t("configurator.text.rules", { max: formatNumber(max), lines: formatNumber(TEXT_MAX_LINES) })}
        </p>
        {limit && (
          <p className="jk-cfg-note" role="status">
            {limit === "lines"
              ? t("configurator.text.maxLines", { lines: formatNumber(TEXT_MAX_LINES) })
              : t("configurator.text.maxChars", { max: formatNumber(max) })}
          </p>
        )}
        {letterMm !== null && letterMm < MIN_LETTER_MM && (
          <p className="jk-cfg-note" role="status">
            {t("configurator.text.tooSmall", { mm: formatNumber(Math.round(letterMm * 10) / 10) })}
          </p>
        )}
      </OptionGroup>

      <OptionGroup label={t("configurator.text.font")} value={fontName(font)}>
        <button
          type="button"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((o) => !o)}
          className="jk-font-current flex min-h-[48px] w-full items-center justify-between gap-3 px-3 py-2 text-start"
        >
          <FontSample fontId={font.id} text={font.scripts.includes("arabic") && !text ? "عربي · EN" : fontName(font)} className="truncate text-[20px] text-jk-ink" />
          <span className="jk-cfg-meta shrink-0 text-[10px] uppercase tracking-widest2 text-jk-muted">
            {pickerOpen ? t("configurator.text.closeFonts") : t("configurator.text.chooseFont")}
          </span>
        </button>
        {pickerOpen && (
          <FontPicker
            selectedId={font.id}
            sample={tidyText(text).replace(/\n/g, " ")}
            onPick={(id) => {
              onFont(id);
              setPickerOpen(false);
            }}
          />
        )}
        {fallback && (
          <p className="jk-cfg-note" role="status">
            {t("configurator.text.missingScript", {
              font: fontName(font),
              scripts: missing.map((s) => t(`configurator.text.script.${s}`)).join(" / "),
              fallback,
            })}
          </p>
        )}
      </OptionGroup>

      <div className="flex flex-col gap-3">
        <span className="jk-label text-jk-ink" style={{ fontSize: 10 }}>
          {t("configurator.text.preview")}
        </span>
        <LivePreview
          text={text}
          fontId={font.id}
          box={zone.box}
          inZone={current?.inZone}
          threadHex={thread.hex}
          backgroundHex={getColour(state.config.colours.body).hex}
        />
      </div>

      {current && current.text && <ZonePlacement zone={zone} element={current} kind="text" />}

      {current && (
        <OptionGroup label={t("configurator.text.thread")} value={names.thread(thread.id, thread.name)}>
          <div className="flex flex-wrap gap-3">
            {THREADS.map((option) => (
              <Swatch
                key={option.id}
                name={names.thread(option.id, option.name)}
                hex={option.hex}
                selected={threadId === option.id}
                onSelect={() => dispatch({ type: "setEmbroideryThread", id: current.id, thread: option.id })}
              />
            ))}
          </div>
        </OptionGroup>
      )}

      {current && (
        <div>
          <button
            type="button"
            className={quietAction}
            onClick={() => {
              request.current++;
              setText("");
              dispatch({ type: "removeEmbroidery", id: current.id });
            }}
          >
            {t("configurator.text.remove")}
          </button>
        </div>
      )}
    </>
  );
}

/** Text in a library font (loads it first). For the picker and labels — the jacket draws its own. */
function FontSample({ fontId, text, className }: { fontId: string; text: string; className?: string }) {
  const font = getEmbroideryFont(fontId);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    loadEmbroideryFonts([font])
      .catch(() => undefined)
      .then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [font]);
  return (
    <bdi dir="auto" className={className} style={{ fontFamily: ready ? `"${font.family}"` : undefined, opacity: ready ? 1 : 0.35 }}>
      {text}
    </bdi>
  );
}

/** The font library: search, filter by style / Arabic, a preview of each font. */
function FontPicker({ selectedId, sample, onPick }: { selectedId: string; sample: string; onPick: (id: string) => void }) {
  const { t } = useI18n();
  const names = useCatalogNames();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FontCategory | null>(null);
  useEffect(() => {
    void loadAllEmbroideryFonts().catch(() => undefined);
  }, []);
  const categoryName = (id: FontCategory) => names.fontCategory(id, FONT_CATEGORIES.find((c) => c.id === id)?.name ?? id);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EMBROIDERY_FONTS.filter(
      (f) =>
        (!category || f.categories.includes(category)) &&
        (!q ||
          [
            f.name,
            names.font(f.id, f.name),
            f.source.family,
            ...f.categories,
            ...f.categories.map((c) => names.fontCategory(c, c)),
            ...f.scripts.map((s) => (s === "arabic" ? "arabic عربي" : "english latin إنجليزي")),
          ].some((s) => s.toLowerCase().includes(q)))
    );
  }, [query, category, names]);

  return (
    <div className="jk-library flex flex-col gap-4 p-4">
      <label className="sr-only" htmlFor="font-search">
        {t("configurator.text.searchFonts")}
      </label>
      <input
        id="font-search"
        type="search"
        value={query}
        placeholder={t("configurator.text.searchFonts")}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border-b border-fidelio-black/15 bg-transparent pb-2 text-sm text-jk-ink outline-none placeholder:text-jk-muted focus:border-fidelio-black"
      />
      <div role="radiogroup" aria-label={t("configurator.text.fontStylesAria")} className="jk-chip-row -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        <button type="button" role="radio" aria-checked={!category} onClick={() => setCategory(null)} className="jk-chip">
          {t("configurator.library.all", { n: formatNumber(EMBROIDERY_FONTS.length) })}
        </button>
        {FONT_CATEGORIES.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={category === c.id} onClick={() => setCategory(c.id)} className="jk-chip">
            {categoryName(c.id)} · {formatNumber(EMBROIDERY_FONTS.filter((f) => f.categories.includes(c.id)).length)}
          </button>
        ))}
      </div>
      {results.length === 0 ? (
        <p className="text-[13px] text-jk-muted">{t("configurator.text.noFonts")}</p>
      ) : (
        <ul role="listbox" aria-label={t("configurator.text.fontsAria")} className="flex max-h-[340px] flex-col overflow-y-auto overscroll-contain">
          {results.map((f) => {
            const arabic = f.scripts.includes("arabic");
            const preview = sample || (arabic ? t("configurator.text.sampleArabic") : t("configurator.text.sampleLatin"));
            return (
              <li key={f.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={f.id === selectedId}
                  onClick={() => onPick(f.id)}
                  className="jk-font-option flex w-full flex-col gap-1 px-2 py-3 text-start"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="jk-label-xs text-jk-ink">{names.font(f.id, f.name)}</span>
                    <span className="jk-label-xs text-jk-muted">
                      {f.categories
                        .filter((c) => c !== "arabic")
                        .map(categoryName)
                        .join(" · ")}
                      {arabic ? ` · ${t("configurator.text.bilingual")}` : ""}
                    </span>
                  </span>
                  <FontSample fontId={f.id} text={preview} className="truncate text-[24px] leading-[1.25] text-jk-ink" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * The text as it will be stitched: drawn by the same artwork code the
 * jacket uses, in the thread colour on the body colour, fitted into a
 * frame of the zone's own proportions.
 */
function LivePreview({
  text,
  fontId,
  box,
  inZone,
  threadHex,
  backgroundHex,
}: {
  text: string;
  fontId: string;
  box: readonly [number, number];
  /** Where the text sits in the zone (as on the jacket). */
  inZone?: ZoneTransform;
  threadHex: string;
  backgroundHex: string;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLCanvasElement>(null);
  const [empty, setEmpty] = useState(true);
  const W = 900;
  const H = Math.round((W * box[1]) / box[0]);
  useEffect(() => {
    const value = tidyText(text);
    let live = true;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = backgroundHex;
    ctx.fillRect(0, 0, W, H);
    setEmpty(!value);
    if (!value) return;
    loadEmbroideryFonts(fontStack(getEmbroideryFont(fontId), value))
      .catch(() => undefined)
      .then(() => {
        if (!live) return;
        const art = drawTextArtwork(value, fontId, threadHex);
        if (!art) return;
        // The canvas is the zone: the text fitted and placed in it exactly
        // as on the jacket and in production (zoneContent).
        const { size, offset } = zoneContent(box, art.canvas.width / art.canvas.height, inZone);
        const dw = (size[0] / box[0]) * W, dh = (size[1] / box[1]) * H;
        const cx = W / 2 + (offset[0] / box[0]) * W, cy = H / 2 - (offset[1] / box[1]) * H;
        ctx.fillStyle = backgroundHex;
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(art.canvas, cx - dw / 2, cy - dh / 2, dw, dh);
      });
    return () => {
      live = false;
    };
  }, [text, fontId, threadHex, backgroundHex, H, box, inZone]);
  return (
    <div className="jk-text-preview relative">
      {/* The zone's edge (the fixed area the text stays in) is the canvas edge. */}
      <canvas ref={ref} width={W} height={H} className="jk-zone-preview mx-auto block h-auto max-h-[240px] w-auto max-w-full" aria-label={t("configurator.text.previewAria", { text })} />
      {empty && (
        <span className="absolute inset-0 grid place-items-center">
          <span className="jk-zone-badge text-[12px]">{t("configurator.text.previewEmpty")}</span>
        </span>
      )}
    </div>
  );
}

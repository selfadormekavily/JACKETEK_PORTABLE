import { useEffect, useRef, useState, type CSSProperties } from "react";
import { labelKey, useCatalogNames } from "@/i18n/useCatalogNames";
import { useI18n } from "@/i18n/useI18n";
import { formatNumber } from "@/i18n/format";
import { colourDistance, getThread, PLACEMENTS, THREADS, type PlacementOption } from "../../model/catalog";
import { ZONE_GROUPS } from "../../model/embroideryGeometry";
import type { ColourwaySlotId, EmbroideryElement, FrontLettersSelection, PlacementId, ThreadId } from "../../model/types";
import { prepareUpload, UploadError, type UploadErrorCode } from "../../embroidery/prepareUpload";
import type { CutoutQuality } from "../../embroidery/backgroundRemoval";
import { colourwayImage, slotThread, slotThreads, type Colours, type ColourwaySlot, type DesignColourway } from "../../library/colourways";
import { colourSlotsOf, useDesignColourway } from "../../library/designColours";
import { categoryTitle, designsForZone, libraryImage, useLibrary, type LibraryData, type LibraryDesign } from "../../library/library";
import { DEFAULT_LETTERS, frontLettersImage, isFrontLettersDesign, toLetter } from "../../library/frontLetters";
import LibraryPicker from "../../library/LibraryPicker";
import { useConfigurator } from "../../state/context";
import { OptionGroup, SegmentedControl, Swatch } from "../ui";
import TextEmbroideryEditor from "./TextEmbroideryEditor";
import ZonePlacement from "./ZonePlacement";

/** Centimetres for display ("8.4"). */
const cm = (metres: number) => formatNumber(Math.round(metres * 1000) / 10);

const pressable =
  "jk-label jk-cfg-action inline-flex min-h-[44px] items-center justify-center whitespace-nowrap px-5 py-3 transition-[background-color,color,transform] duration-200 active:translate-y-px disabled:cursor-wait disabled:translate-y-0";
/** Upload: raised cream with an ink border. Ready-made: the solid crimson button (it opens the library). */
const uploadButton = `${pressable} border border-jk-ink bg-jk-raised text-jk-ink hover:bg-jk-ink hover:text-jk-on-ink disabled:border-jk-muted disabled:text-jk-muted disabled:hover:bg-jk-raised disabled:hover:text-jk-muted`;
const libraryButton = `${pressable} bg-jk-btn text-jk-btn-text hover:bg-jk-btn-hover aria-expanded:bg-jk-btn-hover`;
const quietAction =
  "jk-cfg-meta jk-hit text-[10px] uppercase tracking-widest2 text-jk-muted transition-colors duration-300 hover:text-jk-accent";

type ZoneMode = "design" | "text";

/**
 * Embroidery in fixed zones: the jacket's ten zones (two chest, main back
 * and the lower back text, three down each sleeve), each a locked
 * template. The customer picks a zone on the zone map (or on the jacket)
 * and puts one thing in it — an uploaded design, a ready-made one from the
 * library, or text in a library font, as the zone allows. Only the chosen
 * zone's editor is shown. The content is fitted into the zone's area
 * automatically (centred, proportions kept) and can then be made smaller
 * and moved within it; the zone itself never moves or changes size.
 */
export default function EmbroideryPanel() {
  const { state, dispatch } = useConfigurator();
  const { t } = useI18n();
  const designs = state.config.embroidery;
  const selected = state.ui.selectedZone;

  const fileInput = useRef<HTMLInputElement>(null);
  const uploadZone = useRef<PlacementId | null>(null);
  const [uploading, setUploading] = useState<PlacementId | null>(null);
  const [error, setError] = useState<{ zone: PlacementId; code: UploadErrorCode } | null>(null);
  // Background-removal confidence of this session's uploads, per zone (shown with the design).
  const [quality, setQuality] = useState<Partial<Record<PlacementId, CutoutQuality>>>({});
  // Ready-made designs (the data file loads when this section opens; images only when shown).
  const library = useLibrary();
  const [pickerZone, setPickerZone] = useState<PlacementId | null>(null);

  const designIn = (zone: PlacementId) => designs.find((e) => e.placement === zone) ?? null;
  const libraryDesign = (id: string | undefined) => (id && library ? library.designs.find((d) => d.id === id) ?? null : null);

  // Front Letters and colourways are composed in the browser; only the
  // latest request for a zone is applied (fast typing never shows an older pair).
  const zoneRequest = useRef(new Map<PlacementId, number>());
  const nextRequest = (zone: PlacementId) => {
    const n = (zoneRequest.current.get(zone) ?? 0) + 1;
    zoneRequest.current.set(zone, n);
    return n;
  };
  /**
   * A ready-made design in a zone, with letters (Front Letters) and colours
   * (designs with colour layers): composed / recoloured, then placed.
   */
  const placeDesign = async (zone: PlacementId, design: LibraryDesign, colours: Colours, letters?: string) => {
    const n = nextRequest(zone);
    let image;
    try {
      image = isFrontLettersDesign(design)
        ? await frontLettersImage(design, letters ?? DEFAULT_LETTERS, colours)
        : await colourwayImage(design, colours);
    } catch {
      // No template / colour layers: the design as it is.
      image = libraryImage(design);
    }
    if (zoneRequest.current.get(zone) === n) dispatch({ type: "setZoneDesign", placement: zone, image });
  };
  const lettersIn = (zone: PlacementId) => {
    const current = designIn(zone)?.image?.frontLetters;
    return current ? current.letter1 + current.letter2 : DEFAULT_LETTERS;
  };
  const coloursIn = (zone: PlacementId): Colours => designIn(zone)?.image?.colourway?.colours ?? {};
  const pickLibrary = async (zone: PlacementId, design: LibraryDesign) => {
    // Switching designs keeps the customer's letters, and their colours for
    // the slots the new design has too (fill stays fill…).
    const editable = await colourSlotsOf(design).catch(() => null);
    void placeDesign(zone, design, editable ? coloursIn(zone) : {}, lettersIn(zone));
  };

  const chooseFile = (zone: PlacementOption) => {
    uploadZone.current = zone.id;
    if (fileInput.current) {
      fileInput.current.accept = zone.accept.join(",");
      fileInput.current.click();
    }
  };

  const onFile = async (file: File | undefined) => {
    const zone = uploadZone.current;
    if (!file || !zone) return;
    setUploading(zone);
    setError(null);
    try {
      const prepared = await prepareUpload(file);
      nextRequest(zone);
      dispatch({ type: "setZoneDesign", placement: zone, image: prepared.image });
      setQuality((q) => ({ ...q, [zone]: prepared.quality }));
    } catch (e) {
      // Only known refusals get their own message; anything technical
      // (decode failures, browser errors) reads as "couldn't be read".
      setError({ zone, code: e instanceof UploadError ? e.code : "unreadable" });
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const zone = PLACEMENTS.find((z) => z.id === selected) ?? null;
  // A zone picked from the map: its editor is brought into view (under the pinned jacket on phones).
  const reveal = useRef(false);

  return (
    <div className="flex flex-col gap-8">
      {/* Where: the ten fixed areas, by part of the jacket (picking one on the jacket selects it here too). */}
      <ZoneMap
        designIn={designIn}
        selected={selected}
        onSelect={(id) => {
          reveal.current = true;
          dispatch({ type: "selectZone", placement: id });
        }}
      />

      {/* What: only the chosen area's editor. */}
      {zone && (
        <ZoneRow
          key={zone.id}
          zone={zone}
          design={designIn(zone.id)}
          open
          reveal={reveal}
          uploading={uploading === zone.id}
          errorCode={error?.zone === zone.id ? error.code : null}
          quality={quality[zone.id]}
          onUpload={() => chooseFile(zone)}
          library={library}
          pickerOpen={pickerZone === zone.id}
          onTogglePicker={() => setPickerZone((z) => (z === zone.id ? null : zone.id))}
          onPickLibrary={(design) => {
            void pickLibrary(zone.id, design);
            setPickerZone(null);
          }}
          onLetters={(letters) => {
            const design = libraryDesign(designIn(zone.id)?.image?.library?.id);
            if (design) void placeDesign(zone.id, design, coloursIn(zone.id), letters);
          }}
          onColours={async (colours) => {
            const design = libraryDesign(designIn(zone.id)?.image?.library?.id);
            if (design) await placeDesign(zone.id, design, colours, lettersIn(zone.id));
          }}
          onRemove={(id) => {
            nextRequest(zone.id);
            dispatch({ type: "removeEmbroidery", id });
          }}
        />
      )}

      <input
        ref={fileInput}
        type="file"
        className="sr-only"
        aria-label={t("configurator.embroidery.uploadAria")}
        tabIndex={-1}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}

type ZoneRowProps = {
  zone: PlacementOption;
  /** Set when the zone was picked from the map: scroll its editor into view once. */
  reveal?: { current: boolean };
  design: EmbroideryElement | null;
  open: boolean;
  uploading: boolean;
  errorCode: UploadErrorCode | null;
  quality?: CutoutQuality;
  onUpload: () => void;
  library: LibraryData | null;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onPickLibrary: (design: LibraryDesign) => void;
  onLetters: (letters: string) => void;
  onColours: (colours: Colours) => Promise<void>;
  onRemove: (id: string) => void;
};

function ZoneRow(props: ZoneRowProps) {
  const { zone, design, open, reveal } = props;
  const editor = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!reveal?.current) return;
    reveal.current = false;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    editor.current?.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
  }, [reveal]);
  const { t } = useI18n();
  const names = useCatalogNames();
  const { accepts } = zone;
  // The zone's content decides the starting mode; the customer can switch.
  const [chosenMode, setMode] = useState<ZoneMode | null>(null);
  const mode: ZoneMode = !accepts.design ? "text" : !accepts.text ? "design" : chosenMode ?? (design?.kind === "text" ? "text" : "design");
  const [w, h] = zone.box;
  const panelId = `zone-${zone.id}`;
  const zoneName = names.placement(zone.id, zone.name);
  const imageDesign = design?.kind === "image" && design.image ? design : null;
  const textDesign = design?.kind === "text" && design.text ? design : null;

  return (
    <section ref={editor} className="jk-zone jk-step-fade" data-open={open || undefined} aria-labelledby={`${panelId}-title`}>
      <div className="jk-zone__head">
        <div className="min-w-0">
          {/* Where this area sits in the guided order (Next area / Previous area). */}
          <p className="jk-zone__count">
            {t("configurator.flow.areaOf", {
              n: formatNumber(PLACEMENTS.findIndex((z) => z.id === zone.id) + 1),
              total: formatNumber(PLACEMENTS.length),
            })}
          </p>
          <h3 id={`${panelId}-title`} className="jk-label text-jk-ink">
            {zoneName}
          </h3>
        </div>
        <span className="jk-zone__area">{t("configurator.placement.dimensions", { w: cm(w), h: cm(h) })}</span>
      </div>
      {open && (
        <div id={panelId} className="flex flex-col gap-6">
          {accepts.design && accepts.text && (
            <SegmentedControl
              label={t("configurator.embroidery.modeAria", { zone: zoneName })}
              options={[
                { id: "design", name: t("configurator.embroidery.mode.design") },
                { id: "text", name: t("configurator.embroidery.mode.text") },
              ]}
              value={mode}
              onChange={setMode}
            />
          )}

          {mode === "text" ? (
            <TextEmbroideryEditor zone={zone} design={design} />
          ) : (
            <DesignControls
              {...props}
              design={imageDesign}
              area={t("configurator.embroidery.area", { w: cm(w), h: cm(h) })}
              replacesText={!!textDesign}
            />
          )}
        </div>
      )}
    </section>
  );
}

function DesignControls({
  zone,
  design,
  area,
  uploading,
  errorCode,
  quality,
  onUpload,
  library,
  pickerOpen,
  onTogglePicker,
  onPickLibrary,
  onLetters,
  onColours,
  onRemove,
  replacesText,
}: ZoneRowProps & { area: string; replacesText: boolean }) {
  const { t, locale } = useI18n();
  const names = useCatalogNames();
  const { dispatch } = useConfigurator();
  const readyMade = library ? designsForZone(library, zone.id).length : 0;
  const image = design?.image ?? null;
  const fromLibrary = image?.library ?? null;
  const libDesign = fromLibrary && library ? library.designs.find((d) => d.id === fromLibrary.id) ?? null : null;
  const upload = design && image && !fromLibrary ? design : null;
  // The design's library category, in the site's language when the data has it.
  const category = fromLibrary ? library?.libraries.find((l) => l.id === fromLibrary.libraryId) : undefined;
  const libraryName = fromLibrary ? (category ? categoryTitle(category, locale) : fromLibrary.libraryTitle) : "";
  const thread = getThread(upload?.thread ?? "ivory");

  return (
    <>
      <p className="text-[13px] leading-[1.6] text-jk-muted">{area}</p>
      {replacesText && <p className="jk-cfg-note">{t("configurator.embroidery.replacesText")}</p>}

      <div className="flex items-center gap-4">
        {image && <Thumb src={image.src} size={56} alt={t("configurator.embroidery.designAlt", { zone: names.placement(zone.id, zone.name) })} />}
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <button type="button" onClick={onUpload} disabled={uploading} className={uploadButton}>
            {uploading ? t("configurator.embroidery.preparing") : image ? t("configurator.embroidery.replace") : t("configurator.embroidery.upload")}
          </button>
          {readyMade > 0 && (
            <button type="button" onClick={onTogglePicker} aria-expanded={pickerOpen} className={libraryButton}>
              {t("configurator.embroidery.readyMade")}
            </button>
          )}
          {design && (
            <button type="button" onClick={() => onRemove(design.id)} className={quietAction}>
              {t("configurator.embroidery.remove")}
            </button>
          )}
        </div>
      </div>
      {errorCode && (
        <p className="text-xs text-jk-crimson" role="alert">
          {t(`configurator.upload.errors.${errorCode}`)}
        </p>
      )}

      {pickerOpen && library && (
        <LibraryPicker data={library} zone={zone.id} selectedId={fromLibrary?.id ?? null} onPick={onPickLibrary} onClose={onTogglePicker} />
      )}

      {fromLibrary && (
        <p className="text-[13px] leading-[1.6] text-jk-muted">
          {t("configurator.embroidery.fromLibrary")} · <bdi dir="auto">{libraryName}</bdi>
        </p>
      )}
      {image?.frontLetters && <InitialsInput key={image.frontLetters.templateId} selection={image.frontLetters} onChange={onLetters} />}
      {fromLibrary && (
        <DesignColours design={libDesign} current={image?.colourway?.colours ?? {}} onChange={onColours} />
      )}

      {upload && (
        <>
          <p className="text-xs leading-relaxed text-jk-muted">
            {quality === "uncertain" ? t("configurator.embroidery.qualityUncertain") : t("configurator.embroidery.qualityOk")}
          </p>
          <OptionGroup
            label={t("configurator.embroidery.threadColoursAria")}
            value={upload.thread === null ? t("configurator.embroidery.colourMode.original") : names.thread(thread.id, thread.name)}
          >
            <SegmentedControl
              label={t("configurator.embroidery.threadColoursAria")}
              options={[
                { id: "original", name: t("configurator.embroidery.colourMode.original") },
                { id: "thread", name: t("configurator.embroidery.colourMode.thread") },
              ]}
              value={upload.thread === null ? "original" : "thread"}
              onChange={(m) => dispatch({ type: "setEmbroideryThread", id: upload.id, thread: m === "original" ? null : "ivory" })}
            />
            {upload.thread !== null && (
              <div className="flex flex-wrap gap-3">
                {THREADS.map((option) => (
                  <Swatch
                    key={option.id}
                    name={names.thread(option.id, option.name)}
                    hex={option.hex}
                    selected={upload.thread === option.id}
                    onSelect={() => dispatch({ type: "setEmbroideryThread", id: upload.id, thread: option.id })}
                  />
                ))}
              </div>
            )}
          </OptionGroup>
        </>
      )}

      {/* Size and position inside the zone (the zone itself never changes). */}
      {design && image && <ZonePlacement zone={zone} element={design} kind={fromLibrary ? "design" : "image"} />}
    </>
  );
}

/**
 * YOUR INITIALS: the two letters of a Front Letters design. One English
 * letter per field (A–Z; lowercase becomes uppercase; digits and symbols are
 * refused); every accepted letter updates the jacket at once. The pair
 * reads left to right in every language (it is stitched that way).
 */
function InitialsInput({ selection, onChange }: { selection: FrontLettersSelection; onChange: (letters: string) => void }) {
  const { t } = useI18n();
  const names = useCatalogNames();
  const [letters, setLetters] = useState([selection.letter1, selection.letter2]);
  const [refused, setRefused] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const second = useRef<HTMLInputElement>(null);
  const fields = [first, second];
  const labelId = `initials-${selection.templateId}`;

  const accept = (i: number, letter: string) => {
    const next = i === 0 ? [letter, letters[1]] : [letters[0], letter];
    setLetters(next);
    setRefused(false);
    if (next[0] && next[1]) onChange(next[0] + next[1]);
    if (i === 0) second.current?.focus();
  };
  const typed = (i: number, value: string) => {
    if (value === "") return setLetters(i === 0 ? ["", letters[1]] : [letters[0], ""]);
    const letter = toLetter(value);
    if (letter) accept(i, letter);
    else setRefused(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="jk-label text-jk-ink" style={{ fontSize: 10 }} id={labelId}>
        {t("configurator.embroidery.initials.label")}
      </p>
      {/* The letters are stitched left to right: the pair keeps that order in Arabic too. */}
      <div dir="ltr" className="flex items-center gap-3 rtl:justify-end" role="group" aria-labelledby={labelId}>
        {[0, 1].map((i) => (
          <input
            key={i}
            ref={fields[i]}
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={1}
            aria-label={i === 0 ? t("configurator.embroidery.initials.first") : t("configurator.embroidery.initials.second")}
            value={letters[i]}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              // A letter key replaces the field's letter wherever the cursor is.
              if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                typed(i, e.key);
              }
            }}
            onChange={(e) => typed(i, e.target.value)}
            onBlur={() => {
              // Left empty: back to the letter the jacket shows.
              if (!letters[i]) setLetters(i === 0 ? [selection.letter1, letters[1]] : [letters[0], selection.letter2]);
            }}
            className="jk-initial"
          />
        ))}
      </div>
      <p className="text-[13px] leading-[1.6] text-jk-muted" role={refused ? "alert" : undefined}>
        {refused
          ? t("configurator.embroidery.initials.lettersOnly")
          : t("configurator.embroidery.initials.help", { style: names.letterStyle(selection.style) })}
      </p>
    </div>
  );
}

/**
 * DESIGN COLOURS: a ready-made design's colour layers, built from its
 * metadata — one row per region it actually has (fill, outline, shadow,
 * border, detail…; "Colour N" when the data names none), each picking an
 * embroidery thread. Shown only for designs with colour layers. Changing a
 * row recolours only that region.
 */
function DesignColours({
  design,
  current,
  onChange,
}: {
  design: LibraryDesign | null;
  current: Partial<Record<ColourwaySlotId, ThreadId>>;
  onChange: (colours: Colours) => Promise<void>;
}) {
  const { t, tMaybe } = useI18n();
  const names = useCatalogNames();
  const colourway = useDesignColourway(design);
  // The swatch just picked shows at once; the jacket follows when recoloured.
  const [pending, setPending] = useState<Colours | null>(null);
  const [active, setActive] = useState<ColourwaySlotId | null>(null);
  if (!colourway) return null;
  const shown: Colours = pending ?? current;
  const pick = (slot: ColourwaySlot, thread: ThreadId | null) => {
    const next = { ...shown, [slot.id]: thread };
    setActive(slot.id);
    setPending(next);
    void onChange(next).finally(() => setPending((p) => (p === next ? null : p)));
  };
  const threadOf = (slot: ColourwaySlot) => slotThread(slot, shown as Partial<Record<ColourwaySlotId, ThreadId>>);
  const label = (slot: ColourwaySlot, n: number) => slotLabel(slot, colourway, n, t, tMaybe);
  const close = closePair(colourway.slots, threadOf);

  return (
    <section className="jk-design-colours flex flex-col gap-4" aria-label={t("configurator.designColours.title")}>
      <p className="jk-label jk-zone-group text-jk-ink" style={{ fontSize: 10 }}>
        {t("configurator.designColours.title")}
      </p>
      {colourway.slots.map((slot, i) => {
        const name = label(slot, i + 1);
        const chosen = threadOf(slot);
        const value = chosen ? names.thread(chosen, getThread(chosen).name) : t("configurator.embroidery.colourway.original");
        return (
          <div key={slot.id} className="jk-colour-slot" data-active={(active ?? colourway.slots[0].id) === slot.id || undefined}>
            <OptionGroup label={name} value={value}>
              <div className="jk-palette" role="radiogroup" aria-label={name} ref={centreSelected}>
                {!slot.defaultThread && (
                  <Swatch
                    name={t("configurator.embroidery.colourway.originalSwatch", { slot: name })}
                    hex={slot.defaultColor}
                    selected={!chosen}
                    onSelect={() => pick(slot, null)}
                  />
                )}
                {slotThreads(slot).map((thread) => (
                  <Swatch
                    key={thread.id}
                    name={names.thread(thread.id, thread.name)}
                    hex={thread.hex}
                    selected={chosen === thread.id}
                    onSelect={() => pick(slot, thread.id)}
                  />
                ))}
              </div>
            </OptionGroup>
          </div>
        );
      })}
      {close && (
        <p className="jk-cfg-note" role="status">
          {t("configurator.designColours.tooClose", {
            a: label(close[0], colourway.slots.indexOf(close[0]) + 1),
            b: label(close[1], colourway.slots.indexOf(close[1]) + 1),
          })}
        </p>
      )}
    </section>
  );
}

/**
 * A colour region's name for the customer: its semantic key, refined by
 * what the design's lettering is ("Letter fill", "Number outline"…), else
 * the data label's own key, else "Colour N".
 */
function slotLabel(
  slot: ColourwaySlot,
  colourway: DesignColourway,
  n: number,
  t: ReturnType<typeof useI18n>["t"],
  tMaybe: ReturnType<typeof useI18n>["tMaybe"]
) {
  return (
    (colourway.subject && slot.key ? tMaybe(`configurator.designColours.${colourway.subject}.${slot.key}`) : undefined) ??
    (slot.key ? tMaybe(`catalog.colourwaySlot.${slot.key}`) : undefined) ??
    tMaybe(`catalog.colourwaySlot.${labelKey(slot.label)}`) ??
    t("configurator.designColours.generic", { n })
  );
}

/**
 * A palette that scrolls sideways (phones): when it appears, its selected
 * swatch is brought to the middle of the row — the row only, never the page
 * (works in RTL too: it moves by the swatch's offset from the row's centre).
 */
function centreSelected(palette: HTMLDivElement | null) {
  if (!palette || palette.dataset.centred) return;
  palette.dataset.centred = "pending";
  // Layout may still be settling: centre once the row actually overflows,
  // and stop as soon as the customer touches or scrolls it (or after 3 s).
  const stop = () => {
    palette.dataset.centred = "done";
    observer.disconnect();
  };
  const centre = () => {
    if (palette.dataset.centred === "done") return;
    const selected = palette.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!selected || palette.scrollWidth <= palette.clientWidth) return;
    const p = palette.getBoundingClientRect(), s = selected.getBoundingClientRect();
    palette.scrollLeft += s.left + s.width / 2 - (p.left + p.width / 2);
    stop();
  };
  const observer = new ResizeObserver(() => requestAnimationFrame(centre));
  observer.observe(palette);
  palette.addEventListener("pointerdown", stop, { once: true });
  palette.addEventListener("wheel", stop, { once: true, passive: true });
  window.setTimeout(stop, 3000);
}

/** Two regions set to threads that look almost the same (a gentle note, never a block). */
function closePair(slots: readonly ColourwaySlot[], threadOf: (s: ColourwaySlot) => ThreadId | null): [ColourwaySlot, ColourwaySlot] | null {
  for (let i = 0; i < slots.length; i++)
    for (let j = i + 1; j < slots.length; j++) {
      const a = threadOf(slots[i]), b = threadOf(slots[j]);
      if (a && b && colourDistance(getThread(a).hex, getThread(b).hex) < 12) return [slots[i], slots[j]];
    }
  return null;
}

/** A design's thumbnail on a checkerboard (shows its transparency). */
function Thumb({ src, size, alt }: { src: string; size: number; alt: string }) {
  return (
    <span className="jk-checker flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" decoding="async" />
    </span>
  );
}

/**
 * The zone map: the ten areas grouped by part of the jacket (front, back,
 * each sleeve), one compact chip each — what is in it at a glance (a
 * thumbnail, "Aa" for text, an empty ring) and the chosen one raised with
 * a crimson edge. Only the chosen area's editor shows below it.
 */
function ZoneMap({
  designIn,
  selected,
  onSelect,
}: {
  designIn: (zone: PlacementId) => EmbroideryElement | null;
  selected: PlacementId | null;
  onSelect: (zone: PlacementId) => void;
}) {
  const { t } = useI18n();
  const names = useCatalogNames();
  // Sleeve areas are named by their part only ("Upper") under the sleeve's name.
  const chipName = (zone: PlacementOption) => {
    const part = /(Upper|Middle|Lower)$/.exec(zone.id)?.[1];
    return part ? t(`configurator.embroidery.zoneMap.sleevePart.${part.toLowerCase() as "upper" | "middle" | "lower"}`) : names.placement(zone.id, zone.name);
  };

  return (
    <section className="jk-zonemap" aria-labelledby="jk-zonemap-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="jk-zonemap-title" className="jk-label text-jk-ink" style={{ fontSize: 10 }}>
          {t("configurator.embroidery.zoneMap.title")}
        </h3>
        <p className="jk-zonemap__hint">{t("configurator.embroidery.zoneMap.hint")}</p>
      </div>
      <div className="jk-zonemap__groups">
        {ZONE_GROUPS.map((group) => {
          const groupName = names.placementGroup(group.id, group.name);
          const zones = PLACEMENTS.filter((z) => z.group === group.id);
          return (
            <div key={group.id} role="group" aria-label={groupName} className="jk-zonemap__group">
              <span aria-hidden="true" className="jk-zonemap__group-name">
                {groupName}
              </span>
              <div className="jk-zonemap__zones" style={{ "--zones": zones.length } as CSSProperties}>
                {zones.map((zone) => {
                  const design = designIn(zone.id);
                  const name = names.placement(zone.id, zone.name);
                  const image = design?.kind === "image" ? design.image : null;
                  const text = design?.kind === "text" && design.text ? design.text : null;
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      aria-pressed={zone.id === selected}
                      aria-label={design ? t("configurator.embroidery.zoneMap.filled", { zone: name }) : name}
                      data-filled={design ? "" : undefined}
                      onClick={() => onSelect(zone.id)}
                      className="jk-zonechip"
                    >
                      <span aria-hidden="true" className="jk-zonechip__mark">
                        {image ? (
                          <img src={image.src} alt="" width={20} height={20} loading="lazy" decoding="async" />
                        ) : text ? (
                          <span className="jk-zonechip__aa">Aa</span>
                        ) : (
                          <span className="jk-zonechip__ring" />
                        )}
                      </span>
                      <span className="jk-zonechip__name">{chipName(zone)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

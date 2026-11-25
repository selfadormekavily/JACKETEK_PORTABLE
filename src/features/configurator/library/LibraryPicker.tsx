import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { formatNumber } from "@/i18n/format";
import type { PlacementId } from "../model/types";
import { categoryTitle, designsForZone, type LibraryData, type LibraryDesign } from "./library";

const PAGE = 48;

/**
 * Ready-made designs for one zone: only those allowed there, browsed by
 * library (categories come from the data) and searched by name. Thumbnails
 * load lazily, a page at a time; picking one hands it to the zone.
 */
export default function LibraryPicker({
  data,
  zone,
  selectedId,
  onPick,
  onClose,
}: {
  data: LibraryData;
  zone: PlacementId;
  selectedId: string | null;
  onPick: (design: LibraryDesign) => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const available = useMemo(() => designsForZone(data, zone), [data, zone]);
  const categories = useMemo(
    () =>
      data.libraries
        .map((l) => ({ ...l, label: categoryTitle(l, locale), count: available.filter((d) => d.libraryId === l.id).length }))
        .filter((l) => l.count > 0),
    [data, available, locale]
  );
  const titleOf = useMemo(() => new Map(categories.map((c) => [c.id, c.label])), [categories]);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return available.filter(
      (d) =>
        (!category || d.libraryId === category) &&
        (!q ||
          [d.libraryTitle, titleOf.get(d.libraryId) ?? "", d.originalFileName ?? "", d.productionName ?? ""].some((s) =>
            s.toLowerCase().includes(q)
          ))
    );
  }, [available, category, query, titleOf]);

  return (
    <div className="jk-library flex flex-col gap-4 p-4">
      <div className="flex items-baseline justify-between gap-4">
        <span className="jk-label text-jk-ink" style={{ fontSize: 10 }}>
          {t("configurator.library.title")}
        </span>
        <button type="button" onClick={onClose} className="jk-cfg-meta jk-hit text-[10px] uppercase tracking-widest2 text-jk-muted hover:text-jk-accent">
          {t("configurator.library.close")}
        </button>
      </div>

      <label className="sr-only" htmlFor={`library-search-${zone}`}>
        {t("configurator.library.search")}
      </label>
      <input
        id={`library-search-${zone}`}
        type="search"
        value={query}
        placeholder={t("configurator.library.search")}
        onChange={(e) => {
          setQuery(e.target.value);
          setShown(PAGE);
        }}
        className="w-full border-b border-fidelio-black/15 bg-transparent pb-2 text-sm text-jk-ink outline-none placeholder:text-jk-muted focus:border-fidelio-black"
      />

      <div role="radiogroup" aria-label={t("configurator.library.categoriesAria")} className="jk-chip-row -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        <button
          type="button"
          role="radio"
          aria-checked={!category}
          onClick={() => {
            setCategory(null);
            setShown(PAGE);
          }}
          className="jk-chip"
        >
          {t("configurator.library.all", { n: formatNumber(available.length) })}
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={category === c.id}
            onClick={() => {
              setCategory(c.id);
              setShown(PAGE);
            }}
            className="jk-chip"
          >
            <bdi dir="auto">{c.label}</bdi> · {formatNumber(c.count)}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <p className="text-[13px] text-jk-muted">{t("configurator.library.none")}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-4">
          {results.slice(0, shown).map((d) => {
            const title = titleOf.get(d.libraryId) ?? d.libraryTitle;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onPick(d)}
                  aria-pressed={selectedId === d.id}
                  title={title}
                  className="jk-library-tile jk-checker flex aspect-square w-full items-center justify-center p-1"
                >
                  <img
                    src={d.thumbnail}
                    alt={title}
                    width={d.thumbnailWidth}
                    height={d.thumbnailHeight}
                    loading="lazy"
                    decoding="async"
                    className="max-h-full max-w-full object-contain"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {results.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="jk-cfg-meta jk-hit self-center text-[10px] uppercase tracking-widest2 text-jk-muted hover:text-jk-accent"
        >
          {t("configurator.library.more", { n: formatNumber(results.length - shown) })}
        </button>
      )}
    </div>
  );
}

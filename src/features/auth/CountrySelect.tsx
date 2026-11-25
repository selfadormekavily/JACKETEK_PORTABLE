import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { CountryCode } from "libphonenumber-js";
import Ltr from "@/i18n/Ltr";
import { Trans } from "@/i18n/Trans";
import { useI18n } from "@/i18n/useI18n";
import { countryOf, searchCountries } from "./countries";

/**
 * Country + dialling code picker: a trigger showing the flag and code, and
 * a searchable list (combobox pattern: type to filter by name, in either
 * language, or code; arrows to move, Enter to choose, Escape to close).
 * Names follow the active language; dialling codes always read LTR.
 */
export default function CountrySelect({ value, onChange }: { value: CountryCode; onChange: (code: CountryCode) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const { t, locale } = useI18n();
  const results = useMemo(() => searchCountries(query, locale), [query, locale]);
  const current = countryOf(value, locale);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const i = results.findIndex((c) => c.code === value);
    setActive(i >= 0 ? i : 0);
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
    // Only when the list opens: later filtering resets `active` itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (code: CountryCode) => {
    onChange(code);
    setOpen(false);
    setQuery("");
    trigger.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) choose(results[active].code);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("auth.country.triggerAria", { country: current.name, dial: current.dial })}
        onClick={() => setOpen((o) => !o)}
        className="jk-auth-country"
      >
        <span aria-hidden="true" className="jk-flag text-[18px] leading-none">
          {current.flag}
        </span>
        <Ltr className="text-[15px] tabular-nums text-jk-ink">{current.dial}</Ltr>
        <svg aria-hidden="true" width={10} height={10} viewBox="0 0 10 10" className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
          <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth={1.4} />
        </svg>
      </button>

      {open && (
        <div className="jk-auth-popover">
          <input
            ref={search}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-list`}
            aria-activedescendant={results[active] ? `${id}-${results[active].code}` : undefined}
            aria-label={t("auth.country.searchAria")}
            placeholder={t("auth.country.searchPlaceholder")}
            autoComplete="off"
            dir="auto"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            className="jk-auth-search"
          />
          <ul ref={list} id={`${id}-list`} role="listbox" aria-label={t("auth.country.listAria")} className="max-h-[264px] overflow-y-auto overscroll-contain py-1">
            {results.length === 0 && (
              <li className="px-4 py-3 text-[13px] text-jk-muted">
                <Trans k="auth.country.noMatch" vars={{ query }} tags={{ q: (c) => <bdi>{c}</bdi> }} />
              </li>
            )}
            {results.map((c, i) => (
              <li
                key={c.code}
                id={`${id}-${c.code}`}
                role="option"
                aria-selected={c.code === value}
                data-index={i}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(c.code)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-[9px] text-[14px] text-jk-ink transition-colors duration-150 ${
                  i === active ? "bg-jk-dusty/15" : ""
                }`}
              >
                <span aria-hidden="true" className="jk-flag text-[18px] leading-none">
                  {c.flag}
                </span>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <Ltr className="tabular-nums text-jk-muted">{c.dial}</Ltr>
                {c.code === value && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-jk-crimson" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

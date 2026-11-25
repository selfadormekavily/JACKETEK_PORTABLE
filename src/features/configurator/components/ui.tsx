import { useId, type ReactNode } from "react";
import Ltr from "@/i18n/Ltr";

/**
 * Small, configurator-specific UI primitives, in the JACKETEK design
 * (design spec §7–§8). Kept in one file because each is tiny and they
 * only make sense together.
 */

type OptionGroupProps = {
  label: string;
  value?: ReactNode;
  children: ReactNode;
};

/** A labelled block of options: "LABEL ........ Current value". */
export function OptionGroup({ label, value, children }: OptionGroupProps) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <span id={labelId} className="jk-label text-jk-ink" style={{ fontSize: 10 }}>
          {label}
        </span>
        {value && <span className="jk-value-chip">{value}</span>}
      </div>
      {children}
    </div>
  );
}

type SwatchProps = {
  name: string;
  hex: string;
  selected: boolean;
  onSelect: () => void;
  /** Named under the disc, as one of a radio group (a palette grid). */
  labelled?: boolean;
};

/** A 36px fabric swatch with a soft sheen; the selected one has an offset Crimson ring. */
export function Swatch({ name, hex, selected, onSelect, labelled = false }: SwatchProps) {
  if (labelled) {
    return (
      <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className="jk-swatch-cell pt-1">
        <span aria-hidden="true" className="jk-swatch block" style={{ backgroundColor: hex }} />
        <span>{name}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={name}
      title={name}
      className="jk-swatch jk-hit h-9 w-9"
      style={{ backgroundColor: hex }}
    />
  );
}

type SegmentedControlProps<T extends string> = {
  label: string;
  options: readonly { id: T; name: ReactNode }[];
  value: T | null;
  onChange: (id: T) => void;
  /** Stretch options evenly across the full width. */
  fill?: boolean;
  /** Tighter cells for more options (the size grid). */
  dense?: boolean;
};

/**
 * Segmented control / size grid: equal cells in a hairline box; the
 * selected cell raised cream with an inset Crimson border.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  fill = true,
  dense = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex border border-[rgb(var(--t-head)/.22)] ${fill ? "w-full" : ""}`}
    >
      {options.map((option, i) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className={`jk-label jk-seg-cell text-jk-ink ${dense ? "px-1 py-[13px]" : "p-[15px]"} ${
              fill ? "flex-1" : ""
            } ${i > 0 ? "border-s border-[rgb(var(--t-head)/.22)]" : ""} ${
              selected ? "bg-jk-raised text-jk-crimson shadow-[inset_0_0_0_1.5px_rgb(var(--t-link))]" : "bg-jk-raised/30 hover:bg-jk-raised"
            }`}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "solid" | "outline";
  disabled?: boolean;
  className?: string;
};

/** Square editorial buttons: crimson (primary) or raised cream with an ink border. */
export function Button({
  children,
  onClick,
  variant = "solid",
  disabled = false,
  className = "",
}: ButtonProps) {
  const styles =
    variant === "solid"
      ? "bg-jk-btn text-jk-btn-text hover:bg-jk-btn-hover active:translate-y-px active:bg-jk-btn-hover disabled:bg-transparent disabled:text-jk-muted disabled:shadow-[inset_0_0_0_1px_rgb(var(--t-muted))] disabled:hover:bg-transparent"
      : "border border-jk-ink bg-jk-raised text-jk-ink hover:bg-jk-ink hover:text-jk-on-ink disabled:border-jk-muted disabled:text-jk-muted disabled:hover:bg-jk-raised disabled:hover:text-jk-muted";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`jk-label px-6 py-[18px] transition-[background-color,transform] duration-[250ms] disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

type RangeControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** How the current value is shown next to the label. */
  format: (value: number) => string;
  onChange: (value: number) => void;
};

/** A hairline slider in the Jacketek style. */
export function RangeControl({ label, value, min, max, step = 1, format, onChange }: RangeControlProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="jk-label text-jk-ink" style={{ fontSize: 10 }}>
          {label}
        </label>
        <Ltr className="text-[13px] text-jk-muted">{format(value)}</Ltr>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="fidelio-range w-full"
      />
    </div>
  );
}

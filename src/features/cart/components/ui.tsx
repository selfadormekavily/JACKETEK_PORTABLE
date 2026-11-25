import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import Atmosphere from "@/components/Atmosphere";
import Nav from "@/components/Nav";
import Ltr from "@/i18n/Ltr";
import { useI18n } from "@/i18n/useI18n";
import { formatAmount } from "../pricing";
import { MAX_QUANTITY } from "../types";

/**
 * Building blocks for the cart, checkout and confirmation pages, in the
 * site's own design (tokens, labels, hairlines and dashed rules from
 * styles/index.css — no new styles).
 */

/** A plain page: the nav's light fill over the cream room. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav variant="page" />
      <main className="relative min-h-screen">
        <Atmosphere className="jk-atmos--page fixed inset-0" />
        <div className="relative mx-auto w-full max-w-[1240px] px-5 pb-28 pt-[96px] md:px-14 md:pb-24 md:pt-[124px]">
          {children}
        </div>
      </main>
    </>
  );
}

/** The buttons' arrow (18px), as on the homepage CTA. */
export function ArrowRight() {
  return (
    <svg aria-hidden="true" className="jk-arrow shrink-0" width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9 H15 M10 4 L15 9 L10 14" />
    </svg>
  );
}

/**
 * Page title: the product-title style ("YOUR CART", "CHECKOUT").
 * `fit`: for a customer's own words (a group's name) — a little smaller,
 * and long names wrap anywhere instead of running off a phone screen.
 */
export function PageTitle({ eyebrow, children, fit = false }: { eyebrow?: string; children: ReactNode; fit?: boolean }) {
  return (
    <div>
      {eyebrow && (
        <p className="jk-label flex items-center gap-4 text-jk-ink">
          {eyebrow}
          <span aria-hidden="true" className="block h-px w-[50px] bg-jk-rule" />
        </p>
      )}
      <h1 className={`jk-display mt-4 text-jk-ink ${fit ? "whitespace-normal text-[clamp(40px,7vw,88px)] leading-[0.92] [overflow-wrap:anywhere]" : "text-[clamp(52px,9vw,96px)]"}`}>
        {children}
      </h1>
    </div>
  );
}

/** A section heading inside a form or summary ("CONTACT", "DELIVERY"…). */
export function SectionTitle({ index, children }: { index?: string; children: ReactNode }) {
  return (
    <h2 className="jk-label flex items-center gap-3 text-jk-ink">
      {index && <span className="text-jk-numeral">{index}</span>}
      {children}
    </h2>
  );
}

/** Label / value rows ("Size · XL") in compact type. */
export function DesignRows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      {rows.map(({ label, value }) => (
        <div key={label} className="contents">
          <dt className="jk-label-xs leading-[22px] text-jk-muted">{label}</dt>
          <dd className="text-[13px] leading-[22px] text-jk-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A price in the current language: the amount as "JOD 45.00" (Western
 * digits, isolated left-to-right inside Arabic), or "To be confirmed".
 */
export function Price({ amount }: { amount: number | null }) {
  const { t } = useI18n();
  if (amount === null) return <>{t("cart.price.tbc")}</>;
  return <Ltr>{formatAmount(amount)}</Ltr>;
}

/** "−  1  +" with 44px touch targets (in RTL the row reads "+  1  −"). */
export function QuantityStepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const { t } = useI18n();
  const cell = "grid h-11 w-11 place-items-center text-[18px] leading-none text-jk-ink transition-colors duration-200 hover:bg-jk-raised disabled:text-jk-muted/40 disabled:hover:bg-transparent";
  return (
    <div role="group" aria-label={label} className="jk-stepper inline-flex items-center">
      <button type="button" className={cell} aria-label={t("cart.stepper.decrease")} disabled={value <= 1} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span aria-live="polite" className="jk-label w-10 text-center text-jk-ink">
        {value}
      </span>
      <button
        type="button"
        className={cell}
        aria-label={t("cart.stepper.increase")}
        disabled={value >= MAX_QUANTITY}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

/** SUBTOTAL / DELIVERY / TOTAL. */
export function PriceRows({
  subtotal,
  delivery,
  total,
}: {
  subtotal: number | null;
  delivery: number | null;
  total: number | null;
}) {
  const { t } = useI18n();
  const row = "flex items-baseline justify-between gap-4 py-3";
  return (
    <dl>
      <div className={`${row} jk-dashed-top`}>
        <dt className="jk-label text-jk-muted">{t("cart.price.subtotal")}</dt>
        <dd className="text-[14px] text-jk-ink">
          <Price amount={subtotal} />
        </dd>
      </div>
      <div className={`${row} jk-dashed-top`}>
        <dt className="jk-label text-jk-muted">{t("cart.price.delivery")}</dt>
        <dd className="text-[14px] text-jk-ink">
          <Price amount={delivery} />
        </dd>
      </div>
      <div className={`${row} border-t border-jk-rule`}>
        <dt className="jk-label text-jk-ink">{t("cart.price.total")}</dt>
        <dd className="jk-price-total text-[20px] font-medium tracking-[-0.01em] text-jk-ink">
          <Price amount={total} />
        </dd>
      </div>
    </dl>
  );
}

type FieldProps = {
  label: string;
  error?: string;
  optional?: boolean;
  multiline?: boolean;
  hint?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement & HTMLTextAreaElement>, "className">;

/**
 * A labelled text field: square, hairline-bordered (as the segmented
 * controls), 52px tall; ink border on focus; the error in crimson
 * beneath it (inline, announced, linked to the field).
 */
export function Field({ label, error, optional = false, multiline = false, hint, id, ...input }: FieldProps) {
  const { t } = useI18n();
  const autoId = useId();
  const fieldId = id ?? autoId;
  const messageId = `${fieldId}-message`;
  const box = `w-full border bg-jk-raised/70 px-4 text-[16px] text-jk-ink outline-none transition-colors duration-200 placeholder:text-jk-muted/60 focus:border-jk-ink focus:bg-jk-raised ${
    error ? "border-jk-accent" : "border-[rgb(var(--t-head)/.22)]"
  }`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="jk-label flex justify-between text-jk-ink" style={{ fontSize: 10 }}>
        {label}
        {optional && <span className="text-jk-muted">{t("common.optional")}</span>}
      </label>
      {multiline ? (
        <textarea
          id={fieldId}
          rows={3}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={`${box} min-h-[96px] resize-y py-3 leading-[1.5]`}
          {...input}
        />
      ) : (
        <input
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={`${box} h-[52px]`}
          {...input}
        />
      )}
      {(error || hint) && (
        <p id={messageId} className={`text-[13px] leading-[1.5] ${error ? "text-jk-accent" : "text-jk-muted"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

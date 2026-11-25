import type { ReactNode } from "react";
import { getColour, type JacketConfig } from "@/features/configurator";
import { pad2 } from "@/i18n/format";
import { useCatalogNames } from "@/i18n/useCatalogNames";
import { useI18n } from "@/i18n/useI18n";

/**
 * The cart's editorial pieces (styles/cart.css): presentation only. They
 * read the design they're given and never change it.
 */

/**
 * A small cream fitting room for one jacket: warm light, a dusty-blue
 * ambient glow, a low plinth with a floor shadow, and a woven label
 * numbering the piece.
 */
export function ProductStage({
  src,
  number,
  size = "lg",
  className = "",
  alt,
  emptyLabel,
}: {
  src: string | null;
  number?: number;
  size?: "lg" | "sm";
  className?: string;
  /** Default: "Your jacket design". */
  alt?: string;
  /** Shown when there is no image. Default: "Your design". */
  emptyLabel?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={`jk-stage jk-stage--${size} ${className}`}>
      <div aria-hidden="true" className="jk-stage__wall" />
      <div aria-hidden="true" className="jk-stage__glow" />
      <div aria-hidden="true" className="jk-stage__plinth" />
      {src ? (
        <img src={src} alt={alt ?? t("cart.item.imageAlt")} className="jk-stage__jacket" decoding="async" />
      ) : (
        <span className="jk-stage__empty jk-label-xs">{emptyLabel ?? t("cart.item.emptyStage")}</span>
      )}
      {number !== undefined && size === "lg" && (
        <span className="jk-woven-tag" aria-hidden="true">
          {t("cart.item.number", { nn: pad2(number) })}
        </span>
      )}
    </div>
  );
}

/** A chenille-patch style chip; `strong` for the one key fact (the size). */
export function PatchChip({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  // The inner span keeps mixed runs (a label + an LTR size) as one line of
  // text: as separate flex items their joining space would be dropped.
  return (
    <span className={`jk-patch ${strong ? "jk-patch--strong" : ""}`}>
      <span>{children}</span>
    </span>
  );
}

/** Body · Sleeves · Trim as colour discs, named, from the design itself. */
export function SwatchTrio({ config }: { config: Pick<JacketConfig, "colours"> }) {
  const { t } = useI18n();
  const names = useCatalogNames();
  const zones = [
    ["body", "Body", config.colours.body],
    ["sleeves", "Sleeves", config.colours.sleeves],
    ["trim", "Trim", config.colours.trim],
  ] as const;
  return (
    <ul className="jk-trio" aria-label={t("cart.trio.aria")}>
      {zones.map(([zone, label, id]) => {
        const colour = getColour(id);
        return (
          <li key={zone} className="jk-trio__item">
            <span aria-hidden="true" className="jk-trio__disc" style={{ background: colour.hex }} />
            <span className="jk-trio__label">{names.zone(zone, label)}</span>
            <span className="jk-trio__name">{names.colour(colour.id, colour.name)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** A stitched rule: the seam between parts of a card. */
export function StitchRule({ className = "" }: { className?: string }) {
  return <hr aria-hidden="true" className={`jk-stitch-rule ${className}`} />;
}

/**
 * The order summary as a light receipt: raised cream, a crimson stitch
 * along its top edge, a woven tab naming it.
 */
export function Receipt({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`jk-receipt ${className}`}>
      <p className="jk-receipt__tab">{title}</p>
      {children}
    </section>
  );
}

/**
 * Where checkout is: Cart, Details, Confirmation as one quiet stitched
 * line, the current stop marked with a small crimson knot.
 */
export function CheckoutProgress({ current }: { current: 0 | 1 | 2 }) {
  const { t } = useI18n();
  const stops = [
    ["cart", t("cart.progress.cart")],
    ["details", t("cart.progress.details")],
    ["confirmation", t("cart.progress.confirmation")],
  ] as const;
  return (
    <ol className="jk-progress" aria-label={t("cart.progress.aria")}>
      {stops.map(([id, stop], i) => (
        <li key={id} className={`jk-progress__stop ${i < current ? "is-done" : ""} ${i === current ? "is-current" : ""}`} aria-current={i === current ? "step" : undefined}>
          <span aria-hidden="true" className="jk-progress__knot" />
          {stop}
        </li>
      ))}
    </ol>
  );
}

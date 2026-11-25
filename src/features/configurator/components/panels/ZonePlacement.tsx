import { useId, useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { formatNumber } from "@/i18n/format";
import type { PlacementOption } from "../../model/catalog";
import { contentAspect } from "../../model/config";
import { clampInZone, zoneContent, ZONE_SCALE_MIN } from "../../model/embroideryGeometry";
import type { EmbroideryElement, ZoneTransform } from "../../model/types";
import { useConfigurator } from "../../state/context";
import { OptionGroup, RangeControl } from "../ui";

/** One nudge: half a centimetre on the garment. */
const NUDGE_M = 0.005;
const cm = (metres: number) => formatNumber(Math.round(metres * 1000) / 10);

const arrow =
  "jk-nudge jk-hit grid h-10 w-10 place-items-center text-[15px] text-jk-ink transition-colors duration-200 hover:text-jk-accent disabled:cursor-not-allowed disabled:text-jk-muted/40";
const quietAction =
  "jk-cfg-meta jk-hit text-[10px] uppercase tracking-widest2 text-jk-muted transition-colors duration-300 hover:text-jk-accent disabled:cursor-default disabled:text-jk-muted/40 disabled:hover:text-jk-muted/40";

/**
 * PLACEMENT INSIDE THE ZONE: the content's size (as large as the zone
 * allows, down to ZONE_SCALE_MIN of that) and position (drag it on the
 * jacket, or nudge it here) — always wholly inside the zone, which itself
 * never moves or changes size. Reset brings back the auto-fit, centred.
 */
type Props = {
  zone: PlacementOption;
  element: EmbroideryElement;
  /** What is placed: names the size control ("Text size", "Image size", "Design size"). */
  kind: "text" | "image" | "design";
};

/**
 * "SIZE & POSITION": folded by default (most customers keep the automatic
 * fit), its row showing the current state ("Fitted · centred", "60 % · moved").
 */
export default function ZonePlacement(props: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const aspect = contentAspect(props.element);
  if (!aspect) return null;
  const current = clampInZone(props.zone.box, aspect, props.element.inZone);
  const fitted = current.scale === 1 && current.x === 0 && current.y === 0;
  const where = current.x === 0 && current.y === 0 ? t("configurator.placement.summaryCentred") : t("configurator.placement.summaryMoved");
  const summary = fitted
    ? t("configurator.placement.summaryFitted")
    : t("configurator.placement.summaryCustom", { size: formatNumber(Math.round(current.scale * 100)), where });

  return (
    <div className="jk-disclosure" data-open={open || undefined}>
      <button type="button" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((o) => !o)} className="jk-disclosure__toggle">
        <span className="jk-label text-jk-ink" style={{ fontSize: 10 }}>
          {t("configurator.placement.disclosure")}
        </span>
        <span className="jk-disclosure__value">{summary}</span>
        <span aria-hidden="true" className="jk-disclosure__chevron" />
      </button>
      {open && (
        <div id={contentId} className="jk-disclosure__body jk-step-fade">
          <PlacementControls {...props} />
        </div>
      )}
    </div>
  );
}

function PlacementControls({ zone, element, kind }: Props) {
  const { t } = useI18n();
  const { dispatch } = useConfigurator();
  const aspect = contentAspect(element);
  if (!aspect) return null;
  const current = clampInZone(zone.box, aspect, element.inZone);
  const place = (transform: Partial<ZoneTransform> | null) => dispatch({ type: "setZoneTransform", placement: zone.id, transform });
  const sizeAt = (scale: number) => zoneContent(zone.box, aspect, { ...current, scale }).size;
  const [w, h] = sizeAt(current.scale);
  const isDefault = current.scale === 1 && current.x === 0 && current.y === 0;

  // Nudges: half a centimetre, in zone units; a direction at its edge is disabled.
  const step = { x: NUDGE_M / zone.box[0], y: NUDGE_M / zone.box[1] };
  const canMove = (dx: number, dy: number) => {
    const moved = clampInZone(zone.box, aspect, { ...current, x: current.x + dx, y: current.y + dy });
    return moved.x !== current.x || moved.y !== current.y;
  };
  const nudge = (dx: number, dy: number) => place({ x: current.x + dx, y: current.y + dy });
  const offset = zoneContent(zone.box, aspect, current).offset;
  const position =
    current.x === 0 && current.y === 0
      ? t("configurator.placement.centred")
      : t("configurator.placement.offset", { x: cm(Math.abs(offset[0])), y: cm(Math.abs(offset[1])) });

  return (
    <div className="jk-placement flex flex-col gap-5">
      <RangeControl
        label={t(`configurator.placement.size.${kind}`)}
        value={Math.round(current.scale * 100)}
        min={Math.round(ZONE_SCALE_MIN * 100)}
        max={100}
        format={(v) => {
          const [sw, sh] = sizeAt(v / 100);
          return t("configurator.placement.dimensions", { w: cm(sw), h: cm(sh) });
        }}
        onChange={(v) => place({ scale: v / 100 })}
      />
      <OptionGroup label={t("configurator.placement.position")} value={position}>
        <div className="flex items-center gap-5">
          {/* The garment's own left / right / up / down (never mirrored). */}
          <div dir="ltr" className="jk-nudge-pad grid shrink-0 grid-cols-3 gap-1" role="group" aria-label={t("configurator.placement.nudgeAria")}>
            <span />
            <button type="button" className={arrow} disabled={!canMove(0, step.y)} onClick={() => nudge(0, step.y)} aria-label={t("configurator.placement.up")}>
              ↑
            </button>
            <span />
            <button type="button" className={arrow} disabled={!canMove(-step.x, 0)} onClick={() => nudge(-step.x, 0)} aria-label={t("configurator.placement.left")}>
              ←
            </button>
            <span className="grid h-10 w-10 place-items-center" aria-hidden="true">
              <span className="block h-[6px] w-[6px] rounded-full bg-jk-crimson" />
            </span>
            <button type="button" className={arrow} disabled={!canMove(step.x, 0)} onClick={() => nudge(step.x, 0)} aria-label={t("configurator.placement.right")}>
              →
            </button>
            <span />
            <button type="button" className={arrow} disabled={!canMove(0, -step.y)} onClick={() => nudge(0, -step.y)} aria-label={t("configurator.placement.down")}>
              ↓
            </button>
            <span />
          </div>
          <p className="text-[12.5px] leading-[1.6] text-jk-muted">{t("configurator.placement.dragHint")}</p>
        </div>
      </OptionGroup>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-jk-muted">
          {t("configurator.placement.inArea", { w: cm(w), h: cm(h), zw: cm(zone.box[0]), zh: cm(zone.box[1]) })}
        </p>
        <button type="button" className={quietAction} disabled={isDefault} onClick={() => place(null)}>
          {t("configurator.placement.reset")}
        </button>
      </div>
    </div>
  );
}

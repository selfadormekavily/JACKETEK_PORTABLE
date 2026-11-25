import type { ReactNode } from "react";
import Ltr from "@/i18n/Ltr";
import { labelKey, useCatalogNames } from "@/i18n/useCatalogNames";
import { useI18n } from "@/i18n/useI18n";
import {
  getColour,
  getFit,
  getButtonFinish,
  getMaterial,
  getPlacement,
  getThread,
  PLACEMENTS,
  SIZES,
} from "../../model/catalog";
import { getActiveEmbroidery } from "../../model/config";
import type { ColourwaySelection } from "../../model/types";
import { useConfigurator } from "../../state/context";
import type { StepId } from "../../state/steps";
import { OptionGroup, SegmentedControl } from "../ui";

type Row = { key: string; label: string; value: ReactNode; step: StepId };

/** Embroidery rows follow the zones' order on the jacket (front, back, sleeves). */
const zoneOrder = (id: string) => {
  const i = PLACEMENTS.findIndex((z) => z.id === id);
  return i < 0 ? PLACEMENTS.length : i;
};

/** Size codes stay Latin, left-to-right; the row itself follows the page (XS first). */
const SIZE_OPTIONS = SIZES.map((size) => ({ id: size, name: <Ltr>{size}</Ltr> }));

export default function ReviewPanel() {
  const { state, dispatch } = useConfigurator();
  const { config } = state;
  const { t, tMaybe } = useI18n();
  const names = useCatalogNames();

  const embroidery = getActiveEmbroidery(config);
  const fit = getFit(config.fit);

  const colourName = (id: string) => {
    const c = getColour(id);
    return names.colour(c.id, c.name);
  };
  const zoneValue = (zone: "body" | "sleeves") => {
    const m = getMaterial(config.materials[zone]);
    return t("configurator.summary.colourMaterial", {
      colour: colourName(config.colours[zone]),
      material: names.material(m.id, m.name),
    });
  };
  const threadName = (id: string) => {
    const th = getThread(id);
    return names.thread(th.id, th.name);
  };
  /** A ready-made design's changed colours, layer by layer: "Fill: Burgundy · Outline: White". */
  const designColours = (cw: ColourwaySelection) =>
    cw.slots
      .map((s, i) => {
        const thread = cw.colours[s.id] ?? s.defaultThread;
        const slot =
          (s.key ? tMaybe(`catalog.colourwaySlot.${s.key}`) : undefined) ??
          tMaybe(`catalog.colourwaySlot.${labelKey(s.label)}`) ??
          t("configurator.designColours.generic", { n: i + 1 });
        return t("configurator.review.designColour", { slot, colour: thread ? threadName(thread) : t("configurator.embroidery.colourway.original") });
      })
      .join(" · ");
  const finish = getButtonFinish(config.buttons);
  const snaps = tMaybe(`configurator.review.closureSnaps.${finish.id}`) ?? `${finish.name} snaps`;

  const rows: Row[] = [
    { key: "body", label: t("configurator.steps.body"), value: zoneValue("body"), step: "body" },
    { key: "sleeves", label: t("configurator.steps.sleeves"), value: zoneValue("sleeves"), step: "sleeves" },
    { key: "trim", label: t("configurator.steps.trim"), value: colourName(config.colours.trim), step: "trim" },
    {
      key: "closure",
      label: t("configurator.steps.closure"),
      value: config.zipper ? t("configurator.review.withHiddenZipper", { snaps }) : snaps,
      step: "closure",
    },
    ...(embroidery.length > 0
      ? [...embroidery].sort((a, b) => zoneOrder(a.placement) - zoneOrder(b.placement)).map((e, i) => {
          const placement = getPlacement(e.placement);
          return {
            key: `embroidery-${e.id}`,
            label: t("configurator.review.embroideryRowLabel", {
              n: i + 1,
              placement: names.placementShort(placement.id, placement.shortName),
            }),
            value:
              e.kind === "text" ? (
                <>
                  {/* Text may be English, Arabic or both: isolated, in its own direction. */}
                  <bdi dir="auto" className="whitespace-pre-line">{e.text}</bdi>
                  {e.textStyle ? ` · ${names.font(e.textStyle.fontId, e.textStyle.fontName)}` : ""}
                  {e.thread ? ` · ${threadName(e.thread)}` : ""}
                </>
              ) : e.image?.frontLetters ? (
                <>
                  {t("configurator.review.frontLetters")} <Ltr>{`${e.image.frontLetters.letter1} ${e.image.frontLetters.letter2}`}</Ltr>
                  {` · ${names.letterStyle(e.image.frontLetters.style)}`}
                  {e.image.colourway ? ` · ${designColours(e.image.colourway)}` : ""}
                </>
              ) : e.image?.library ? (
                `${t("configurator.review.readyMade")} · ${
                  e.image.colourway ? designColours(e.image.colourway) : t("configurator.review.originalColours")
                }`
              ) : (
                `${t("configurator.review.image")} · ${
                  e.thread ? threadName(e.thread) : t("configurator.review.originalColours")
                }`
              ),
            step: "embroidery" as const,
          };
        })
      : [
          {
            key: "embroidery",
            label: t("configurator.steps.embroidery"),
            value: t("configurator.review.none"),
            step: "embroidery" as const,
          },
        ]),
  ];

  return (
    <div className="flex flex-col gap-8">
      <dl className="jk-dashed-top">
        {rows.map((row) => (
          <div
            key={row.key}
            className="jk-dashed-bottom flex items-baseline gap-4 py-3"
          >
            <dt className="jk-cfg-meta w-24 shrink-0 text-[10px] tracking-widest2 uppercase text-jk-muted">
              {row.label}
            </dt>
            <dd className="flex-1 text-sm tracking-wide text-fidelio-black">
              {row.value}
            </dd>
            <button
              type="button"
              onClick={() => dispatch({ type: "goToStep", step: row.step })}
              className="jk-cfg-meta jk-hit text-[10px] tracking-widest2 uppercase text-jk-muted transition-colors duration-300 hover:text-jk-accent"
              aria-label={t("configurator.review.editAria", { label: row.label })}
            >
              {t("configurator.review.edit")}
            </button>
          </div>
        ))}
      </dl>

      <OptionGroup
        label={t("configurator.review.size")}
        value={config.size ? <Ltr>{config.size}</Ltr> : t("configurator.review.sizeSelect")}
      >
        <SegmentedControl
          label={t("configurator.review.size")}
          options={SIZE_OPTIONS}
          value={config.size}
          onChange={(size) => dispatch({ type: "setSize", size })}
          dense
        />
      </OptionGroup>

      {/* One standard fit — stated, not chosen (a saved design shows the fit it was made with). */}
      <OptionGroup label={t("configurator.review.fit")} value={names.fit(fit.id, fit.name)}>
        <p className="text-xs text-jk-muted">{names.fitDescription(fit.id, fit.description)}</p>
      </OptionGroup>

      <button
        type="button"
        onClick={() => dispatch({ type: "reset" })}
        className="jk-cfg-meta jk-hit self-start text-[10px] tracking-widest2 uppercase text-jk-muted transition-colors duration-300 hover:text-jk-accent"
      >
        {t("configurator.review.startOver")}
      </button>
    </div>
  );
}

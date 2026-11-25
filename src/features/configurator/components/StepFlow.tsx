import type { CSSProperties } from "react";
import { useCatalogNames } from "@/i18n/useCatalogNames";
import { useI18n } from "@/i18n/useI18n";
import { formatNumber } from "@/i18n/format";
import { PLACEMENTS } from "../model/catalog";
import type { PlacementId } from "../model/types";
import { useConfigurator } from "../state/context";
import { getStepPosition, STEPS } from "../state/steps";
import { GroupDesignBar } from "@/features/groups/components/GroupDesignBar";
import { summarise } from "./stepSummary";
import { useAddToCart } from "./useAddToCart";
import { DevTechPackPanel } from "./DevTechPackPanel";

/*
 * The guided flow around the step panels (design: "fitting-room wizard").
 * - StepMap: the steps as knots on a stitched thread; every knot jumps to
 *   its step, the current one is a crimson knot, the ones before it are
 *   tied off in navy.
 * - StepHeading: where you are, what you chose, what this step is for.
 * - StepActions: Back / Next (Add to cart on Review), always in the same
 *   place — the panel's foot on desktop, a bar at the bottom of the screen
 *   on phones and tablets.
 */

/**
 * The step map. `labels="all"`: every step named under its knot (the
 * desktop panel). `labels="current"`: knots only, with the current step
 * named beneath (phones and tablets — long names never crowd one line).
 */
export function StepMap({ labels }: { labels: "all" | "current" }) {
  const { state, dispatch } = useConfigurator();
  const { t } = useI18n();
  const position = getStepPosition(state.ui.step);
  const current = STEPS[position];
  const progress = { "--progress": position / (STEPS.length - 1) } as CSSProperties;

  return (
    <nav aria-label={t("configurator.flow.stepMapAria")} className={`jk-stepmap jk-stepmap--${labels}`}>
      <ol className="jk-stepmap__track" style={progress}>
        {STEPS.map((step, i) => {
          const status = i < position ? "done" : i === position ? "current" : "todo";
          const name = t(`configurator.steps.${step.id}`);
          return (
            <li key={step.id} className="jk-stepmap__item">
              <button
                type="button"
                data-state={status}
                aria-current={status === "current" ? "step" : undefined}
                aria-label={`${t("configurator.flow.stepAria", { n: formatNumber(i + 1), name })}${
                  status === "todo" ? "" : ` (${t(status === "done" ? "configurator.flow.done" : "configurator.flow.current")})`
                }`}
                onClick={() => dispatch({ type: "goToStep", step: step.id })}
                title={name}
                className="jk-stepmap__step"
              >
                <span aria-hidden="true" className="jk-stepmap__knot" />
                {labels === "all" && (
                  <span aria-hidden="true" className="jk-stepmap__name">
                    {name}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      {labels === "current" && (
        <p key={current.id} className="jk-stepmap__current" aria-live="polite">
          <span className="jk-stepmap__index">{current.index}</span>
          <span className="jk-stepmap__label">{t(`configurator.steps.${current.id}`)}</span>
          <span className="jk-stepmap__count">
            {formatNumber(position + 1)} / {formatNumber(STEPS.length)}
          </span>
        </p>
      )}
    </nav>
  );
}

/** Step N of M, the step's name, its current value, and what it is for. */
export function StepHeading({ compact = false }: { compact?: boolean }) {
  const { state } = useConfigurator();
  const i18n = useI18n();
  const { t } = i18n;
  const names = useCatalogNames();
  const step = state.ui.step;
  const position = getStepPosition(step);
  const summary = summarise(step, state.config, names, i18n);

  return (
    <header key={step} className="jk-stephead jk-step-fade">
      {!compact && (
        <p className="jk-stephead__step jk-label-xs text-jk-muted">
          {t("configurator.flow.stepOf", { n: formatNumber(position + 1), total: formatNumber(STEPS.length) })}
        </p>
      )}
      <div className="jk-stephead__row">
        <h2 className="jk-display jk-stephead__title text-jk-ink">{t(`configurator.steps.${step}`)}</h2>
        {summary.text && (
          <span className="jk-stephead__value">
            {summary.hex && <span aria-hidden="true" className="jk-stephead__dot" style={{ backgroundColor: summary.hex }} />}
            <bdi>{summary.text}</bdi>
          </span>
        )}
      </div>
      <p className="jk-stephead__prompt">{t(`configurator.flow.prompts.${step}`)}</p>
    </header>
  );
}

/** The chosen area's editor, brought to a comfortable place once it has rendered (under the pinned stage on phones). */
function revealZoneEditor() {
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => document.querySelector(".jk-zone")?.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" }))
  );
}

/**
 * Back / Next — on Review, Add to cart (with what is still missing, if anything).
 *
 * Inside Embroidery a second, inner level comes first: the areas one by one
 * ("Next area — Right Chest", "Previous area"), each selected, shown on the
 * jacket and brought into view; an empty area is simply passed. Only on the
 * last area does Next lead on to Review (the zone map still jumps anywhere,
 * and the step map anywhere in the journey).
 */
export function StepActions() {
  const { state, dispatch } = useConfigurator();
  const { t } = useI18n();
  const names = useCatalogNames();
  const { addToCart, checking, issues, error, target } = useAddToCart();
  const forGroup = target.kind === "group";
  const blocked = forGroup && target.blockedCode !== null;
  const position = getStepPosition(state.ui.step);
  const previous = STEPS[position - 1];
  const next = STEPS[position + 1];
  const review = state.ui.step === "review";

  const area = state.ui.step === "embroidery" ? PLACEMENTS.findIndex((z) => z.id === state.ui.selectedZone) : -1;
  const previousArea = area > 0 ? PLACEMENTS[area - 1] : null;
  const nextArea = area >= 0 && area < PLACEMENTS.length - 1 ? PLACEMENTS[area + 1] : null;
  const goToArea = (zone: PlacementId) => {
    dispatch({ type: "selectZone", placement: zone });
    revealZoneEditor();
  };

  return (
    <div className="jk-stepbar">
      {forGroup && <GroupDesignBar target={target} error={error} />}
      {review && (
        <p className="jk-stepbar__note" aria-live="polite">
          {issues.length > 0 ? issues.map((issue) => t(`configurator.issues.${issue}`)).join(" ") : t("configurator.review.complete")}
        </p>
      )}
      {review && <DevTechPackPanel />}
      <div className="jk-stepbar__row">
        {previousArea ? (
          <button
            type="button"
            onClick={() => goToArea(previousArea.id)}
            aria-label={t("configurator.flow.previousAreaAria", { zone: names.placement(previousArea.id, previousArea.name) })}
            className="jk-stepbar__back jk-label"
          >
            <Arrow back />
            <span className="max-md:hidden">{t("configurator.flow.previousArea")}</span>
            <span className="md:hidden">{t("configurator.flow.previousShort")}</span>
          </button>
        ) : previous ? (
          <button
            type="button"
            onClick={() => dispatch({ type: "goToStep", step: previous.id })}
            aria-label={t("configurator.flow.backAria", { step: t(`configurator.steps.${previous.id}`) })}
            className="jk-stepbar__back jk-label"
          >
            <Arrow back />
            <span>{t("configurator.flow.back")}</span>
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        {review ? (
          <button
            type="button"
            onClick={() => void addToCart()}
            disabled={issues.length > 0 || checking || blocked}
            className="jk-stepbar__next jk-label"
            data-testid="commit-design"
          >
            <span>
              {checking
                ? t("configurator.review.saving")
                : !forGroup
                  ? t("configurator.review.addToCart")
                  : target.itemId
                    ? t("group.designBar.save")
                    : t("group.designBar.add")}
            </span>
          </button>
        ) : nextArea ? (
          <button
            type="button"
            onClick={() => goToArea(nextArea.id)}
            aria-label={t("configurator.flow.nextArea", { zone: names.placement(nextArea.id, nextArea.name) })}
            className="jk-stepbar__next jk-stepbar__next--area jk-label"
          >
            {/* Two lines: the action, then where it goes (never cut short). */}
            <span className="jk-stepbar__stack">
              <span className="jk-stepbar__kicker">{t("configurator.flow.nextAreaShort")}</span>
              <bdi className="jk-stepbar__target">{names.placement(nextArea.id, nextArea.name)}</bdi>
            </span>
            <Arrow />
          </button>
        ) : area >= 0 && next ? (
          // The last area: leaving Embroidery, said plainly.
          <button
            type="button"
            onClick={() => dispatch({ type: "goToStep", step: next.id })}
            aria-label={t("configurator.next", { step: t(`configurator.steps.${next.id}`) })}
            className="jk-stepbar__next jk-stepbar__next--area jk-label"
          >
            <span className="jk-stepbar__stack">
              <span className="jk-stepbar__kicker">{t("configurator.flow.finishEmbroidery")}</span>
              <span className="jk-stepbar__target">{t(`configurator.steps.${next.id}`)}</span>
            </span>
            <Arrow />
          </button>
        ) : (
          next && (
            <button type="button" onClick={() => dispatch({ type: "goToStep", step: next.id })} className="jk-stepbar__next jk-label">
              <span className="truncate">{t("configurator.next", { step: t(`configurator.steps.${next.id}`) })}</span>
              <Arrow />
            </button>
          )
        )}
      </div>
    </div>
  );
}

/** → (Next) or ← (Back); both turn round in right-to-left pages (.jk-arrow). */
function Arrow({ back = false }: { back?: boolean }) {
  return (
    <svg aria-hidden="true" className="jk-arrow shrink-0" width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={back ? "M15 9 H3 M8 4 L3 9 L8 14" : "M3 9 H15 M10 4 L15 9 L10 14"} />
    </svg>
  );
}

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useCatalogNames } from "@/i18n/useCatalogNames";
import { useI18n } from "@/i18n/useI18n";
import { useConfigurator } from "../state/context";
import { getStepPosition, type StepId } from "../state/steps";
import ConfiguratorStage from "./ConfiguratorStage";
import ClosurePanel from "./panels/ClosurePanel";
import EmbroideryPanel from "./panels/EmbroideryPanel";
import MaterialPanel from "./panels/MaterialPanel";
import ReviewPanel from "./panels/ReviewPanel";
import ZoneColourPanel from "./panels/ZoneColourPanel";
import { StepActions, StepHeading, StepMap } from "./StepFlow";

const PANELS: Record<StepId, () => ReactNode> = {
  // Colour and material: two independent controls, one step.
  body: () => (
    <div className="flex flex-col gap-9">
      <ZoneColourPanel zone="body" />
      <MaterialPanel zone="body" />
    </div>
  ),
  sleeves: () => (
    <div className="flex flex-col gap-9">
      <ZoneColourPanel zone="sleeves" />
      <MaterialPanel zone="sleeves" />
    </div>
  ),
  trim: () => <ZoneColourPanel zone="trim" />,
  closure: () => <ClosurePanel />,
  embroidery: () => <EmbroideryPanel />,
  review: () => <ReviewPanel />,
};

/** The split layout (stage | panel) is on: keep in step with the `cfg` screen (tailwind.config.ts). */
const SPLIT = "(min-width: 1180px), (min-width: 1024px) and (orientation: landscape)";

/**
 * The configurator, as a guided fitting-room journey: one step at a time,
 * the jacket always in view.
 *
 * Desktop (and landscape tablets): the stage is the hero; the panel beside
 * it is three bands — the step map and heading, the current step's
 * controls (the only part that scrolls), and Back / Next at its foot.
 * The grid follows the document direction (panel right in LTR, left in RTL).
 *
 * Phones and portrait tablets: the stage, with a compact step map, is
 * pinned under the bar; the current step's controls scroll beneath it and
 * Back / Next stay at the bottom of the screen.
 */
export default function ConfiguratorShell() {
  const { state } = useConfigurator();
  const { t } = useI18n();
  const names = useCatalogNames();
  const active = state.ui.step;
  const position = getStepPosition(active);
  const body = useRef<HTMLDivElement>(null);

  // Which way the journey moved (the next step slides in from ahead, the previous from behind).
  const [shown, setShown] = useState({ position, direction: 1 });
  if (shown.position !== position) setShown({ position, direction: position > shown.position ? 1 : -1 });

  // A new step starts at its top: the panel's own scroll on desktop, the
  // page on phones (which brings the pinned jacket and the heading back together).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    body.current?.scrollTo({ top: 0 });
    if (!window.matchMedia(SPLIT).matches && window.scrollY > 0) {
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
    }
  }, [active]);

  // Phones and portrait tablets: the pinned stage is at its largest at the
  // top of the page and gives way pixel for pixel as the customer scrolls
  // into the controls, down to a compact height (styles/configurator-flow.css
  // reads --cfg-scroll) — no jumps: the controls follow the finger.
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const write = () => {
      frame = 0;
      root.style.setProperty("--cfg-scroll", `${Math.max(0, Math.round(window.scrollY))}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(write);
    };
    write();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      root.style.removeProperty("--cfg-scroll");
    };
  }, []);

  return (
    <div className="jk-cfg bg-jk-canvas cfg:grid cfg:h-screen cfg:grid-cols-[minmax(0,1fr)_var(--cfg-panel)] cfg:overflow-hidden" data-step={active}>
      <ConfiguratorStage />

      <aside aria-label={t("configurator.panelAria")} className="jk-panel jk-cfg-panel cfg:flex cfg:h-full cfg:min-h-0 cfg:flex-col">
        <div className="jk-cfg-panel__head">
          {/* Phones: read by screen readers only — the jacket takes the space. */}
          <h1 className="jk-label text-jk-ink max-md:sr-only">
            {names.product()}
            <span className="jk-cfg-panel__collection">
              {t("configurator.collection")} · {t("configurator.madeToOrder")}
            </span>
          </h1>
          <div className="hidden cfg:block">
            <StepMap labels="all" />
          </div>
          <StepHeading />
        </div>

        <div ref={body} className="jk-cfg-panel__body">
          <div key={active} className="jk-step-enter" data-direction={shown.direction}>
            {PANELS[active]()}
          </div>
        </div>

        <StepActions />
      </aside>
    </div>
  );
}

import Atmosphere from "@/components/Atmosphere";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCatalogNames } from "@/i18n/useCatalogNames";
import { useI18n } from "@/i18n/useI18n";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { CAMERA_VIEWS } from "../model/catalog";
import type { PlacementId } from "../model/types";
import { useConfigurator } from "../state/context";
import JacketViewer from "../viewer/JacketViewer";
import { resolveAppearance } from "../viewer/appearance";
import { StepMap } from "./StepFlow";

/** Phones / portrait tablets (the stacked layout; see ConfiguratorShell). */
const PHONE = "(max-width: 767.98px)";
const STACKED = "(max-width: 1023.98px), (max-width: 1179.98px) and (orientation: portrait)";
/**
 * Framing on touch layouts: the jacket nearly edge to edge, below the step
 * map that floats over the top of the stage. Desktop keeps its airy default.
 */
const PHONE_FRAME = { margin: 1.04, insetTop: 76 };
const TABLET_FRAME = { margin: 1.12, insetTop: 62 };

/**
 * The product stage: the jacket viewer fills the whole area, with the
 * view controls laid over it as quiet editorial type. On phones and
 * portrait tablets it is pinned under the bar, the step map floating over
 * its top edge, so the jacket stays in view while the controls scroll
 * beneath it; on phones the view switch gives way to touch (rotate with a
 * finger) and the jacket takes all of the stage.
 */
export default function ConfiguratorStage() {
  const { state, dispatch } = useConfigurator();
  const { config, ui } = state;
  const { t } = useI18n();
  const names = useCatalogNames();
  const appearance = useMemo(() => resolveAppearance(config), [config]);

  // While its section is open, the edited zone is outlined on the jacket,
  // picking a design there selects its zone, and the selected zone's
  // content can be dragged — within the zone only (the zone never moves).
  const editingEmbroidery = ui.step === "embroidery";
  const selectZone = useCallback(
    (placement: PlacementId) => dispatch({ type: "selectZone", placement }),
    [dispatch]
  );
  const moveInZone = useCallback(
    (placement: PlacementId, x: number, y: number) => dispatch({ type: "setZoneTransform", placement, transform: { x, y } }),
    [dispatch]
  );
  // While the user inspects the jacket close up, the title steps aside.
  const [zoomed, setZoomed] = useState(false);
  const phone = useMediaQuery(PHONE);
  const stacked = useMediaQuery(STACKED);
  const frame = phone ? PHONE_FRAME : stacked ? TABLET_FRAME : undefined;

  // Stacked: the room (and its canvas) keeps the stage's full height and is
  // scaled down as the stage gives way on scroll — a GPU transform, so the
  // 3D canvas never resizes while the page scrolls.
  const stage = useRef<HTMLElement>(null);
  const room = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const outer = stage.current;
    const inner = room.current;
    if (!outer || !inner) return;
    const fit = () => {
      const full = inner.offsetHeight;
      const k = stacked && full > 0 ? Math.min(1, outer.clientHeight / full) : 1;
      inner.style.transform = k < 0.999 ? `scale(${k.toFixed(4)})` : "";
    };
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    observer.observe(inner);
    fit();
    return () => observer.disconnect();
  }, [stacked]);

  return (
    <section
      ref={stage}
      aria-label={t("configurator.stage.aria")}
      className="jk-cfg-stage cfg:relative cfg:h-full cfg:min-h-0 cfg:pt-24"
    >
      {/* The cream room the jacket hangs in (components/Atmosphere). */}
      <Atmosphere className="jk-atmos--center absolute inset-0" />
      <div className="jk-cfg-stage__map cfg:hidden">
        <StepMap labels="current" />
      </div>
      <div ref={room} className="jk-cfg-stage__room relative cfg:h-full">
        {/* The viewer stops above the view switch (tablets, desktop), so the
            jacket never sits underneath it; on phones it takes the whole stage. */}
        {/* (The fade-in lives here: on the room, its transform would override the scale.) */}
        <div className="animate-fade-in-up absolute inset-x-0 bottom-0 top-0 md:bottom-9 cfg:bottom-16">
          <JacketViewer
            appearance={appearance}
            view={ui.view}
            viewRequest={ui.viewRequest}
            focus={ui.focus}
            selectedZone={editingEmbroidery ? ui.selectedZone : null}
            onSelectZone={editingEmbroidery ? selectZone : undefined}
            onMoveInZone={editingEmbroidery ? moveInZone : undefined}
            onZoomedChange={setZoomed}
            jacketOpen={ui.jacketOpen && config.zipper}
            frame={frame}
          />
        </div>

        <MaterialChip hidden={zoomed} />

        <span className="jk-label-xs pointer-events-none absolute bottom-6 start-5 hidden text-jk-muted md:start-14 cfg:block">
          {editingEmbroidery && config.embroidery.some((e) => e.placement === ui.selectedZone)
            ? t("configurator.stage.hintMoveInZone")
            : t("configurator.stage.hintRotate")}
        </span>

        <span aria-hidden="true" className="jk-woven-tag jk-stage-tag hidden cfg:block">
          {t("configurator.stage.fittingRoom")}
        </span>

        <div
          role="radiogroup"
          aria-label={t("configurator.stage.cameraViewAria")}
          className="jk-cfg-views absolute bottom-1 left-1/2 hidden -translate-x-1/2 gap-6 md:flex cfg:bottom-[84px] cfg:gap-[30px]"
        >
          {CAMERA_VIEWS.map((view) => {
            const selected = ui.view === view.id;
            return (
              <button
                key={view.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => dispatch({ type: "setView", view: view.id })}
                // jk-hit: a 44px hit area around the 6px-padded label.
                className={`jk-label jk-hit relative py-[6px] transition-colors duration-200 ${
                  selected ? "border-b border-jk-rule text-jk-ink" : "border-b border-transparent text-jk-numeral hover:text-jk-ink"
                }`}
              >
                {view.id === "threeQuarter" ? (
                  <bdi dir="ltr">{names.view(view.id, view.name)}</bdi>
                ) : (
                  names.view(view.id, view.name)
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const MATERIAL_CHIP = {
  felt: { src: "/assets/macro/wool.webp" },
  leather: { src: "/assets/macro/leather.webp" },
} as const;

/** A macro of the material being edited (the body's, or the sleeves') — on those two steps only. */
function MaterialChip({ hidden }: { hidden: boolean }) {
  const { state } = useConfigurator();
  const relevant = state.ui.step === "body" || state.ui.step === "sleeves";
  const { t } = useI18n();
  const zone = state.ui.step === "sleeves" ? "sleeves" : "body";
  const material = state.config.materials[zone];
  const chip = MATERIAL_CHIP[material];
  const lines = [
    t(`configurator.stage.chip.${material}.material`),
    t(`configurator.stage.chip.${material}.finish`),
    t("configurator.stage.chip.madeToOrder"),
  ];
  return (
    <div
      className={`pointer-events-none absolute start-14 top-[420px] hidden items-center gap-4 transition-opacity duration-500 min-[1400px]:flex ${
        hidden || !relevant ? "opacity-0" : "opacity-100"
      }`}
    >
      <img
        src={chip.src}
        alt=""
        width={64}
        height={64}
        className="h-16 w-16 rounded-full object-cover shadow-[0_8px_18px_rgb(var(--brand-navy-deep)/.22)]"
      />
      <p className="jk-label-xs text-jk-ink" style={{ lineHeight: 1.9 }}>
        {lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>
    </div>
  );
}

import Ltr from "@/i18n/Ltr";
import { useCatalogNames } from "@/i18n/useCatalogNames";
import { useI18n } from "@/i18n/useI18n";
import { CAMERA_VIEWS, getPlacement, ZONES } from "../model/catalog";
import type { PlacementId } from "../model/types";
import type { JacketViewerProps } from "./types";

/**
 * 2D fallback viewer for devices without WebGL: an empty stage with
 * framing marks, plus a quiet readout of the live appearance data.
 */
export default function ViewerPlaceholder({
  appearance,
  view,
  focus,
  className = "",
}: JacketViewerProps) {
  const { t } = useI18n();
  const names = useCatalogNames();
  const viewOption = CAMERA_VIEWS.find((v) => v.id === view);
  const viewName = viewOption ? names.view(viewOption.id, viewOption.name) : view;

  const placementName = (id: PlacementId) => {
    const p = getPlacement(id);
    return names.placement(p.id, p.name);
  };

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center ${className}`}
    >
      <FrameCorners />

      <div className="flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-2">
          <span className="jk-cfg-meta text-[10px] tracking-widest2 uppercase text-jk-muted">
            {t("configurator.viewer.title")}
          </span>
          <span
            key={view}
            className="jk-cfg-meta animate-fade-in-up text-xs tracking-widest2 uppercase text-jk-ink"
          >
            {t("configurator.viewer.view", { view: viewName })}
          </span>
        </div>

        <ul className="flex items-center gap-5" aria-label={t("configurator.viewer.coloursAria")}>
          {ZONES.map((zone) => {
            const surface = appearance.surfaces[zone.id];
            const focused = focus?.kind === "zone" && focus.id === zone.id;
            return (
              <li key={zone.id} className="flex flex-col items-center gap-2">
                <span
                  className={`block h-8 w-8 border transition-all duration-500 ${
                    focused
                      ? "border-fidelio-black"
                      : "border-fidelio-black/10"
                  }`}
                  style={{ backgroundColor: surface.hex }}
                />
                <span className="jk-cfg-meta text-[9px] tracking-widest2 uppercase text-jk-muted">
                  {names.zone(zone.id, zone.name)}
                </span>
              </li>
            );
          })}
        </ul>

        {appearance.embroidery.length > 0 && (
          <ul className="flex flex-col items-center gap-1">
            {appearance.embroidery.map((e) => {
              const focused =
                focus?.kind === "placement" && focus.id === e.placement;
              return (
                <li
                  key={e.id}
                  className={`jk-cfg-meta text-[10px] tracking-widest2 uppercase transition-colors duration-500 ${
                    focused ? "text-jk-ink" : "text-jk-muted"
                  }`}
                >
                  {/* Configurator designs only use the configurator's zones. */}
                  {placementName(e.placement as PlacementId)} —{" "}
                  {e.kind === "text" ? <Ltr>{e.text}</Ltr> : t("configurator.viewer.image")}
                </li>
              );
            })}
          </ul>
        )}

        <span className="jk-cfg-meta text-[9px] tracking-widest2 uppercase text-jk-muted">
          {t("configurator.viewer.unavailable")}
        </span>
      </div>
    </div>
  );
}

/** Thin registration marks at each corner of the stage. */
function FrameCorners() {
  const base = "absolute h-4 w-4 border-fidelio-black/20";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-8">
      <span className={`${base} left-0 top-0 border-l border-t`} />
      <span className={`${base} right-0 top-0 border-r border-t`} />
      <span className={`${base} bottom-0 left-0 border-b border-l`} />
      <span className={`${base} bottom-0 right-0 border-b border-r`} />
    </div>
  );
}

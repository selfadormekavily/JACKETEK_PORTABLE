import { useCatalogNames } from "@/i18n/useCatalogNames";
import { useI18n } from "@/i18n/useI18n";
import { BUTTON_FINISHES, getButtonFinish, ZIPPER_ENABLED } from "../../model/catalog";
import { useConfigurator } from "../../state/context";
import { OptionGroup, SegmentedControl } from "../ui";


/**
 * Closure: the snap finish — and, when enabled, an optional zipper
 * hidden beneath the snap placket (see ZIPPER_ENABLED).
 */
export default function ClosurePanel() {
  const { state, dispatch } = useConfigurator();
  const { buttons } = state.config;
  const { t } = useI18n();
  const names = useCatalogNames();
  const finish = getButtonFinish(buttons);
  const options = BUTTON_FINISHES.map((b) => ({ id: b.id, name: names.buttonFinish(b.id, b.name) }));

  return (
    <div className="flex flex-col gap-8">
      <OptionGroup label={t("configurator.closure.buttons")} value={names.buttonFinish(finish.id, finish.name)}>
        <SegmentedControl
          label={t("configurator.closure.buttonFinishAria")}
          options={options}
          value={buttons}
          onChange={(finish) => dispatch({ type: "setButtons", finish })}
          dense
        />
      </OptionGroup>
      {ZIPPER_ENABLED && <ZipperControls />}
    </div>
  );
}

/** The hidden-zipper option and the open preview (set aside for now). */
function ZipperControls() {
  const { state, dispatch } = useConfigurator();
  const { zipper } = state.config;
  const open = state.ui.jacketOpen;
  const { t } = useI18n();
  const zipperOptions = [
    { id: "off", name: t("configurator.closure.off") },
    { id: "on", name: t("configurator.closure.on") },
  ] as const;
  const jacketOptions = [
    { id: "closed", name: t("configurator.closure.closed") },
    { id: "open", name: t("configurator.closure.open") },
  ] as const;

  return (
    <>
      <OptionGroup
        label={t("configurator.closure.zipper")}
        value={zipper ? t("configurator.closure.zipperValueOn") : t("configurator.closure.zipperValueOff")}
      >
        <SegmentedControl
          label={t("configurator.closure.zipper")}
          options={zipperOptions}
          value={zipper ? "on" : "off"}
          onChange={(id) => dispatch({ type: "setZipper", zipper: id === "on" })}
        />
        <p key={String(zipper)} className="animate-fade-in-up text-xs text-jk-muted">
          {zipper
            ? t("configurator.closure.zipperOnHelp")
            : t("configurator.closure.zipperOffHelp")}
        </p>
      </OptionGroup>

      {zipper && (
        <div className="animate-fade-in-up">
          <OptionGroup
            label={t("configurator.closure.jacket")}
            value={open ? t("configurator.closure.open") : t("configurator.closure.closed")}
          >
            <SegmentedControl
              label={t("configurator.closure.showJacketAria")}
              options={jacketOptions}
              value={open ? "open" : "closed"}
              onChange={(id) => dispatch({ type: "setJacketOpen", open: id === "open" })}
            />
          </OptionGroup>
        </div>
      )}
    </>
  );
}

import type { I18nValue } from "@/i18n/context";
import type { useCatalogNames } from "@/i18n/useCatalogNames";
import { getButtonFinish, getColour, getMaterial } from "../model/catalog";
import { getActiveEmbroidery } from "../model/config";
import type { JacketConfig } from "../model/types";
import type { StepId } from "../state/steps";

type Names = ReturnType<typeof useCatalogNames>;
type Text = Pick<I18nValue, "t" | "tp">;

/** The current value of a step, in the current language (dot: its colour). */
export function summarise(step: StepId, config: JacketConfig, names: Names, { t, tp }: Text): { text: string; hex?: string } {
  switch (step) {
    case "trim": {
      const colour = getColour(config.colours.trim);
      return { text: names.colour(colour.id, colour.name), hex: colour.hex };
    }
    case "closure": {
      const finish = getButtonFinish(config.buttons);
      const name = names.buttonFinish(finish.id, finish.name);
      return {
        text: config.zipper ? t("configurator.summary.withZipper", { finish: name }) : name,
        hex: finish.hex,
      };
    }
    case "body":
    case "sleeves": {
      const colour = getColour(config.colours[step]);
      const material = getMaterial(config.materials[step]);
      return {
        text: t("configurator.summary.colourMaterial", {
          colour: names.colour(colour.id, colour.name),
          material: names.material(material.id, material.name),
        }),
        hex: colour.hex,
      };
    }
    case "embroidery": {
      const count = getActiveEmbroidery(config).length;
      return {
        text: count === 0 ? t("configurator.summary.embroideryNone") : tp("configurator.summary.embroideryCount", count),
      };
    }
    case "review":
      return { text: config.size ? t("configurator.summary.size", { size: config.size }) : "" };
  }
}

import { useMemo } from "react";
import type { TKey } from "@/i18n/context";
import { useCatalogNames } from "@/i18n/useCatalogNames";
import { useI18n } from "@/i18n/useI18n";
import { getMaterial, MATERIALS } from "../../model/catalog";
import type { MaterialZone } from "../../model/types";
import { useConfigurator } from "../../state/context";
import { OptionGroup, SegmentedControl } from "../ui";

const LABELS: Record<MaterialZone, TKey> = {
  body: "configurator.material.bodyLabel",
  sleeves: "configurator.material.sleevesLabel",
};

/**
 * Material for one zone (body or sleeves), independent of its colour and
 * of the other zone: the same garment piece, re-surfaced as leather or
 * felt on the 3D model.
 */
export default function MaterialPanel({ zone }: { zone: MaterialZone }) {
  const { state, dispatch } = useConfigurator();
  const { t } = useI18n();
  const names = useCatalogNames();
  const material = getMaterial(state.config.materials[zone]);
  const options = useMemo(() => MATERIALS.map((m) => ({ id: m.id, name: names.material(m.id, m.name) })), [names]);
  const label = t(LABELS[zone]);

  return (
    <OptionGroup label={label} value={names.material(material.id, material.name)}>
      <SegmentedControl
        label={label}
        options={options}
        value={material.id}
        onChange={(m) => dispatch({ type: "setMaterial", zone, material: m })}
      />
      <p key={material.id} className="animate-fade-in-up text-[13px] leading-[1.5] text-jk-muted">
        {names.materialDescription(material.id, material.description)}
      </p>
    </OptionGroup>
  );
}

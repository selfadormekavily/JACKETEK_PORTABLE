import { useCatalogNames } from "@/i18n/useCatalogNames";
import { getColour, paletteFor, ZONES } from "../../model/catalog";
import type { ColourZone } from "../../model/types";
import { useConfigurator } from "../../state/context";
import { OptionGroup, Swatch } from "../ui";

/**
 * Colour picker for one zone (body, sleeves or trim): the one jacket
 * palette, in the shades of the zone's material (leather for leather,
 * felt for felt and for the rib trim, a knit). A compact grid, each
 * colour named.
 */
export default function ZoneColourPanel({ zone }: { zone: ColourZone }) {
  const { state, dispatch } = useConfigurator();
  const selected = state.config.colours[zone];
  const names = useCatalogNames();
  const material = zone === "trim" ? "rib" : state.config.materials[zone];
  const palette = paletteFor(material);
  const zoneOption = ZONES.find((z) => z.id === zone);
  const description = zoneOption ? names.zoneDescription(zoneOption.id, zoneOption.description) : "";
  const current = getColour(selected);

  return (
    <OptionGroup label={description} value={names.colour(current.id, current.name)}>
      <div role="radiogroup" aria-label={description} className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-x-1 gap-y-4">
        {palette.map((colour) => (
          <Swatch
            key={colour.id}
            labelled
            name={names.colour(colour.id, colour.name)}
            hex={colour.hex}
            selected={selected === colour.id}
            onSelect={() => dispatch({ type: "setColour", zone, colour: colour.id })}
          />
        ))}
      </div>
    </OptionGroup>
  );
}

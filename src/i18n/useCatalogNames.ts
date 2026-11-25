import { useMemo } from "react";
import { useI18n } from "@/i18n/useI18n";
import { paletteBaseId } from "@/features/configurator/model/catalog";

/** A data label as a message key: "Lettering outline" → "letteringOutline". */
export const labelKey = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ""))
    .replace(/^[^a-z]+/, "");

/**
 * Display names for catalog options (configurator, cart, checkout, order),
 * by id. Keys live in the `catalog` namespace:
 *   catalog.product.graduationJacket
 *   catalog.colour.<ColourId>          catalog.thread.<ThreadId>
 *   catalog.palette.<id>   (palette colours "fabric-<id>" / "leather-<id>")
 *   catalog.zone.<zone>.name|description
 *   catalog.material.<MaterialId>.name|description
 *   catalog.buttonFinish.<HardwareFinish>
 *   catalog.placement.<PlacementId>.name|short
 *   catalog.placementGroup.<ZoneGroup>
 *   catalog.font.<fontId>              catalog.fontCategory.<FontCategory>
 *   catalog.colourwaySlot.<slotKey>    catalog.letterStyle.<styleKey>
 *     (keys from the library data's English label: "Lettering outline" → letteringOutline)
 *   catalog.fit.<FitId>.name|description
 *   catalog.view.<CameraView>
 * Each lookup falls back to the English name passed in (the catalog's own
 * data), so a missing key never shows a raw key.
 */
export function useCatalogNames() {
  const { tMaybe } = useI18n();
  return useMemo(() => {
    const get = (key: string, fallback: string) => tMaybe(`catalog.${key}`) ?? fallback;
    return {
      product: (fallback = "Graduation Jacket") => get("product.graduationJacket", fallback),
      colour: (id: string, fallback: string) => {
        const base = paletteBaseId(id);
        return tMaybe(`catalog.colour.${id}`) ?? (base ? tMaybe(`catalog.palette.${base}`) : undefined) ?? fallback;
      },
      // Threads in the jacket palette's colours share its names.
      thread: (id: string, fallback: string) => tMaybe(`catalog.thread.${id}`) ?? tMaybe(`catalog.palette.${id}`) ?? fallback,
      zone: (id: string, fallback: string) => get(`zone.${id}.name`, fallback),
      zoneDescription: (id: string, fallback: string) => get(`zone.${id}.description`, fallback),
      material: (id: string, fallback: string) => get(`material.${id}.name`, fallback),
      materialDescription: (id: string, fallback: string) => get(`material.${id}.description`, fallback),
      buttonFinish: (id: string, fallback: string) => get(`buttonFinish.${id}`, fallback),
      placement: (id: string, fallback: string) => get(`placement.${id}.name`, fallback),
      placementShort: (id: string, fallback: string) => get(`placement.${id}.short`, fallback),
      placementGroup: (id: string, fallback: string) => get(`placementGroup.${id}`, fallback),
      font: (id: string, fallback: string) => get(`font.${id}`, fallback),
      fontCategory: (id: string, fallback: string) => get(`fontCategory.${id}`, fallback),
      colourwaySlot: (label: string) => get(`colourwaySlot.${labelKey(label)}`, label),
      letterStyle: (name: string) => get(`letterStyle.${labelKey(name)}`, name),
      fit: (id: string, fallback: string) => get(`fit.${id}.name`, fallback),
      fitDescription: (id: string, fallback: string) => get(`fit.${id}.description`, fallback),
      view: (id: string, fallback: string) => get(`view.${id}`, fallback),
    };
  }, [tMaybe]);
}

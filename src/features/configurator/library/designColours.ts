import { useEffect, useState } from "react";
import { designColourway, type DesignColourway } from "./colourways";
import { isFrontLettersDesign, lettersColourway } from "./frontLetters";
import type { LibraryDesign } from "./library";

/**
 * Which ready-made designs can have their colours changed — decided by the
 * library's metadata alone (a Front Letters template with colour layers, or
 * a design with a colourway), never by design ids in code. A design without
 * either keeps its own colours and shows no colour controls.
 */
export const colourSlotsOf = (design: Pick<LibraryDesign, "designId" | "libraryId">): Promise<DesignColourway | null> =>
  isFrontLettersDesign(design) ? lettersColourway(design.designId) : designColourway(design.designId);

/** A design's colour slots, when it has any (null: not editable, or still loading). */
export function useDesignColourway(design: Pick<LibraryDesign, "designId" | "libraryId"> | null): DesignColourway | null {
  const designId = design?.designId ?? null;
  const libraryId = design?.libraryId ?? null;
  const [state, setState] = useState<{ id: string; cw: DesignColourway | null } | null>(null);
  useEffect(() => {
    if (!designId || !libraryId) return;
    let live = true;
    colourSlotsOf({ designId, libraryId })
      .catch(() => null)
      .then((cw) => live && setState({ id: designId, cw }));
    return () => {
      live = false;
    };
  }, [designId, libraryId]);
  return designId && state?.id === designId ? state.cw : null;
}

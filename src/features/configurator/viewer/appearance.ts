import { getColour, getThread } from "../model/catalog";
import { getActiveEmbroidery } from "../model/config";
import type { JacketConfig } from "../model/types";
import type { JacketAppearance } from "./types";

/** Maps a JacketConfig to what a renderer needs to paint it. */
export function resolveAppearance(config: JacketConfig): JacketAppearance {
  return {
    surfaces: {
      // Body and sleeves each carry their own chosen material.
      body: { hex: getColour(config.colours.body).hex, finish: config.materials.body },
      sleeves: { hex: getColour(config.colours.sleeves).hex, finish: config.materials.sleeves },
      trim: { hex: getColour(config.colours.trim).hex, finish: "rib" },
    },
    // Fixed zones: every design sits at its zone's centre, fitted into the
    // zone's box — the zone alone sets position and size.
    embroidery: getActiveEmbroidery(config).map((e) => ({
      id: e.id,
      kind: e.kind,
      text: e.text.trim(),
      image: e.image,
      placement: e.placement,
      offset: [0, 0],
      rotation: 0,
      scale: 1,
      threadHex: e.thread ? getThread(e.thread).hex : null,
      ...(e.textStyle ? { textStyle: e.textStyle } : {}),
      ...(e.inZone ? { inZone: e.inZone } : {}),
    })),
    fit: config.fit,
    hardware: config.buttons,
    closure: { zipper: config.zipper },
  };
}

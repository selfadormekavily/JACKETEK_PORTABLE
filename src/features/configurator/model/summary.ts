import { ALL_COLOURS, BUTTON_FINISHES, FITS, getColour, getMaterial, MATERIALS, PLACEMENTS, THREADS } from "./catalog";
import { contentAspect, getActiveEmbroidery } from "./config";
import { clampInZone, LEGACY_ZONES } from "./embroideryGeometry";
import type { EmbroideryElement, JacketConfig } from "./types";

export type DesignField = { label: string; value: string; hex?: string };

/** "Unknown (id)" rather than a silent fallback, for stored designs. */
const lookup = <T extends { id: string; name: string }>(list: readonly T[], id: string | null | undefined) =>
  list.find((x) => x.id === id) ?? null;

/**
 * Every field of a design, readable, for the admin: nothing summarised
 * away (the raw JSON is shown alongside).
 */
export function describeDesign(config: JacketConfig): { title: string; fields: DesignField[] }[] {
  const colour = (label: string, id: string) => {
    const c = lookup(ALL_COLOURS, id);
    return { label, value: c ? `${c.name} (${c.hex})` : `Unknown (${id})`, hex: c?.hex };
  };
  const material = (label: string, id: string) => ({ label, value: lookup(MATERIALS, id)?.name ?? `Unknown (${id})` });
  const finish = lookup(BUTTON_FINISHES, config.buttons);
  const fit = lookup(FITS, config.fit);
  return [
    {
      title: "Size and fit",
      fields: [
        { label: "Size", value: config.size ?? "Not selected" },
        { label: "Fit", value: fit ? `${fit.name} — ${fit.description}` : `Unknown (${config.fit})` },
      ],
    },
    {
      title: "Colours",
      fields: [
        colour("Body", config.colours.body),
        colour("Sleeves", config.colours.sleeves),
        colour("Trim (collar, cuffs, waistband)", config.colours.trim),
      ],
    },
    { title: "Materials", fields: [material("Body", config.materials.body), material("Sleeves", config.materials.sleeves)] },
    {
      title: "Closure",
      fields: [
        { label: "Snaps", value: finish ? `${finish.name} finish (${finish.hex})` : `Unknown (${config.buttons})`, hex: finish?.hex },
        { label: "Hidden zipper", value: config.zipper ? "Yes" : "No" },
      ],
    },
  ];
}

/** Where the content sits inside its fixed zone (size share and offset from the zone centre). */
function placementInArea(e: EmbroideryElement, box: readonly [number, number]) {
  const aspect = contentAspect(e);
  if (!aspect || !e.inZone) return "Fitted to the area, centred (default)";
  const t = clampInZone(box, aspect, e.inZone);
  const at = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)} cm`;
  const size = t.scale >= 0.999 ? "fitted to the area" : `${Math.round(t.scale * 100)} % of the largest that fits`;
  const where = t.x === 0 && t.y === 0 ? "centred" : `centre ${at(t.x * box[0])} across, ${at(t.y * box[1])} up from the area centre (facing the zone)`;
  return `${size} · ${where}`;
}

/** Every stored property of one embroidery element, readable. */
export function describeEmbroidery(e: EmbroideryElement): DesignField[] {
  const thread = e.thread === null ? null : lookup(THREADS, e.thread);
  const [x, y] = e.offset ?? [0, 0];
  const cm = (m: number) => `${m >= 0 ? "+" : "−"}${Math.abs(m * 100).toFixed(1)} cm`;
  const zone = lookup(PLACEMENTS, e.placement);
  // Orders placed before the fixed zones stored a free position.
  const free = x !== 0 || y !== 0 || (e.rotation ?? 0) !== 0 || (e.scale ?? 1) !== 1;
  return [
    { label: "Placement", value: zone?.name ?? LEGACY_ZONES[e.placement]?.name ?? `Unknown (${e.placement})` },
    ...(zone ? [{ label: "Zone area", value: `${(zone.box[0] * 100).toFixed(1)} × ${(zone.box[1] * 100).toFixed(1)} cm (fixed; the design stays inside it)` }] : []),
    ...(zone && !free ? [{ label: "Placement in area", value: placementInArea(e, zone.box) }] : []),
    { label: "Type", value: e.kind === "text" ? "Text" : e.image?.library ? "Ready-made library design" : "Uploaded image" },
    ...(e.image?.library
      ? [{
          label: "Library design",
          value: `${e.image.library.libraryTitle}${e.image.library.productionName ? ` (code ${e.image.library.productionName})` : ""} · ${e.image.library.originalFileName ?? "—"} · ${e.image.library.id}`,
        }]
      : []),
    ...(e.image?.colourway
      ? [{
          label: "Colours",
          value: e.image.colourway.slots
            .map((s) => {
              const chosen = e.image!.colourway!.colours[s.id];
              const t = lookup(THREADS, chosen ?? s.defaultThread ?? "");
              return `${s.label}: ${t ? `${t.name} (${t.hex})${chosen ? "" : " — as designed"}` : `original (${s.defaultColor})`}`;
            })
            .join(" · "),
        }]
      : []),
    ...(e.image?.frontLetters
      ? [{ label: "Front letters", value: `${e.image.frontLetters.letter1} ${e.image.frontLetters.letter2} · ${e.image.frontLetters.style} · template ${e.image.frontLetters.templateId}` }]
      : []),
    ...(e.kind === "text" ? [{ label: "Text", value: e.text || "(empty — not stitched)" }] : []),
    ...(e.textStyle
      ? [
          { label: "Font", value: `${e.textStyle.fontName} (${e.textStyle.fontId})${e.textStyle.fallbackFontIds.length ? ` + ${e.textStyle.fallbackFontIds.join(", ")} for other scripts` : ""}` },
          { label: "Text layout", value: `${e.textStyle.direction === "rtl" ? "Right-to-left" : "Left-to-right"} · lines centred · fitted to ${Math.round(e.textStyle.fitScale * 100)}% of the zone height` },
          ...(e.physicalSize ? [{ label: "Text size", value: `${e.physicalSize.widthCm} × ${e.physicalSize.heightCm} cm` }] : []),
        ]
      : []),
    ...(e.kind === "image" && e.image ? [{ label: "Image aspect", value: e.image.aspect.toFixed(2) }] : []),
    {
      label: "Thread",
      value: e.thread === null ? "Original artwork colours" : thread ? `${thread.name} (${thread.hex})` : `Unknown (${e.thread})`,
      hex: thread?.hex,
    },
    ...(free
      ? [
          { label: "Offset from zone centre", value: `x ${cm(x)}, y ${cm(y)}` },
          { label: "Rotation", value: `${e.rotation}°` },
          { label: "Scale", value: `×${e.scale.toFixed(2)} of the zone default` },
        ]
      : []),
    { label: "Stitch", value: e.style },
  ];
}

/**
 * A compact, customer-facing summary of a design (cart, checkout,
 * confirmation). The full design stays in the config itself.
 */
export function summariseDesign(config: JacketConfig): { label: string; value: string }[] {
  const zone = (z: "body" | "sleeves") =>
    `${getColour(config.colours[z]).name} · ${getMaterial(config.materials[z]).name}`;
  return [
    { label: "Size", value: config.size ?? "Not selected" },
    { label: "Body", value: zone("body") },
    { label: "Sleeves", value: zone("sleeves") },
    { label: "Embroidery", value: getActiveEmbroidery(config).length ? "Customised" : "None" },
  ];
}

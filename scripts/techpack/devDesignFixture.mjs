// TEST-ONLY design for the development tech pack tests (scripts/techpack/rfq.test.mjs). Not the
// acceptance design: the final proof is a design made by hand on the website.
// Built the way the configurator builds a design (library/library.ts libraryImage()), from real
// entries of the embroidery library, so library resolution, Front Letters and colourways are exercised.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LAYERS_DIR, LIBRARY_DIR } from "../../server/embroideryLibrary.mjs";
import { encodePng } from "../../server/png.mjs";

const lib = JSON.parse(readFileSync(join(LIBRARY_DIR, "library.json"), "utf8"));
const firstIn = (code, zone) => lib.designs.find((d) => d.productionName === code && d.zones.includes(zone));
const ref = (d) => ({ id: d.id, designId: d.designId, libraryId: d.libraryId, libraryTitle: d.libraryTitle, productionName: d.productionName, originalFileName: d.originalFileName, asset: d.asset, thumbnail: d.thumbnail, source: { provider: d.source?.provider ?? "ojisan", placements: d.source?.placements ?? [] } });
export const libraryImage = (d) => ({ src: d.asset, aspect: d.width / d.height, asUploaded: true, original: { fileName: d.originalFileName ?? `${d.designId}.${d.format}`, mimeType: d.format === "png" ? "image/png" : `image/${d.format}`, widthPx: d.width, heightPx: d.height }, library: ref(d) });

/** A small PNG (a filled disc) as a data URL. */
export function png(w, h, rgb) {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set((x - w / 2) ** 2 + (y - h / 2) ** 2 < (Math.min(w, h) / 2.2) ** 2 ? [...rgb, 255] : [0, 0, 0, 0], (y * w + x) * 4);
  return `data:image/png;base64,${encodePng({ width: w, height: h, data }).toString("base64")}`;
}

/** A back design with colour layers (colourway) on this server, or null. */
const layered = lib.designs.find((d) => d.productionName === "AQ" && d.zones.includes("mainBack") && existsSync(join(LAYERS_DIR, "colourways", d.designId, "colourway.json")));
const backColourway = layered ? JSON.parse(readFileSync(join(LAYERS_DIR, "colourways", layered.designId, "colourway.json"), "utf8")) : null;

export const FIXTURE_DESIGNS = {
  back: layered,
  frontLetters: firstIn("F", "leftChest"),
  number: firstIn("BC", "rightSleeveUpper"),
  patch: firstIn("AB", "leftSleeveMiddle"),
};

/** A complete design: Front Letters, sleeve number, sleeve patch, an upload and two lines of text. */
export function devDesign(size = "L") {
  const { frontLetters: fl, number: num, patch } = FIXTURE_DESIGNS;
  const el = (id, placement, extra) => ({ id, kind: "image", text: "", placement, offset: [0, 0], rotation: 0, scale: 1, style: "satin", thread: null, ...extra });
  return {
    colours: { body: "fabric-burgundy", sleeves: "leather-black", trim: "fabric-white" },
    materials: { body: "felt", sleeves: "leather" },
    buttons: "gold",
    zipper: false,
    size,
    fit: "relaxed",
    embroidery: [
      el("fx-fl", "leftChest", { inZone: { scale: 0.85, x: 0.04, y: -0.03 }, image: { ...libraryImage(fl), src: png(64, 64, [200, 160, 60]), frontLetters: { type: "front-letters", templateId: fl.designId, libraryId: fl.libraryId, letter1: "J", letter2: "K", style: "Brush script", templateVersion: 1 } } }),
      el("fx-num", "rightSleeveUpper", { inZone: { scale: 0.75, x: 0, y: 0 }, image: libraryImage(num) }),
      el("fx-patch", "leftSleeveMiddle", { inZone: { scale: 1, x: 0, y: 0 }, image: libraryImage(patch) }),
      el("fx-up", "rightChest", { inZone: { scale: 0.6, x: -0.1, y: 0.08 }, image: { src: png(48, 48, [30, 90, 200]), aspect: 1, processed: { widthPx: 48, heightPx: 48 }, original: { src: png(48, 48, [30, 90, 200]), fileName: "fixture-logo.png", mimeType: "image/png", widthPx: 48, heightPx: 48 } } }),
      ...(layered
        ? [el("fx-back", "mainBack", { inZone: { scale: 0.9, x: 0, y: 0.05 }, image: { ...libraryImage(layered), src: png(60, 64, [240, 240, 240]), colourway: { type: "colourway", designId: layered.designId, colourwayVersion: backColourway.version, colours: { [backColourway.slots[0].id]: "gold" }, slots: backColourway.slots.map((x) => ({ id: x.id, label: x.label, ...(x.key ? { key: x.key } : {}), defaultColor: x.defaultColor, ...(x.defaultThread ? { defaultThread: x.defaultThread } : {}) })) } } })]
        : []),
      { id: "fx-text", kind: "text", text: "CLASS OF\r\n2027", placement: "backQuote", offset: [0, 0], rotation: 0, scale: 1, style: "satin", thread: "red", image: null, textStyle: { fontId: "montserrat", fontName: "Montserrat", fallbackFontIds: [], alignment: "center", direction: "ltr", aspect: 3.1, fitScale: 0.8 } },
    ],
  };
}

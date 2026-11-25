// Front Letters — each of the 20 templates' style: its family, its stroke
// parameters (design units, cap height 1000) — the measurable ones fitted to the
// template's own A at build time (`fit`: parameter → search step) — and its
// treatment (how the A's colours / outlines / texture are carried over).
/* global window */
"use strict";

(() => {
  const FL = window.FL;
  const FIT = { T: 40, t: 30, bar: 30, barY: 40, wide: 0.08, apex: 40, sl: 25, sh: 25, apexShift: 30 };

  const western = {
    id: "western-shadow", name: "Western shadow", family: "roman", treatment: "shadow", approximation: true,
    notes: "Letter shapes fit the A closely; the offset outline shadow is a fitted model of the A's shadow (shift, line width, gap), not traced.",
    P: { T: 300, t: 200, bar: 150, barY: 560, sh: 70, sl: 50, serif: "flare", br: 50, wide: 0.75, apex: 180, apexSerif: 30, apexSerifR: 30, apexH: 60, apexShift: 0, beak: 0.35 },
    fit: { ...FIT, br: 20, apexSerif: 20, apexSerifR: 20 },
  };
  const stencil = {
    id: "stencil-slab", name: "Stencil slab", family: "roman", treatment: "flat",
    P: { T: 260, t: 90, bar: 100, barY: 640, sh: 80, sl: 70, serif: "round", br: 50, wide: 0.9, apex: 140, apexSerif: 60, apexH: 80, apexShift: 0, stencil: 26, beak: 0.3 },
    fit: { ...FIT, br: 20, apexSerif: 25 },
  };
  const clarendon = {
    id: "clarendon", name: "Bracketed serif", family: "roman", treatment: "flat",
    P: { T: 280, t: 120, bar: 90, barY: 560, sh: 60, sl: 80, serif: "bracket", br: 60, wide: 1.1, apex: 120, apexShift: 0, beak: 0.3 },
    fit: { ...FIT, br: 25 },
  };
  const collegiate = { T: 280, t: 230, bar: 170, barY: 600, sh: 170, sl: 60, serif: "slab", corner: 30, wide: 1.0, apex: 300, apexSerif: 40, apexSerifR: 40, apexH: 170, apexShift: 0, beak: 0.4, beakW: 170, qTail: 1000 };
  const collegiateFit = { ...FIT, apexSerif: 25, apexSerifR: 25, apexH: 25, corner: 10 };
  const patch = (id, name) => ({ id, name, family: "roman", treatment: "patch", texture: true, textureDepth: 40, P: { ...collegiate }, fit: collegiateFit });

  const brush = { id: "brush-script", name: "Brush script", family: "brush", treatment: "flat", P: {} };
  const pixel = { id: "pixel", name: "Pixel block", family: "pixel", treatment: "flat", P: { cell: 116 }, fit: { cell: 6 } };
  const copperplate = {
    id: "copperplate", name: "Copperplate script", family: "copperplate", treatment: "flat", approximation: true,
    notes: "Hairline/shaded script capitals drawn to the A's slant, hairline, shade and ball terminals; the most freehand of the families.",
    // Hairline fixed from the A (≈11 px at its scale); the rest fitted.
    P: { slant: 0.48, hair: 17, shade: 120, ball: 50, wide: 1.0 },
    fit: { slant: 0.06, shade: 20, ball: 10, wide: 0.08 },
  };

  FL.TEMPLATE_STYLES = {
    "1.webp": brush,
    "2.webp": brush,
    "3.webp": pixel,
    "4.webp": pixel,
    "7.webp": copperplate,
    "8.webp": copperplate,
    "9.webp": western,
    "10.webp": western,
    "11.webp": stencil,
    "12.webp": stencil,
    "15.webp": clarendon,
    "16.webp": clarendon,
    "19.webp": { id: "collegiate-name", name: "Collegiate with name", family: "roman", treatment: "flat", band: true, P: { ...collegiate, corner: 0, band: true }, fit: collegiateFit },
    "20.webp": {
      id: "serif-name", name: "Serif with name", family: "roman", treatment: "flat", band: true, approximation: true,
      notes: "Only the top and the feet of the A show around the name, so the letters' middle (bars, bowls) is built from the serif style, not measured.",
      P: { T: 210, t: 70, bar: 70, barY: 600, sh: 50, sl: 90, serif: "bracket", br: 70, wide: 0.95, apex: 60, apexShift: 0, beak: 0.3 },
      fit: { ...FIT, br: 25 },
    },
    "25.webp": { id: "collegiate-outline", name: "Collegiate outline", family: "roman", treatment: "ring", P: { ...collegiate }, fit: collegiateFit },
    "26.webp": { id: "collegiate-outline", name: "Collegiate outline", family: "roman", treatment: "ring", P: { ...collegiate }, fit: collegiateFit },
    "21.png": patch("patch-black", "Felt patch — black"),
    "22.png": patch("patch-black", "Felt patch — black"),
    "23.png": patch("patch-grey", "Felt patch — grey"),
    "24.png": patch("patch-grey", "Felt patch — grey"),
  };
})();

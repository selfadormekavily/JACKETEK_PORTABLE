// EMBROIDERY ZONE RATIOS — a zone's approved normalised placement (spec
// configuratorReference.normalised, from embroideryGeometry.ts normalisedZone) described
// in garment landmarks for a factory, plus how it becomes centimetres once the garment is
// calibrated. NORMALIZED PLACEMENT — NOT PHYSICAL SIZE: nothing here is a measurement.
//
// Body:   u = centre from the CF / CB line ÷ half body width at the waistband (+ = wearer's
//         left); v = HPS → centre ÷ HPS → waistband top; h = height ÷ HPS → waistband top;
//         W:H = the box's own proportions (width = height × W:H). The box spans v ± h/2 down.
// Sleeve: s = shoulder point → centre ÷ shoulder point → cuff seam (along the sleeve);
//         h = height ÷ shoulder point → cuff seam; W:H = the box's own proportions (width =
//         height × W:H); centred across the sleeve's outer face.

/** Up to 4 decimals (the stored precision), at least 3: 0.43 → "0.430", 0.8125 → "0.8125". */
const r3 = (n) => {
  const s = (Math.round(n * 10000) / 10000).toFixed(4);
  return s.endsWith("0") ? s.slice(0, -1) : s;
};
const pct = (n) => `${Math.round(n * 1000) / 10}%`;

/**
 * The garment dimensions each unit needs before a zone can be stated in cm — all still
 * unmeasured POMs of the master spec, so physical values stay null until the M sample.
 */
export const CALIBRATION = {
  body: {
    vertical: { unit: "HPS → waistband top", needs: ["B07", "R01"], formula: "B07 − R01", note: "Back length from HPS minus waistband rib height (both measured on the M sample)." },
    horizontal: { unit: "body width at the waistband (flat) — zone centre only", needs: ["B03"], formula: "B03 ÷ 2", note: "B03 is recorded as a circumference (side to side × 2); the flat width is half of it. Zone widths follow from their heights (W:H), so they need no width POM." },
  },
  sleeve: {
    along: { unit: "shoulder point → cuff seam", needs: ["S02", "S09"], formula: "S02 − S09", note: "Overarm sleeve length minus cuff rib height." },
    across: { unit: "zone width = zone height × W:H", needs: ["S02", "S09"], formula: "W:H × h × (S02 − S09)", note: "The box keeps its proportions, so its width follows from its height; no sleeve-width POM is needed." },
  },
  status: "NOT CALIBRATED — the POMs above are TO_MEASURE_ON_SAMPLE; no provisional garment value covers these units, so no cm is derived.",
};

/** Normalised values and landmark wording for one spec zone. */
export function zoneRatios(zone) {
  const n = zone.configuratorReference?.normalised;
  if (!n) return null;
  if (n.kind === "sleeve") {
    const top = n.s - n.h / 2, bottom = n.s + n.h / 2;
    return {
      kind: "sleeve",
      centre: `s ${r3(n.s)} · centred across`,
      centreLines: [`s ${r3(n.s)}`, "centred"],
      width: `W:H ${r3(n.aspect)}`,
      height: r3(n.h),
      landmarks: [
        `Centre ${pct(n.s)} of the way from the shoulder point to the cuff seam, on the sleeve's outer face`,
        `Box from ${pct(top)} to ${pct(bottom)} of shoulder point → cuff seam`,
        `Width = height × ${r3(n.aspect)} (the box's proportions on the website), centred across the sleeve`,
      ],
      reference: "Shoulder point, cuff seam (along and size); box proportions W:H",
      formulas: {
        centreBelowSP: `${r3(n.s)} × (${CALIBRATION.sleeve.along.formula})`,
        height: `${r3(n.h)} × (${CALIBRATION.sleeve.along.formula})`,
        width: `${r3(n.aspect)} × ${r3(n.h)} × (${CALIBRATION.sleeve.along.formula})`,
      },
    };
  }
  const top = n.v - n.h / 2, bottom = n.v + n.h / 2;
  const line = zone.side === "back" ? "CB" : "CF";
  const side = n.u > 0 ? "wearer's left" : "wearer's right";
  const across = n.u === 0
    ? `Centred on the ${line} line`
    : `Centre ${pct(Math.abs(n.u))} of the half body width from the ${line} line (${side})`;
  return {
    kind: "body",
    centre: `u ${n.u > 0 ? "+" : ""}${r3(n.u)} · v ${r3(n.v)}`,
    centreLines: [`u ${n.u > 0 ? "+" : ""}${r3(n.u)}`, `v ${r3(n.v)}`],
    width: `W:H ${r3(n.aspect)}`,
    height: r3(n.h),
    landmarks: [across, `Centre ${pct(n.v)} of HPS → waistband top; box from ${pct(top)} to ${pct(bottom)}`, `Width = height × ${r3(n.aspect)} (the box's proportions on the website)`],
    reference: `HPS, waistband top (vertical and size); ${line} line, body width at the waistband (centre across); box proportions W:H`,
    formulas: {
      centreBelowHPS: `${r3(n.v)} × (${CALIBRATION.body.vertical.formula})`,
      centreFromCentreLine: `${r3(Math.abs(n.u))} × (${CALIBRATION.body.horizontal.formula}) ÷ 2`,
      width: `${r3(n.aspect)} × ${r3(n.h)} × (${CALIBRATION.body.vertical.formula})`,
      height: `${r3(n.h)} × (${CALIBRATION.body.vertical.formula})`,
    },
  };
}

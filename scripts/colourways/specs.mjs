// Colourway mappings, per design (Phase 1: back designs of Groups A and A+, from the
// colour investigation). Each slot lists the colours of its region as sampled from the
// artwork ("prototypes": the thread colour and its shading). Pixels near no slot's
// prototypes stay as they are (keep original); the build fails if such an unmapped
// colour is significant, unless it is listed in `acknowledgedKeep` after review.
// Slot ids are stable (stored in orders): color1, color2, color3.

// White / light thread under stitch shading (lightness ≈ 58–98).
const WHITE = ["#f6f2f1", "#e8e2e1", "#d9d1d0", "#c7bfbe", "#b3abaa", "#9d9594", "#8a8281"];
const outer = (protos = WHITE) => ({ id: "color1", label: "Outer", role: "Outer border (and white lettering)", protos });
const inner = (...protos) => ({ id: "color2", label: "Inner", role: "Inner fill (main numbers and lettering)", protos });
const RED = ["#990000", "#8a0000"];
const BRICK = ["#a4261f", "#951f19"];
const NAVY = ["#000080", "#000099", "#020281"];
const BLACK_OUTLINE = { id: "color3", label: "Lettering outline", role: "Top lettering (black)", protos: ["#342b2a", "#2b2221", "#1f1918", "#43393a", "#554a49"] };

export const COLOURWAY_SPECS = [
  { file: "3.PNG", id: "31392f23", slots: [outer(), inner(...RED)] },
  { file: "4.PNG", id: "ebaa2c77", slots: [outer(), inner(...RED)] },
  { file: "5.PNG", id: "cfc84bb3", slots: [outer(), inner(...RED)] },
  { file: "6.PNG", id: "1ea5e736", slots: [outer(), inner(...RED)] },
  // The "Class of" script is shaded red thread: it follows the fill.
  { file: "7.PNG", id: "b1efbefd", slots: [outer(), inner(...RED, "#a52d2c", "#8c2322", "#c04a48")] },
  { file: "15.PNG", id: "1a75c4ba", slots: [outer(), inner(...BRICK)] },
  // The Arabic script is shaded red thread: it follows the fill.
  { file: "16.PNG", id: "160f6620", slots: [outer(), inner(...RED, "#a23d39", "#86302c", "#c05a55")] },
  // The graduation-cap tassel is a separate gold thread: it stays as it is.
  { file: "17.PNG", id: "f1d7761b", slots: [outer(), inner(...BRICK)], acknowledgedKeep: [{ colour: "#8b5f30", maxShare: 0.008 }] },
  { file: "27.PNG", id: "84c51494", slots: [outer(), inner(...BRICK)] },
  // Shaded red details follow the fill.
  { file: "29.PNG", id: "8ba8a6cf", slots: [outer(), inner(...RED, "#953731", "#7d2a25", "#b04a44")] },
  // Rose-tinted border thread; the bow and its shadows are shaded red: they follow the fill.
  { file: "31.PNG", id: "405d58bd", slots: [outer(["#f3e3e1", "#e2c8c5", "#d0aeab", "#c39a97", "#b08784", "#9c7471"]), inner(...BRICK, "#631d19", "#7e2722", "#922d27")] },
  { file: "36.PNG", id: "9f559133", slots: [outer(), inner(...BRICK)] },
  // A small shaded-navy detail follows the fill.
  { file: "54.PNG", id: "3f173168", slots: [outer(), inner(...NAVY, "#22217a", "#1a1960", "#33328f")] },
  { file: "57.PNG", id: "f992bec3", slots: [outer(), inner("#333399", "#2a2a85")] },
  { file: "59.PNG", id: "e0debea2", slots: [outer(), inner(...NAVY)] },
  { file: "60.PNG", id: "d6d9b284", slots: [outer(), inner(...NAVY)] },
  // The "Class of" script is shaded blue thread: it follows the fill.
  { file: "62.PNG", id: "f77843f3", slots: [outer(), inner(...NAVY, "#2e2c9b", "#24227f", "#4846b5")] },
  { file: "64.PNG", id: "cab66290", slots: [outer(), inner(...NAVY)] },
  // Shaded blue details (cap, small lettering) follow the fill.
  { file: "67.PNG", id: "472f1e9c", slots: [outer(), inner(...NAVY, "#282696", "#1f1d7a", "#4240b0")] },
  // A+: a third region — the black outline of the top lettering.
  { file: "8.PNG", id: "0cf53afd", slots: [outer(), inner(...RED), BLACK_OUTLINE] },
  { file: "9.PNG", id: "9e1a8fac", slots: [outer(), inner(...RED), BLACK_OUTLINE] },
];

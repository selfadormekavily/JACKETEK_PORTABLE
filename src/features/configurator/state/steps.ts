import type { CameraView, ColourZone } from "../model/types";

export type StepId =
  | "body"
  | "sleeves"
  | "trim"
  | "closure"
  | "embroidery"
  | "review";

type StepDefinition = {
  id: StepId;
  index: string;
  name: string;
  /** Camera angle the viewer turns to when this section opens. */
  view: CameraView;
  /** Colour zone this section edits, if any. */
  zone?: ColourZone;
};

export const STEPS: readonly StepDefinition[] = [
  { id: "body", index: "01", name: "Body", view: "front", zone: "body" },
  // Body and sleeves: colour and material (leather / felt) together.
  { id: "sleeves", index: "02", name: "Sleeves", view: "threeQuarter", zone: "sleeves" },
  { id: "trim", index: "03", name: "Trim", view: "front", zone: "trim" },
  // Snap finish, and the zipper hidden under the placket.
  { id: "closure", index: "04", name: "Closure", view: "front" },
  // Embroidery turns to the selected placement instead (see reducer).
  { id: "embroidery", index: "05", name: "Embroidery", view: "front" },
  { id: "review", index: "06", name: "Review", view: "threeQuarter" },
];

export const getStep = (id: StepId) =>
  STEPS.find((s) => s.id === id) ?? STEPS[0];

export const getStepPosition = (id: StepId) =>
  STEPS.findIndex((s) => s.id === id);

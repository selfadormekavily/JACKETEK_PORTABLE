/**
 * THE MANUFACTURING SPEC — the versioned contract between a stored design
 * (an order line) and every factory document made from it (today: the RFQ
 * Tech Pack PDF). The PDF is rendered from this JSON only, never from
 * configurator state.
 *
 * Every manufacturing value is a Field (provenance.ts): value, unit, status,
 * source, approved.
 */
import type { NormalisedZone } from "@/features/configurator/model/embroideryGeometry";
import type { Field, Status } from "./provenance";

export const SPEC_SCHEMA = "jacketek.manufacturingSpec";
export const SPEC_VERSION = "0.1.0";

export type DocumentType = "RFQ_TECH_PACK";
export type SizeId = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export type ManufacturingSpec = {
  meta: {
    schema: typeof SPEC_SCHEMA;
    specVersion: typeof SPEC_VERSION;
    documentType: DocumentType;
    documentStatus: "NOT_FOR_BULK_PRODUCTION";
    /** Shown on every page and in the PDF metadata. */
    statusBanner: "RFQ — NOT FOR BULK PRODUCTION";
    styleId: string;
    /** Stable id of the design (hash of its customisation): the same design → the same id. */
    designId: string;
    orderId: string | null;
    orderLine: number | null;
    /** "RFQ-01", "RFQ-02"… */
    revision: string;
    createdAt: string;
    language: "en";
    masterSpec: { file: string; title: string; revision: string; sha256: string | null; productionApproved: boolean };
    generator: string;
  };
  style: {
    name: string;
    productType: string;
    category: string;
    fit: Field<string>;
    silhouette: {
      primaryReference: Field<string>;
      secondaryVisualReference: Field<string>;
      techPackStructureReference: string;
    };
    sampleStatus: string;
    requestedSampleSize: Field<string>;
    quantityOnOrder: Field<number>;
  };
  documentStatus: { code: "NOT_FOR_BULK_PRODUCTION"; banner: string; productionApproved: false; statement: string };
  garment: {
    size: Field<string>;
    fit: Field<string>;
    bodyMaterial: Field<string>;
    sleeveMaterial: Field<string>;
    shoulderConstruction: Field<string>;
    closure: { type: Field<string>; snapFinish: Field<string>; snapCount: Field<number>; zipper: Field<string> };
  };
  measurements: {
    unit: "cm";
    baseSize: SizeId;
    sizes: SizeId[];
    poms: Pom[];
    provisionalTargets: ProvisionalTarget[];
    secondaryBenchmark: { label: string; status: Status; note: string; values: { measurement: string; value: number; unit: string; method: string }[] };
    methodAmbiguities: { id: string; pomId: string; title: string; detail: string }[];
  };
  grading: {
    kind: "REFERENCE_PROVISIONAL";
    label: string;
    productionApproved: false;
    note: string;
    rules: { pomId: string; name: string; perSize: Field<number> }[];
  };
  materials: BomItem[];
  colourway: ColourEntry[];
  construction: ConstructionItem[];
  trims: string[];
  labels: BomItem[];
  embroideryZones: ZoneSpec[];
  artwork: ArtworkItem[];
  quotationRequirements: {
    currency: Field<string>;
    priceBreaks: number[];
    requested: { id: string; item: string; value: Field<string> }[];
    notes: string[];
  };
  conflicts: { id: string; topic: string; detail: string }[];
  revisionHistory: { revision: string; date: string; specVersion: string; summary: string }[];
  validation: ValidationResult | null;
};

export type Pom = {
  id: string;
  area: string;
  name: string;
  nameAr: string;
  method: string;
  start: string;
  end: string;
  condition: string;
  /** Per size. */
  values: Record<SizeId, Field<number>>;
  tolerance: Field<number>;
  notes: string[];
};

export type ProvisionalTarget = { measurement: string; relatedPom: string; field: Field<number>; method: string };

export type BomItem = {
  id: string;
  category: string;
  component: string;
  placement: string;
  material: Field<string>;
  colour: Field<string>;
  specification: Field<string>;
  supplier: Field<string>;
  notes: string[];
};

export type ColourEntry = {
  role: string;
  colourId: Field<string>;
  name: string | null;
  hex: string | null;
  material: string | null;
  /** Physical reference (Pantone / thread code): only once a supplier confirms it. */
  physicalReference: Field<string>;
};

export type ConstructionItem = { id: string; operation: string; fieldsRequired: string; value: Field<string>; notes: string[] };

export type ZoneSpec = {
  zoneId: string;
  zoneName: string;
  productionKey: string;
  garmentPanel: string;
  /** What the zone takes on the website. */
  allowedContent: "DESIGN_OR_TEXT" | "TEXT_ONLY" | "DESIGN_ONLY";
  side: "front" | "back" | "leftSleeve" | "rightSleeve";
  physicalAnchorPrimary: string;
  physicalAnchorSecondary: string;
  zoneWidthCm: Field<number>;
  zoneHeightCm: Field<number>;
  anchorOffsetXCm: Field<number>;
  anchorOffsetYCm: Field<number>;
  gradedBySize: Field<boolean>;
  /** The configurator's zone on its 3D reference model: drawing position and normalised frame only — not physical. */
  configuratorReference: {
    status: "SYSTEM_DERIVED";
    note: string;
    boxCm: [number, number];
    centreFromCentreLineCm: number;
    centreBelowAnchorCm: number;
    anchor: "HPS" | "SP";
    /** The zone relative to garment landmarks (embroideryGeometry.ts normalisedZone): what the drawing places. Shares, not measurements. */
    normalised: NormalisedZone;
  };
  used: boolean;
  status: Status;
  approved: false;
};

export const ARTWORK_TYPES = ["READY_MADE", "FRONT_LETTERS", "TEXT", "UPLOAD", "NUMBER_YEAR", "CREST", "OTHER_LIBRARY_DESIGN"] as const;
export type ArtworkType = (typeof ARTWORK_TYPES)[number];

export type ThreadRef = { role: string; threadId: Field<string>; name: string | null; hex: string | null; asDesigned: boolean };

export type ArtworkItem = {
  artworkId: string;
  elementId: string;
  artworkType: ArtworkType;
  zoneId: string;
  zoneName: string;
  source: {
    kind: "library" | "front-letters" | "upload" | "text";
    libraryId: string | null;
    libraryCode: string | null;
    libraryTitle: string | null;
    libraryTitleEn: string | null;
    designId: string | null;
    originalFileName: string | null;
  };
  /** Files in the tech pack folder (relative), written by the server. */
  files: { artwork: string | null; original: string | null };
  pixelSize: { width: number; height: number } | null;
  aspect: number;
  colourMode: "ORIGINAL" | "CUSTOM";
  threads: ThreadRef[];
  text: null | {
    content: string;
    lines: string[];
    lineCount: number;
    characterCount: number;
    font: string;
    fontId: string;
    fallbackFonts: string[];
    direction: "ltr" | "rtl";
    alignment: "center";
  };
  frontLetters: null | { letter1: string; letter2: string; style: string; templateId: string };
  placement: {
    status: "PENDING_MASTER_ZONE_DIMENSIONS" | "PHYSICAL_FROM_MASTER_ZONE";
    label: string;
    normalizedScale: number;
    normalizedOffsetX: number;
    normalizedOffsetY: number;
    anchorReference: string;
    finishedWidthCm: Field<number>;
    finishedHeightCm: Field<number>;
    physicalOffsetXCm: Field<number>;
    physicalOffsetYCm: Field<number>;
    /** The size the configurator's 3D preview showed — a visual estimate, NOT a production measurement (not printed in the RFQ). */
    configuratorSizeCm: Field<[number, number]>;
    rotationDeg: Field<number>;
  };
  productionTechnique: Field<string>;
  approved: false;
};

export type Severity = "ERROR" | "WARNING" | "INFO";
export type Issue = { severity: Severity; code: string; path: string; message: string };
export type ValidationResult = { ok: boolean; errors: Issue[]; warnings: Issue[]; info: Issue[] };

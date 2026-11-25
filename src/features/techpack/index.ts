/**
 * JACKETEK Manufacturing Spec — the contract between a stored design and the
 * factory documents made from it (RFQ Tech Pack today; Production Tech Pack
 * later). Server-side only (compiled for Node by server/tsModule.mjs).
 */
export { buildManufacturingSpec, STYLE_ID, type BuildInput } from "./build";
export { MASTER_SCHEMA, type MasterSpec } from "./master";
export { OPEN_STATUSES, OPEN_WORDING, STATUSES, VALUE_STATUSES, type Field, type Status } from "./provenance";
export { ARTWORK_TYPES, SPEC_SCHEMA, SPEC_VERSION, type ArtworkItem, type ManufacturingSpec, type ValidationResult, type ZoneSpec } from "./types";
export { validateManufacturingSpec, type ValidateOptions } from "./validate";

/**
 * Public API of the configurator feature. Code outside this folder
 * should import from here, not from internal files.
 */
export { default as ConfiguratorProvider } from "./state/ConfiguratorProvider";
export type { DraftPersistence } from "./state/ConfiguratorProvider";
export { default as ConfiguratorShell } from "./components/ConfiguratorShell";
export { useConfigurator } from "./state/context";
export { describeDesign, describeEmbroidery, summariseDesign } from "./model/summary";
export { getColour } from "./model/catalog";
export type { DesignField } from "./model/summary";
export { takeSnapshot, registerSnapshot } from "./viewer/snapshot";
export type * from "./model/types";
export type * from "./viewer/types";

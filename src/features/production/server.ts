/**
 * Everything the Node server (server/) uses from the website's source,
 * in one entry: compiled for Node on demand (server/tsModule.mjs), never
 * imported by the browser app.
 */
export { orderToProductionOrder, productionPdfName } from "./orderToProductionOrder";
export { PRICING } from "@/features/cart/pricing";
export { GROUP_PRICING, quoteGroup } from "@/features/cart/groupPricing";
export { MAX_QUANTITY, PRODUCT } from "@/features/cart/types";
export { summariseDesign } from "@/features/configurator/model/summary";
export { digitizeJob, embroideryJobs } from "@/features/embroidery/fromOrder";
export { decodeDst, encodeDst } from "@/features/embroidery/dst";
export { stitchPreviewSvg } from "@/features/embroidery/preview";
export { packStitches, unpackStitches } from "@/features/embroidery/stitchData";
export { colourSections, colourSeparationSvg, digitizingDetailSvg, digitizingMapSvg, mapCellMm, pickDetailWindow, verifyAgainstDst } from "@/features/embroidery/stitchMap";
export { DIGITIZER_ENGINE, DIGITIZING_STATUS } from "@/features/embroidery/types";
export { EMBROIDERY_FONTS, fontStack, getEmbroideryFont } from "@/features/embroidery/fonts/fontLibrary";
export { ALL_COLOURS, BUTTON_FINISHES, FITS, MATERIALS, SIZES, THREADS } from "@/features/configurator/model/catalog";
export { buildManufacturingSpec, MASTER_SCHEMA, OPEN_WORDING, STATUSES, validateManufacturingSpec } from "@/features/techpack";
export { EMBROIDERY_ZONES_BY_ID, LEGACY_ZONES, REFERENCE_HPS_Y, REFERENCE_SP_Y, TEXT_MAX_CHARS, TEXT_MAX_LINES } from "@/features/configurator/model/embroideryGeometry";

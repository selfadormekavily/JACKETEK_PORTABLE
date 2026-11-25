/**
 * Where the embroidery library is served: one URL prefix, stable because
 * orders store library paths under it ("/embroidery-library/assets/…").
 *
 * The files are NOT in public/ (so `npm run build` never copies them into
 * dist/): they live in runtime-assets/embroidery-library at the project root,
 * or the folder EMBROIDERY_LIBRARY_DIR names. The Vite dev server and the
 * Node server (production) both serve this prefix from that one folder, and
 * production reads library files from it (server/embroideryLibrary.mjs).
 * The repository tracks only the catalogues and a small, rights-clear TEST
 * SUBSET of artwork (scripts/embroidery-fixtures/build.mjs).
 */
export const LIBRARY_URL = "/embroidery-library";

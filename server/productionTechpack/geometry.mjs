// Loads server/productionTechpack/shared.ts (the configurator's geometry + catalogue) into Node,
// bundled once per process with esbuild (installed with Vite). Same approach as server/tsModule.mjs.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
let loaded = null;

export function loadGeometry() {
  loaded ??= (async () => {
    const esbuild = await import("esbuild");
    const options = { entryPoints: [join(HERE, "shared.ts")], bundle: true, platform: "node", format: "esm", write: false, alias: { "@": join(ROOT, "src") }, logLevel: "silent" };
    let out;
    try {
      out = await esbuild.build(options);
    } catch {
      out = esbuild.buildSync(options);
    }
    return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
  })().catch((err) => {
    loaded = null;
    throw err;
  });
  return loaded;
}

// Loads the website's shared TypeScript (src/features/production/server.ts)
// into Node: bundled with esbuild (already installed with Vite) on first
// use, then cached for the life of the process.
//
// esbuild's async API runs a long-lived helper process (esbuild.exe). If that
// helper ever exits — killed, crashed — every later build() in this process
// fails for good ("The service is no longer running"), and so did every route
// needing this module until the server was restarted. A build that fails is
// therefore retried once with buildSync, which runs its own one-off esbuild
// process. Only a successful bundle is cached, so a later call can recover.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let shared;
let loading = null;

const OPTIONS = {
  entryPoints: [join(ROOT, "src/features/production/server.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  alias: { "@": join(ROOT, "src") },
  logLevel: "silent",
};

async function compile() {
  const esbuild = await import("esbuild");
  let out;
  try {
    out = await esbuild.build(OPTIONS);
  } catch (err) {
    console.warn(`Shared code: esbuild failed (${err.message}); bundling again with a one-off esbuild process.`);
    out = esbuild.buildSync(OPTIONS);
  }
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
}

export async function loadShared() {
  if (shared) return shared;
  // One compile at a time; a failed one is forgotten so the next call tries again.
  loading ??= compile().then(
    (module) => (shared = module),
    (err) => {
      loading = null;
      throw err;
    },
  );
  return loading;
}

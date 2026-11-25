import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** The project folder (this file's), so paths resolve wherever the folder is moved. */
const PROJECT_ROOT = fileURLToPath(new URL(".", import.meta.url));

/**
 * Serves /embroidery-library/ in dev from the colour layers overlay
 * (embroidery-library-layers/, or EMBROIDERY_LAYERS_DIR) first, then the
 * library (runtime-assets/embroidery-library, or EMBROIDERY_LIBRARY_DIR) —
 * the same folders the Node server uses (server/embroideryLibrary.mjs). The
 * library is not in public/, so `vite build` never copies it into dist/.
 * Only files inside those two folders are reachable; anything else under the
 * prefix is 404 (never the SPA page).
 */
function embroideryLibrary(): Plugin {
  const types: Record<string, string> = {
    ".json": "application/json",
    ".png": "image/png",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
  };

  return {
    name: "jacketek-embroidery-library",

    configureServer(server) {
      const env = loadEnv(server.config.mode, PROJECT_ROOT, "");

      const roots = [
        env.EMBROIDERY_LAYERS_DIR?.trim() || "embroidery-library-layers",
        env.EMBROIDERY_LIBRARY_DIR?.trim() || "runtime-assets/embroidery-library",
      ].map((d) => resolve(PROJECT_ROOT, d));

      // First: a raw request that names the library but tries to leave it
      // ("/embroidery-library/../x", "%2e%2e", "%2E%2E", "..%5c", "%252e"…)
      // is refused before anything resolves the ".." (same rule as the server's
      // isLibraryTraversal in server/embroideryLibrary.mjs).
      server.middlewares.use((req, res, next) => {
        let path = (req.url ?? "/")
          .split(/[?#]/)[0]
          .replace(/^[\\/]+/, "/");

        for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(path); i++) {
          try {
            path = decodeURIComponent(path);
          } catch {
            break;
          }
        }

        const rest = path.startsWith("/embroidery-library")
          ? path.slice("/embroidery-library".length)
          : null;

        if (rest === null || (rest && !/^[\\/]/.test(rest))) {
          return next();
        }

        if (
          rest.includes("\0") ||
          rest.split(/[\\/]/).some((seg) => seg.startsWith("."))
        ) {
          res.statusCode = 404;
          return void res.end();
        }

        next();
      });

      server.middlewares.use("/embroidery-library", (req, res) => {
        const notFound = (status = 404) => {
          res.statusCode = status;
          res.end();
        };

        if (req.method !== "GET" && req.method !== "HEAD") {
          return notFound(405);
        }

        let rel: string;

        try {
          rel = decodeURIComponent((req.url ?? "/").split(/[?#]/)[0]).replace(
            /^\/+/,
            "",
          );
        } catch {
          return notFound();
        }

        // No hidden names, no NUL, no ".." segments.
        if (
          !rel ||
          rel.includes("\0") ||
          rel.split(/[\\/]/).some((seg) => seg.startsWith("."))
        ) {
          return notFound();
        }

        for (const root of roots) {
          const file = resolve(root, rel);
          const inside = relative(root, file);

          if (
            !inside ||
            inside.startsWith("..") ||
            isAbsolute(inside) ||
            !existsSync(file) ||
            !statSync(file).isFile()
          ) {
            continue;
          }

          res.setHeader(
            "Content-Type",
            types[extname(file).toLowerCase()] ?? "application/octet-stream",
          );
          res.setHeader("Content-Length", statSync(file).size);
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader(
            "Content-Security-Policy",
            "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
          );

          if (req.method === "HEAD") {
            return void res.end();
          }

          return void createReadStream(file).pipe(res);
        }

        notFound();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), embroideryLibrary()],

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  server: {
    host: "0.0.0.0",
    allowedHosts: true,

    // Orders and the admin API live in the Node server (server/index.mjs).
    // changeOrigin stays false so the server sees the site's own Host, which
    // its same-origin (CSRF) check on account requests compares Origin to.
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.API_PORT ?? 8787}`,
        changeOrigin: false,
      },
    },

    // Data folders, not source: never watched. The RFQ generator prints through a headless
    // browser whose profile files sit locked in server-data/techpacks while it runs — watching
    // them crashed the dev server (EBUSY).
    watch: {
      ignored: [
        "**/server-data/**",
        "**/archive/**",
        "**/runtime-assets/**",
        "**/embroidery-library-layers/**",
        "**/garment-spec/**",
        "**/production-output/**",
      ],
    },
  },
});
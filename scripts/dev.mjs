#!/usr/bin/env node
// Local development in one command: the order server (server/index.mjs,
// http://localhost:8787) and the website (Vite, http://localhost:5173,
// which forwards /api to the server).
//
// On first run it creates .env.local with a random ADMIN_KEY — the key for
// http://localhost:5173/admin/orders — and prints it.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = join(ROOT, ".env.local");

const current = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
const existing = /^ADMIN_KEY\s*=\s*(\S+)/m.exec(current)?.[1];
let key = process.env.ADMIN_KEY ?? existing;
if (!key) {
  key = randomBytes(18).toString("base64url");
  appendFileSync(ENV_FILE, `${current && !current.endsWith("\n") ? "\n" : ""}# Admin sign-in key for /admin/orders (local only; keep it private)\nADMIN_KEY=${key}\n`);
  console.log("Created .env.local with a new admin key.");
}

const sitePort = process.env.SITE_PORT ?? "5173";
console.log(`
  Website          http://localhost:${sitePort}
  Admin dashboard  http://localhost:${sitePort}/admin/orders
  Admin key        ${key}   (stored in .env.local)
`);

const children = [
  spawn(process.execPath, [join(ROOT, "server/index.mjs")], { stdio: "inherit", env: { ...process.env, ADMIN_KEY: key } }),
  // A fixed port, so the address above is always right (fails if taken).
  // Extra arguments are passed on to Vite, e.g. `npm run dev -- --host 0.0.0.0`
  // to open the site to other devices on the local network (Vite then prints
  // the Network URL). Without them it stays on localhost, as before.
  spawn(process.execPath, [join(ROOT, "node_modules/vite/bin/vite.js"), "--port", sitePort, "--strictPort", ...process.argv.slice(2)], { stdio: "inherit" }),
];
const stop = () => children.forEach((c) => c.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children.forEach((c) => c.on("exit", (code) => {
  if (code) {
    stop();
    process.exit(code);
  }
}));

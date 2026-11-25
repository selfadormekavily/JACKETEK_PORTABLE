// Downloads the embroidery font library's files (src/features/embroidery/fonts/fontLibrary.ts)
// into public/fonts/embroidery/<id>.ttf — complete TrueType files from Google Fonts
// (all SIL Open Font License). Existing files are kept; --force refetches.
// Usage: node scripts/fetch-embroidery-fonts.mjs [--force]
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "fonts", "embroidery");
const force = process.argv.includes("--force");

const { build } = await import("esbuild");
const bundle = await build({ entryPoints: [join(ROOT, "src/features/embroidery/fonts/fontLibrary.ts")], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
const { EMBROIDERY_FONTS } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

mkdirSync(OUT, { recursive: true });
let failed = 0;
for (const f of EMBROIDERY_FONTS) {
  const target = join(OUT, `${f.id}.ttf`);
  if (existsSync(target) && !force) { console.log("kept", f.id); continue; }
  try {
    // Without a browser user agent the CSS API answers with the whole TrueType file.
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.source.family)}:wght@${f.source.weight}`)).text();
    const url = /src:\s*url\((https:[^)]+\.ttf)\)/.exec(css)?.[1];
    if (!url) throw new Error(`no TrueType file in: ${css.slice(0, 160)}`);
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    if (buf.readUInt32BE(0) !== 0x00010000 && buf.toString("ascii", 0, 4) !== "true" && buf.toString("ascii", 0, 4) !== "OTTO") throw new Error("not a font file");
    writeFileSync(target, buf);
    console.log("fetched", f.id, f.source.family, f.source.weight, `${Math.round(buf.length / 1024)} KB`);
  } catch (e) {
    failed++;
    console.error("FAILED", f.id, e.message);
  }
}
writeFileSync(
  join(OUT, "README.txt"),
  `Embroidery font library — self-hosted font files.\nAll fonts: SIL Open Font License 1.1 (https://openfontlicense.org), from Google Fonts (https://fonts.google.com).\nThe list, names and ids are in src/features/embroidery/fonts/fontLibrary.ts; fetched by scripts/fetch-embroidery-fonts.mjs.\n\n${EMBROIDERY_FONTS.map((f) => `${f.id}.ttf — ${f.source.family} ${f.source.weight} (OFL-1.1)`).join("\n")}\n`
);
process.exit(failed ? 1 : 0);

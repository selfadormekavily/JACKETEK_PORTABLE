#!/usr/bin/env node
// RFQ Tech Pack from a stored order line (server database) or an order JSON file.
//
//   node scripts/rfq-techpack.mjs --order <ORDER_ID> [--line 1]
//   node scripts/rfq-techpack.mjs --order-file <order.json> [--line 1] [--out-root <dir>]
//
// Writes server-data/techpacks/<designId>/RFQ-NN/ (see server/rfq/generate.mjs).
// Prints the result summary; exits 1 with the validation errors when the spec
// has structural errors (nothing is written then).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateRFQTechPack, RfqError } from "../server/rfq/generate.mjs";

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const line = Number(opt("--line") ?? 1) - 1;

let order, outRoot = opt("--out-root");
if (opt("--order-file")) {
  order = JSON.parse(readFileSync(opt("--order-file"), "utf8"));
  outRoot ??= join(process.cwd(), "server-data", "techpacks");
} else if (opt("--order")) {
  const { getOrder, DATA_DIR } = await import("../server/orders.mjs");
  order = getOrder(opt("--order"));
  if (!order) {
    console.error(`Order ${opt("--order")} not found.`);
    process.exit(1);
  }
  outRoot ??= join(DATA_DIR, "techpacks");
} else {
  console.error("Usage: node scripts/rfq-techpack.mjs --order <ORDER_ID> | --order-file <order.json> [--line 1] [--out-root <dir>] [--test-label <text>]");
  process.exit(2);
}

try {
  const r = await generateRFQTechPack(order, { lineIndex: line, outRoot, testLabel: opt("--test-label") ?? null });
  const v = r.validation;
  console.log(`RFQ generated: ${r.designId} ${r.revision}`);
  console.log(`  PDF : ${r.pdf}`);
  console.log(`  JSON: ${r.json}`);
  console.log(`  ${r.pages} pages; validation: ${v.errors.length} errors, ${v.warnings.length} warnings, ${v.info.length} info`);
  for (const w of v.warnings) console.log(`  WARNING ${w.code} — ${w.message}`);
} catch (err) {
  if (err instanceof RfqError) {
    console.error(err.message);
    for (const i of err.issues ?? []) console.error(`  ${i.severity} ${i.code} ${i.path} — ${i.message}`);
    process.exit(1);
  }
  throw err;
}

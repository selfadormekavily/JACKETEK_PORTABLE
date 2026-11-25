// The active base-garment master (garment-spec/ACTIVE_TECHPACK_MASTER.json, written by
// scripts/techpack-master/build-active-master.mjs). Every pinned file is checked against its SHA-256
// before a Production Tech Pack is generated: if the R2 package or its engineering data changed
// without rebuilding the registry, generation is refused (fail closed).
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const MASTER_FILE = "garment-spec/ACTIVE_TECHPACK_MASTER.json";

export class MasterError extends Error {
  status = 500;
}

const verified = new Map(); // path → "size:mtime:sha" already checked in this process

function check(pin) {
  const file = join(ROOT, pin.path);
  if (!existsSync(file)) throw new MasterError(`Master file missing: ${pin.path}`);
  const st = statSync(file);
  const key = `${st.size}:${st.mtimeMs}:${pin.sha256}`;
  if (verified.get(pin.path) === key) return;
  const sha = createHash("sha256").update(readFileSync(file)).digest("hex");
  if (sha !== pin.sha256) throw new MasterError(`Master file changed since the registry was built: ${pin.path}. Re-run scripts/techpack-master/build-active-master.mjs after reviewing the change.`);
  verified.set(pin.path, key);
}

/** The verified active master: { master, sha256, file(path) }. */
export function loadMaster({ file = MASTER_FILE } = {}) {
  const abs = resolve(ROOT, file);
  if (!existsSync(abs)) throw new MasterError(`No active Tech Pack master (${file}). Run scripts/techpack-master/build-active-master.mjs.`);
  const raw = readFileSync(abs);
  const master = JSON.parse(raw.toString("utf8"));
  if (master.schema !== "jacketek.active-techpack-master/1") throw new MasterError(`Unsupported master schema "${master.schema}".`);
  for (const pin of [...master.supplierPackage.files, master.supplierPackage.zip, master.supplierPackage.verification, ...master.engineeringData]) check(pin);
  return { master, sha256: createHash("sha256").update(raw).digest("hex"), file, path: (role) => join(ROOT, master.engineeringData.find((p) => p.role === role).path) };
}

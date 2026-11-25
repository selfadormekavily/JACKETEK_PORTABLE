// Customer Production Tech Pack — end to end over HTTP (node:test; needs Chrome or Edge).
//   node --test --test-concurrency=1 scripts/techpack/production-techpack.e2e.test.mjs
// Starts the real server (server/index.mjs) with an empty temporary DATA_DIR and places orders exactly
// as the checkout does. The project's own server-data/ is never written.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ADMIN_KEY = "test-admin-key-0123456789";
const DATA = mkdtempSync(join(tmpdir(), "jk-ptp-e2e-"));
const REF = JSON.parse(readFileSync(join(ROOT, "garment-spec/JACKETEK_R2_BUILD_SOURCES/reference-design/D-59a2a5aab079/DEV-01/design-config.json"), "utf8")).config;

function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
/** What the browser sends after the customer confirms the final design. */
const approval = (c) => ({ confirmed: true, designSha256: createHash("sha256").update(stable(c)).digest("hex") });

let base, child, out = "", cookie = "";
before(async () => {
  const port = await new Promise((ok) => {
    const s = createServer();
    s.listen(0, () => {
      const p = s.address().port;
      s.close(() => ok(p));
    });
  });
  child = spawn(process.execPath, [join(ROOT, "server/index.mjs")], { cwd: ROOT, env: { ...process.env, DATA_DIR: DATA, PORT: String(port), ADMIN_KEY }, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (c) => (out += c));
  child.stderr.on("data", (c) => (out += c));
  await new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error(`server didn't start:\n${out}`)), 30_000);
    child.stdout.on("data", () => out.includes("JACKETEK server on") && (clearTimeout(t), ok()));
  });
  base = `http://127.0.0.1:${port}`;
  const r = await fetch(`${base}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: ADMIN_KEY }) });
  cookie = r.headers.get("set-cookie").split(";")[0];
});
after(async () => {
  if (process.env.PTP_E2E_LOG) console.error(out.slice(-4000));
  if (child.exitCode === null) await new Promise((ok) => (child.on("exit", ok), child.kill()));
  try { rmSync(DATA, { recursive: true, force: true }); } catch {}
});

const order = (items) => ({
  customer: { fullName: "Test Customer", phone: "+9647700000000" },
  delivery: { city: "Test", area: "Test", address: "Test address 1", notes: "" },
  payment: { method: "cod" },
  items,
});
const post = (path, body, admin = false) =>
  fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...(admin ? { Cookie: cookie, "X-Jacketek-Admin": "1" } : {}) }, body: JSON.stringify(body) });
// Read-only polls retry on a connection reset: while the server auto-digitizes a new order's embroidery
// (pre-existing background job, CPU-bound) a reused keep-alive socket can be closed under the client.
async function adminGet(path) {
  for (let i = 0; ; i++) {
    try {
      return await fetch(`${base}${path}`, { headers: { Cookie: cookie, Connection: "close" } });
    } catch (err) {
      if (i >= 3 || err.cause?.code !== "ECONNRESET") throw err;
    }
  }
}

async function waitForPacks(id, n) {
  for (let i = 0; i < 240; i++) {
    const j = await (await adminGet(`/api/admin/orders/${id}/production-techpack`)).json();
    if (j.techpacks.filter((p) => p.status !== "PENDING").length >= n) return j;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timed out waiting for ${id}\n${out}`);
}

test("checkout without approval: order placed exactly as before, no Tech Pack", async () => {
  const r = await post("/api/orders", order([{ customization: REF, quantity: 1 }]));
  assert.equal(r.status, 201);
  const { order: o } = await r.json();
  const j = await (await adminGet(`/api/admin/orders/${o.id}/production-techpack`)).json();
  assert.deepEqual(j, { approvals: [], techpacks: [] });
  // The RFQ / production routes are unchanged: the order still opens in the admin.
  assert.equal((await adminGet(`/api/admin/orders/${o.id}`)).status, 200);
});

test("approval that does not match the design sent: refused, nothing stored", async () => {
  const before = (await (await adminGet("/api/admin/orders")).json()).orders.length;
  const r = await post("/api/orders", order([{ customization: { ...REF, size: "XL" }, quantity: 1, designApproval: approval(REF) }]));
  assert.equal(r.status, 400);
  assert.equal((await (await adminGet("/api/admin/orders")).json()).orders.length, before);
});

test("approved checkout: Jacket IDs, automatic generation, admin download", async () => {
  const two = { ...structuredClone(REF), size: "L", colours: { body: "fabric-navy", sleeves: "leather-white", trim: "fabric-navy" } };
  const r = await post("/api/orders", order([
    { customization: REF, quantity: 1, designApproval: approval(REF) },
    { customization: two, quantity: 3, designApproval: approval(two) },
  ]));
  assert.equal(r.status, 201);
  const { order: o } = await r.json();
  const j = await waitForPacks(o.id, 2);
  assert.deepEqual(j.approvals.map((a) => a.jacketId), [`${o.id}-J1`, `${o.id}-J2`]);
  assert.ok(j.techpacks.every((p) => p.status === "GENERATED" && p.masterRevision === "R2"), JSON.stringify(j.techpacks));
  const p = j.techpacks[1];
  const folder = p.dir.split("/").at(-1);
  const pdf = await adminGet(`/api/admin/orders/${o.id}/production-techpack/${p.jacketId}/${folder}/pdf`);
  assert.equal(pdf.status, 200);
  const bytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(createHash("sha256").update(bytes).digest("hex"), p.pdfSha256);
  assert.ok(existsSync(join(DATA, p.dir, "snapshot.json")));

  // Admin retry: same record, nothing new written.
  const again = await (await post(`/api/admin/orders/${o.id}/production-techpack`, { line: 2 }, true)).json();
  assert.equal(again.techpack.reused, true);
  assert.equal(again.techpacks.length, 2);
  assert.equal(readdirSync(join(DATA, "production-techpacks", o.id, p.jacketId)).length, 1);
});

test("admin path: no approval → refused; recorded customer confirmation → generated", async () => {
  const { order: o } = await (await post("/api/orders", order([{ customization: REF, quantity: 1 }]))).json();
  const refused = await post(`/api/admin/orders/${o.id}/production-techpack`, { line: 1 }, true);
  assert.equal(refused.status, 409);
  const ok = await post(`/api/admin/orders/${o.id}/production-techpack`, { line: 1, approvalReference: "Customer confirmed the final design by phone (test)" }, true);
  assert.equal(ok.status, 200);
  const j = await ok.json();
  assert.equal(j.techpack.status, "GENERATED");
  assert.equal(j.approvals[0].method, "Customer confirmation recorded by admin");
});

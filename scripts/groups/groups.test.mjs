// Group orders — backend integration tests (node:test; no extra dependency).
//   npm run test:groups
// Each suite starts the real server (server/index.mjs) on a free port with
// its own empty DATA_DIR in the system temp folder, and talks to it over
// HTTP exactly as the website would. The project's own server-data/ is
// never written (the real-database migration test works on a copy).
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { encodePng } from "../../server/png.mjs";
import { loadShared } from "../../server/tsModule.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ADMIN_KEY = "test-admin-key-0123456789";
const SAME_SITE = { "X-JACKETEK-Auth": "1" };

// ---------------------------------------------------------------------------
// Server harness

const freePort = () =>
  new Promise((ok, fail) => {
    const s = createServer();
    s.unref();
    s.on("error", fail);
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });

async function startServer(dataDir, env = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, [join(ROOT, "server/index.mjs")], {
    cwd: ROOT,
    env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), ADMIN_KEY, GROUP_INVITE_SECRET: "", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (c) => (out += c));
  child.stderr.on("data", (c) => (out += c));
  await new Promise((ok, fail) => {
    const timer = setTimeout(() => fail(new Error(`server didn't start:\n${out}`)), 30_000);
    const check = () => {
      if (out.includes("JACKETEK server on")) {
        clearTimeout(timer);
        ok();
      }
    };
    child.stdout.on("data", check);
    child.on("exit", (code) => {
      clearTimeout(timer);
      fail(Object.assign(new Error(`server exited (${code}):\n${out}`), { code, output: out }));
    });
  });
  const stop = () =>
    new Promise((ok) => {
      if (child.exitCode !== null) return ok();
      child.on("exit", ok);
      child.kill();
    });
  return { base: `http://127.0.0.1:${port}`, stop, output: () => out, dataDir };
}

/** Starts a server expected to FAIL; resolves with its exit code and output. */
async function startFailing(dataDir) {
  try {
    const s = await startServer(dataDir);
    await s.stop();
    return { code: 0, output: s.output() };
  } catch (err) {
    return { code: err.code, output: err.output ?? String(err) };
  }
}

const tempDir = (label) => mkdtempSync(join(tmpdir(), `jk-groups-${label}-`));

// ---------------------------------------------------------------------------
// Fixtures

function png(w = 24, h = 16, rgb = [180, 20, 40]) {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([...rgb, 255], i * 4);
  return `data:image/png;base64,${encodePng({ width: w, height: h, data }).toString("base64")}`;
}
const ART = png(30, 20);
const PREVIEW = png(64, 64, [20, 40, 160]);

/** A current-model design: a customer upload on the left chest, text on the back. */
function design(overrides = {}) {
  return {
    colours: { body: "fabric-navy", sleeves: "leather-white", trim: "fabric-red" },
    materials: { body: "felt", sleeves: "leather" },
    buttons: "gold",
    zipper: false,
    size: "M",
    fit: "regular",
    embroidery: [
      {
        id: "e-upload", kind: "image", text: "", placement: "leftChest", offset: [0, 0], rotation: 0, scale: 1, style: "satin", thread: null,
        image: { src: ART, aspect: 1.5, processed: { widthPx: 30, heightPx: 20 }, original: { src: ART, fileName: "private-family-photo.png", mimeType: "image/png", widthPx: 30, heightPx: 20 } },
      },
      { id: "e-text", kind: "text", text: "YOUSEF 27", placement: "mainBack", offset: [0, 0], rotation: 0, scale: 1, style: "satin", thread: "ivory", image: null },
    ],
    ...overrides,
  };
}
const textOnly = () => design({ embroidery: [design().embroidery[1]] });

// ---------------------------------------------------------------------------
// HTTP client with a cookie per user

function client(base, cookie = null) {
  const call = async (method, path, body, headers = {}) => {
    const h = { ...headers };
    if (cookie) h.Cookie = cookie;
    if (method !== "GET" && !("X-JACKETEK-Auth" in h) && !h.noSameSite) Object.assign(h, SAME_SITE);
    delete h.noSameSite;
    let payload;
    if (body !== undefined) {
      h["Content-Type"] = "application/json";
      payload = typeof body === "string" ? body : JSON.stringify(body);
    }
    const res = await fetch(base + path, { method, headers: h, body: payload });
    const type = res.headers.get("content-type") ?? "";
    const data = type.includes("json") ? await res.json() : res.status === 304 ? null : Buffer.from(await res.arrayBuffer());
    return { status: res.status, body: data, headers: res.headers };
  };
  return {
    cookie,
    get: (p, h) => call("GET", p, undefined, h),
    post: (p, b, h) => call("POST", p, b ?? {}, h),
    patch: (p, b) => call("PATCH", p, b),
    put: (p, b) => call("PUT", p, b),
    del: (p) => call("DELETE", p),
  };
}

/** A customer signed up through the real API (proves the auth integration). */
async function signUp(base, first) {
  const res = await fetch(`${base}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SAME_SITE },
    body: JSON.stringify({ firstName: first, lastName: "Tester", method: "email", email: `${first.toLowerCase()}-${randomUUID()}@example.com`, password: "correct-horse-battery" }),
  });
  assert.equal(res.status, 201, await res.clone().text());
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("jk_session=")).split(";")[0];
  return client(base, cookie);
}

/**
 * A customer with a session, written straight into the test database (the
 * sign-up API allows 10 per address per 10 minutes; these tests need more).
 */
function seedUser(server, first) {
  const db = new DatabaseSync(join(server.dataDir, "jacketek.db"));
  db.exec("PRAGMA busy_timeout = 5000");
  const id = randomUUID();
  const t = new Date().toISOString();
  db.prepare("INSERT INTO users (id, first_name, last_name, email, email_normalized, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'x', ?, ?)").run(id, first, "Seeded", `${id}@example.com`, `${id}@example.com`, t, t);
  const token = randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)").run(
    createHash("sha256").update(token).digest("hex"), id, t, new Date(Date.now() + 86400_000).toISOString(), t,
  );
  db.close();
  return Object.assign(client(server.base, `jk_session=${token}`), { userId: id });
}

const rid = () => `req-${randomUUID()}`;
const tokenOf = (view) => view.group.invite.path.split("/").pop();

async function newGroup(host, name = "AIS Seniors 2027") {
  const r = await host.post("/api/groups", { name, clientRequestId: rid() });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}
async function joinGroup(user, token) {
  const r = await user.post(`/api/groups/invite/${token}/join`);
  assert.ok(r.status === 201 || r.status === 200, JSON.stringify(r.body));
  return r.body;
}
async function addJacket(user, groupId, config = design(), extra = {}) {
  return user.post(`/api/groups/${groupId}/items`, { clientRequestId: rid(), config, quantity: 1, preview: PREVIEW, ...extra });
}
const view = async (user, groupId) => (await user.get(`/api/groups/${groupId}`)).body;

// ---------------------------------------------------------------------------

describe("group orders API", () => {
  let server, A, B, C, D, E, stranger;

  before(async () => {
    server = await startServer(tempDir("api"));
    A = await signUp(server.base, "Yousef");
    B = await signUp(server.base, "Omar");
    C = seedUser(server, "Lina");
    D = seedUser(server, "Sara");
    E = seedUser(server, "Kareem");
    stranger = seedUser(server, "Stranger");
  });
  after(async () => {
    await server?.stop();
    rmSync(server.dataDir, { recursive: true, force: true });
  });

  describe("unauthorized access", () => {
    let group;
    before(async () => {
      group = await newGroup(A);
      await joinGroup(B, tokenOf(group));
      const item = await addJacket(B, group.group.id);
      assert.equal(item.status, 201);
      group.itemId = item.body.item.id;
    });

    test("signed-out requests are refused (401)", async () => {
      const anon = client(server.base);
      for (const r of [
        await anon.get("/api/groups"),
        await anon.post("/api/groups", { clientRequestId: rid() }),
        await anon.get(`/api/groups/${group.group.id}`),
        await anon.post(`/api/groups/invite/${tokenOf(group)}/join`),
        await anon.get(`/api/groups/${group.group.id}/items/${group.itemId}/preview`),
      ]) {
        assert.equal(r.status, 401);
        assert.equal(r.body.code, "UNAUTHENTICATED");
      }
    });

    test("changes without the site's own header are refused (403)", async () => {
      const r = await A.post(`/api/groups/${group.group.id}/status`, { to: "LOCKED", expectedRevision: 1 }, { noSameSite: true });
      assert.equal(r.status, 403);
      assert.equal(r.body.code, "FORBIDDEN");
    });

    test("a non-member can't see the group or anything in it — not even that it exists (404)", async () => {
      const id = group.group.id;
      for (const r of [
        await stranger.get(`/api/groups/${id}`),
        await stranger.get(`/api/groups/${id}?since=1`),
        await stranger.get(`/api/groups/${id}/my-items`),
        await stranger.get(`/api/groups/${id}/items/${group.itemId}`),
        await stranger.get(`/api/groups/${id}/items/${group.itemId}/preview`),
        await stranger.patch(`/api/groups/${id}/items/${group.itemId}`, { quantity: 2, expectedVersion: 1 }),
        await stranger.del(`/api/groups/${id}/items/${group.itemId}?expectedVersion=1`),
        await addJacket(stranger, id),
        await stranger.post(`/api/groups/${id}/status`, { to: "LOCKED", expectedRevision: 3 }),
        await stranger.post(`/api/groups/${id}/invite/rotate`),
        await stranger.get(`/api/groups/not-a-uuid`),
        await stranger.get(`/api/groups/${randomUUID()}`),
      ]) {
        assert.equal(r.status, 404, JSON.stringify(r.body));
        assert.equal(r.body.code, "GROUP_NOT_FOUND");
      }
      const mine = await stranger.get("/api/groups");
      assert.deepEqual(mine.body.groups, []);
    });

    test("the invite preview shows the group, never its members or jackets", async () => {
      const r = await client(server.base).get(`/api/groups/invite/${tokenOf(group)}`);
      assert.equal(r.status, 200);
      assert.deepEqual(Object.keys(r.body.invite).sort(), ["groupId", "hostFirstName", "joinable", "memberCount", "membershipStatus", "name", "status"]);
      assert.equal(r.body.invite.groupId, null, "the id is only told to members");
      assert.equal(r.body.invite.memberCount, 2);
      assert.equal(r.body.invite.hostFirstName, "Yousef");
      for (const bad of ["x", "A".repeat(43), "../../etc"]) assert.equal((await client(server.base).get(`/api/groups/invite/${bad}`)).status, 404);
    });

    test("members never receive another member's uploaded artwork or file names", async () => {
      const v = await view(A, group.group.id);
      const json = JSON.stringify(v);
      assert.ok(!json.includes("data:image"), "no embedded artwork");
      assert.ok(!json.includes("private-family-photo"), "no original file name");
      assert.ok(!json.includes("@example.com") && !json.includes("phone"), "no contact details");
      const jacket = v.members.find((m) => !m.isYou).items[0];
      assert.equal(jacket.design.size, "M");
      assert.deepEqual(jacket.design.embroidery.map((e) => e.kind), ["image", "text"]);
      assert.deepEqual(jacket.design.embroidery[0].design, { source: "upload" });
      assert.equal(jacket.design.embroidery[1].text, "YOUSEF 27");
      assert.equal(jacket.isYours, false);
      // The preview still is visible to members.
      const p = await A.get(jacket.previewUrl);
      assert.equal(p.status, 200);
      assert.equal(p.headers.get("content-type"), "image/png");
      assert.equal(p.headers.get("x-content-type-options"), "nosniff");
      assert.ok(p.body.equals(Buffer.from(PREVIEW.split(",")[1], "base64")));
      const again = await A.get(jacket.previewUrl, { "If-None-Match": p.headers.get("etag") });
      assert.equal(again.status, 304);
    });

    test("only the owner opens a jacket's full design", async () => {
      const own = await B.get(`/api/groups/${group.group.id}/items/${group.itemId}`);
      assert.equal(own.status, 200);
      assert.equal(own.body.item.config.embroidery[0].image.original.src, ART);
      const host = await A.get(`/api/groups/${group.group.id}/items/${group.itemId}`);
      assert.equal(host.status, 403);
      assert.equal(host.body.code, "NOT_ITEM_OWNER");
    });
  });

  describe("ownership", () => {
    let id, itemB;
    before(async () => {
      const g = await newGroup(A);
      id = g.group.id;
      await joinGroup(B, tokenOf(g));
      await joinGroup(C, tokenOf(g));
      itemB = (await addJacket(B, id)).body.item;
    });

    test("another member can't change, replace or remove a member's jacket", async () => {
      const base = `/api/groups/${id}/items/${itemB.id}`;
      for (const r of [
        await C.patch(base, { quantity: 5, expectedVersion: 1 }),
        await C.put(base, { config: design({ size: "XL" }), expectedVersion: 1 }),
        await C.del(`${base}?expectedVersion=1`),
      ]) {
        assert.equal(r.status, 403);
        assert.equal(r.body.code, "NOT_ITEM_OWNER");
      }
    });

    test("the host can't change a member's jacket either", async () => {
      const base = `/api/groups/${id}/items/${itemB.id}`;
      for (const r of [await A.patch(base, { quantity: 5, expectedVersion: 1 }), await A.put(base, { config: textOnly(), expectedVersion: 1 }), await A.del(`${base}?expectedVersion=1`)]) {
        assert.equal(r.status, 403);
        assert.equal(r.body.code, "NOT_ITEM_OWNER");
      }
      const own = await B.get(base);
      assert.equal(own.body.item.version, 1, "untouched");
      assert.equal(own.body.item.quantity, 1);
      assert.equal(own.body.item.status, "active");
    });

    test("the owner can change quantity and size, replace the design and remove it", async () => {
      const base = `/api/groups/${id}/items/${itemB.id}`;
      const p = await B.patch(base, { quantity: 2, size: "L", expectedVersion: 1 });
      assert.equal(p.status, 200, JSON.stringify(p.body));
      assert.equal(p.body.item.version, 2);
      const full = (await B.get(base)).body.item;
      assert.equal(full.config.size, "L");
      assert.equal(full.quantity, 2);
      const put = await B.put(base, { config: textOnly(), expectedVersion: 2 });
      assert.equal(put.status, 200, JSON.stringify(put.body));
      assert.equal(put.body.item.version, 3);
      assert.equal(put.body.item.quantity, 2, "quantity kept when not sent");
      assert.ok(put.body.item.previewUrl, "preview kept when not sent");
      const del = await B.del(`${base}?expectedVersion=3`);
      assert.equal(del.status, 200);
      assert.equal(del.body.item.status, "withdrawn");
      // The design is kept for its owner.
      const mine = (await B.get(`/api/groups/${id}/my-items`)).body.items;
      assert.equal(mine.length, 1);
      assert.equal(mine[0].withdrawnReason, "deleted");
      assert.equal(mine[0].config.embroidery[0].text, "YOUSEF 27");
      assert.equal((await view(A, id)).totals.jackets, 0);
    });
  });

  describe("joining and idempotency", () => {
    test("creating a group needs no jackets, and a repeated create returns the same group", async () => {
      const clientRequestId = rid();
      const results = await Promise.all([1, 2, 3].map(() => A.post("/api/groups", { name: "  Class   of 2027 ", clientRequestId })));
      const ids = new Set(results.map((r) => r.body.group.id));
      assert.equal(ids.size, 1);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 201]);
      const g = results[0].body;
      assert.equal(g.group.name, "Class of 2027");
      assert.equal(g.group.status, "OPEN");
      assert.equal(g.totals.jackets, 0);
      assert.equal(g.viewer.role, "host");
      assert.ok(g.viewer.permissions.includes("group.lock"));
      const mismatch = await A.post("/api/groups", { name: "Other", clientRequestId });
      assert.equal(mismatch.status, 409);
      assert.equal(mismatch.body.code, "IDEMPOTENCY_MISMATCH");
      assert.equal((await A.post("/api/groups", { name: "x" })).body.code, "VALIDATION");
    });

    test("joining twice (or five times at once) makes one membership", async () => {
      const g = await newGroup(A);
      const results = await Promise.all([1, 2, 3, 4, 5].map(() => D.post(`/api/groups/invite/${tokenOf(g)}/join`)));
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 200, 200, 201]);
      assert.equal(new Set(results.map((r) => r.body.memberId)).size, 1);
      const again = await D.post(`/api/groups/invite/${tokenOf(g)}/join`);
      assert.equal(again.status, 200);
      assert.equal(again.body.joined, false);
      const v = await view(A, g.group.id);
      assert.equal(v.totals.members, 2);
      assert.equal(v.members.filter((m) => m.firstName === "Sara").length, 1);
    });

    test("a double-clicked Add creates one jacket; the same id with another design is refused", async () => {
      const g = await newGroup(A);
      await joinGroup(B, tokenOf(g));
      const body = { clientRequestId: rid(), config: design(), quantity: 1, preview: PREVIEW };
      const results = await Promise.all([1, 2, 3, 4].map(() => B.post(`/api/groups/${g.group.id}/items`, body)));
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 200, 201]);
      assert.equal(new Set(results.map((r) => r.body.item.id)).size, 1);
      assert.ok(results.filter((r) => r.body.replayed).length === 3);
      assert.equal((await view(A, g.group.id)).totals.jackets, 1);
      const changed = await B.post(`/api/groups/${g.group.id}/items`, { ...body, quantity: 3 });
      assert.equal(changed.status, 409);
      assert.equal(changed.body.code, "IDEMPOTENCY_MISMATCH");
      // A retried request with a re-taken preview is still the same request.
      const retake = await B.post(`/api/groups/${g.group.id}/items`, { ...body, preview: null });
      assert.equal(retake.status, 200);
      assert.equal(retake.body.replayed, true);
    });

    test("cart import is all-or-nothing and safe to retry", async () => {
      const g = await newGroup(A);
      const id = g.group.id;
      await joinGroup(B, tokenOf(g));
      const cart = [1, 2, 3].map((n) => ({ clientRequestId: `cart:${randomUUID()}`, config: design({ size: ["S", "M", "L"][n - 1] }), quantity: n, preview: PREVIEW }));
      // One bad jacket: nothing at all is stored.
      const bad = await B.post(`/api/groups/${id}/items/import`, { items: [...cart.slice(0, 2), { ...cart[2], config: design({ colours: { body: "neon", sleeves: "leather-white", trim: "fabric-red" } }) }] });
      assert.equal(bad.status, 422);
      assert.equal(bad.body.code, "INVALID_DESIGN");
      assert.equal(bad.body.index, 2);
      assert.equal(bad.body.clientRequestId, cart[2].clientRequestId);
      assert.equal((await view(B, id)).totals.jackets, 0);
      // Over the per-member limit: the whole batch is refused inside the transaction.
      const many = Array.from({ length: 11 }, () => ({ clientRequestId: `cart:${randomUUID()}`, config: textOnly(), quantity: 1 }));
      const tooMany = await B.post(`/api/groups/${id}/items/import`, { items: many });
      assert.equal(tooMany.status, 409);
      assert.equal(tooMany.body.code, "LIMIT_REACHED");
      assert.equal((await view(B, id)).totals.jackets, 0);
      // All good: all created.
      const ok = await B.post(`/api/groups/${id}/items/import`, { items: cart });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      assert.deepEqual(ok.body.items.map((i) => i.status), ["created", "created", "created"]);
      assert.equal((await view(B, id)).totals.jackets, 6);
      // Retry (e.g. the response was lost): nothing twice.
      const retry = await B.post(`/api/groups/${id}/items/import`, { items: cart });
      assert.deepEqual(retry.body.items.map((i) => i.status), ["replayed", "replayed", "replayed"]);
      assert.deepEqual(retry.body.items.map((i) => i.item.id), ok.body.items.map((i) => i.item.id));
      // A partly-imported retry with one new line: only the new one is created.
      const extra = { clientRequestId: `cart:${randomUUID()}`, config: textOnly(), quantity: 1 };
      const mixed = await B.post(`/api/groups/${id}/items/import`, { items: [...cart, extra] });
      assert.deepEqual(mixed.body.items.map((i) => i.status), ["replayed", "replayed", "replayed", "created"]);
      assert.equal((await view(B, id)).totals.jackets, 7);
      // Bounds of one import.
      assert.equal((await B.post(`/api/groups/${id}/items/import`, { items: [] })).status, 422);
      assert.equal((await B.post(`/api/groups/${id}/items/import`, { items: Array.from({ length: 21 }, () => extra) })).status, 422);
    });
  });

  describe("concurrency", () => {
    test("two edits from the same stale version: one wins, the other gets 409 VERSION_CONFLICT", async () => {
      const g = await newGroup(E);
      await joinGroup(B, tokenOf(g));
      const item = (await addJacket(B, g.group.id)).body.item;
      const base = `/api/groups/${g.group.id}/items/${item.id}`;
      const [r1, r2] = await Promise.all([B.patch(base, { quantity: 2, expectedVersion: 1 }), B.patch(base, { quantity: 3, expectedVersion: 1 })]);
      assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
      const conflict = [r1, r2].find((r) => r.status === 409);
      assert.equal(conflict.body.code, "VERSION_CONFLICT");
      assert.equal(conflict.body.currentVersion, 2);
      const winner = [r1, r2].find((r) => r.status === 200);
      assert.equal((await B.get(base)).body.item.quantity, winner.body.item.quantity);
      // Stale replace / delete, and missing versions.
      assert.equal((await B.put(base, { config: textOnly(), expectedVersion: 1 })).body.code, "VERSION_CONFLICT");
      assert.equal((await B.del(`${base}?expectedVersion=1`)).body.code, "VERSION_CONFLICT");
      assert.equal((await B.patch(base, { quantity: 4 })).body.code, "VALIDATION");
      assert.equal((await B.del(base)).body.code, "VALIDATION");
    });

    test("status changes need the current revision", async () => {
      const g = await newGroup(E);
      await joinGroup(B, tokenOf(g));
      const stale = g.group.revision; // before B joined
      const r = await E.post(`/api/groups/${g.group.id}/status`, { to: "LOCKED", expectedRevision: stale });
      assert.equal(r.status, 409);
      assert.equal(r.body.code, "REVISION_CONFLICT");
      assert.equal(r.body.currentRevision, stale + 1);
      assert.equal((await E.post(`/api/groups/${g.group.id}/status`, { to: "LOCKED" })).body.code, "VALIDATION");
    });

    test("lock vs add race: a jacket is either in the frozen quote or refused — never lost or added after the lock", async () => {
      const g = await newGroup(E);
      const id = g.group.id;
      await joinGroup(B, tokenOf(g));
      const outcomes = { addWon: 0, lockWon: 0 };
      for (let i = 0; i < 24; i++) {
        const { revision } = (await view(E, id)).group;
        const lock = () => E.post(`/api/groups/${id}/status`, { to: "LOCKED", expectedRevision: revision });
        const add = () => addJacket(B, id, textOnly(), { quantity: 1 });
        // Alternate who is sent first; the server decides who commits first.
        const [a, l] = i % 2 ? await Promise.all([add(), lock()]) : (await Promise.all([lock(), add()])).reverse();
        const v = await view(E, id);
        if (a.status === 201) {
          outcomes.addWon++;
          assert.equal(l.status, 409, "the lock was based on a revision without the new jacket");
          assert.equal(l.body.code, "REVISION_CONFLICT");
          assert.equal(v.group.status, "OPEN");
          assert.ok(v.members.some((m) => m.items.some((it) => it.id === a.body.item.id)));
          await B.del(`/api/groups/${id}/items/${a.body.item.id}?expectedVersion=1`);
        } else {
          outcomes.lockWon++;
          assert.equal(l.status, 200, JSON.stringify(l.body));
          assert.equal(a.status, 409);
          assert.equal(a.body.code, "GROUP_NOT_OPEN");
          assert.equal(v.group.status, "LOCKED");
          assert.equal(v.quote.frozen, true);
          assert.equal(v.quote.totalJackets, v.totals.jackets, "the frozen quote is exactly what was locked");
          assert.equal(v.quote.groupRevision, v.group.revision);
          const u = await E.post(`/api/groups/${id}/status`, { to: "OPEN", expectedRevision: v.group.revision });
          assert.equal(u.status, 200);
        }
      }
      assert.equal(outcomes.addWon + outcomes.lockWon, 24);
      console.log(`    lock-vs-add outcomes: ${JSON.stringify(outcomes)}`);
      const v = await view(E, id);
      assert.equal(v.totals.jackets, 0, "every won add was removed again; nothing slipped in");
    });

    test("a lock that commits while an add is still uploading wins; the add is then refused", async () => {
      const g = await newGroup(E);
      const id = g.group.id;
      await joinGroup(B, tokenOf(g));
      const { revision } = (await view(E, id)).group;
      // Send the add's body by hand and stop half-way, so the lock is
      // guaranteed to commit while the add is in flight.
      const body = Buffer.from(JSON.stringify({ clientRequestId: rid(), config: design(), quantity: 1, preview: PREVIEW }));
      const { request } = await import("node:http");
      const url = new URL(`${server.base}/api/groups/${id}/items`);
      let finish;
      const pending = new Promise((ok, fail) => {
        const req = request(url, { method: "POST", headers: { Cookie: B.cookie, ...SAME_SITE, "Content-Type": "application/json", "Content-Length": body.length } }, (res) => {
          let text = "";
          res.on("data", (c) => (text += c));
          res.on("end", () => ok({ status: res.statusCode, body: JSON.parse(text) }));
        });
        req.on("error", fail);
        req.write(body.subarray(0, body.length >> 1));
        finish = () => req.end(body.subarray(body.length >> 1));
      });
      await new Promise((r) => setTimeout(r, 50));
      const lock = await E.post(`/api/groups/${id}/status`, { to: "LOCKED", expectedRevision: revision });
      assert.equal(lock.status, 200, "the lock commits while the add is half-sent");
      finish();
      const add = await pending;
      assert.equal(add.status, 409);
      assert.equal(add.body.code, "GROUP_NOT_OPEN");
      const v = await view(E, id);
      assert.equal(v.totals.jackets, 0);
      assert.equal(v.quote.totalJackets, 0);
    });
  });

  describe("lifecycle and quotes", () => {
    let id, g, itemB;
    before(async () => {
      g = await newGroup(A);
      id = g.group.id;
      await joinGroup(B, tokenOf(g));
      itemB = (await addJacket(B, id, design(), { quantity: 2 })).body.item;
      await addJacket(A, id, textOnly());
    });

    test("an open group shows a live server quote (prices not configured → unknown amounts, no discount)", async () => {
      const v = await view(B, id);
      assert.equal(v.quote.frozen, false);
      assert.equal(v.quote.totalJackets, 3);
      assert.equal(v.quote.contributingMembers, 2);
      assert.equal(v.quote.basis, "jackets");
      assert.equal(v.quote.tier, null);
      assert.equal(v.quote.discountRate, 0);
      assert.equal(v.quote.subtotal, null);
    });

    test("locking freezes contents and quote; unlocking discards the frozen quote", async () => {
      let v = await view(A, id);
      const locked = await A.post(`/api/groups/${id}/status`, { to: "LOCKED", expectedRevision: v.group.revision });
      assert.equal(locked.status, 200);
      v = await view(B, id);
      assert.equal(v.group.status, "LOCKED");
      assert.equal(v.quote.frozen, true);
      assert.equal(v.quote.totalJackets, 3);
      assert.ok(!v.viewer.permissions.includes("item.create"));
      // Frozen: no jacket changes, no joins, no leaving.
      assert.equal((await addJacket(B, id)).body.code, "GROUP_NOT_OPEN");
      assert.equal((await B.patch(`/api/groups/${id}/items/${itemB.id}`, { quantity: 9, expectedVersion: 1 })).body.code, "GROUP_NOT_OPEN");
      assert.equal((await B.del(`/api/groups/${id}/items/${itemB.id}?expectedVersion=1`)).body.code, "GROUP_NOT_OPEN");
      assert.equal((await B.post(`/api/groups/${id}/leave`)).body.code, "GROUP_NOT_OPEN");
      const j = await E.post(`/api/groups/invite/${tokenOf(v)}/join`);
      assert.equal(j.status, 409);
      assert.equal(j.body.code, "GROUP_NOT_OPEN");
      // A repeated lock click is harmless; a member can't lock or unlock.
      assert.equal((await A.post(`/api/groups/${id}/status`, { to: "LOCKED", expectedRevision: 1 })).body.replayed, true);
      assert.equal((await B.post(`/api/groups/${id}/status`, { to: "OPEN", expectedRevision: v.group.revision })).status, 403);
      // Unlock: live quote again.
      const unlocked = await A.post(`/api/groups/${id}/status`, { to: "OPEN", expectedRevision: v.group.revision });
      assert.equal(unlocked.status, 200);
      v = await view(B, id);
      assert.equal(v.quote.frozen, false);
      assert.equal(v.quote.groupRevision, undefined);
      const db = new DatabaseSync(join(server.dataDir, "jacketek.db"), { readOnly: true });
      assert.equal(db.prepare("SELECT frozen_quote FROM group_orders WHERE id = ?").get(id).frozen_quote, null);
      db.close();
    });

    test("polling with ?since= answers 304 until something changes", async () => {
      const { revision } = (await view(B, id)).group;
      assert.equal((await B.get(`/api/groups/${id}?since=${revision}`)).status, 304);
      await A.patch(`/api/groups/${id}`, { name: "AIS Seniors 2027 ‮evil" });
      const changed = await B.get(`/api/groups/${id}?since=${revision}`);
      assert.equal(changed.status, 200);
      assert.equal(changed.body.group.name, "AIS Seniors 2027 evil", "bidi override stripped");
      assert.equal((await B.patch(`/api/groups/${id}`, { name: "Mine now" })).status, 403);
    });

    test("cancelling is final; owners can still recover their designs", async () => {
      const v = await view(A, id);
      assert.equal((await B.post(`/api/groups/${id}/status`, { to: "CANCELLED", expectedRevision: v.group.revision })).status, 403);
      const c = await A.post(`/api/groups/${id}/status`, { to: "CANCELLED", expectedRevision: v.group.revision });
      assert.equal(c.status, 200);
      const after = await view(B, id);
      assert.equal(after.group.status, "CANCELLED");
      assert.equal(after.group.invite, null);
      assert.equal(after.quote, null);
      assert.equal((await addJacket(B, id)).body.code, "GROUP_NOT_OPEN");
      const reopen = await A.post(`/api/groups/${id}/status`, { to: "OPEN", expectedRevision: after.group.revision });
      assert.equal(reopen.status, 409);
      assert.equal(reopen.body.code, "INVALID_TRANSITION");
      const lock = await A.post(`/api/groups/${id}/status`, { to: "LOCKED", expectedRevision: after.group.revision });
      assert.equal(lock.body.code, "INVALID_TRANSITION");
      const mine = (await B.get(`/api/groups/${id}/my-items`)).body.items;
      assert.equal(mine[0].config.embroidery[0].image.src, ART);
    });

    test("the discount engine is ready but inactive; its shares always add up", async () => {
      const S = await loadShared();
      assert.deepEqual(S.GROUP_PRICING.tiers, [], "no discount tiers are active");
      const lines = [
        { itemId: "a", memberId: "m1", quantity: 3 },
        { itemId: "b", memberId: "m2", quantity: 1 },
        { itemId: "c", memberId: "m3", quantity: 3 },
      ];
      const none = S.quoteGroup(lines, S.GROUP_PRICING, 40, "JOD");
      assert.equal(none.subtotal, 280);
      assert.equal(none.discountAmount, 0);
      assert.equal(none.total, 280);
      // Hypothetical rules, only to exercise the engine (never shipped).
      const rules = { version: 99, basis: "jackets", tiers: [{ id: "t5", min: 5, rate: 0.1 }, { id: "t10", min: 10, rate: 0.2 }] };
      const q = S.quoteGroup(lines, rules, 33.33, "JOD");
      assert.equal(q.tier.id, "t5");
      assert.equal(q.subtotal, 233.31);
      assert.equal(q.discountAmount, 23.33);
      const cents = (x) => Math.round(x * 100);
      assert.equal(q.members.reduce((s, m) => s + cents(m.discountAmount), 0), cents(q.discountAmount));
      assert.equal(q.members.reduce((s, m) => s + cents(m.total), 0), cents(q.total));
      const byMembers = S.quoteGroup(lines, { ...rules, basis: "members", tiers: [{ id: "m3", min: 3, rate: 0.05 }] }, 10, "JOD");
      assert.equal(byMembers.tier.id, "m3");
    });
  });

  describe("invites", () => {
    test("rotating the invite kills the old link; members stay", async () => {
      const g = await newGroup(E);
      const id = g.group.id;
      const oldToken = tokenOf(g);
      await joinGroup(B, oldToken);
      assert.equal((await B.post(`/api/groups/${id}/invite/rotate`)).status, 403);
      const r = await E.post(`/api/groups/${id}/invite/rotate`);
      assert.equal(r.status, 200);
      const newToken = r.body.invite.path.split("/").pop();
      assert.notEqual(newToken, oldToken);
      assert.match(newToken, /^[A-Za-z0-9_-]{43}$/);
      assert.equal((await client(server.base).get(`/api/groups/invite/${oldToken}`)).body.code, "INVITE_INVALID");
      const oldJoin = await C.post(`/api/groups/invite/${oldToken}/join`);
      assert.equal(oldJoin.status, 404);
      assert.equal(oldJoin.body.code, "INVITE_INVALID");
      assert.equal((await C.post(`/api/groups/invite/${newToken}/join`)).status, 201);
      const v = await view(B, id);
      assert.equal(v.totals.members, 3);
      assert.equal(tokenOf(v), newToken, "members see the current link");
    });

    test("the database holds only a hash of the invite token", async () => {
      const g = await newGroup(E);
      const token = tokenOf(g);
      const db = new DatabaseSync(join(server.dataDir, "jacketek.db"), { readOnly: true });
      const row = db.prepare("SELECT * FROM group_orders WHERE id = ?").get(g.group.id);
      db.close();
      assert.ok(!JSON.stringify(row).includes(token));
      assert.equal(row.invite_token_hash, createHash("sha256").update(token).digest("hex"));
    });
  });

  describe("leaving, removal and the host role", () => {
    let id, g;
    before(async () => {
      g = await newGroup(A);
      id = g.group.id;
      for (const u of [B, C, D]) await joinGroup(u, tokenOf(g));
      await addJacket(C, id);
      await addJacket(D, id);
    });

    test("a member who leaves loses access; their jackets are withdrawn but kept for them", async () => {
      assert.equal((await C.post(`/api/groups/${id}/leave`)).status, 200);
      const r = await C.get(`/api/groups/${id}`);
      assert.equal(r.status, 403);
      assert.equal(r.body.code, "MEMBERSHIP_ENDED");
      assert.equal(r.body.membershipStatus, "left");
      assert.equal((await addJacket(C, id)).body.code, "MEMBERSHIP_ENDED");
      const dItem = (await view(A, id)).members.find((m) => m.firstName === "Sara").items[0];
      assert.equal((await C.get(dItem.previewUrl)).body.code, "MEMBERSHIP_ENDED");
      assert.equal((await C.get(`/api/groups/${id}/items/${dItem.id}`)).body.code, "MEMBERSHIP_ENDED");
      const mine = (await C.get(`/api/groups/${id}/my-items`)).body.items;
      assert.equal(mine.length, 1);
      assert.equal(mine[0].status, "withdrawn");
      assert.equal(mine[0].withdrawnReason, "member_left");
      assert.equal(mine[0].config.embroidery[0].image.original.src, ART, "the full design is recoverable");
      assert.equal((await C.get(`/api/groups/${id}/items/${mine[0].id}`)).status, 200);
      const v = await view(A, id);
      assert.equal(v.totals.members, 3);
      assert.equal(v.totals.jackets, 1);
      assert.deepEqual(v.formerMembers.map((m) => [m.firstName, m.status]), [["Lina", "left"]]);
      assert.equal((await view(B, id)).formerMembers, undefined, "only the host sees former members");
    });

    test("a member who left may rejoin while open (their old jackets stay withdrawn)", async () => {
      const r = await C.post(`/api/groups/invite/${tokenOf(g)}/join`);
      assert.equal(r.status, 201);
      const v = await view(C, id);
      assert.equal(v.viewer.role, "member");
      assert.equal(v.members.find((m) => m.isYou).items.length, 0);
    });

    test("the host removes a member; a removed member can't come back or see the group", async () => {
      let v = await view(A, id);
      const dMember = v.members.find((m) => m.firstName === "Sara");
      assert.equal((await B.del(`/api/groups/${id}/members/${dMember.id}?expectedRevision=${v.group.revision}`)).status, 403);
      assert.equal((await A.del(`/api/groups/${id}/members/${dMember.id}?expectedRevision=1`)).body.code, "REVISION_CONFLICT");
      const r = await A.del(`/api/groups/${id}/members/${dMember.id}?expectedRevision=${v.group.revision}`);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const g2 = await D.get(`/api/groups/${id}`);
      assert.equal(g2.status, 403);
      assert.equal(g2.body.membershipStatus, "removed");
      const back = await D.post(`/api/groups/invite/${tokenOf(g)}/join`);
      assert.equal(back.status, 403);
      assert.equal(back.body.code, "MEMBER_REMOVED");
      assert.equal((await client(server.base, D.cookie).get(`/api/groups/invite/${tokenOf(g)}`)).body.invite.joinable, false);
      const mine = (await D.get(`/api/groups/${id}/my-items`)).body.items;
      assert.equal(mine[0].withdrawnReason, "member_removed");
      v = await view(A, id);
      assert.equal(v.totals.jackets, 0);
    });

    test("the group never loses its host: the host can't leave or be removed, only hand over", async () => {
      let v = await view(A, id);
      const leave = await A.post(`/api/groups/${id}/leave`);
      assert.equal(leave.status, 409);
      assert.equal(leave.body.code, "HOST_MUST_TRANSFER");
      const hostId = v.viewer.memberId;
      assert.equal((await A.del(`/api/groups/${id}/members/${hostId}?expectedRevision=${v.group.revision}`)).body.code, "HOST_MUST_TRANSFER");
      const bId = v.members.find((m) => m.firstName === "Omar").id;
      assert.equal((await B.post(`/api/groups/${id}/host`, { memberId: bId, expectedRevision: v.group.revision })).status, 403);
      const removed = v.formerMembers.find((m) => m.status === "removed").id;
      assert.equal((await A.post(`/api/groups/${id}/host`, { memberId: removed, expectedRevision: v.group.revision })).body.code, "MEMBER_NOT_FOUND");
      const t = await A.post(`/api/groups/${id}/host`, { memberId: bId, expectedRevision: v.group.revision });
      assert.equal(t.status, 200, JSON.stringify(t.body));
      v = await view(B, id);
      assert.equal(v.viewer.role, "host");
      assert.equal(v.members.filter((m) => m.role === "host").length, 1);
      assert.ok(v.viewer.permissions.includes("group.lock"));
      assert.equal((await view(A, id)).viewer.role, "member");
      // The old host is a member now and may leave.
      assert.equal((await A.post(`/api/groups/${id}/leave`)).status, 200);
      const db = new DatabaseSync(join(server.dataDir, "jacketek.db"), { readOnly: true });
      const hosts = db.prepare("SELECT COUNT(*) AS n FROM group_members WHERE group_id = ? AND role = 'host' AND status = 'active'").get(id).n;
      db.close();
      assert.equal(hosts, 1);
    });
  });

  describe("malformed and oversized designs", () => {
    let id;
    before(async () => {
      id = (await newGroup(A)).group.id;
    });
    const bad = async (body, path) => {
      const r = await A.post(`/api/groups/${id}/items`, { clientRequestId: rid(), quantity: 1, ...body });
      assert.equal(r.status, 422, JSON.stringify(r.body).slice(0, 400));
      assert.equal(r.body.code, "INVALID_DESIGN");
      if (path) assert.ok(r.body.issues.some((i) => i.path === path), `issue at ${path}: ${JSON.stringify(r.body.issues)}`);
      return r;
    };
    const withImage = (image) => design({ embroidery: [{ ...design().embroidery[0], image: { ...design().embroidery[0].image, ...image } }] });

    test("invalid JSON", async () => {
      const r = await A.post(`/api/groups/${id}/items`, "{not json");
      assert.equal(r.status, 400);
      assert.equal(r.body.code, "INVALID_JSON");
    });

    test("missing or wrong catalog values", async () => {
      await bad({ config: undefined }, "config");
      await bad({ config: "jacket" }, "config");
      await bad({ config: design({ colours: { body: "neon", sleeves: "leather-white", trim: "fabric-red" } }) }, "colours.body");
      await bad({ config: design({ size: null }) }, "size");
      await bad({ config: design({ size: "XXXL" }) }, "size");
      await bad({ config: design({ fit: "baggy" }) }, "fit");
      await bad({ config: design({ zipper: "yes" }) }, "zipper");
      await bad({ config: design({ embroidery: [{ ...design().embroidery[1], placement: "forehead" }] }) }, "embroidery.0.placement");
      await bad({ config: design({ embroidery: [design().embroidery[1], { ...design().embroidery[1], id: "e2" }] }) }, "embroidery.1.placement");
      await bad({ config: design({ embroidery: [{ ...design().embroidery[0], image: null }] }) }, "embroidery.0.image");
    });

    test("quantities", async () => {
      for (const quantity of [0, 100, "1", 1.5, -1]) await bad({ config: design(), quantity }, "quantity");
    });

    test("embedded files only where artwork belongs, of image types whose bytes match", async () => {
      await bad({ config: withImage({ src: "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" }) }, "embroidery.0.image.src");
      const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]).toString("base64");
      await bad({ config: withImage({ src: `data:image/png;base64,${jpegBytes}` }) }, "embroidery.0.image.src");
      await bad({ config: withImage({ src: "data:image/png;base64,***" }) }, "embroidery.0.image.src");
      await bad({ config: withImage({ src: "https://evil.example/x.png" }) }, "embroidery.0.image.src");
      await bad({ config: withImage({ src: "/embroidery-library/../../server-data/jacketek.db" }) }, "embroidery.0.image.src");
      await bad({ config: design({ embroidery: [{ ...design().embroidery[1], text: ART }] }) }, "embroidery.0.text");
      await bad({ config: withImage({ library: { libraryTitle: ART } }) }, "embroidery.0.image.library.libraryTitle");
      // A library design (path, not a file) is fine.
      const lib = withImage({ src: "/embroidery-library/assets/2c9f6e3a-4d5b-4a7c-8d8e-9f0a1b2c3d4e/full.png", original: undefined, asUploaded: true });
      assert.equal((await A.post(`/api/groups/${id}/items`, { clientRequestId: rid(), config: lib, quantity: 1 })).status, 201);
    });

    test("unknown structures, prototype keys and deep nesting", async () => {
      await bad({ config: { ...design(), secret: { blob: "x" } } }, "secret");
      await bad({ config: design({ embroidery: [{ ...design().embroidery[1], extra: [1, 2] }] }) }, "embroidery.0.extra");
      const proto = await A.post(`/api/groups/${id}/items`, `{"clientRequestId":"${rid()}","quantity":1,"config":${JSON.stringify(design()).replace(/^\{/, '{"__proto__":{"admin":true},')}}`);
      assert.equal(proto.status, 422);
      let deep = { leaf: 1 };
      for (let i = 0; i < 12; i++) deep = { deep };
      await bad({ config: design({ embroidery: [{ ...design().embroidery[1], textStyle: deep }] }) });
      // Plain unknown values from older designs are tolerated and kept.
      const r = await A.post(`/api/groups/${id}/items`, { clientRequestId: rid(), config: { ...design(), legacyFlag: true }, quantity: 1 });
      assert.equal(r.status, 201);
      assert.equal((await A.get(`/api/groups/${id}/items/${r.body.item.id}`)).body.item.config.legacyFlag, true);
    });

    test("production-only fields are not stored", async () => {
      const el = { ...design().embroidery[1], textArtwork: { src: "x", widthPx: 1, heightPx: 1, direction: "ltr", fonts: [] } };
      const r = await A.post(`/api/groups/${id}/items`, { clientRequestId: rid(), config: design({ embroidery: [el] }), quantity: 1 });
      assert.equal(r.status, 201);
      assert.equal((await A.get(`/api/groups/${id}/items/${r.body.item.id}`)).body.item.config.embroidery[0].textArtwork, undefined);
    });

    test("previews: PNG / JPEG / WebP images up to 2 MB only", async () => {
      await bad({ config: design(), preview: "data:text/plain;base64,aGVsbG8=" }, "preview");
      await bad({ config: design(), preview: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" }, "preview");
      await bad({ config: design(), preview: 42 }, "preview");
      const big = `data:image/png;base64,${Buffer.concat([Buffer.from(PREVIEW.split(",")[1], "base64"), Buffer.alloc(2.2 * 1024 * 1024)]).toString("base64")}`;
      await bad({ config: design(), preview: big }, "preview");
    });

    test("artwork over the per-file limit is refused (422); a request over 48 MB is refused (413)", async () => {
      const huge = `data:image/png;base64,${Buffer.concat([Buffer.from(ART.split(",")[1], "base64"), Buffer.alloc(16 * 1024 * 1024)]).toString("base64")}`;
      await bad({ config: withImage({ src: huge, original: undefined }) }, "embroidery.0.image.src");
      const body = JSON.stringify({ clientRequestId: rid(), quantity: 1, config: design(), pad: "x".repeat(49 * 1024 * 1024) });
      let status;
      try {
        status = (await A.post(`/api/groups/${id}/items`, body)).status;
      } catch (err) {
        status = `connection closed (${err.cause?.code ?? err.message})`;
      }
      assert.equal(status, 413);
      // Nothing was stored by any of the refused requests above.
      const mine = (await A.get(`/api/groups/${id}/my-items`)).body.items;
      assert.equal(mine.length, 3, "only the three accepted jackets in this suite");
    });
  });

  describe("stored summaries", () => {
    test("the group page is built from stored summaries, never the full designs", async () => {
      const g = await newGroup(B);
      const id = g.group.id;
      await joinGroup(C, tokenOf(g));
      const item = (await addJacket(C, id)).body.item;
      // Make the stored full design unreadable: the group page must not need it.
      const db = new DatabaseSync(join(server.dataDir, "jacketek.db"));
      db.exec("PRAGMA busy_timeout = 5000");
      const original = db.prepare("SELECT config FROM group_items WHERE id = ?").get(item.id).config;
      db.prepare("UPDATE group_items SET config = 'not json' WHERE id = ?").run(item.id);
      const v = await B.get(`/api/groups/${id}`);
      assert.equal(v.status, 200, JSON.stringify(v.body));
      assert.equal(v.body.members.find((m) => m.firstName === "Lina").items[0].design.embroidery[1].text, "YOUSEF 27");
      db.prepare("UPDATE group_items SET config = ? WHERE id = ?").run(original, item.id);
      db.close();
    });

    test("summaries follow every change: size, replace, and a missing summary is rebuilt once", async () => {
      const g = await newGroup(B);
      const id = g.group.id;
      const item = (await addJacket(B, id)).body.item;
      const base = `/api/groups/${id}/items/${item.id}`;
      await B.patch(base, { size: "XL", expectedVersion: 1 });
      let v = await view(B, id);
      assert.equal(v.members[0].items[0].design.size, "XL");
      await B.put(base, { config: design({ size: "S", embroidery: [{ ...design().embroidery[1], text: "NEW TEXT" }] }), expectedVersion: 2 });
      v = await view(B, id);
      assert.equal(v.members[0].items[0].design.size, "S");
      assert.deepEqual(v.members[0].items[0].design.embroidery.map((e) => e.text), ["NEW TEXT"]);
      const db = new DatabaseSync(join(server.dataDir, "jacketek.db"));
      db.exec("PRAGMA busy_timeout = 5000");
      db.prepare("UPDATE group_items SET summary = NULL WHERE id = ?").run(item.id);
      v = await view(B, id);
      assert.equal(v.members[0].items[0].design.size, "S");
      assert.ok(db.prepare("SELECT summary FROM group_items WHERE id = ?").get(item.id).summary, "rebuilt and stored");
      db.close();
    });
  });

  describe("existing individual flows are unchanged", () => {
    test("a normal order is placed, stored and readable by the admin exactly as before", async () => {
      const config = textOnly();
      const order = {
        items: [{ productId: "graduation-jacket", productName: "Graduation Jacket", size: "M", quantity: 2, unitPrice: null, lineTotal: null, customization: config }],
        customer: { fullName: "Regression Test", phone: "+962791234567" },
        delivery: { city: "Amman", area: "Abdoun", address: "Street 1, Building 2", notes: "" },
        payment: { method: "cod", status: "due-on-delivery" },
      };
      const placed = await fetch(`${server.base}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order) });
      assert.equal(placed.status, 201);
      const { order: stored } = await placed.json();
      assert.match(stored.id, /^JK-\d{6}-[A-Z0-9]{4}$/);
      assert.equal(stored.status, "pending");
      assert.deepEqual(stored.pricing, { currency: "JOD", subtotal: null, delivery: null, total: null });
      assert.deepEqual(stored.payment, { method: "cod", status: "due-on-delivery" });
      assert.deepEqual(stored.items[0].customization, config);

      const invalid = await fetch(`${server.base}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...order, items: [] }) });
      assert.equal(invalid.status, 400);
      assert.match((await invalid.json()).error, /The order must contain 1–20 jackets\./);

      // Over 100 MB: refused with the order wording (now a real 413 answer instead of a dropped connection).
      const huge = await fetch(`${server.base}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "x".repeat(101 * 1024 * 1024) });
      assert.equal(huge.status, 413);
      assert.equal((await huge.json()).error, "This order is too large.");

      const login = await fetch(`${server.base}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: ADMIN_KEY }) });
      assert.equal(login.status, 200);
      const admin = login.headers.getSetCookie()[0].split(";")[0];
      const read = await fetch(`${server.base}/api/admin/orders/${stored.id}`, { headers: { Cookie: admin } });
      assert.equal(read.status, 200);
      const body = await read.json();
      assert.deepEqual(body.order.items[0].customization, config);
      assert.equal(body.measurements[0].size, "M");
      const list = await (await fetch(`${server.base}/api/admin/orders`, { headers: { Cookie: admin } })).json();
      assert.ok(list.orders.some((o) => o.id === stored.id));

      const db = new DatabaseSync(join(server.dataDir, "jacketek.db"), { readOnly: true });
      const row = db.prepare("SELECT user_id, group_order_id FROM orders WHERE id = ?").get(stored.id);
      db.close();
      assert.deepEqual({ ...row }, { user_id: null, group_order_id: null });
    });

    test("accounts: session, log-out and log-in still work", async () => {
      const s = await fetch(`${server.base}/api/auth/session`, { headers: { Cookie: A.cookie } });
      assert.equal((await s.json()).user.firstName, "Yousef");
      const anon = await fetch(`${server.base}/api/auth/session`);
      assert.equal((await anon.json()).user, null);
      const wrong = await fetch(`${server.base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", ...SAME_SITE }, body: JSON.stringify({ method: "email", email: "nobody@example.com", password: "whatever-123" }) });
      assert.equal(wrong.status, 401);
    });
  });
});

// ---------------------------------------------------------------------------
// Migrations

/** The schema before group orders (orders.mjs / auth.mjs at commit 3d01360), with some data. */
function legacyDatabase(dir) {
  const db = new DatabaseSync(join(dir, "jacketek.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE orders (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, status TEXT NOT NULL, customer_name TEXT NOT NULL, phone TEXT NOT NULL,
      city TEXT NOT NULL, area TEXT NOT NULL, address TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL, currency TEXT NOT NULL, subtotal REAL, delivery REAL, total REAL, data TEXT NOT NULL);
    CREATE TABLE order_items (order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, line INTEGER NOT NULL, product_id TEXT NOT NULL,
      product_name TEXT NOT NULL, size TEXT, quantity INTEGER NOT NULL, unit_price REAL, line_total REAL, customization TEXT NOT NULL, PRIMARY KEY (order_id, line));
    CREATE TABLE production_pdfs (order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, line INTEGER NOT NULL, production_id TEXT NOT NULL,
      pdf_name TEXT NOT NULL, artwork TEXT NOT NULL, gaps TEXT NOT NULL, generated_at TEXT NOT NULL, PRIMARY KEY (order_id, line));
    CREATE INDEX orders_created ON orders(created_at DESC);
    CREATE TABLE embroidery_designs (order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, line INTEGER NOT NULL, element_id TEXT NOT NULL,
      design_id TEXT NOT NULL, engine TEXT NOT NULL, created_at TEXT NOT NULL, metadata TEXT NOT NULL, dst BLOB NOT NULL, preview_svg TEXT NOT NULL, stitches TEXT,
      PRIMARY KEY (order_id, line, element_id));
    CREATE TABLE users (id TEXT PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT, email_normalized TEXT UNIQUE, phone_e164 TEXT UNIQUE,
      phone_country TEXT, password_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', email_verified_at TEXT, phone_verified_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_login_at TEXT, CHECK (email_normalized IS NOT NULL OR phone_e164 IS NOT NULL));
    CREATE TABLE user_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, user_agent TEXT);
  `);
  const config = textOnly();
  const order = {
    id: "JK-260101-OLD1", createdAt: "2026-01-01T10:00:00.000Z", status: "pending",
    items: [{ productId: "graduation-jacket", productName: "Graduation Jacket", size: "M", quantity: 1, unitPrice: null, lineTotal: null, customization: config }],
    pricing: { currency: "JOD", subtotal: null, delivery: null, total: null },
    customer: { fullName: "Old Customer", phone: "+962790000000" }, delivery: { city: "Amman", area: "X", address: "Old street 1", notes: "" },
    payment: { method: "cod", status: "due-on-delivery" },
  };
  db.prepare("INSERT INTO orders VALUES (?, ?, 'pending', 'Old Customer', '+962790000000', 'Amman', 'X', 'Old street 1', '', 'cod', 'due-on-delivery', 'JOD', NULL, NULL, NULL, ?)").run(order.id, order.createdAt, JSON.stringify(order));
  db.prepare("INSERT INTO order_items VALUES (?, 0, 'graduation-jacket', 'Graduation Jacket', 'M', 1, NULL, NULL, ?)").run(order.id, JSON.stringify(config));
  db.prepare("INSERT INTO users (id, first_name, last_name, email, email_normalized, password_hash, created_at, updated_at) VALUES ('u-old', 'Old', 'User', 'old@example.com', 'old@example.com', 'x', '2026-01-01', '2026-01-01')").run();
  db.close();
  return order;
}

const tables = (file) => {
  const db = new DatabaseSync(file, { readOnly: true });
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((r) => r.name);
  const migrations = names.includes("schema_migrations") ? db.prepare("SELECT version, name FROM schema_migrations ORDER BY version").all().map((r) => ({ ...r })) : [];
  const orderColumns = db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name);
  db.close();
  return { names, migrations, orderColumns };
};
const EXPECTED = [{ version: 1, name: "orders-owner-columns" }, { version: 2, name: "group-orders" }, { version: 3, name: "group-item-summaries" }];

// ---------------------------------------------------------------------------
// Shared code (server/tsModule.mjs) when esbuild's helper process has died

/**
 * Runs `loadShared()` from the given tsModule source in a fresh Node process
 * whose esbuild helper was started and then killed BEFORE the first load —
 * the state that broke every group route on a long-running dev server
 * (create returned 500 after saving the group; the import never ran).
 */
function loadSharedWithDeadEsbuild(tsModuleSource) {
  const dir = tempDir("esbuild");
  const modulePath = join(ROOT, "server", `.tsModule-under-test-${process.pid}-${Date.now()}.mjs`);
  writeFileSync(modulePath, tsModuleSource);
  const script = `
    import { execSync } from "node:child_process";
    const esbuild = await import("esbuild");
    await esbuild.transform("let a = 1"); // the helper is running
    const pids = process.platform === "win32"
      ? execSync(\`powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\\\"Name='esbuild.exe' AND ParentProcessId=\${process.pid}\\\\").ProcessId"\`).toString().trim().split(/\\s+/)
      : execSync(\`pgrep -P \${process.pid} esbuild || true\`).toString().trim().split(/\\s+/);
    for (const pid of pids.filter(Boolean)) process.kill(Number(pid));
    await new Promise((r) => setTimeout(r, 300));
    const { loadShared } = await import(${JSON.stringify(pathToFileURL(modulePath).href)});
    try {
      const S = await loadShared();
      console.log(JSON.stringify({ ok: true, quoteGroup: typeof S.quoteGroup, pricing: !!S.PRICING }));
    } catch (err) {
      console.log(JSON.stringify({ ok: false, error: err.message }));
    }`;
  try {
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: ROOT, encoding: "utf8", timeout: 120_000 });
    const line = r.stdout.trim().split("\n").at(-1);
    return { ...JSON.parse(line), stderr: r.stderr };
  } finally {
    rmSync(modulePath, { force: true });
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("shared code loading survives a dead esbuild helper", () => {
  test("control: the original loader fails for good once esbuild's helper has died", (t) => {
    const original = execFileSync("git", ["show", "HEAD:server/tsModule.mjs"], { cwd: ROOT, encoding: "utf8" });
    if (original === readFileSync(join(ROOT, "server/tsModule.mjs"), "utf8")) {
      t.skip("HEAD already contains the fixed loader, so the pre-fix loader is not available as a control");
      return;
    }
    const r = loadSharedWithDeadEsbuild(original);
    assert.equal(r.ok, false);
    assert.match(r.error, /service is no longer running/i);
  });

  test("the fixed loader recovers with a one-off esbuild process", () => {
    const r = loadSharedWithDeadEsbuild(readFileSync(join(ROOT, "server/tsModule.mjs"), "utf8"));
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.quoteGroup, "function");
    assert.equal(r.pricing, true);
    assert.match(r.stderr, /bundling again with a one-off esbuild process/);
  });
});

describe("database migrations", () => {
  test("an empty database gets every table, without a backup", async () => {
    const dir = tempDir("empty");
    const s = await startServer(dir);
    await s.stop();
    const t = tables(join(dir, "jacketek.db"));
    assert.deepEqual(t.migrations, EXPECTED);
    for (const name of ["orders", "users", "group_orders", "group_members", "group_items", "group_events", "schema_migrations"]) assert.ok(t.names.includes(name), name);
    assert.ok(t.orderColumns.includes("user_id") && t.orderColumns.includes("group_order_id"));
    assert.ok(!existsSync(join(dir, "backups")), "nothing to back up");
    rmSync(dir, { recursive: true, force: true });
  });

  test("an existing database is backed up, migrated in place, keeps its data, and re-migrating is a no-op", async () => {
    const dir = tempDir("existing");
    const order = legacyDatabase(dir);
    const s = await startServer(dir);
    assert.match(s.output(), /backed up to .*jacketek-before-v1-/);
    assert.match(s.output(), /migrated to version 2/);
    // The old order is intact and readable through the admin API.
    const login = await fetch(`${s.base}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: ADMIN_KEY }) });
    const admin = login.headers.getSetCookie()[0].split(";")[0];
    const read = await (await fetch(`${s.base}/api/admin/orders/${order.id}`, { headers: { Cookie: admin } })).json();
    assert.deepEqual(read.order.items[0].customization, order.items[0].customization);
    assert.equal(read.order.customer.fullName, "Old Customer");
    await s.stop();

    const t = tables(join(dir, "jacketek.db"));
    assert.deepEqual(t.migrations, EXPECTED);
    const backups = readdirSync(join(dir, "backups"));
    assert.equal(backups.length, 1);
    const backup = tables(join(dir, "backups", backups[0]));
    assert.ok(!backup.names.includes("group_orders"), "the backup is the database as it was");
    const bdb = new DatabaseSync(join(dir, "backups", backups[0]), { readOnly: true });
    assert.equal(bdb.prepare("SELECT COUNT(*) AS n FROM orders").get().n, 1);
    bdb.close();

    // Second start: nothing pending, no new backup, no migration.
    const again = await startServer(dir);
    await again.stop();
    assert.doesNotMatch(again.output(), /migrated to version|backed up/);
    assert.equal(readdirSync(join(dir, "backups")).length, 1);
    assert.deepEqual(tables(join(dir, "jacketek.db")).migrations, EXPECTED);
    rmSync(dir, { recursive: true, force: true });
  });

  test("a diverged migration history stops the server instead of guessing", async () => {
    const dir = tempDir("diverged");
    legacyDatabase(dir);
    const db = new DatabaseSync(join(dir, "jacketek.db"));
    db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)");
    db.prepare("INSERT INTO schema_migrations VALUES (1, 'something-else', '2026-01-01')").run();
    db.close();
    const r = await startFailing(dir);
    assert.notEqual(r.code, 0);
    assert.match(r.output, /recorded as "something-else"/);
    assert.ok(!tables(join(dir, "jacketek.db")).names.includes("group_orders"), "nothing was applied");
    rmSync(dir, { recursive: true, force: true });
  });

  test("migration 3 backfills jacket summaries for groups created before it", async () => {
    const dir = tempDir("summaries");
    let s = await startServer(dir);
    const host = seedUser(s, "Host");
    const g = (await host.post("/api/groups", { name: "Backfill", clientRequestId: rid() })).body;
    const added = await host.post(`/api/groups/${g.group.id}/items`, { clientRequestId: rid(), config: design(), quantity: 2, preview: PREVIEW });
    assert.equal(added.status, 201);
    await s.stop();
    // Back to the version-2 database (as it was before this migration).
    const db = new DatabaseSync(join(dir, "jacketek.db"));
    db.exec("ALTER TABLE group_items DROP COLUMN summary; DELETE FROM schema_migrations WHERE version = 3;");
    db.close();
    s = await startServer(dir);
    assert.match(s.output(), /migrated to version 3 \(group-item-summaries\)/);
    const check = new DatabaseSync(join(dir, "jacketek.db"), { readOnly: true });
    const row = check.prepare("SELECT summary FROM group_items WHERE id = ?").get(added.body.item.id);
    check.close();
    const summary = JSON.parse(row.summary);
    assert.equal(summary.size, "M");
    assert.deepEqual(summary.embroidery.map((e) => e.kind), ["image", "text"]);
    assert.ok(!row.summary.includes("data:image"), "no artwork in the summary");
    const host2 = client(s.base, host.cookie);
    const v = (await host2.get(`/api/groups/${g.group.id}`)).body;
    assert.equal(v.members[0].items[0].design.embroidery[1].text, "YOUSEF 27");
    // Full design and preview still served to the owner, unchanged.
    const full = (await host2.get(`/api/groups/${g.group.id}/items/${added.body.item.id}`)).body.item;
    assert.equal(full.config.embroidery[0].image.original.src, ART);
    assert.equal((await host2.get(v.members[0].items[0].previewUrl)).status, 200);
    await s.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  const REAL = join(ROOT, "server-data", "jacketek.db");
  test("a copy of this project's real database migrates and keeps every order", { skip: !existsSync(REAL) && "no server-data/jacketek.db" }, async () => {
    const dir = tempDir("real");
    // A consistent copy, read-only from the original (never modified).
    const src = new DatabaseSync(REAL, { readOnly: true });
    src.prepare("VACUUM INTO ?").run(join(dir, "jacketek.db"));
    src.close();
    const count = (sql) => {
      const db = new DatabaseSync(join(dir, "jacketek.db"), { readOnly: true });
      const n = db.prepare(sql).get().n;
      db.close();
      return n;
    };
    const before = { orders: count("SELECT COUNT(*) AS n FROM orders"), items: count("SELECT COUNT(*) AS n FROM order_items"), users: count("SELECT COUNT(*) AS n FROM users") };
    const s = await startServer(dir);
    await s.stop();
    const after = { orders: count("SELECT COUNT(*) AS n FROM orders"), items: count("SELECT COUNT(*) AS n FROM order_items"), users: count("SELECT COUNT(*) AS n FROM users") };
    assert.deepEqual(after, before);
    assert.deepEqual(tables(join(dir, "jacketek.db")).migrations, EXPECTED);
    console.log(`    real database copy: ${JSON.stringify(before)} preserved`);
    rmSync(dir, { recursive: true, force: true });
  });
});

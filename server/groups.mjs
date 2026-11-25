// Group orders: one shared, server-held order that several signed-in
// customers fill with their own jackets. The personal cart (browser only)
// and checkout are untouched; a group is an additional way to buy.
//
// Tables (created by migration 2, server/migrations.mjs):
//   group_orders   the group: name, status, `revision` (bumped by every
//                  change), the invite (epoch + hash of its token), and the
//                  quote frozen when it was locked.
//   group_members  who is in it: role host|member, status active|left|removed.
//                  UNIQUE(group_id, user_id): a customer is in a group once.
//   group_items    the jackets: each owned by ONE member (member_id), with
//                  the complete design (config JSON), quantity, a preview
//                  still, `version` (bumped by every change), and status
//                  active|withdrawn, and `summary`: what other members see of
//                  it (stored with every change — the group page never
//                  parses full designs).
//   group_events   append-only history (who did what, when).
//
// INVARIANTS (enforced here, inside one transaction per change):
//   - A group always has exactly one active host. A partial UNIQUE index
//     allows at most one; the host can't leave or be removed, only hand
//     the role to another active member (transferHost), which demotes and
//     promotes in the same transaction. Users are never deleted
//     (no ON DELETE CASCADE), so a host can't vanish with their account.
//   - Only an item's owner changes it — never the host, never another
//     member — and only while the group is OPEN and they are active.
//   - Nothing is ever hard-deleted. Deleting an item, leaving, or being
//     removed WITHDRAWS items (status = withdrawn + reason); their designs
//     stay readable by their owner forever (GET …/my-items), so a design is
//     never lost — e.g. to copy it back into the personal cart.
//   - Status: OPEN ⇄ LOCKED → CANCELLED (from OPEN or LOCKED). CANCELLED is
//     final. CHECKOUT / SUBMITTED / PAID are reserved for group checkout
//     (not built); nothing moves a group into them yet.
//       OPEN       join, add / edit / remove own jackets, leave; host manages.
//       LOCKED     contents frozen: no joins, jacket changes, leaving or
//                  removals. The host may rename, rotate the invite, hand
//                  over the host role, unlock or cancel.
//       CANCELLED  read-only; owners can still read their designs.
//   - Quotes: computed live (server only) while OPEN. Locking freezes the
//     quote, stamped with the group revision and pricing-rules version it
//     was made from; unlocking DISCARDS it (frozen_quote = NULL). A frozen
//     quote is only valid while group.revision and the rules version still
//     match — checkout must re-check both.
//   - Removed members can't rejoin (the host removed them on purpose);
//     members who left may rejoin through the invite while the group is
//     OPEN (their withdrawn jackets stay withdrawn; they re-add them).
//
// CONCURRENCY: node:sqlite is synchronous and this server is one process,
// so a change runs as a single BEGIN IMMEDIATE transaction with no await
// inside: the membership, ownership and status checks and the write it
// guards are one atomic step (a lock can't slip between "is it OPEN?" and
// the insert). Request bodies are read and designs validated BEFORE the
// transaction. Lost updates are prevented with optimistic versions:
// changes to a jacket require its `expectedVersion`; status changes, host
// transfer and member removal require the group's `expectedRevision`
// (409 on mismatch, with the current value).
//
// IDEMPOTENCY: creating a group and adding jackets take a client request
// id. Repeating a request (double-click, retry after a lost response,
// re-running a cart import) returns the original result with
// `replayed: true` and creates nothing; the same id with different content
// is refused (409 IDEMPOTENCY_MISMATCH). Joining is idempotent by
// UNIQUE(group_id, user_id).
//
// INVITES: the link carries a 256-bit token = HMAC-SHA256(secret, group id +
// invite epoch). The database stores only the token's SHA-256 (for lookup),
// so a copy of the database can't be used to join; the server can still
// show the link again to members. Rotating bumps the epoch: the old link
// stops working at once, people already in the group are unaffected.
// Secret: GROUP_INVITE_SECRET (32+ characters), or a random key generated
// once in <DATA_DIR>/group-invite.key. Changing it invalidates every link.
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AuthError, limit } from "./auth.mjs";
import { visibleDesign } from "./groupDesign.mjs";
import { HttpError } from "./http.mjs";
import "./migrations.mjs";
import { DATA_DIR, db } from "./orders.mjs";

db.exec("PRAGMA busy_timeout = 5000");

export const STATUS = { OPEN: "OPEN", LOCKED: "LOCKED", CHECKOUT: "CHECKOUT", SUBMITTED: "SUBMITTED", PAID: "PAID", CANCELLED: "CANCELLED" };

export const GROUP_LIMITS = {
  activeMembers: 100,
  itemsPerMember: 10,
  activeItems: 300,
  /** Sum of the active designs' JSON (uploaded artwork included). */
  designBytes: 750 * 1024 * 1024,
  /** OPEN or LOCKED groups one customer hosts. */
  hostedGroups: 20,
  nameLength: 80,
};

// ---------------------------------------------------------------------------
// Errors: { error, code, ...details }

export const fail = (status, code, message, details = {}) => new HttpError(status, message, { code, ...details });
const notFound = () => fail(404, "GROUP_NOT_FOUND", "Group not found.");

/** The auth module's limiter, answered with a group error code. */
function rateLimit(key, max, windowMs) {
  try {
    limit(`group:${key}`, max, windowMs, "Too many requests. Try again shortly.");
  } catch (err) {
    if (err instanceof AuthError) throw fail(429, "RATE_LIMITED", err.message);
    throw err;
  }
}
export const limits = {
  create: (userId) => rateLimit(`create:${userId}`, 20, 60 * 60_000),
  preview: (ip) => rateLimit(`preview:${ip}`, 60, 60_000),
  join: (userId, ip) => {
    rateLimit(`join:${userId}`, 30, 10 * 60_000);
    rateLimit(`join-ip:${ip}`, 60, 10 * 60_000);
  },
  write: (userId) => rateLimit(`write:${userId}`, 240, 60_000),
};

// ---------------------------------------------------------------------------
// Transactions

let inTransaction = false;
/** Runs `fn` (synchronous — never pass an async function) as one atomic change. */
export function atomically(fn) {
  if (inTransaction) throw new Error("Nested group transaction.");
  db.exec("BEGIN IMMEDIATE");
  inTransaction = true;
  try {
    const result = fn();
    if (result && typeof result.then === "function") throw new Error("Group transactions must be synchronous.");
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    inTransaction = false;
  }
}

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Invites

function inviteSecret() {
  const fromEnv = process.env.GROUP_INVITE_SECRET ?? "";
  if (fromEnv.length >= 32) return fromEnv;
  if (fromEnv) console.warn("GROUP_INVITE_SECRET is shorter than 32 characters; using the generated key instead.");
  const file = join(DATA_DIR, "group-invite.key");
  if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString("base64url"), { mode: 0o600, flag: "wx" });
  return readFileSync(file, "utf8").trim();
}
const SECRET = inviteSecret();

export const INVITE_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const inviteToken = (groupId, epoch) => createHmac("sha256", SECRET).update(`group-invite:v1:${groupId}:${epoch}`).digest("base64url");
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
const invitePath = (token) => `/join/${token}`;

// ---------------------------------------------------------------------------
// Capabilities: what each role may do, and in which group statuses.
// One table, so a future role (e.g. co-host) is a new entry, not new checks.

const ACTIONS = {
  "group.view": { roles: ["host", "member"], statuses: ["OPEN", "LOCKED", "CHECKOUT", "SUBMITTED", "PAID", "CANCELLED"] },
  "invite.view": { roles: ["host", "member"], statuses: ["OPEN", "LOCKED"] },
  "item.create": { roles: ["host", "member"], statuses: ["OPEN"] },
  "item.editOwn": { roles: ["host", "member"], statuses: ["OPEN"] },
  "member.leave": { roles: ["member"], statuses: ["OPEN"] },
  "member.remove": { roles: ["host"], statuses: ["OPEN"] },
  "group.rename": { roles: ["host"], statuses: ["OPEN", "LOCKED"] },
  "invite.rotate": { roles: ["host"], statuses: ["OPEN", "LOCKED"] },
  "host.transfer": { roles: ["host"], statuses: ["OPEN", "LOCKED"] },
  "group.lock": { roles: ["host"], statuses: ["OPEN"] },
  "group.unlock": { roles: ["host"], statuses: ["LOCKED"] },
  "group.cancel": { roles: ["host"], statuses: ["OPEN", "LOCKED"] },
};

/** Everything `actor` may do in `group` right now (for the website to show). */
export const permissionsOf = (actor, group) =>
  Object.keys(ACTIONS).filter((a) => ACTIONS[a].roles.includes(actor.role) && ACTIONS[a].statuses.includes(group.status));

/** Throws unless `actor` may do `action` (and, for an item, owns it). */
export function authorize(actor, action, group, item) {
  const rule = ACTIONS[action];
  if (!rule) throw new Error(`Unknown action ${action}`);
  if (!rule.roles.includes(actor.role)) {
    if (action === "member.leave" && actor.role === "host")
      throw fail(409, "HOST_MUST_TRANSFER", "Hand the host role to another member (or cancel the group) before leaving.");
    throw fail(403, "FORBIDDEN", "Only the group's host can do that.");
  }
  if (item && item.member_id !== actor.id) throw fail(403, "NOT_ITEM_OWNER", "You can only change your own jackets.");
  if (!rule.statuses.includes(group.status))
    throw fail(409, Object.values(TRANSITIONS).includes(action) ? "INVALID_TRANSITION" : "GROUP_NOT_OPEN", `This group is ${group.status.toLowerCase()}.`, { status: group.status });
}

// ---------------------------------------------------------------------------
// Reads

const q = {
  group: db.prepare("SELECT * FROM group_orders WHERE id = ?"),
  groupByInvite: db.prepare("SELECT * FROM group_orders WHERE invite_token_hash = ?"),
  member: db.prepare("SELECT * FROM group_members WHERE group_id = ? AND user_id = ?"),
  memberById: db.prepare("SELECT * FROM group_members WHERE id = ? AND group_id = ?"),
  members: db.prepare(
    `SELECT m.*, u.first_name, u.last_name FROM group_members m JOIN users u ON u.id = m.user_id
     WHERE m.group_id = ? ORDER BY m.role = 'host' DESC, m.joined_at, m.id`,
  ),
  activeCount: db.prepare("SELECT COUNT(*) AS n FROM group_members WHERE group_id = ? AND status = 'active'"),
  host: db.prepare(
    `SELECT m.*, u.first_name FROM group_members m JOIN users u ON u.id = m.user_id
     WHERE m.group_id = ? AND m.role = 'host' AND m.status = 'active'`,
  ),
  item: db.prepare("SELECT * FROM group_items WHERE id = ? AND group_id = ?"),
  itemByRequest: db.prepare("SELECT * FROM group_items WHERE member_id = ? AND client_request_id = ?"),
  activeItems: db.prepare(
    `SELECT i.id, i.member_id, i.quantity, i.summary, i.version, i.preview_type, i.created_at, i.updated_at
     FROM group_items i JOIN group_members m ON m.id = i.member_id
     WHERE i.group_id = ? AND i.status = 'active' AND m.status = 'active' ORDER BY i.created_at, i.id`,
  ),
  quoteLines: db.prepare(
    `SELECT i.id AS itemId, i.member_id AS memberId, i.quantity FROM group_items i JOIN group_members m ON m.id = i.member_id
     WHERE i.group_id = ? AND i.status = 'active' AND m.status = 'active' ORDER BY i.created_at, i.id`,
  ),
  configOf: db.prepare("SELECT config FROM group_items WHERE id = ?"),
  setSummary: db.prepare("UPDATE group_items SET summary = ? WHERE id = ? AND summary IS NULL"),
  memberItemCount: db.prepare("SELECT COUNT(*) AS n FROM group_items WHERE member_id = ? AND status = 'active'"),
  groupItemTotals: db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(config_bytes), 0) AS bytes FROM group_items WHERE group_id = ? AND status = 'active'"),
  myItems: db.prepare(
    `SELECT i.* FROM group_items i JOIN group_members m ON m.id = i.member_id
     WHERE i.group_id = ? AND m.user_id = ? ORDER BY i.created_at, i.id`,
  ),
  hostedOpen: db.prepare(
    `SELECT COUNT(*) AS n FROM group_members m JOIN group_orders g ON g.id = m.group_id
     WHERE m.user_id = ? AND m.role = 'host' AND m.status = 'active' AND g.status IN ('OPEN', 'LOCKED')`,
  ),
  byCreateRequest: db.prepare("SELECT * FROM group_orders WHERE created_by_user_id = ? AND create_request_id = ?"),
  myGroups: db.prepare(
    `SELECT g.*, m.role, m.status AS membership_status, m.id AS member_id,
       (SELECT COUNT(*) FROM group_members x WHERE x.group_id = g.id AND x.status = 'active') AS member_count,
       (SELECT COALESCE(SUM(i.quantity), 0) FROM group_items i JOIN group_members x ON x.id = i.member_id
          WHERE i.group_id = g.id AND i.status = 'active' AND x.status = 'active') AS jackets
     FROM group_members m JOIN group_orders g ON g.id = m.group_id WHERE m.user_id = ? ORDER BY g.updated_at DESC`,
  ),
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isId = (v) => typeof v === "string" && UUID.test(v);

/**
 * The signed-in user's active membership of a group (the "actor"), or the
 * matching error: 404 when the group doesn't exist or they were never in
 * it (no hint that it exists), 403 MEMBERSHIP_ENDED once they left or
 * were removed.
 */
function actorFor(userId, groupId) {
  if (!isId(groupId)) throw notFound();
  const group = q.group.get(groupId);
  if (!group) throw notFound();
  const member = q.member.get(groupId, userId);
  if (!member) throw notFound();
  if (member.status !== "active")
    throw fail(403, "MEMBERSHIP_ENDED", member.status === "removed" ? "The host removed you from this group." : "You left this group.", { membershipStatus: member.status });
  return { group, actor: member };
}

function itemOf(groupId, itemId) {
  const item = isId(itemId) ? q.item.get(itemId, groupId) : null;
  if (!item) throw fail(404, "ITEM_NOT_FOUND", "Jacket not found.");
  return item;
}

// ---------------------------------------------------------------------------
// Writes (always inside atomically())

function bump(groupId, extra = "") {
  db.prepare(`UPDATE group_orders SET revision = revision + 1, updated_at = ?${extra} WHERE id = ?`).run(now(), groupId);
}
function event(groupId, actorUserId, type, data = {}) {
  db.prepare("INSERT INTO group_events (group_id, actor_user_id, type, data, created_at) VALUES (?, ?, ?, ?, ?)").run(groupId, actorUserId, type, JSON.stringify(data), now());
}
function checkRevision(group, expected) {
  if (!Number.isInteger(expected)) throw fail(400, "VALIDATION", "expectedRevision is required.");
  if (expected !== group.revision) throw fail(409, "REVISION_CONFLICT", "The group changed since you loaded it. Reload and try again.", { currentRevision: group.revision });
}
function checkVersion(item, expected) {
  if (!Number.isInteger(expected)) throw fail(400, "VALIDATION", "expectedVersion is required.");
  if (expected !== item.version) throw fail(409, "VERSION_CONFLICT", "This jacket changed since you loaded it. Reload and try again.", { currentVersion: item.version });
}

/** Group names: NFC, no control or bidi-override characters, single spaces, ≤ 80 characters; "" → null. */
export function cleanName(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") throw fail(400, "VALIDATION", "The group name must be text.");
  const name = raw
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if ([...name].length > GROUP_LIMITS.nameLength) throw fail(400, "VALIDATION", `Keep the group name to ${GROUP_LIMITS.nameLength} characters.`);
  return name || null;
}

const REQUEST_ID = /^[A-Za-z0-9:_-]{8,100}$/;
export function requestId(raw) {
  if (typeof raw !== "string" || !REQUEST_ID.test(raw)) throw fail(400, "VALIDATION", "clientRequestId is required (8–100 letters, digits, '-', '_' or ':').");
  return raw;
}

// ---------------------------------------------------------------------------
// Views

/** A row's stored summary; a row without one (backfill couldn't read it, or older code wrote it) is summarised once now. */
function summaryOf(row) {
  if (row.summary) return JSON.parse(row.summary);
  const design = visibleDesign(JSON.parse(q.configOf.get(row.id).config));
  q.setSummary.run(JSON.stringify(design), row.id);
  return design;
}
const summaryJson = (config) => JSON.stringify(visibleDesign(config));

/** One jacket as the group page shows it. Full designs only go to their owner (getItem). */
function itemView(row, viewerMemberId, groupId) {
  return {
    id: row.id,
    memberId: row.member_id,
    isYours: row.member_id === viewerMemberId,
    version: row.version,
    quantity: row.quantity,
    design: summaryOf(row),
    previewUrl: row.preview_type ? `/api/groups/${groupId}/items/${row.id}/preview?v=${row.version}` : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The owner's own view of one of their jackets (status included; the design on request). */
export function ownItemView(row, { withConfig = false } = {}) {
  return {
    id: row.id,
    groupId: row.group_id,
    memberId: row.member_id,
    status: row.status,
    withdrawnReason: row.withdrawn_reason,
    version: row.version,
    quantity: row.quantity,
    productId: row.product_id,
    productName: row.product_name,
    clientRequestId: row.client_request_id,
    previewUrl: row.preview_type ? `/api/groups/${row.group_id}/items/${row.id}/preview?v=${row.version}` : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    withdrawnAt: row.withdrawn_at,
    ...(withConfig ? { config: JSON.parse(row.config) } : {}),
  };
}

function liveQuote(groupId, S) {
  return { frozen: false, ...S.quoteGroup(q.quoteLines.all(groupId), S.GROUP_PRICING, S.PRICING.jacketPrice, S.PRICING.currency) };
}

function groupView(group, actor, S) {
  const members = q.members.all(group.id);
  const items = q.activeItems.all(group.id);
  const perMember = new Map();
  for (const it of items) {
    if (!perMember.has(it.member_id)) perMember.set(it.member_id, []);
    perMember.get(it.member_id).push(itemView(it, actor.id, group.id));
  }
  const permissions = permissionsOf(actor, group);
  const active = members.filter((m) => m.status === "active");
  const person = (m) => ({ id: m.id, role: m.role, firstName: m.first_name, lastName: m.last_name, joinedAt: m.joined_at, isYou: m.id === actor.id });
  const frozen = group.frozen_quote ? JSON.parse(group.frozen_quote) : null;
  return {
    group: {
      id: group.id,
      name: group.name,
      status: group.status,
      revision: group.revision,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      lockedAt: group.locked_at,
      cancelledAt: group.cancelled_at,
      invite: permissions.includes("invite.view") ? { path: invitePath(inviteToken(group.id, group.invite_epoch)) } : null,
    },
    viewer: { memberId: actor.id, role: actor.role, permissions },
    members: active.map((m) => ({ ...person(m), items: perMember.get(m.id) ?? [] })),
    // Who left or was removed: the host's management view only.
    formerMembers: actor.role === "host" ? members.filter((m) => m.status !== "active").map((m) => ({ ...person(m), status: m.status, endedAt: m.ended_at })) : undefined,
    totals: { members: active.length, jackets: items.reduce((n, i) => n + i.quantity, 0) },
    quote: frozen ? { frozen: true, ...frozen } : group.status === "OPEN" ? liveQuote(group.id, S) : null,
  };
}

// ---------------------------------------------------------------------------
// Operations. `S` is the shared module (server/tsModule.mjs). Each returns
// plain JSON for the route.

export function createGroup(user, { name, clientRequestId }) {
  const cleaned = cleanName(name);
  const reqId = requestId(clientRequestId);
  return atomically(() => {
    const existing = q.byCreateRequest.get(user.id, reqId);
    if (existing) {
      if ((existing.name ?? null) !== cleaned) throw fail(409, "IDEMPOTENCY_MISMATCH", "This request id was already used for a different group.");
      return { groupId: existing.id, replayed: true };
    }
    if (q.hostedOpen.get(user.id).n >= GROUP_LIMITS.hostedGroups)
      throw fail(409, "LIMIT_REACHED", `You can host up to ${GROUP_LIMITS.hostedGroups} open groups.`, { limit: GROUP_LIMITS.hostedGroups });
    const id = randomUUID();
    const t = now();
    db.prepare(
      `INSERT INTO group_orders (id, name, status, revision, invite_epoch, invite_token_hash, created_by_user_id, create_request_id, created_at, updated_at)
       VALUES (?, ?, 'OPEN', 1, 1, ?, ?, ?, ?, ?)`,
    ).run(id, cleaned, tokenHash(inviteToken(id, 1)), user.id, reqId, t, t);
    db.prepare("INSERT INTO group_members (id, group_id, user_id, role, status, joined_at) VALUES (?, ?, ?, 'host', 'active', ?)").run(randomUUID(), id, user.id, t);
    event(id, user.id, "group.created", { name: cleaned });
    return { groupId: id, replayed: false };
  });
}

export function getGroup(user, groupId, S) {
  // Read-only: no transaction needed (one connection, synchronous reads).
  const { group, actor } = actorFor(user.id, groupId);
  return groupView(group, actor, S);
}

export function groupRevision(user, groupId) {
  return actorFor(user.id, groupId).group.revision;
}

export function listMyGroups(user) {
  return q.myGroups.all(user.id).map((g) => ({
    id: g.id,
    name: g.name,
    status: g.status,
    revision: g.revision,
    role: g.role,
    membershipStatus: g.membership_status,
    memberCount: g.member_count,
    jackets: g.jackets,
    updatedAt: g.updated_at,
  }));
}

/** What an invite link shows before joining: nothing about anyone's jackets. */
export function previewInvite(token, user) {
  if (!INVITE_TOKEN.test(token ?? "")) throw fail(404, "INVITE_INVALID", "This invite link isn't valid any more.");
  const group = q.groupByInvite.get(tokenHash(token));
  if (!group) throw fail(404, "INVITE_INVALID", "This invite link isn't valid any more.");
  const host = q.host.get(group.id);
  const membership = user ? q.member.get(group.id, user.id) : null;
  return {
    invite: {
      groupId: membership?.status === "active" ? group.id : null,
      name: group.name,
      status: group.status,
      hostFirstName: host?.first_name ?? null,
      memberCount: q.activeCount.get(group.id).n,
      joinable: group.status === "OPEN" && membership?.status !== "removed",
      membershipStatus: membership?.status ?? null,
    },
  };
}

export function joinGroup(user, token) {
  if (!INVITE_TOKEN.test(token ?? "")) throw fail(404, "INVITE_INVALID", "This invite link isn't valid any more.");
  return atomically(() => {
    const group = q.groupByInvite.get(tokenHash(token));
    if (!group) throw fail(404, "INVITE_INVALID", "This invite link isn't valid any more.");
    const existing = q.member.get(group.id, user.id);
    if (existing?.status === "active") return { groupId: group.id, memberId: existing.id, joined: false };
    if (existing?.status === "removed") throw fail(403, "MEMBER_REMOVED", "The host removed you from this group.");
    if (group.status !== "OPEN") throw fail(409, "GROUP_NOT_OPEN", `This group is ${group.status.toLowerCase()}; it isn't taking new members.`, { status: group.status });
    if (q.activeCount.get(group.id).n >= GROUP_LIMITS.activeMembers)
      throw fail(409, "LIMIT_REACHED", "This group is full.", { limit: GROUP_LIMITS.activeMembers });
    const t = now();
    let memberId;
    if (existing) {
      // Left earlier: back in, as a member.
      db.prepare("UPDATE group_members SET role = 'member', status = 'active', joined_at = ?, ended_at = NULL, ended_by_user_id = NULL WHERE id = ?").run(t, existing.id);
      memberId = existing.id;
      event(group.id, user.id, "member.rejoined", { memberId });
    } else {
      memberId = randomUUID();
      db.prepare("INSERT INTO group_members (id, group_id, user_id, role, status, joined_at) VALUES (?, ?, ?, 'member', 'active', ?)").run(memberId, group.id, user.id, t);
      event(group.id, user.id, "member.joined", { memberId });
    }
    bump(group.id);
    return { groupId: group.id, memberId, joined: true };
  });
}

export function renameGroup(user, groupId, { name }) {
  const cleaned = cleanName(name);
  return atomically(() => {
    const { group, actor } = actorFor(user.id, groupId);
    authorize(actor, "group.rename", group);
    if ((group.name ?? null) === cleaned) return { revision: group.revision };
    db.prepare("UPDATE group_orders SET name = ? WHERE id = ?").run(cleaned, group.id);
    bump(group.id);
    event(group.id, user.id, "group.renamed", { from: group.name, to: cleaned });
    return { revision: group.revision + 1 };
  });
}

const TRANSITIONS = { LOCKED: "group.lock", OPEN: "group.unlock", CANCELLED: "group.cancel" };

export function setStatus(user, groupId, { to, expectedRevision }, S) {
  const action = TRANSITIONS[to];
  if (!action) throw fail(400, "VALIDATION", "Status must be LOCKED, OPEN or CANCELLED.");
  return atomically(() => {
    const { group, actor } = actorFor(user.id, groupId);
    // Already there (a repeated click): nothing to do — but only the host may ask.
    if (group.status === to && ACTIONS[action].roles.includes(actor.role)) return { status: to, revision: group.revision, replayed: true };
    authorize(actor, action, group);
    checkRevision(group, expectedRevision);
    const t = now();
    const revision = group.revision + 1;
    if (to === "LOCKED") {
      // The quote frozen with the exact contents being locked.
      const quote = { ...S.quoteGroup(q.quoteLines.all(group.id), S.GROUP_PRICING, S.PRICING.jacketPrice, S.PRICING.currency), groupRevision: revision, frozenAt: t };
      db.prepare("UPDATE group_orders SET status = 'LOCKED', locked_at = ?, frozen_quote = ? WHERE id = ?").run(t, JSON.stringify(quote), group.id);
    } else if (to === "OPEN") {
      // Unlocking discards the frozen quote: contents may change again.
      db.prepare("UPDATE group_orders SET status = 'OPEN', locked_at = NULL, frozen_quote = NULL WHERE id = ?").run(group.id);
    } else {
      db.prepare("UPDATE group_orders SET status = 'CANCELLED', cancelled_at = ?, frozen_quote = NULL WHERE id = ?").run(t, group.id);
    }
    bump(group.id);
    event(group.id, user.id, `group.${to === "LOCKED" ? "locked" : to === "OPEN" ? "unlocked" : "cancelled"}`, { from: group.status });
    return { status: to, revision, replayed: false };
  });
}

export function rotateInvite(user, groupId) {
  return atomically(() => {
    const { group, actor } = actorFor(user.id, groupId);
    authorize(actor, "invite.rotate", group);
    const epoch = group.invite_epoch + 1;
    db.prepare("UPDATE group_orders SET invite_epoch = ?, invite_token_hash = ? WHERE id = ?").run(epoch, tokenHash(inviteToken(group.id, epoch)), group.id);
    bump(group.id);
    event(group.id, user.id, "invite.rotated", { epoch });
    return { invite: { path: invitePath(inviteToken(group.id, epoch)) }, revision: group.revision + 1 };
  });
}

export function transferHost(user, groupId, { memberId, expectedRevision }) {
  return atomically(() => {
    const { group, actor } = actorFor(user.id, groupId);
    authorize(actor, "host.transfer", group);
    checkRevision(group, expectedRevision);
    const target = isId(memberId) ? q.memberById.get(memberId, group.id) : null;
    if (!target || target.status !== "active") throw fail(404, "MEMBER_NOT_FOUND", "That member isn't in the group.");
    if (target.id === actor.id) throw fail(400, "VALIDATION", "You're already the host.");
    // Demote first: the one-host index never sees two.
    db.prepare("UPDATE group_members SET role = 'member' WHERE id = ?").run(actor.id);
    db.prepare("UPDATE group_members SET role = 'host' WHERE id = ?").run(target.id);
    bump(group.id);
    event(group.id, user.id, "host.transferred", { from: actor.id, to: target.id });
    return { hostMemberId: target.id, revision: group.revision + 1 };
  });
}

function withdrawMemberItems(memberId, reason, t) {
  db.prepare("UPDATE group_items SET status = 'withdrawn', withdrawn_reason = ?, withdrawn_at = ?, updated_at = ?, version = version + 1 WHERE member_id = ? AND status = 'active'").run(reason, t, t, memberId);
}

export function leaveGroup(user, groupId) {
  return atomically(() => {
    const { group, actor } = actorFor(user.id, groupId);
    authorize(actor, "member.leave", group);
    const t = now();
    db.prepare("UPDATE group_members SET status = 'left', ended_at = ?, ended_by_user_id = ? WHERE id = ?").run(t, user.id, actor.id);
    withdrawMemberItems(actor.id, "member_left", t);
    bump(group.id);
    event(group.id, user.id, "member.left", { memberId: actor.id });
    return { left: true };
  });
}

export function removeMember(user, groupId, memberId, { expectedRevision }) {
  return atomically(() => {
    const { group, actor } = actorFor(user.id, groupId);
    authorize(actor, "member.remove", group);
    checkRevision(group, expectedRevision);
    const target = isId(memberId) ? q.memberById.get(memberId, group.id) : null;
    if (!target || target.status !== "active") throw fail(404, "MEMBER_NOT_FOUND", "That member isn't in the group.");
    if (target.id === actor.id) throw fail(409, "HOST_MUST_TRANSFER", "The host can't remove themselves; hand over the host role or cancel the group.");
    const t = now();
    db.prepare("UPDATE group_members SET status = 'removed', ended_at = ?, ended_by_user_id = ? WHERE id = ?").run(t, user.id, target.id);
    withdrawMemberItems(target.id, "member_removed", t);
    bump(group.id);
    event(group.id, user.id, "member.removed", { memberId: target.id });
    return { removed: true, revision: group.revision + 1 };
  });
}

/**
 * Inserts one validated jacket for `actor` (inside a transaction), or
 * returns the jacket an earlier identical request created.
 * `prepared`: { clientRequestId, config, configJson, quantity, preview, hash }.
 */
function insertItem(group, actor, prepared, S) {
  const prior = q.itemByRequest.get(actor.id, prepared.clientRequestId);
  if (prior) {
    if (prior.request_hash !== prepared.hash) throw fail(409, "IDEMPOTENCY_MISMATCH", "This request id was already used for a different jacket.", { clientRequestId: prepared.clientRequestId });
    return { row: prior, replayed: true };
  }
  authorize(actor, "item.create", group);
  if (q.memberItemCount.get(actor.id).n >= GROUP_LIMITS.itemsPerMember)
    throw fail(409, "LIMIT_REACHED", `You can add up to ${GROUP_LIMITS.itemsPerMember} jackets to a group.`, { limit: GROUP_LIMITS.itemsPerMember });
  const totals = q.groupItemTotals.get(group.id);
  if (totals.n >= GROUP_LIMITS.activeItems) throw fail(409, "LIMIT_REACHED", "This group has reached its jacket limit.", { limit: GROUP_LIMITS.activeItems });
  if (totals.bytes + prepared.configJson.length > GROUP_LIMITS.designBytes) throw fail(409, "LIMIT_REACHED", "This group has reached its storage limit for artwork.");
  const id = randomUUID();
  const t = now();
  db.prepare(
    `INSERT INTO group_items (id, group_id, member_id, status, product_id, product_name, config, config_format, config_bytes, summary, quantity,
       preview, preview_type, version, client_request_id, request_hash, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?, 1, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
  ).run(
    id, group.id, actor.id, S.PRODUCT.id, S.PRODUCT.name, prepared.configJson, prepared.configJson.length, summaryJson(prepared.config), prepared.quantity,
    prepared.preview?.bytes ?? null, prepared.preview?.type ?? null, prepared.clientRequestId, prepared.hash, t, t,
  );
  return { row: q.item.get(id, group.id), replayed: false };
}

export function addItem(user, groupId, prepared, S) {
  return atomically(() => {
    const { group, actor } = actorFor(user.id, groupId);
    const { row, replayed } = insertItem(group, actor, prepared, S);
    if (!replayed) {
      bump(group.id);
      event(group.id, user.id, "item.added", { itemId: row.id });
    }
    return { item: ownItemView(row), replayed, revision: q.group.get(group.id).revision };
  });
}

/**
 * Cart import: every jacket or none, in one transaction. Each carries the
 * cart line's id as its clientRequestId, so re-running the same import
 * after a failure or a lost response creates nothing twice.
 */
export function importItems(user, groupId, preparedList, S) {
  return atomically(() => {
    const { group, actor } = actorFor(user.id, groupId);
    const results = preparedList.map((p) => insertItem(group, actor, p, S));
    const created = results.filter((r) => !r.replayed);
    if (created.length) {
      bump(group.id);
      event(group.id, user.id, "item.imported", { itemIds: created.map((r) => r.row.id) });
    }
    return {
      items: results.map((r) => ({ clientRequestId: r.row.client_request_id, status: r.replayed ? "replayed" : "created", item: ownItemView(r.row) })),
      revision: q.group.get(group.id).revision,
    };
  });
}

/** One of the user's own jackets with its full design — also after they left or were removed, so it can be recovered. */
export function getItem(user, groupId, itemId) {
  if (!isId(groupId)) throw notFound();
  const group = q.group.get(groupId);
  const member = group && q.member.get(groupId, user.id);
  if (!member) throw notFound();
  const item = itemOf(groupId, itemId);
  if (item.member_id !== member.id) {
    if (member.status !== "active") throw fail(403, "MEMBERSHIP_ENDED", "You're no longer in this group.", { membershipStatus: member.status });
    throw fail(403, "NOT_ITEM_OWNER", "Only the jacket's owner can open its full design.");
  }
  return { item: ownItemView(item, { withConfig: true }) };
}

/** All of the user's jackets in a group, any status (recovery and editing). */
export function myItems(user, groupId) {
  if (!isId(groupId)) throw notFound();
  const group = q.group.get(groupId);
  if (!group || !q.member.get(groupId, user.id)) throw notFound();
  return { items: q.myItems.all(groupId, user.id).map((r) => ownItemView(r, { withConfig: true })) };
}

/** Quantity and/or size of an own jacket. */
export function patchItem(user, groupId, itemId, { quantity, size, expectedVersion }, S) {
  return atomically(() => {
    const { group, actor } = actorFor(user.id, groupId);
    const item = itemOf(group.id, itemId);
    authorize(actor, "item.editOwn", group, item);
    if (item.status !== "active") throw fail(409, "ITEM_WITHDRAWN", "This jacket was removed from the group.");
    checkVersion(item, expectedVersion);
    let config = item.config;
    let summary = item.summary;
    if (size !== undefined) {
      if (!S.SIZES.includes(size)) throw fail(422, "INVALID_DESIGN", "Choose a valid size.", { issues: [{ path: "size", message: "is not a catalog size." }] });
      const next = { ...JSON.parse(item.config), size };
      config = JSON.stringify(next);
      summary = summaryJson(next);
    }
    const qty = quantity === undefined ? item.quantity : quantity;
    if (!Number.isInteger(qty) || qty < 1 || qty > S.MAX_QUANTITY)
      throw fail(422, "INVALID_DESIGN", `Quantity must be 1–${S.MAX_QUANTITY}.`, { issues: [{ path: "quantity", message: "is out of range." }] });
    db.prepare("UPDATE group_items SET quantity = ?, config = ?, config_bytes = ?, summary = ?, version = version + 1, updated_at = ? WHERE id = ?").run(qty, config, config.length, summary, now(), item.id);
    bump(group.id);
    event(group.id, user.id, "item.updated", { itemId: item.id });
    return { item: ownItemView(q.item.get(item.id, group.id)), revision: group.revision + 1 };
  });
}

/** Replaces an own jacket's whole design (reopened and edited in the configurator). */
export function replaceItem(user, groupId, itemId, prepared, expectedVersion) {
  return atomically(() => {
    const { group, actor } = actorFor(user.id, groupId);
    const item = itemOf(group.id, itemId);
    authorize(actor, "item.editOwn", group, item);
    if (item.status !== "active") throw fail(409, "ITEM_WITHDRAWN", "This jacket was removed from the group.");
    checkVersion(item, expectedVersion);
    const totals = q.groupItemTotals.get(group.id);
    if (totals.bytes - item.config_bytes + prepared.configJson.length > GROUP_LIMITS.designBytes)
      throw fail(409, "LIMIT_REACHED", "This group has reached its storage limit for artwork.");
    const keepPreview = prepared.preview === undefined;
    db.prepare(
      `UPDATE group_items SET config = ?, config_bytes = ?, summary = ?, quantity = ?, preview = ?, preview_type = ?, version = version + 1, updated_at = ? WHERE id = ?`,
    ).run(
      prepared.configJson, prepared.configJson.length, summaryJson(prepared.config), prepared.quantity ?? item.quantity,
      keepPreview ? item.preview : prepared.preview?.bytes ?? null, keepPreview ? item.preview_type : prepared.preview?.type ?? null, now(), item.id,
    );
    bump(group.id);
    event(group.id, user.id, "item.replaced", { itemId: item.id });
    return { item: ownItemView(q.item.get(item.id, group.id)), revision: group.revision + 1 };
  });
}

export function deleteItem(user, groupId, itemId, expectedVersion) {
  return atomically(() => {
    const { group, actor } = actorFor(user.id, groupId);
    const item = itemOf(group.id, itemId);
    authorize(actor, "item.editOwn", group, item);
    if (item.status !== "active") return { item: ownItemView(item), replayed: true, revision: group.revision };
    checkVersion(item, expectedVersion);
    const t = now();
    db.prepare("UPDATE group_items SET status = 'withdrawn', withdrawn_reason = 'deleted', withdrawn_at = ?, updated_at = ?, version = version + 1 WHERE id = ?").run(t, t, item.id);
    bump(group.id);
    event(group.id, user.id, "item.deleted", { itemId: item.id });
    return { item: ownItemView(q.item.get(item.id, group.id)), replayed: false, revision: group.revision + 1 };
  });
}

/** A jacket's preview still: for active members (active jackets), and always for its owner. */
export function getPreview(user, groupId, itemId) {
  if (!isId(groupId)) throw notFound();
  const group = q.group.get(groupId);
  const member = group && q.member.get(groupId, user.id);
  if (!member) throw notFound();
  const item = itemOf(groupId, itemId);
  const own = item.member_id === member.id;
  if (!own) {
    if (member.status !== "active") throw fail(403, "MEMBERSHIP_ENDED", "You're no longer in this group.", { membershipStatus: member.status });
    if (item.status !== "active") throw fail(404, "ITEM_NOT_FOUND", "Jacket not found.");
  }
  if (!item.preview_type) throw fail(404, "PREVIEW_NOT_FOUND", "This jacket has no preview.");
  return { type: item.preview_type, bytes: Buffer.from(item.preview), etag: `"${item.id}-${item.version}"` };
}

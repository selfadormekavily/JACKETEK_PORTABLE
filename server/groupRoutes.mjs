// /api/groups — group orders over HTTP (the rules live in server/groups.mjs).
//
// Every route needs a signed-in customer (session cookie), except the
// invite preview. Every change also needs the site's own header
// (checkSameSite — X-JACKETEK-Auth: 1) and is rate-limited.
// Errors: { error, code, ...details } — see the codes in server/groups.mjs.
//
//   GET    /api/groups                                   my groups
//   POST   /api/groups                {name?, clientRequestId}           create (empty) → host
//   GET    /api/groups/invite/:token                     what the invite shows (no sign-in needed)
//   POST   /api/groups/invite/:token/join                join (idempotent)
//   GET    /api/groups/:id[?since=revision]              the group page (304 if unchanged)
//   PATCH  /api/groups/:id            {name}                             host
//   POST   /api/groups/:id/status     {to: LOCKED|OPEN|CANCELLED, expectedRevision}   host
//   POST   /api/groups/:id/invite/rotate                 host: new link, old one stops working
//   POST   /api/groups/:id/host       {memberId, expectedRevision}       host: hand over the role
//   POST   /api/groups/:id/leave                         member (not the host)
//   DELETE /api/groups/:id/members/:memberId?expectedRevision=n          host
//   POST   /api/groups/:id/items      {clientRequestId, config, quantity, preview?}   own jacket
//   POST   /api/groups/:id/items/import {items: [{clientRequestId, config, quantity, preview?}]}  all or none
//   GET    /api/groups/:id/my-items                      my jackets, any status, full designs (recovery)
//   GET    /api/groups/:id/items/:itemId                 owner: full design
//   PATCH  /api/groups/:id/items/:itemId {quantity?, size?, expectedVersion}       owner
//   PUT    /api/groups/:id/items/:itemId {config, quantity?, preview?, expectedVersion}  owner: whole design
//   DELETE /api/groups/:id/items/:itemId?expectedVersion=n               owner
//   GET    /api/groups/:id/items/:itemId/preview         members: the jacket's still image
import { checkSameSite, currentUser } from "./auth.mjs";
import { DesignError, LIMITS, requestHash, validateConfig, validatePreview, validateQuantity } from "./groupDesign.mjs";
import * as G from "./groups.mjs";
import { readJsonBody, send } from "./http.mjs";
import { loadShared } from "./tsModule.mjs";

const SMALL = 16 * 1024;
const ipOf = (req) => req.socket.remoteAddress ?? "?";

function signedIn(req) {
  const user = currentUser(req);
  if (!user) throw G.fail(401, "UNAUTHENTICATED", "Log in to use group orders.");
  return user;
}

const intParam = (url, name) => {
  const v = url.searchParams.get(name);
  return v !== null && /^\d{1,9}$/.test(v) ? Number(v) : undefined;
};

/** Checks one jacket from a request (before any transaction): the stored design, its JSON, hash and preview. */
function prepare(body, S, { requireId = true } = {}) {
  try {
    const config = validateConfig(body?.config, S);
    const quantity = validateQuantity(body?.quantity ?? 1, S.MAX_QUANTITY);
    const configJson = JSON.stringify(config);
    if (configJson.length > LIMITS.configBytes) throw new DesignError([{ path: "config", message: "is too large." }]);
    return {
      clientRequestId: requireId ? G.requestId(body?.clientRequestId) : undefined,
      config,
      configJson,
      quantity,
      // undefined = not sent (PUT keeps the current preview); null = none.
      preview: body?.preview === undefined ? undefined : validatePreview(body.preview),
      hash: requestHash(config, quantity),
    };
  } catch (err) {
    if (err instanceof DesignError) throw G.fail(422, "INVALID_DESIGN", "This jacket's design couldn't be accepted.", { issues: err.issues });
    throw err;
  }
}

export async function handleGroups(req, res, url, parts) {
  const method = req.method;
  const [, , a, b, c, d] = parts; // api / groups / a / b / c / d
  if (parts.length > 6) throw G.fail(404, "NOT_FOUND", "Not found.");
  if (method !== "GET" && method !== "HEAD") {
    try {
      checkSameSite(req);
    } catch {
      throw G.fail(403, "FORBIDDEN", "Forbidden.");
    }
  }

  // ---- invite links
  if (a === "invite") {
    if (method === "GET" && parts.length === 4) {
      G.limits.preview(ipOf(req));
      return send(res, 200, G.previewInvite(b, currentUser(req)));
    }
    if (method === "POST" && parts.length === 5 && c === "join") {
      const user = signedIn(req);
      G.limits.join(user.id, ipOf(req));
      const r = G.joinGroup(user, b);
      return send(res, r.joined ? 201 : 200, r);
    }
    throw G.fail(404, "NOT_FOUND", "Not found.");
  }

  const user = signedIn(req);

  if (!a) {
    if (method === "GET") return send(res, 200, { groups: G.listMyGroups(user) });
    if (method === "POST") {
      G.limits.create(user.id);
      const body = await readJsonBody(req, SMALL);
      // Everything the answer needs is ready BEFORE the group is created: a
      // failure here creates nothing (no empty group the customer never saw).
      const S = await loadShared();
      const r = G.createGroup(user, body);
      return send(res, r.replayed ? 200 : 201, { ...G.getGroup(user, r.groupId, S), replayed: r.replayed });
    }
    throw G.fail(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }

  const groupId = a;
  if (method !== "GET") G.limits.write(user.id);

  if (!b) {
    if (method === "GET") {
      const since = intParam(url, "since");
      if (since !== undefined && since === G.groupRevision(user, groupId)) {
        res.writeHead(304, { "Cache-Control": "no-store" });
        return res.end();
      }
      return send(res, 200, G.getGroup(user, groupId, await loadShared()));
    }
    if (method === "PATCH") return send(res, 200, G.renameGroup(user, groupId, await readJsonBody(req, SMALL)));
    throw G.fail(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }

  if (b === "status" && !c && method === "POST") {
    const body = await readJsonBody(req, SMALL);
    return send(res, 200, G.setStatus(user, groupId, body ?? {}, await loadShared()));
  }
  if (b === "invite" && c === "rotate" && !d && method === "POST") return send(res, 200, G.rotateInvite(user, groupId));
  if (b === "host" && !c && method === "POST") return send(res, 200, G.transferHost(user, groupId, (await readJsonBody(req, SMALL)) ?? {}));
  if (b === "leave" && !c && method === "POST") return send(res, 200, G.leaveGroup(user, groupId));
  if (b === "members" && c && !d && method === "DELETE")
    return send(res, 200, G.removeMember(user, groupId, c, { expectedRevision: intParam(url, "expectedRevision") }));
  if (b === "my-items" && !c && method === "GET") return send(res, 200, G.myItems(user, groupId));

  if (b === "items") {
    if (!c && method === "POST") {
      const body = await readJsonBody(req, LIMITS.itemRequestBytes);
      const S = await loadShared();
      const r = G.addItem(user, groupId, prepare(body, S), S);
      return send(res, r.replayed ? 200 : 201, r);
    }
    if (c === "import" && !d && method === "POST") {
      const body = await readJsonBody(req, LIMITS.importRequestBytes);
      const list = body?.items;
      if (!Array.isArray(list) || list.length < 1 || list.length > LIMITS.importItems)
        throw G.fail(422, "VALIDATION", `Import 1–${LIMITS.importItems} jackets at a time.`, { limit: LIMITS.importItems });
      const S = await loadShared();
      const prepared = list.map((item, i) => {
        try {
          return prepare(item, S);
        } catch (err) {
          // Say which jacket; nothing is stored.
          if (err.extra?.code) err.extra = { ...err.extra, index: i, clientRequestId: typeof item?.clientRequestId === "string" ? item.clientRequestId : null };
          throw err;
        }
      });
      return send(res, 200, G.importItems(user, groupId, prepared, S));
    }
    if (c && !d) {
      if (method === "GET") return send(res, 200, G.getItem(user, groupId, c));
      if (method === "PATCH") {
        const body = (await readJsonBody(req, SMALL)) ?? {};
        return send(res, 200, G.patchItem(user, groupId, c, { quantity: body.quantity, size: body.size, expectedVersion: body.expectedVersion }, await loadShared()));
      }
      if (method === "PUT") {
        const body = await readJsonBody(req, LIMITS.itemRequestBytes);
        const S = await loadShared();
        const prepared = prepare({ ...body, quantity: body?.quantity ?? 1 }, S, { requireId: false });
        if (body?.quantity === undefined) prepared.quantity = undefined;
        return send(res, 200, G.replaceItem(user, groupId, c, prepared, body?.expectedVersion));
      }
      if (method === "DELETE") return send(res, 200, G.deleteItem(user, groupId, c, intParam(url, "expectedVersion")));
      throw G.fail(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    }
    if (c && d === "preview" && method === "GET") {
      const p = G.getPreview(user, groupId, c);
      if (req.headers["if-none-match"] === p.etag) {
        res.writeHead(304, { ETag: p.etag, "Cache-Control": "private, no-cache" });
        return res.end();
      }
      res.writeHead(200, {
        "Content-Type": p.type,
        "Content-Length": p.bytes.length,
        ETag: p.etag,
        "Cache-Control": "private, no-cache",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      });
      return res.end(p.bytes);
    }
  }
  throw G.fail(404, "NOT_FOUND", "Not found.");
}

// HTTP helpers shared by the route modules (server/index.mjs, server/groupRoutes.mjs).

// Uploaded embroidery artwork (each design's original file, up to 15 MB,
// plus its processed PNG) travels inside the order.
export const MAX_BODY = 100 * 1024 * 1024;

/**
 * An error answered as JSON: { error: message, ...extra }. Group routes put
 * a stable machine-readable `code` in `extra` (e.g. "GROUP_NOT_OPEN").
 */
export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

export function readJsonBody(req, max = MAX_BODY) {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks = [];
    const onData = (c) => {
      size += c.length;
      if (size > max) {
        // Stop reading (nothing more is buffered) and let the 413 be sent;
        // the connection is closed once it has been (see closeAfterResponse).
        req.off("data", onData);
        req.pause();
        req.tooLarge = true;
        fail(new HttpError(413, max === MAX_BODY ? "This order is too large." : "Request too large.", { code: "PAYLOAD_TOO_LARGE" }));
      } else chunks.push(c);
    };
    req.on("data", onData);
    req.on("end", () => {
      if (req.tooLarge) return;
      try {
        ok(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        fail(new HttpError(400, "Invalid JSON.", { code: "INVALID_JSON" }));
      }
    });
    req.on("error", fail);
  });
}

/**
 * A request whose body was refused part-way (413) still has unread data on
 * its connection: answer with "Connection: close", then let the rest of the
 * upload drain (discarded) so the client can read the answer — closing on a
 * half-read upload resets the connection and loses it. A sender that keeps
 * going is cut off after 5 seconds.
 */
export function closeAfterResponse(req, res) {
  if (!req.tooLarge) return {};
  res.on("finish", () => {
    const cutOff = setTimeout(() => req.destroy(), 5000);
    cutOff.unref();
    req.on("end", () => clearTimeout(cutOff));
    req.resume();
  });
  return { Connection: "close" };
}

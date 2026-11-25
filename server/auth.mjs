// Customer accounts: sign-up, log-in (email OR phone + password), log-out
// and persistent sessions, in the same SQLite database as the orders.
//
//   users          one row per customer. email_normalized and phone_e164
//                  are each UNIQUE but optional (SQLite allows many NULLs),
//                  and a CHECK requires at least one of them. The
//                  *_verified_at columns are ready for email / SMS
//                  verification; nothing sets them yet.
//   user_sessions  one row per signed-in browser. Only the SHA-256 of the
//                  session token is stored, so a copy of the database
//                  can't be replayed as a login.
//
// Passwords: Argon2id (Node's built-in crypto.argon2, OWASP parameters:
// 19 MiB, 2 passes, 1 lane), stored as a PHC string, compared in constant
// time. Plain passwords are never stored or logged.
import { argon2, createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { db } from "./orders.mjs";

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                TEXT PRIMARY KEY,
    first_name        TEXT NOT NULL,
    last_name         TEXT NOT NULL,
    email             TEXT,
    email_normalized  TEXT UNIQUE,
    phone_e164        TEXT UNIQUE,
    phone_country     TEXT,
    password_hash     TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'active',
    email_verified_at TEXT,
    phone_verified_at TEXT,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    last_login_at     TEXT,
    CHECK (email_normalized IS NOT NULL OR phone_e164 IS NOT NULL)
  );
  CREATE TABLE IF NOT EXISTS user_sessions (
    token_hash   TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TEXT NOT NULL,
    expires_at   TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    user_agent   TEXT
  );
  CREATE INDEX IF NOT EXISTS user_sessions_user ON user_sessions(user_id);
  CREATE INDEX IF NOT EXISTS user_sessions_expires ON user_sessions(expires_at);
`);

export class AuthError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

// ---------------------------------------------------------------------------
// Validation and normalisation (mirrored in src/features/auth/validation.ts)

export const PASSWORD_MIN = 7;
const PASSWORD_MAX = 256;

/** Practical email check: something@domain.tld, no spaces, no empty labels. */
export function normaliseEmail(raw) {
  if (typeof raw !== "string") return null;
  const email = raw.trim();
  if (email.length > 254) return null;
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (local.length > 64 || /\s/.test(local) || local.includes("@")) return null;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((l) => !/^[a-z0-9¡-￿](?:[a-z0-9¡-￿-]*[a-z0-9¡-￿])?$/i.test(l))) return null;
  if (labels[labels.length - 1].length < 2) return null;
  const display = `${local}@${domain}`;
  return { display, normalized: display.toLowerCase() };
}

/** Any country: { country: "JO", number: "079 123 4567" } or an E.164 string. */
export function normalisePhone(raw) {
  const number = typeof raw?.number === "string" ? raw.number : typeof raw === "string" ? raw : "";
  const country = typeof raw?.country === "string" && /^[A-Z]{2}$/.test(raw.country) ? raw.country : undefined;
  if (!number.trim() || number.length > 40) return null;
  const parsed = parsePhoneNumberFromString(number, country);
  if (!parsed || !parsed.isValid()) return null;
  return { e164: parsed.number, country: parsed.country ?? country ?? null };
}

const cleanName = (v) => (typeof v === "string" ? v.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, "").trim() : "");

function checkPassword(password, errors) {
  if (typeof password !== "string" || [...password].length < PASSWORD_MIN) errors.password = `Use at least ${PASSWORD_MIN} characters.`;
  else if (password.length > PASSWORD_MAX) errors.password = "That password is too long.";
}

// ---------------------------------------------------------------------------
// Passwords: Argon2id

const argon2Async = promisify(argon2);
const ARGON = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };

async function hashPassword(password) {
  const nonce = randomBytes(16);
  const hash = await argon2Async("argon2id", { message: password, nonce, ...ARGON });
  return `$argon2id$v=19$m=${ARGON.memory},t=${ARGON.passes},p=${ARGON.parallelism}$${nonce.toString("base64")}$${hash.toString("base64")}`;
}

async function verifyPassword(password, stored) {
  const m = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(stored ?? "");
  if (!m) return false;
  const expected = Buffer.from(m[5], "base64");
  const actual = await argon2Async("argon2id", {
    message: password,
    nonce: Buffer.from(m[4], "base64"),
    memory: Number(m[1]),
    passes: Number(m[2]),
    parallelism: Number(m[3]),
    tagLength: expected.length,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Unknown accounts still pay for one hash, so response time doesn't reveal
// whether an email or phone is registered.
const DUMMY_HASH = await hashPassword(randomBytes(12).toString("hex"));

// ---------------------------------------------------------------------------
// Rate limits (in memory, per server process; also used by server/groups.mjs)

const buckets = new Map();
export function limit(key, max, windowMs, message) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) throw new AuthError(429, message);
  hits.push(now);
  buckets.set(key, hits);
}
const clearLimit = (key) => buckets.delete(key);

// ---------------------------------------------------------------------------
// Sessions: a random 256-bit token in an HttpOnly cookie; the DB keeps its hash.

export const SESSION_COOKIE = "jk_session";
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");

export function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

const secureRequest = (req) => req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";

export function sessionCookie(req, token, maxAgeSeconds) {
  const secure = secureRequest(req) ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure}`;
}

function createSession(req, userId) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  db.prepare(
    "INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(tokenHash(token), userId, now.toISOString(), new Date(now.getTime() + SESSION_MS).toISOString(), now.toISOString(), String(req.headers["user-agent"] ?? "").slice(0, 300));
  return { cookie: sessionCookie(req, token, SESSION_MS / 1000) };
}

/** The signed-in customer for this request, or null. */
export function currentUser(req) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token || token.length > 100) return null;
  const row = db
    .prepare(
      `SELECT u.*, s.expires_at AS session_expires, s.last_seen_at AS session_seen FROM user_sessions s
       JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    )
    .get(tokenHash(token));
  if (!row) return null;
  if (row.session_expires < new Date().toISOString() || row.status !== "active") {
    db.prepare("DELETE FROM user_sessions WHERE token_hash = ?").run(tokenHash(token));
    return null;
  }
  // Note activity at most once an hour (keeps reads cheap).
  if (Date.now() - Date.parse(row.session_seen) > 60 * 60 * 1000) {
    db.prepare("UPDATE user_sessions SET last_seen_at = ? WHERE token_hash = ?").run(new Date().toISOString(), tokenHash(token));
  }
  return row;
}

/** What the browser may know about the customer: never the hash or internals. */
export function publicUser(row) {
  return row
    ? { id: row.id, firstName: row.first_name, lastName: row.last_name, email: row.email ?? null, phone: row.phone_e164 ?? null }
    : null;
}

// ---------------------------------------------------------------------------
// The three actions

const ipOf = (req) => req.socket.remoteAddress ?? "?";

export async function signUp(req, body) {
  limit(`signup:${ipOf(req)}`, 10, 10 * 60_000, "Too many sign-ups from here. Try again in a few minutes.");
  const errors = {};
  const firstName = cleanName(body?.firstName);
  const lastName = cleanName(body?.lastName);
  if (!firstName) errors.firstName = "Enter your first name.";
  else if (firstName.length > 60) errors.firstName = "That name is too long.";
  if (!lastName) errors.lastName = "Enter your last name.";
  else if (lastName.length > 60) errors.lastName = "That name is too long.";

  let email = null;
  let phone = null;
  if (body?.method === "phone") {
    phone = normalisePhone(body?.phone);
    if (!phone) errors.phone = "Enter a valid mobile number for the selected country.";
  } else {
    email = normaliseEmail(body?.email);
    if (!email) errors.email = "Enter a valid email address, like name@example.com.";
  }
  checkPassword(body?.password, errors);
  if (Object.keys(errors).length) throw new AuthError(400, "Please check the highlighted fields.", errors);

  // Duplicates: the person signing up needs to know to log in instead.
  if (email && db.prepare("SELECT 1 FROM users WHERE email_normalized = ?").get(email.normalized))
    throw new AuthError(409, "An account already uses this email.", { email: "An account already uses this email. Log in instead." });
  if (phone && db.prepare("SELECT 1 FROM users WHERE phone_e164 = ?").get(phone.e164))
    throw new AuthError(409, "An account already uses this number.", { phone: "An account already uses this number. Log in instead." });

  const now = new Date().toISOString();
  const id = randomUUID();
  const hash = await hashPassword(body.password);
  try {
    db.prepare(
      `INSERT INTO users (id, first_name, last_name, email, email_normalized, phone_e164, phone_country, password_hash, created_at, updated_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, firstName, lastName, email?.display ?? null, email?.normalized ?? null, phone?.e164 ?? null, phone?.country ?? null, hash, now, now, now);
  } catch (err) {
    // A concurrent sign-up with the same identifier hit the UNIQUE index.
    if (String(err?.message).includes("UNIQUE")) throw new AuthError(409, "An account already uses these details. Log in instead.");
    throw err;
  }
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  return { user: publicUser(user), ...createSession(req, id) };
}

const LOGIN_FAILED = "Email/phone or password is incorrect.";

export async function logIn(req, body) {
  const ip = ipOf(req);
  limit(`login-ip:${ip}`, 20, 60_000, "Too many attempts. Try again in a minute.");
  let row = null;
  let key = null;
  if (body?.method === "phone") {
    const phone = normalisePhone(body?.phone);
    if (!phone) throw new AuthError(400, "Enter a valid mobile number for the selected country.", { phone: "Enter a valid mobile number for the selected country." });
    key = phone.e164;
    row = db.prepare("SELECT * FROM users WHERE phone_e164 = ?").get(phone.e164);
  } else {
    const email = normaliseEmail(body?.email);
    if (!email) throw new AuthError(400, "Enter a valid email address.", { email: "Enter a valid email address, like name@example.com." });
    key = email.normalized;
    row = db.prepare("SELECT * FROM users WHERE email_normalized = ?").get(email.normalized);
  }
  if (typeof body?.password !== "string" || !body.password || body.password.length > PASSWORD_MAX) throw new AuthError(401, LOGIN_FAILED);
  limit(`login-id:${key}`, 8, 15 * 60_000, "Too many attempts for this account. Try again in 15 minutes.");

  const ok = await verifyPassword(body.password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok || row.status !== "active") throw new AuthError(401, LOGIN_FAILED);

  clearLimit(`login-id:${key}`);
  const now = new Date().toISOString();
  db.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(now, now, row.id);
  return { user: publicUser(row), ...createSession(req, row.id) };
}

export function logOut(req) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) db.prepare("DELETE FROM user_sessions WHERE token_hash = ?").run(tokenHash(token));
  return { cookie: sessionCookie(req, "", 0) };
}

/**
 * State-changing auth requests must come from this site's own pages: a
 * custom header (which other origins can't send without a CORS preflight
 * this server never grants) and, when present, a same-host Origin.
 */
export function checkSameSite(req) {
  if (req.headers["x-jacketek-auth"] !== "1") throw new AuthError(403, "Forbidden.");
  const origin = req.headers.origin;
  if (origin) {
    let host = null;
    try {
      host = new URL(origin).host;
    } catch {
      /* invalid */
    }
    // Same host as the request (or as the reverse proxy in front of us reports).
    const own = [req.headers.host, req.headers["x-forwarded-host"]].filter(Boolean);
    if (!host || !own.includes(host)) throw new AuthError(403, "Forbidden.");
  }
}

// Expired sessions are removed at start-up and then once a day.
const purge = () => db.prepare("DELETE FROM user_sessions WHERE expires_at < ?").run(new Date().toISOString());
purge();
setInterval(purge, 24 * 60 * 60 * 1000).unref();

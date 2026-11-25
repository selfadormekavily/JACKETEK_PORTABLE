// Versioned, additive schema migrations for the one SQLite database.
//
// The original tables (orders, order_items, production_pdfs,
// embroidery_designs, users, user_sessions) are the baseline: orders.mjs and
// auth.mjs still create them with CREATE TABLE IF NOT EXISTS. Everything
// added since lives here, recorded in `schema_migrations`.
//
// Rules:
//   - Forward-only and additive: new tables, new nullable columns, new
//     indexes. Never drop, rename or retype a column; never rewrite rows.
//     So rolling the CODE back is safe without touching the database (older
//     code never reads the new tables, and every INSERT it runs names its
//     columns, so new nullable columns stay NULL).
//   - Each migration runs in its own BEGIN IMMEDIATE transaction together
//     with its schema_migrations row: it applies fully or not at all. A
//     failure stops the server from starting, with the database at the
//     previous version.
//   - Before the first pending migration runs on a database that already
//     holds orders or accounts, a full copy is written (VACUUM INTO) to
//     <DATA_DIR>/backups/. Rolling the DATA back = stop the server and put
//     that file back as jacketek.db (removing the -wal / -shm files).
//   - A recorded version whose name differs from the code's is a diverged
//     history: the server refuses to start rather than guess.
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import "./auth.mjs"; // the baseline users table (groups reference it)
import { visibleDesign } from "./groupDesign.mjs";
import { DATA_DIR, db } from "./orders.mjs";

const hasColumn = (table, column) => db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
const addColumn = (table, column, type) => {
  if (!hasColumn(table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
};

/** In order. Append only; never edit one that has shipped. */
export const MIGRATIONS = [
  {
    version: 1,
    name: "orders-owner-columns",
    // Who placed an order and which group it settles. Nothing writes them yet
    // (checkout is unchanged); group checkout will.
    up() {
      addColumn("orders", "user_id", "TEXT");
      addColumn("orders", "group_order_id", "TEXT");
      db.exec(`
        CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id);
        CREATE INDEX IF NOT EXISTS orders_group ON orders(group_order_id);
      `);
    },
  },
  {
    version: 2,
    name: "group-orders",
    // See server/groups.mjs for what each column means and the invariants.
    up() {
      db.exec(`
        CREATE TABLE IF NOT EXISTS group_orders (
          id                 TEXT PRIMARY KEY,
          name               TEXT,
          status             TEXT NOT NULL,
          revision           INTEGER NOT NULL DEFAULT 1,
          invite_epoch       INTEGER NOT NULL DEFAULT 1,
          invite_token_hash  TEXT NOT NULL UNIQUE,
          created_by_user_id TEXT NOT NULL REFERENCES users(id),
          create_request_id  TEXT,
          payment_mode       TEXT,
          frozen_quote       TEXT,
          created_at         TEXT NOT NULL,
          updated_at         TEXT NOT NULL,
          locked_at          TEXT,
          cancelled_at       TEXT,
          UNIQUE (created_by_user_id, create_request_id)
        );
        CREATE TABLE IF NOT EXISTS group_members (
          id               TEXT PRIMARY KEY,
          group_id         TEXT NOT NULL REFERENCES group_orders(id),
          user_id          TEXT NOT NULL REFERENCES users(id),
          role             TEXT NOT NULL,
          status           TEXT NOT NULL,
          joined_at        TEXT NOT NULL,
          ended_at         TEXT,
          ended_by_user_id TEXT REFERENCES users(id),
          UNIQUE (group_id, user_id)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS group_members_one_host ON group_members(group_id) WHERE role = 'host' AND status = 'active';
        CREATE INDEX IF NOT EXISTS group_members_user ON group_members(user_id, status);
        CREATE TABLE IF NOT EXISTS group_items (
          id                TEXT PRIMARY KEY,
          group_id          TEXT NOT NULL REFERENCES group_orders(id),
          member_id         TEXT NOT NULL REFERENCES group_members(id),
          status            TEXT NOT NULL,
          withdrawn_reason  TEXT,
          product_id        TEXT NOT NULL,
          product_name      TEXT NOT NULL,
          config            TEXT NOT NULL,
          config_format     INTEGER NOT NULL,
          config_bytes      INTEGER NOT NULL,
          quantity          INTEGER NOT NULL,
          preview           BLOB,
          preview_type      TEXT,
          version           INTEGER NOT NULL DEFAULT 1,
          client_request_id TEXT NOT NULL,
          request_hash      TEXT NOT NULL,
          order_id          TEXT REFERENCES orders(id),
          created_at        TEXT NOT NULL,
          updated_at        TEXT NOT NULL,
          withdrawn_at      TEXT,
          UNIQUE (member_id, client_request_id)
        );
        CREATE INDEX IF NOT EXISTS group_items_group ON group_items(group_id, status);
        CREATE INDEX IF NOT EXISTS group_items_member ON group_items(member_id, status);
        CREATE TABLE IF NOT EXISTS group_events (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id      TEXT NOT NULL REFERENCES group_orders(id),
          actor_user_id TEXT REFERENCES users(id),
          type          TEXT NOT NULL,
          data          TEXT NOT NULL DEFAULT '{}',
          created_at    TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS group_events_group ON group_events(group_id, id);
      `);
    },
  },
  {
    version: 3,
    name: "group-item-summaries",
    // What other members see of each jacket (groupDesign.mjs visibleDesign),
    // stored when the jacket is saved, so the group page never parses the full
    // designs (uploaded artwork can make each one tens of MB). Existing rows
    // are backfilled one at a time; a row whose design can't be read keeps a
    // NULL summary and is summarised on first use (server/groups.mjs).
    up() {
      addColumn("group_items", "summary", "TEXT");
      const ids = db.prepare("SELECT id FROM group_items WHERE summary IS NULL").all().map((r) => r.id);
      const read = db.prepare("SELECT config FROM group_items WHERE id = ?");
      const write = db.prepare("UPDATE group_items SET summary = ? WHERE id = ?");
      for (const id of ids) {
        try {
          write.run(JSON.stringify(visibleDesign(JSON.parse(read.get(id).config))), id);
        } catch {
          /* left NULL: summarised on first use */
        }
      }
    },
  },
];

function migrate() {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Map(db.prepare("SELECT version, name FROM schema_migrations").all().map((r) => [r.version, r.name]));
  for (const m of MIGRATIONS) {
    if (applied.has(m.version) && applied.get(m.version) !== m.name)
      throw new Error(`Database migration ${m.version} is recorded as "${applied.get(m.version)}", but this code calls it "${m.name}". Refusing to start.`);
  }
  const newest = Math.max(0, ...applied.keys());
  const known = MIGRATIONS.at(-1).version;
  if (newest > known) console.warn(`Database schema is at version ${newest}; this code knows up to ${known}. Continuing (migrations are additive).`);

  const pending = MIGRATIONS.filter((m) => !applied.has(m.version));
  if (!pending.length) return;

  const hasData = db.prepare("SELECT (SELECT COUNT(*) FROM orders) + (SELECT COUNT(*) FROM users) AS n").get().n > 0;
  if (hasData) {
    const dir = join(DATA_DIR, "backups");
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = join(dir, `jacketek-before-v${pending[0].version}-${stamp}.db`);
    if (!existsSync(file)) db.prepare("VACUUM INTO ?").run(file);
    console.log(`database backed up to ${file} before migrating`);
  }

  for (const m of pending) {
    db.exec("BEGIN IMMEDIATE");
    try {
      m.up();
      db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)").run(m.version, m.name, new Date().toISOString());
      db.exec("COMMIT");
      console.log(`database migrated to version ${m.version} (${m.name})`);
    } catch (err) {
      db.exec("ROLLBACK");
      throw new Error(`Database migration ${m.version} (${m.name}) failed and was rolled back: ${err.message}`);
    }
  }
}

migrate();

/** The applied migration versions (for tests and diagnostics). */
export const appliedMigrations = () => db.prepare("SELECT version, name, applied_at FROM schema_migrations ORDER BY version").all();

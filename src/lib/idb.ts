/**
 * A tiny key-value store on IndexedDB, for drafts too large for
 * localStorage (embroidery artwork travels inside a design as data URLs).
 * Never used for anything sensitive: auth lives in an HttpOnly cookie.
 * Every call resolves (null / no-op) when IndexedDB is unavailable.
 */
const DB_NAME = "jacketek";
const STORE = "drafts";

let opening: Promise<IDBDatabase | null> | null = null;

/** An open that hasn't settled by then (e.g. queued behind another tab's upgrade) counts as unavailable. */
const OPEN_TIMEOUT_MS = 4000;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  opening ??= new Promise<IDBDatabase | null>((resolve) => {
    // Unavailable this time: let a later call try again.
    const fail = () => {
      opening = null;
      resolve(null);
    };
    const timer = window.setTimeout(fail, OPEN_TIMEOUT_MS);
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => {
        window.clearTimeout(timer);
        const db = req.result;
        // Never hold up another tab's upgrade or deletion: step aside, reopen later.
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        window.clearTimeout(timer);
        fail();
      };
      req.onblocked = () => {
        window.clearTimeout(timer);
        fail();
      };
    } catch {
      window.clearTimeout(timer);
      fail();
    }
  });
  return opening;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return open().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const req = fn(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export const idbGet = <T>(key: string) => run<T>("readonly", (s) => s.get(key) as IDBRequest<T>);
export const idbSet = (key: string, value: unknown) => run("readwrite", (s) => s.put(value, key)).then(() => undefined);
export const idbDelete = (key: string) => run("readwrite", (s) => s.delete(key)).then(() => undefined);

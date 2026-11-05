import type { StateStorage } from 'zustand/middleware';

/**
 * Web persistence: IndexedDB. localStorage caps out around 5 MB, which a handful of photos or one
 * imported PDF fills — after that saves fail silently. IndexedDB allows hundreds of MB.
 *
 * Older versions saved to localStorage; on first read we move that data over.
 */
const DB_NAME = 'kober';
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function legacy(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Saves run one after another so an older save can never land after a newer one. */
let queue: Promise<unknown> = Promise.resolve();

export const appStorage: StateStorage = {
  getItem: async (key) => {
    await queue;
    const value = await run<string | undefined>('readonly', (s) => s.get(key));
    if (value != null) return value;
    const old = legacy(key);
    if (old != null) {
      await run('readwrite', (s) => s.put(old, key));
      try {
        localStorage.removeItem(key); // only once the copy is safely in IndexedDB
      } catch {}
    }
    return old;
  },
  setItem: (key, value) => {
    const job = queue.then(() => run('readwrite', (s) => s.put(value, key)));
    queue = job.catch((e) => console.error('[storage] save failed', e));
    return job.then(() => undefined);
  },
  removeItem: async (key) => {
    await queue;
    await run('readwrite', (s) => s.delete(key));
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

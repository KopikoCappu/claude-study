/**
 * Web: note recordings are stored as blobs in their own IndexedDB database (they're too big for the notes
 * store, and aren't uploaded by sync).
 */
const DB_NAME = 'kober-audio';
const STORE = 'blobs';

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

const urls = new Map<string, string>();

/** Copy a finished recording (a blob: URL from the recorder) into IndexedDB. */
export async function saveAudio(id: string, recorderUri: string): Promise<void> {
  const blob = await (await fetch(recorderUri)).blob();
  await run('readwrite', (s) => s.put(blob, id));
}

/** A playable URL, or null if this browser doesn't have the recording. */
export async function audioUri(id: string): Promise<string | null> {
  const cached = urls.get(id);
  if (cached) return cached;
  const blob = await run<Blob | undefined>('readonly', (s) => s.get(id));
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(id, url);
  return url;
}

export async function deleteAudio(id: string): Promise<void> {
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
  await run('readwrite', (s) => s.delete(id));
}

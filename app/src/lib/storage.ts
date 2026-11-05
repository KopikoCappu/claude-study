import { File, Paths } from 'expo-file-system';
import type { StateStorage } from 'zustand/middleware';

/**
 * Native persistence: one JSON file per key in the app's document directory.
 * (Android AsyncStorage caps out at ~6 MB, which a few photos would blow through.)
 * Writes are debounced because the store persists on every stroke.
 *
 * Writes are crash-safe: the new data goes to `<key>.json.tmp` first and only replaces the real file
 * once it's fully written. If the app is killed mid-save, either the old file or the finished temp
 * file is still there — never a half-written one.
 */
const WRITE_DELAY_MS = 400;
const pending = new Map<string, { value: string; timer: ReturnType<typeof setTimeout> }>();

const fileFor = (key: string) => new File(Paths.document, `${key}.json`);
const tmpFor = (key: string) => new File(Paths.document, `${key}.json.tmp`);

async function flush(key: string) {
  const job = pending.get(key);
  if (!job) return;
  pending.delete(key);
  const tmp = tmpFor(key);
  if (!tmp.exists) tmp.create();
  await tmp.write(job.value);
  tmp.moveSync(fileFor(key), { overwrite: true });
}

export const appStorage: StateStorage = {
  getItem: async (key) => {
    const queued = pending.get(key);
    if (queued) return queued.value;
    const file = fileFor(key);
    if (file.exists) return await file.text();
    // Killed between finishing the temp file and moving it into place.
    const tmp = tmpFor(key);
    return tmp.exists ? await tmp.text() : null;
  },
  setItem: (key, value) => {
    const prev = pending.get(key);
    if (prev) clearTimeout(prev.timer);
    pending.set(key, { value, timer: setTimeout(() => void flush(key), WRITE_DELAY_MS) });
  },
  removeItem: (key) => {
    const prev = pending.get(key);
    if (prev) clearTimeout(prev.timer);
    pending.delete(key);
    for (const f of [fileFor(key), tmpFor(key)]) if (f.exists) f.delete();
  },
};

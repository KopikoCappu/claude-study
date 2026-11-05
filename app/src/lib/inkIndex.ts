import { activeKey } from './aiKey';
import { readHandwriting } from './api';
import { strokeBounds } from './ink';
import { pageCountFor, pageIndexOf, pageRect } from './pages';
import { renderRegion } from './snapshot';
import { useStore } from './store';
import type { InkIndexEntry, Page } from './types';
import { useUsage } from './usage';

/**
 * Handwriting search: each page of a note is rendered from its ink and read by the AI (with the user's own key),
 * and the text is saved on the note as `inkIndex`. A page is only read again when its ink changes, so each
 * page costs one small request per edit session. Runs when you leave a note, and once at startup for
 * anything not yet read.
 */

/** Ink strokes on page `i` (highlighter marks aren't writing). */
const inkOn = (page: Page, i: number) => page.strokes.filter((s) => s.tool !== 'highlighter' && pageIndexOf(strokeBounds(s)) === i);

/** Fingerprint of the ink on a page, to tell whether it changed since it was read. */
function signature(page: Page, i: number) {
  let h = 0;
  for (const s of inkOn(page, i)) for (const ch of s.id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return `${inkOn(page, i).length}:${h}`;
}

/** Pages of a note whose ink changed since it was last read (or that lost all their ink). */
function stalePages(page: Page): number[] {
  const out: number[] = [];
  for (let i = 0; i < pageCountFor(page); i++) {
    const entry = page.inkIndex?.find((e) => e.page === i);
    const sig = signature(page, i);
    if (inkOn(page, i).length === 0 ? !!entry : entry?.sig !== sig) out.push(i);
  }
  return out;
}

let running = false;
const queued = new Set<string>();

/** Read the handwriting of notes whose ink changed. Pass ids to limit it to those notes. Safe to call often. */
export async function indexHandwriting(noteIds?: string[]) {
  const { pages, searchHandwriting } = useStore.getState();
  const key = activeKey();
  if (!searchHandwriting || !key) return;
  for (const id of noteIds ?? Object.keys(pages)) queued.add(id);
  if (running) return;
  running = true;
  try {
    while (queued.size) {
      const id = queued.values().next().value as string;
      queued.delete(id);
      await indexNote(id, key);
    }
  } finally {
    running = false;
  }
}

async function indexNote(id: string, key: string) {
  const page = useStore.getState().pages[id];
  if (!page || page.deletedAt) return;
  for (const i of stalePages(page)) {
    // Re-read the latest version: the user may still be writing in another note meanwhile.
    const current = useStore.getState().pages[id];
    if (!current) return;
    const strokes = inkOn(current, i);
    const sig = signature(current, i);
    let entry: InkIndexEntry | null = null;
    if (strokes.length) {
      const image = renderRegion(current, pageRect(i), { strokeIds: strokes.map((s) => s.id), imageIds: [], longSide: 1200 });
      if (!image) continue;
      try {
        const read = await readHandwriting(key, { ...image, mime: 'image/png' });
        useUsage.getState().record(read.usage, 'search', id);
        entry = { page: i, text: read.text.trim(), sig };
      } catch {
        return; // offline, out of credits, or an older server: try again next time
      }
    }
    useStore.getState().updatePage(id, (p) => ({
      inkIndex: [...(p.inkIndex ?? []).filter((e) => e.page !== i), ...(entry ? [entry] : [])].sort((a, b) => a.page - b.page),
    }));
  }
}

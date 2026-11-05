import type { Page, StudyTool } from './types';

// Same as uid() in ink.ts, without pulling the drawing engine into this module.
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** Earlier versions kept per tool (each is a full page of HTML, and they sync with the note). */
export const MAX_VERSIONS = 5;

export type LibraryEntry = { tool: StudyTool; pageId: string; pageTitle: string };

/**
 * Every tool in every note, newest first — the student's tool library. A tool copied between notes is listed once.
 * `exclude` leaves out one note's tools (the note that's open).
 */
export function libraryOf(pages: Record<string, Page>, exclude?: string): LibraryEntry[] {
  const seen = new Set<string>();
  const out: LibraryEntry[] = [];
  const all = Object.values(pages).flatMap((p) => (p.tools ?? []).map((tool) => ({ tool, pageId: p.id, pageTitle: p.title || 'Untitled' })));
  all.sort((a, b) => b.tool.updatedAt - a.tool.updatedAt);
  // Tools in the open note count as seen first, so their copies elsewhere aren't offered again.
  if (exclude) for (const t of pages[exclude]?.tools ?? []) seen.add(t.sourceId ?? t.id);
  for (const e of all) {
    const k = e.tool.sourceId ?? e.tool.id;
    if (e.pageId === exclude || seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

/** A copy of a tool for another note. Free: nothing is rebuilt. */
export function copyTool(t: StudyTool): StudyTool {
  const now = Date.now();
  return { id: uid(), title: t.title, prompt: t.prompt, html: t.html, createdAt: now, updatedAt: now, sourceId: t.sourceId ?? t.id };
}

/** The tool after a change or fix: the old version is kept so the change can be undone. */
export function withNewVersion(t: StudyTool, title: string, html: string, now: number): StudyTool {
  const versions = [...(t.versions ?? []), { title: t.title, html: t.html, savedAt: t.updatedAt }].slice(-MAX_VERSIONS);
  return { ...t, title, html, updatedAt: now, versions };
}

/** Go back to the version before the latest change. */
export function undoVersion(t: StudyTool): StudyTool {
  const versions = [...(t.versions ?? [])];
  const prev = versions.pop();
  if (!prev) return t;
  return { ...t, title: prev.title, html: prev.html, updatedAt: Date.now(), versions, lastUsage: undefined };
}

const STOP = new Set(
  'the and for with that this from into about make build give want let practice tool tools quiz help some can you please how what using use show'.split(' '),
);
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)));

/** Tools the student already has that look like what they're about to ask for (so they can reuse one instead of paying again). */
export function similarTools(query: string, entries: LibraryEntry[], max = 2): LibraryEntry[] {
  const q = words(query);
  if (!q.size) return [];
  return entries
    .map((e) => {
      const w = words(`${e.tool.title} ${e.tool.prompt}`);
      let hits = 0;
      for (const x of q) if (w.has(x) || [...w].some((y) => y.length >= 4 && x.length >= 4 && (y.startsWith(x) || x.startsWith(y)))) hits++;
      return { e, hits };
    })
    .filter(({ hits }) => hits >= Math.min(2, q.size))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, max)
    .map(({ e }) => e);
}

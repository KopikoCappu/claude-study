import { mathBounds, textBounds } from './ink';
import { pageIndexOf } from './pages';
import type { Page } from './types';

export type SearchHit = {
  page: Page;
  /** Page of the note where the first match is (0-based), when known. */
  pageIndex: number | null;
  /** A bit of the matching text, with the match near the start. */
  snippet: string;
  where: 'title' | 'typed' | 'handwriting' | 'equation' | 'chat';
};

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

function snippetAround(text: string, term: string) {
  const flat = text.replace(/\s+/g, ' ').trim();
  const at = norm(flat).indexOf(term);
  if (at < 0) return flat.slice(0, 120);
  const start = Math.max(0, at - 40);
  return `${start > 0 ? '…' : ''}${flat.slice(start, start + 140)}${start + 140 < flat.length ? '…' : ''}`;
}

/**
 * Find notes containing every word of the query, in their title, typed text, handwriting (once the AI has read
 * it, see inkIndex.ts), equations or AI chat. Notes in Recently deleted are skipped. Title matches come first,
 * then the most recently edited.
 */
export function searchNotes(pages: Page[], query: string): SearchHit[] {
  const terms = norm(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits: (SearchHit & { score: number })[] = [];
  for (const page of pages) {
    if (page.deletedAt) continue;
    const fields: { text: string; where: SearchHit['where']; pageIndex: number | null }[] = [
      { text: page.title, where: 'title', pageIndex: null },
      ...page.texts.map((t) => ({ text: t.text, where: 'typed' as const, pageIndex: pageIndexOf(textBounds(t)) })),
      ...(page.inkIndex ?? []).map((e) => ({ text: e.text, where: 'handwriting' as const, pageIndex: e.page })),
      ...(page.maths ?? []).map((m) => ({ text: m.latex, where: 'equation' as const, pageIndex: pageIndexOf(mathBounds(m)) })),
      ...page.chat.map((m) => ({ text: [m.text, m.transcription].filter(Boolean).join('\n'), where: 'chat' as const, pageIndex: null })),
    ];
    const all = norm(fields.map((f) => f.text).join('\n'));
    if (!terms.every((t) => all.includes(t))) continue;
    // Show the field that matches the most words (ties: the earliest, so the title wins).
    let best = fields[0];
    let bestCount = -1;
    for (const f of fields) {
      const n = terms.filter((t) => norm(f.text).includes(t)).length;
      if (n > bestCount) [best, bestCount] = [f, n];
    }
    const first = terms.find((t) => norm(best.text).includes(t)) ?? terms[0];
    const titleHit = terms.some((t) => norm(page.title).includes(t));
    hits.push({
      page,
      pageIndex: best.pageIndex,
      snippet: best.where === 'title' ? '' : snippetAround(best.text, first),
      where: best.where,
      score: (titleHit ? 1e15 : 0) + page.updatedAt,
    });
  }
  return hits.sort((a, b) => b.score - a.score);
}

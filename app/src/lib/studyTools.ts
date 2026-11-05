import { selectAll } from './ink';
import { renderPageView, renderSelection, type RenderedImage } from './snapshot';
import type { Page, Rect, Selection } from './types';

export type ToolContext = { text: string; image?: RenderedImage & { mime?: string } };

const MAX_CONTEXT_CHARS = 12000;

/** All the words in a note: typed text, equations, and handwriting already read for search. */
function noteText(page: Page): string {
  const parts = [
    page.title && page.title !== 'Untitled' ? `Note title: ${page.title}` : '',
    ...page.texts.map((t) => t.text.trim()).filter(Boolean),
    ...(page.maths ?? []).map((m) => `$$${m.latex}$$`),
    ...(page.inkIndex ?? []).map((e) => e.text.trim()).filter(Boolean).map((t) => `(handwriting) ${t}`),
  ].filter(Boolean);
  return parts.join('\n').slice(0, MAX_CONTEXT_CHARS);
}

/** Context for a tool built from the whole note: its text plus a picture of what's on screen. */
export function noteContext(page: Page, view: Rect): ToolContext {
  const image = selectAll(page) ? renderPageView(page, view).image : null;
  return { text: noteText(page), image: image ?? undefined };
}

/** Context for a tool built from a lasso selection: the selection's picture and text, plus the note's text. */
export function selectionContext(page: Page, selection: Selection): ToolContext {
  const chip = renderSelection(page, selection, { ink: true, images: true, text: true }, 'selection');
  const image = chip.combined ?? chip.ink ?? chip.images?.[0] ?? chip.image;
  const text = [chip.text ? `Selected text:\n${chip.text}` : '', noteText(page)].filter(Boolean).join('\n\n').slice(0, MAX_CONTEXT_CHARS);
  return { text, image: image ? { base64: image.base64, width: image.width, height: image.height, mime: image.mime } : undefined };
}

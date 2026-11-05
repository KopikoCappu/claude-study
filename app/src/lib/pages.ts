import { annotationBounds, strokeBounds, textBounds, mathBounds, uid, unionRects } from './ink';
import type { Page, Point, Rect } from './types';
import { clampZoom, type Viewport } from './viewport';

/** US Letter at 96 dpi (8.5 × 11 in). All page content lives in this coordinate space. */
export const PAGE_W = 816;
export const PAGE_H = 1056;
/** Grey "desk" gap between stacked pages. */
export const PAGE_GAP = 40;
/** Desk margin around the document when it's fitted to the screen. */
export const DESK_PAD = 24;

export const pageTop = (i: number) => i * (PAGE_H + PAGE_GAP);
export const pageRect = (i: number): Rect => ({ x: 0, y: pageTop(i), w: PAGE_W, h: PAGE_H });
export const docHeight = (count: number) => count * PAGE_H + (count - 1) * PAGE_GAP;

/** Pages in a note: what the user added, or more if existing content reaches further down. */
export function pageCountFor(page: Page): number {
  const bounds = unionRects([
    ...page.strokes.map(strokeBounds),
    ...page.texts.map(textBounds),
    ...(page.maths ?? []).map(mathBounds),
    ...page.images,
  ]);
  const needed = bounds ? Math.floor(Math.max(0, bounds.y + bounds.h - 1) / (PAGE_H + PAGE_GAP)) + 1 : 1;
  return Math.max(page.pageCount ?? 1, needed);
}

/** Zoom that fits a page's width to the screen (never above 100% on big screens). */
export const fitScale = (viewW: number) => clampZoom(Math.min(1.25, (viewW - DESK_PAD * 2) / PAGE_W));

/** Fit the page width to the screen and scroll to the top of `pageIndex`. */
export function fitToWidth(vp: Viewport, viewW: number, pageIndex = 0) {
  const s = fitScale(viewW);
  vp.scale.set(s);
  vp.tx.set((viewW - PAGE_W * s) / 2);
  vp.ty.set(DESK_PAD - pageTop(pageIndex) * s);
}

/**
 * Keep the document on screen: when it's narrower than the view it may sit anywhere (fully visible) so
 * zoom/pan stay where the user put them; otherwise stop panning at its edges (+ a little desk).
 * Vertically stop just past the first and last page. Only fitToWidth / rotation center the page.
 */
export function clampViewport(vp: Viewport, viewW: number, viewH: number, pageCount: number) {
  if (!viewW || !viewH) return;
  const s = vp.scale.get();
  const docW = PAGE_W * s;
  const docH = docHeight(pageCount) * s;
  const pad = DESK_PAD;

  const tx = vp.tx.get();
  if (docW + pad * 2 <= viewW) vp.tx.set(Math.min(viewW - docW - pad, Math.max(pad, tx)));
  else vp.tx.set(Math.min(pad, Math.max(viewW - docW - pad, tx)));

  const ty = vp.ty.get();
  const minTy = Math.min(pad, viewH - docH - viewH * 0.4); // allow scrolling a bit past the last page
  vp.ty.set(Math.min(pad, Math.max(minTy, ty)));
}

/** How far the document can scroll at zoom `s` (same limits as clampViewport), for momentum scrolling. */
export function scrollBounds(s: number, viewW: number, viewH: number, pageCount: number) {
  const docW = PAGE_W * s;
  const docH = docHeight(pageCount) * s;
  const minTy = Math.min(DESK_PAD, viewH - docH - viewH * 0.4);
  return { minTy, maxTy: DESK_PAD, minTx: Math.min(DESK_PAD, viewW - docW - DESK_PAD), maxTx: DESK_PAD };
}

/** Which page is at the vertical center of the screen (0-based). */
export function pageAtCenter(ty: number, scale: number, viewH: number, pageCount: number) {
  'worklet'; // also runs inside Reanimated reactions (UI thread on native)
  const y = (viewH / 2 - ty) / scale;
  return Math.min(pageCount - 1, Math.max(0, Math.floor(y / (PAGE_H + PAGE_GAP))));
}

/** First ruled line from the top of each page (see PaperBackground). */
export const RULE_TOP = 96;

/** Top of a text block whose first line sits on the ruled line nearest to page-space y. */
export function snapToRule(y: number, lineSpacing: number) {
  const stride = PAGE_H + PAGE_GAP;
  const top = Math.max(0, Math.floor(y / stride)) * stride;
  const n = Math.max(0, Math.round((y - top - RULE_TOP) / lineSpacing));
  return top + RULE_TOP + n * lineSpacing - lineSpacing + 4;
}

// ---------------------------------------------------------------- page management

const STRIDE = PAGE_H + PAGE_GAP;

/** Which page of the note an item belongs to: the page its center is on. */
export const pageIndexOf = (r: Rect) => Math.max(0, Math.floor((r.y + r.h / 2) / STRIDE));

/** Old page index → new index, or null to remove that page's content. */
type Plan = (i: number) => number | null;

/** Move every item to the page the plan says, keeping its position on the page. */
function applyPlan(page: Page, plan: Plan, pageCount: number): Partial<Page> {
  const target = (r: Rect) => {
    const i = pageIndexOf(r);
    const n = plan(i);
    return n == null ? null : (n - i) * STRIDE;
  };
  const keep = <T,>(items: T[], bounds: (t: T) => Rect, move: (t: T, dy: number) => T) =>
    items.flatMap((t) => {
      const dy = target(bounds(t));
      return dy == null ? [] : [dy ? move(t, dy) : t];
    });
  return {
    strokes: keep(page.strokes, strokeBounds, (s, dy) => ({ ...s, points: s.points.map(([x, y, p]) => [x, y + dy, p] as Point) })),
    texts: keep(page.texts, textBounds, (t, dy) => ({ ...t, y: t.y + dy })),
    maths: keep(page.maths ?? [], mathBounds, (m, dy) => ({ ...m, y: m.y + dy })),
    images: keep(page.images, (i) => i, (i, dy) => ({ ...i, y: i.y + dy })),
    annotations: keep(page.annotations, annotationBounds, (a, dy) => ({
      ...a,
      rect: { ...a.rect, y: a.rect.y + dy },
      from: a.from ? ([a.from[0], a.from[1] + dy] as [number, number]) : undefined,
    })),
    inkIndex: (page.inkIndex ?? []).flatMap((e) => {
      const n = plan(e.page);
      return n == null ? [] : [{ ...e, page: n }];
    }),
    pageCount,
  };
}

/** Move page `from` so it ends up at position `to` (0-based). */
export function movePage(page: Page, from: number, to: number): Partial<Page> {
  const n = pageCountFor(page);
  const order = [...Array(n).keys()];
  order.splice(to, 0, ...order.splice(from, 1));
  return applyPlan(page, (i) => order.indexOf(i), n);
}

/** Insert a blank page at position `at` (0-based); later pages move down. */
export function insertPage(page: Page, at: number): Partial<Page> {
  return applyPlan(page, (i) => (i >= at ? i + 1 : i), pageCountFor(page) + 1);
}

/** Remove page `at` and everything on it; later pages move up. A note always keeps at least one page. */
export function deletePageAt(page: Page, at: number): Partial<Page> {
  return applyPlan(page, (i) => (i === at ? null : i > at ? i - 1 : i), Math.max(1, pageCountFor(page) - 1));
}

/** Copy page `at` (everything on it) to a new page right after it. */
export function duplicatePage(page: Page, at: number): Partial<Page> {
  const spaced = { ...page, ...insertPage(page, at + 1) } as Page;
  const onPage = <T,>(items: T[], bounds: (t: T) => Rect) => items.filter((t) => pageIndexOf(bounds(t)) === at);
  const copy = applyPlan(
    {
      ...page,
      strokes: onPage(page.strokes, strokeBounds).map((s) => ({ ...s, id: uid() })),
      texts: onPage(page.texts, textBounds).map((t) => ({ ...t, id: uid() })),
      maths: onPage(page.maths ?? [], mathBounds).map((m) => ({ ...m, id: uid() })),
      images: onPage(page.images, (i) => i).map((i) => ({ ...i, id: uid() })),
      annotations: onPage(page.annotations, annotationBounds).map((a) => ({ ...a, id: uid(), createdAt: 0 })),
      inkIndex: [],
    },
    (i) => i + 1,
    0,
  );
  return {
    ...spaced,
    strokes: [...spaced.strokes, ...copy.strokes!],
    texts: [...spaced.texts, ...copy.texts!],
    maths: [...(spaced.maths ?? []), ...copy.maths!],
    images: [...spaced.images, ...copy.images!],
    annotations: [...spaced.annotations, ...copy.annotations!],
  };
}

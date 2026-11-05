import { create } from 'zustand';

/**
 * Dragging a note card onto a sidebar folder to move it there.
 * Sidebar rows register a way to measure themselves; they're measured when a drag starts (the sidebar may have
 * scrolled since it was laid out). `null` folder = "All notes", which takes the note out of its folder.
 */
type Rect = { x: number; y: number; w: number; h: number };
type Measure = (done: (r: Rect) => void) => void;

const targets = new Map<string, { folderId: string | null; measure: Measure; rect?: Rect }>();
const NONE = '__none__';

export function registerDropTarget(folderId: string | null, measure: Measure) {
  const key = folderId ?? NONE;
  targets.set(key, { folderId, measure });
  return () => {
    if (targets.get(key)?.measure === measure) targets.delete(key);
  };
}

type DragState = {
  pageId: string | null;
  title: string;
  x: number;
  y: number;
  /** The drop target under the finger: a folder id, null for All notes, undefined for none. */
  over: string | null | undefined;
};

export const useNoteDrag = create<DragState>(() => ({ pageId: null, title: '', x: 0, y: 0, over: undefined }));

/** When the last drag ended, so the card's tap handler can ignore the release that ends a drag. */
let lastDragEnd = 0;
export const justDragged = () => Date.now() - lastDragEnd < 400;

function hit(x: number, y: number): string | null | undefined {
  for (const t of targets.values()) {
    const r = t.rect;
    if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return t.folderId;
  }
  return undefined;
}

export function startDrag(pageId: string, title: string, x: number, y: number) {
  for (const t of targets.values()) t.measure((r) => (t.rect = r));
  useNoteDrag.setState({ pageId, title, x, y, over: undefined });
}

export function moveDrag(x: number, y: number) {
  useNoteDrag.setState({ x, y, over: hit(x, y) });
}

/** Ends the drag; returns where the note was dropped (folder id / null), or undefined if not on a target. */
export function endDrag(): string | null | undefined {
  const { over, pageId } = useNoteDrag.getState();
  lastDragEnd = Date.now();
  useNoteDrag.setState({ pageId: null, over: undefined });
  return pageId ? over : undefined;
}

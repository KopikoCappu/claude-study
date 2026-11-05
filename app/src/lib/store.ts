import { appStorage } from './storage';
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { AppState, Platform } from 'react-native';
import { deleteAudio } from './audioFiles';
import { uid } from './ink';
import { FOLDER_COLORS } from './theme';
import type { Folder, Page, ShapeKind, Tool } from './types';

type Snapshot = Pick<Page, 'strokes' | 'texts' | 'maths' | 'images' | 'annotations' | 'pageCount'>;
type SizedTool = 'pen' | 'highlighter' | 'eraser';
/** stroke: touching a stroke removes all of it. partial: only the part under the eraser goes. */
export type EraserMode = 'stroke' | 'partial';

/** Notes in Recently deleted are removed for good after this long. */
export const TRASH_DAYS = 30;

export const SIZE_OPTIONS: Record<SizedTool, number[]> = {
  pen: [1.5, 2.5, 4, 6, 9, 14],
  highlighter: [10, 16, 22, 30, 40, 54],
  eraser: [6, 10, 16, 24, 36, 52], // radius
};

const MAX_HISTORY = 100;

/**
 * Don't save anything until saved notes have loaded successfully. If loading fails (corrupt file, a
 * migration that throws), the store is empty — saving then would overwrite every note with nothing.
 * Leaving the file alone keeps the notes recoverable (and cloud sync can restore them).
 */
let loadedOk = false;

/**
 * Saving means turning every note (photos included) into one big string, which can take long enough to
 * stutter the pen if done after every stroke. So saves wait until edits pause for a moment, and are
 * flushed right away when the app goes to the background or the tab is hidden/closed.
 */
const SAVE_DELAY_MS = 600;
let pendingSave: { name: string; value: StorageValue<unknown> } | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function flushSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const job = pendingSave;
  pendingSave = null;
  if (job && loadedOk) return appStorage.setItem(job.name, JSON.stringify(job.value));
}

const debouncedStorage: PersistStorage<unknown> = {
  getItem: async (name) => {
    const raw = await appStorage.getItem(name);
    return raw == null ? null : (JSON.parse(raw) as StorageValue<unknown>);
  },
  setItem: (name, value) => {
    if (!loadedOk) return; // see above: never save over notes that failed to load
    pendingSave = { name, value };
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void flushSave(), SAVE_DELAY_MS);
  },
  removeItem: (name) => {
    pendingSave = null;
    return appStorage.removeItem(name);
  },
};

if (Platform.OS === 'web') {
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => void flushSave());
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && void flushSave());
  }
} else {
  AppState.addEventListener('change', (s) => s !== 'active' && void flushSave());
}

/** Sync key for a note or folder. */
export const syncKey = (kind: 'note' | 'folder', id: string) => `${kind}:${id}`;

/** A row coming down from the cloud (see lib/sync.ts). `data` is absent for tombstones. */
export type RemoteItem = { kind: 'note' | 'folder'; id: string; updated_at: number; deleted: boolean; data?: unknown };

type State = {
  pages: Record<string, Page>;
  folders: Record<string, Folder>;
  // editor prefs
  tool: Tool;
  color: string;
  highlighterColor: string;
  sizes: Record<SizedTool, number>;
  shapeKind: ShapeKind;
  /** Ignore finger touches for drawing (palm rejection) — turn on with the S Pen */
  penOnly: boolean;
  eraserMode: EraserMode;
  /** Read handwriting with the user's AI key in the background so search can find it. */
  searchHandwriting: boolean;
  // in-memory undo/redo stacks per page (not persisted)
  undo: Record<string, Snapshot[]>;
  redo: Record<string, Snapshot[]>;
  // --- cloud sync bookkeeping (persisted) ---
  /** syncKey → updatedAt of the version the cloud has, so only newer local changes get uploaded */
  synced: Record<string, number>;
  /** syncKey → when it was deleted locally (uploaded as a tombstone) */
  tombstones: Record<string, number>;

  createPage: (folderId?: string | null) => string;
  /** Move a note to Recently deleted (it can be restored for 30 days). */
  deletePage: (id: string) => void;
  restorePage: (id: string) => void;
  /** Remove a note for good, including its recordings on this device. */
  deleteForever: (id: string) => void;
  emptyTrash: () => void;
  /** Remove notes that have been in Recently deleted for more than 30 days. */
  purgeTrash: () => void;
  movePage: (id: string, folderId: string | null) => void;
  renamePage: (id: string, title: string) => void;
  setPinned: (id: string, pinned: boolean) => void;
  /** Copy a note (not its recordings or chat). Returns the copy's id. */
  duplicateNote: (id: string) => string | null;
  createFolder: (name?: string) => string;
  renameFolder: (id: string, name: string) => void;
  setFolderColor: (id: string, color: string) => void;
  /** Notes inside go back to "no folder" — nothing is deleted. */
  deleteFolder: (id: string) => void;
  /** Mutate a page. Pass `trackUndo` for user edits to the canvas. */
  updatePage: (id: string, fn: (p: Page) => Partial<Page>, trackUndo?: boolean) => void;
  undoPage: (id: string) => void;
  redoPage: (id: string) => void;
  setTool: (t: Tool) => void;
  setColor: (c: string) => void;
  setHighlighterColor: (c: string) => void;
  setSize: (tool: SizedTool, size: number) => void;
  setPenOnly: (v: boolean) => void;
  setEraserMode: (m: EraserMode) => void;
  setSearchHandwriting: (v: boolean) => void;
  setShapeKind: (k: ShapeKind) => void;
  /** Merge rows from the cloud (last write wins on updatedAt). */
  applyRemote: (items: RemoteItem[]) => void;
  markSynced: (entries: Record<string, number>) => void;
  /** Sign-out: forget this account's notes on this device. */
  resetData: () => void;
};

const snapshot = (p: Page): Snapshot => ({ strokes: p.strokes, texts: p.texts, maths: p.maths ?? [], images: p.images, annotations: p.annotations, pageCount: p.pageCount });

/** Drop notes for good: tombstones for sync, and their recordings on this device. */
function removeNotes(s: State, ids: string[]): Partial<State> {
  if (!ids.length) return {};
  const pages = { ...s.pages };
  const tombstones = { ...s.tombstones };
  const now = Date.now();
  for (const id of ids) {
    for (const r of pages[id]?.recordings ?? []) void deleteAudio(r.id).catch(() => {});
    delete pages[id];
    tombstones[syncKey('note', id)] = now;
  }
  return { pages, tombstones };
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      pages: {},
      folders: {},
      tool: 'pen',
      color: '#1F2328',
      highlighterColor: '#FFD60A',
      sizes: { pen: 2.5, highlighter: 22, eraser: 16 },
      shapeKind: 'rect',
      penOnly: false,
      eraserMode: 'stroke',
      searchHandwriting: true,
      undo: {},
      redo: {},
      synced: {},
      tombstones: {},

      createPage: (folderId = null) => {
        const id = uid();
        const now = Date.now();
        set((s) => ({
          pages: {
            ...s.pages,
            [id]: { id, title: 'Untitled', createdAt: now, updatedAt: now, strokes: [], texts: [], images: [], annotations: [], chat: [], paper: 'lined', bg: '#FFFFFF', folderId },
          },
        }));
        return id;
      },
      deletePage: (id) =>
        set((s) => {
          const now = Date.now();
          return s.pages[id] ? { pages: { ...s.pages, [id]: { ...s.pages[id], deletedAt: now, updatedAt: now } } } : s;
        }),
      restorePage: (id) =>
        set((s) => {
          if (!s.pages[id]) return s;
          const { deletedAt: _, ...page } = s.pages[id];
          // Its folder may have been deleted meanwhile.
          const folderId = page.folderId && s.folders[page.folderId] ? page.folderId : null;
          return { pages: { ...s.pages, [id]: { ...page, folderId, updatedAt: Date.now() } } };
        }),
      deleteForever: (id) => set((s) => removeNotes(s, [id])),
      emptyTrash: () => set((s) => removeNotes(s, Object.values(s.pages).filter((p) => p.deletedAt).map((p) => p.id))),
      purgeTrash: () =>
        set((s) => {
          const cutoff = Date.now() - TRASH_DAYS * 864e5;
          return removeNotes(s, Object.values(s.pages).filter((p) => p.deletedAt && p.deletedAt < cutoff).map((p) => p.id));
        }),
      movePage: (id, folderId) =>
        set((s) => (s.pages[id] ? { pages: { ...s.pages, [id]: { ...s.pages[id], folderId, updatedAt: Date.now() } } } : s)),
      renamePage: (id, title) =>
        set((s) => (s.pages[id] ? { pages: { ...s.pages, [id]: { ...s.pages[id], title: title.trim() || 'Untitled', updatedAt: Date.now() } } } : s)),
      setPinned: (id, pinned) =>
        set((s) => (s.pages[id] ? { pages: { ...s.pages, [id]: { ...s.pages[id], pinned, updatedAt: Date.now() } } } : s)),
      duplicateNote: (id) => {
        const src = get().pages[id];
        if (!src) return null;
        const copyId = uid();
        const now = Date.now();
        // Recordings stay with the original: their audio files are deleted along with the note that owns them.
        const { recordings: _r, deletedAt: _d, pinned: _p, ...rest } = src;
        set((s) => ({ pages: { ...s.pages, [copyId]: { ...structuredClone(rest), id: copyId, title: `${src.title || 'Untitled'} copy`, chat: [], createdAt: now, updatedAt: now } } }));
        return copyId;
      },
      createFolder: (name = 'New folder') => {
        const id = uid();
        const now = Date.now();
        set((s) => {
          // Next color in the palette, so new folders don't all look the same.
          const color = FOLDER_COLORS[Object.keys(s.folders).length % FOLDER_COLORS.length];
          return { folders: { ...s.folders, [id]: { id, name, color, createdAt: now, updatedAt: now } } };
        });
        return id;
      },
      renameFolder: (id, name) =>
        set((s) => (s.folders[id] ? { folders: { ...s.folders, [id]: { ...s.folders[id], name, updatedAt: Date.now() } } } : s)),
      setFolderColor: (id, color) =>
        set((s) => (s.folders[id] ? { folders: { ...s.folders, [id]: { ...s.folders[id], color, updatedAt: Date.now() } } } : s)),
      deleteFolder: (id) =>
        set((s) => {
          const now = Date.now();
          const { [id]: _, ...folders } = s.folders;
          const pages = Object.fromEntries(
            Object.entries(s.pages).map(([k, p]) => [k, p.folderId === id ? { ...p, folderId: null, updatedAt: now } : p]),
          );
          return { folders, pages, tombstones: { ...s.tombstones, [syncKey('folder', id)]: now } };
        }),
      updatePage: (id, fn, trackUndo) =>
        set((s) => {
          const page = s.pages[id];
          if (!page) return s;
          const history = trackUndo
            ? {
                undo: { ...s.undo, [id]: [...(s.undo[id] ?? []).slice(-(MAX_HISTORY - 1)), snapshot(page)] },
                redo: { ...s.redo, [id]: [] }, // a new edit invalidates redo
              }
            : {};
          return { pages: { ...s.pages, [id]: { ...page, ...fn(page), updatedAt: Date.now() } }, ...history };
        }),
      undoPage: (id) => {
        const { undo, redo, pages } = get();
        const stack = undo[id];
        const prev = stack?.[stack.length - 1];
        if (!prev || !pages[id]) return;
        set({
          pages: { ...pages, [id]: { ...pages[id], ...prev } },
          undo: { ...undo, [id]: stack.slice(0, -1) },
          redo: { ...redo, [id]: [...(redo[id] ?? []), snapshot(pages[id])] },
        });
      },
      redoPage: (id) => {
        const { undo, redo, pages } = get();
        const stack = redo[id];
        const next = stack?.[stack.length - 1];
        if (!next || !pages[id]) return;
        set({
          pages: { ...pages, [id]: { ...pages[id], ...next } },
          redo: { ...redo, [id]: stack.slice(0, -1) },
          undo: { ...undo, [id]: [...(undo[id] ?? []), snapshot(pages[id])] },
        });
      },
      setTool: (tool) => set({ tool }),
      setColor: (color) => set((s) => ({ color, tool: s.tool === 'pen' || s.tool === 'text' || s.tool === 'shape' ? s.tool : 'pen' })),
      setHighlighterColor: (highlighterColor) => set({ highlighterColor, tool: 'highlighter' }),
      setSize: (tool, size) => set((s) => ({ sizes: { ...s.sizes, [tool]: size } })),
      setPenOnly: (penOnly) => set({ penOnly }),
      setEraserMode: (eraserMode) => set({ eraserMode, tool: 'eraser' }),
      setSearchHandwriting: (searchHandwriting) => set({ searchHandwriting }),
      setShapeKind: (shapeKind) => set({ shapeKind, tool: 'shape' }),

      applyRemote: (items) =>
        set((s) => {
          const pages = { ...s.pages };
          const folders = { ...s.folders };
          const synced = { ...s.synced };
          const tombstones = { ...s.tombstones };
          for (const it of items) {
            const k = syncKey(it.kind, it.id);
            const local = it.kind === 'note' ? pages[it.id] : folders[it.id];
            const localAt = local ? (local.updatedAt ?? local.createdAt) : (tombstones[k] ?? 0);
            if (it.updated_at < localAt) continue; // local is newer — it will be uploaded
            if (it.deleted) {
              if (it.kind === 'note') {
                for (const r of pages[it.id]?.recordings ?? []) void deleteAudio(r.id).catch(() => {});
                delete pages[it.id];
              }
              else delete folders[it.id];
            } else if (it.data) {
              if (it.kind === 'note') pages[it.id] = { ...(it.data as Page), id: it.id, updatedAt: it.updated_at };
              else folders[it.id] = { ...(it.data as Folder), id: it.id, updatedAt: it.updated_at };
              delete tombstones[k];
            }
            synced[k] = it.updated_at;
          }
          return { pages, folders, synced, tombstones };
        }),
      markSynced: (entries) => set((s) => ({ synced: { ...s.synced, ...entries } })),
      resetData: () => set({ pages: {}, folders: {}, synced: {}, tombstones: {}, undo: {}, redo: {} }),
    }),
    {
      name: 'kober',
      version: 2,
      storage: debouncedStorage as PersistStorage<Omit<State, "undo" | "redo">>,
      partialize: ({ undo, redo, ...rest }) => rest,
      onRehydrateStorage: () => (state, error) => {
        if (error) console.error('[store] could not load saved notes — not saving over them', error);
        else {
          loadedOk = true;
          state?.purgeTrash();
        }
      },
      // v0 stored a single `penSize`; fold it into `sizes`.
      migrate: (persisted, version) => {
        const s = persisted as Partial<State> & { penSize?: number };
        if (version < 1) {
          s.sizes = { pen: s.penSize ?? 2.5, highlighter: 22, eraser: 16 };
          delete s.penSize;
        }
        // v2: sync bookkeeping; folders track updatedAt.
        if (version < 2) {
          s.synced = {};
          s.tombstones = {};
          for (const f of Object.values(s.folders ?? {})) f.updatedAt ??= f.createdAt;
        }
        return s as State;
      },
    },
  ),
);

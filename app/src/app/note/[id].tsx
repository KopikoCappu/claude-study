import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AgentPanel } from '@/components/AgentPanel';
import { AudioBar } from '@/components/AudioBar';
import { PagesPanel } from '@/components/PagesPanel';
import { InkCanvas } from '@/components/InkCanvas';
import { SelectionBar } from '@/components/SelectionBar';
import { ToolsPanel, type PendingContext } from '@/components/ToolsPanel';
import { ColorMenu, MoreMenu, SideControls, TopBar, ZoomPill, type Menu } from '@/components/Toolbar';
import { Notice, useNotice } from '@/components/Notice';
import { exportNoteAsPdf } from '@/lib/exportPdf';
import { fromFile, importFile, imagesIn, isImage, loadImage, pickFiles, type ImportSource, type LoadedImage } from '@/lib/importFiles';
import { selectAll, uid, unionRects } from '@/lib/ink';
import { prepareImage, renderSelection } from '@/lib/snapshot';
import { selectionContext } from '@/lib/studyTools';
import { useAudioState } from '@/lib/audioState';
import { indexHandwriting } from '@/lib/inkIndex';
import { useStore } from '@/lib/store';
import { makeStyles } from '@/lib/theme';
import type { Chip, Include, PageImage, Selection, Tool } from '@/lib/types';
import { fitToWidth, pageCountFor } from '@/lib/pages';
import { useViewport, zoomAt } from '@/lib/viewport';

const ALL: Include = { ink: true, images: true, text: true };
const idsKey = (s: Selection | null) => (s ? [s.strokeIds, s.textIds, s.mathIds, s.imageIds, s.annotationIds ?? []].map((a) => a.join(',')).join('|') : '');

const TOOL_KEYS: Record<string, Tool> = { p: 'pen', h: 'highlighter', s: 'shape', e: 'eraser', l: 'lasso', t: 'text' };

export default function NoteScreen() {
  const styles = useStyles();
  const { id, page: pageParam } = useLocalSearchParams<{ id: string; page?: string }>();
  // Opened from a search result: start at the page that matched (1-based in the URL).
  const [initialPage] = useState(() => Math.max(0, (Number(pageParam) || 1) - 1));
  const [pagesOpen, setPagesOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(() => useAudioState.getState().recording?.pageId === id);
  const page = useStore((s) => s.pages[id]);
  const updatePage = useStore((s) => s.updatePage);
  const [selection, setSelectionState] = useState<Selection | null>(null);
  const [include, setInclude] = useState<Include>(ALL);
  const [transforming, setTransforming] = useState(false);
  // New selection → send everything by default; moving/resizing the same items keeps the toggles.
  const setSelection = (s: Selection | null) => {
    if (idsKey(s) !== idsKey(selection)) setInclude(ALL);
    setSelectionState(s);
  };
  const [chips, setChips] = useState<Chip[]>([]);
  const [agentOpen, setAgentOpenState] = useState(false);
  // Study tools pane. Once opened it stays mounted (hidden when closed) so a running tool keeps its state.
  const [toolsOpen, setToolsOpenState] = useState(false);
  const [toolsMounted, setToolsMounted] = useState(false);
  const [toolContext, setToolContext] = useState<PendingContext | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const toolsDocked = windowWidth >= 700; // side by side; on phones the pane covers the canvas
  const roomForBoth = windowWidth >= 1280; // tools + Ask panel + a usable canvas
  const setAgentOpen = (open: boolean) => {
    setAgentOpenState(open);
    if (open && !roomForBoth) setToolsOpenState(false);
  };
  const setToolsOpen = (open: boolean) => {
    setToolsOpenState(open);
    if (open) {
      setToolsMounted(true);
      if (!roomForBoth) setAgentOpenState(false);
    }
  };
  const [menu, setMenu] = useState<Menu>(null);
  const viewport = useViewport();
  const canvasSize = useRef({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLElement | null>(null);
  const [notice, setNotice] = useNotice();
  const [viewHeight, setViewHeight] = useState(0);
  const center = (): [number, number] => [canvasSize.current.width / 2, canvasSize.current.height / 2];
  // Page-space rect currently on screen (sent to Claude as the "page view").
  const visibleRect = () => {
    const sc = viewport.scale.get();
    const { width, height } = canvasSize.current;
    return { x: -viewport.tx.get() / sc, y: -viewport.ty.get() / sc, w: Math.max(1, width) / sc, h: Math.max(1, height) / sc };
  };

  // Leaving the note: make its handwriting searchable (only pages whose ink changed are read).
  useEffect(() => () => void indexHandwriting([id]), [id]);

  // Latest panel toggles for the key handler below (it's registered once per note).
  const panelKeys = useRef({ agent: () => {}, tools: () => {} });
  panelKeys.current = { agent: () => setAgentOpen(!agentOpen), tools: () => setToolsOpen(!toolsOpen) };

  // Keyboard shortcuts (web / tablets with a keyboard): Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y, P H S E L T, Ctrl+J, Ctrl+I, ?, Esc
  useEffect(() => {
    if (Platform.OS !== 'web' || !id) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const { undoPage, redoPage, setTool } = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoPage(id);
        else undoPage(id);
      } else if (mod && key === 'y') {
        e.preventDefault();
        redoPage(id);
      } else if (mod && (key === '=' || key === '+' || key === '-')) {
        e.preventDefault();
        zoomAt(viewport, viewport.scale.get() * (key === '-' ? 1 / 1.25 : 1.25), ...center());
      } else if (mod && key === '0') {
        e.preventDefault();
        fitToWidth(viewport, canvasSize.current.width);
      } else if (mod && key === 'j') {
        e.preventDefault();
        panelKeys.current.agent();
      } else if (mod && key === 'i') {
        e.preventDefault();
        panelKeys.current.tools();
      } else if (e.key === '?') {
        router.push('/shortcuts');
      } else if (!mod && TOOL_KEYS[key]) {
        setTool(TOOL_KEYS[key]);
      } else if (key === 'escape') {
        setSelection(null);
        setMenu(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Web: Ctrl+V a copied image or screenshot; drag images / PDFs / text files onto the page.
  const handlers = useRef({ addImageFiles, importIntoNote });
  useEffect(() => {
    handlers.current = { addImageFiles, importIntoNote };
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || !id) return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return; // typing text
      const files = imagesIn(e.clipboardData);
      if (!files.length) return;
      e.preventDefault();
      void handlers.current.addImageFiles(files);
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); // allow dropping files
    };
    const onDrop = (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (!files.length) return;
      e.preventDefault(); // don't let the browser open the file instead
      const images = files.filter(isImage);
      const others = files.filter((f) => !isImage(f));
      // Drop point → page space, so images land where they were dropped.
      const sc = viewport.scale.get();
      const rect = canvasRef.current?.getBoundingClientRect();
      const at: [number, number] | undefined = rect
        ? [(e.clientX - rect.left - viewport.tx.get()) / sc, (e.clientY - rect.top - viewport.ty.get()) / sc]
        : undefined;
      void (async () => {
        if (images.length) await handlers.current.addImageFiles(images, at);
        if (others.length) await handlers.current.importIntoNote(others.map(fromFile));
      })();
    };
    window.addEventListener('paste', onPaste);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!page) return <Text style={{ padding: 24 }}>Note not found.</Text>;

  function addSelectionToAI() {
    if (!selection) return;
    setChips([...chips, renderSelection(useStore.getState().pages[id], selection, include)]);
    setSelection(null);
    setAgentOpen(true);
  }

  function makeToolFromSelection() {
    if (!selection) return;
    setToolContext({ context: selectionContext(useStore.getState().pages[id], selection), label: 'selection' });
    setSelection(null);
    setToolsOpen(true);
  }

  function attachWholePage() {
    const p = useStore.getState().pages[id];
    const all = selectAll(p);
    if (all) setChips([...chips, renderSelection(p, all, ALL, 'whole page')]);
    setAgentOpen(true);
  }

  async function addImage(source: 'camera' | 'library') {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.9 };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = res.canceled ? null : res.assets[0];
    if (!asset?.base64) return;
    // Store a downscaled copy (≤2048px): crisp for the AI, small enough to send and persist.
    insertImages([prepareImage(asset.base64) ?? { base64: asset.base64, width: asset.width, height: asset.height, mime: 'image/jpeg' }]);
  }

  /** Paste / drop / imports (web): images from the clipboard or desktop. */
  async function addImageFiles(files: Blob[], at?: [number, number]) {
    if (!files.length) return;
    setNotice({ text: files.length > 1 ? `Adding ${files.length} images…` : 'Adding image…', busy: true });
    try {
      insertImages(await Promise.all(files.map((f) => loadImage(f))), at);
      setNotice(null);
    } catch {
      setNotice({ text: "Couldn't read that image." });
    }
  }

  /** Place images (centered on screen, or at a page-space point), staggered, then select them so they can be moved. */
  function insertImages(imgs: LoadedImage[], at?: [number, number]) {
    const view = visibleRect();
    const [cx, cy] = at ?? [view.x + view.w / 2, view.y + view.h / 2];
    const added: PageImage[] = imgs.map((img, i) => {
      const w = Math.min(view.w * 0.6, 480 / viewport.scale.get(), img.width);
      const h = (img.height / img.width) * w;
      const off = (i * 24) / viewport.scale.get();
      return { id: uid(), x: cx - w / 2 + off, y: cy - h / 2 + off, w, h, base64: img.base64, mime: img.mime };
    });
    if (!added.length) return;
    updatePage(id, (p) => ({ images: [...p.images, ...added] }), true);
    // Select right away so they can be moved/resized; switch to the lasso tool so the handles work.
    useStore.getState().setTool('lasso');
    const bounds = unionRects(added)!;
    setSelection({ strokeIds: [], textIds: [], mathIds: [], imageIds: added.map((a) => a.id), bounds });
  }

  /** Import PDFs / images / text files as new pages at the end of this note. */
  async function importIntoNote(files: ImportSource[]) {
    for (const file of files) {
      try {
        setNotice({ text: `Importing ${file.name}…`, busy: true });
        const p = useStore.getState().pages[id];
        const start = pageCountFor(p);
        const got = await importFile(file, start, (text) => setNotice({ text, busy: true }));
        updatePage(id, (pg) => ({ images: [...pg.images, ...got.images], texts: [...pg.texts, ...got.texts], pageCount: start + got.pages }), true);
        fitToWidth(viewport, canvasSize.current.width, start);
      } catch (e) {
        setNotice({ text: e instanceof Error ? e.message : String(e) });
        return;
      }
    }
    setNotice({ text: files.length > 1 ? `Imported ${files.length} files.` : 'Imported.' });
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar
        pageId={id}
        agentOpen={agentOpen}
        onToggleAgent={() => setAgentOpen(!agentOpen)}
        menu={menu}
        setMenu={setMenu}
        pagesOpen={pagesOpen}
        onTogglePages={() => setPagesOpen(!pagesOpen)}
        audioOpen={audioOpen}
        onToggleAudio={() => setAudioOpen(!audioOpen)}
        toolsOpen={toolsOpen}
        onToggleTools={() => setToolsOpen(!toolsOpen)}
      />
      <View style={styles.body}>
        {pagesOpen && <PagesPanel pageId={id} viewport={viewport} getView={() => canvasSize.current} onClose={() => setPagesOpen(false)} />}
        <View ref={canvasRef as never} style={{ flex: 1 }} onLayout={(e) => {
            canvasSize.current = e.nativeEvent.layout;
            setViewHeight(e.nativeEvent.layout.height);
          }}>
          <InkCanvas pageId={id} selection={selection} onSelectionChange={setSelection} viewport={viewport} onTransformingChange={setTransforming} initialPage={initialPage} />
          {audioOpen && <AudioBar pageId={id} onClose={() => setAudioOpen(false)} onMessage={(text) => setNotice({ text })} />}
          <SideControls pageId={id} />
          <ZoomPill
            viewport={viewport}
            getCenter={center}
            onReset={() => fitToWidth(viewport, canvasSize.current.width)}
            pageCount={pageCountFor(page)}
            viewHeight={viewHeight}
          />
          {selection && !transforming && (
            <SelectionBar
              pageId={id}
              selection={selection}
              viewport={viewport}
              include={include}
              setInclude={setInclude}
              onAsk={addSelectionToAI}
              onMakeTool={makeToolFromSelection}
              onSelectionChange={setSelection}
            />
          )}
        </View>
        {toolsMounted && (
          <ToolsPanel
            pageId={id}
            getView={visibleRect}
            pending={toolContext}
            clearPending={() => setToolContext(null)}
            onClose={() => setToolsOpen(false)}
            docked={toolsDocked}
            hidden={!toolsOpen}
          />
        )}
        {agentOpen && (
          <AgentPanel pageId={id} chips={chips} setChips={setChips} onClose={() => setAgentOpen(false)} getView={visibleRect} onAttachPage={attachWholePage} />
        )}
      </View>

      {menu && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(null)} />
          {menu === 'color' ? (
            <ColorMenu />
          ) : (
            <MoreMenu
              pageId={id}
              onAddImage={(src) => {
                setMenu(null);
                addImage(src);
              }}
              onImportFile={async () => {
                setMenu(null);
                const files = await pickFiles();
                if (files.length) await importIntoNote(files);
              }}
              onExportPdf={
                Platform.OS === 'web'
                  ? async () => {
                      setMenu(null);
                      setSelection(null);
                      setNotice({ text: 'Preparing PDF…', busy: true });
                      try {
                        await exportNoteAsPdf(useStore.getState().pages[id]);
                        setNotice(null);
                      } catch (e) {
                        setNotice({ text: `Couldn't export: ${e instanceof Error ? e.message : String(e)}` });
                      }
                    }
                  : undefined
              }
            />
          )}
        </>
      )}
      <Notice notice={notice} />
    </SafeAreaView>
  );
}

const useStyles = makeStyles((C) => ({
  root: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1, flexDirection: 'row' },
}));

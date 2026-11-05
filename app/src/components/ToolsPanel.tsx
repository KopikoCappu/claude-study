import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { IconBtn } from '@/components/Toolbar';
import { ToolFrame } from '@/components/ToolFrame';
import { buildTool, NoKeyError, type ToolProgress } from '@/lib/api';
import { useAiKey } from '@/lib/aiKey';
import { enterToSend } from '@/lib/enterToSend';
import { modelName, perAction, usePrefs } from '@/lib/prefs';
import { uid } from '@/lib/ink';
import { useStore } from '@/lib/store';
import { noteContext, type ToolContext } from '@/lib/studyTools';
import { copyTool, libraryOf, similarTools, undoVersion, withNewVersion, type LibraryEntry } from '@/lib/toolLibrary';
import { fmtUsage, useUsage } from '@/lib/usage';
import { F, makeStyles, R, useTheme } from '@/lib/theme';
import type { Rect, StudyTool, Usage } from '@/lib/types';
import { FACTS, Ticker } from '@/components/Ticker';

/** Context waiting to be used for the next tool (set by "Make a tool" on a lasso selection). */
export type PendingContext = { context: ToolContext; label: string };

type Props = {
  pageId: string;
  /** Page-space rect currently visible on screen. */
  getView: () => Rect;
  pending: PendingContext | null;
  clearPending: () => void;
  onClose: () => void;
  /** Side-by-side with the notes (resizable). Otherwise it covers the canvas (phones). */
  docked: boolean;
  /** Kept mounted while closed so a running tool keeps its state. */
  hidden: boolean;
};

const EXAMPLES = ['Quiz me on this note', 'Practice problems with step-by-step answers', 'An interactive diagram I can explore'];
const MIN_W = 320;
/** For this session: the width the student dragged the pane to. */
const memory = { width: 460, start: 460 };

type Busy = { label: string; started: number; abort: AbortController; progress?: ToolProgress };

export function ToolsPanel({ pageId, getView, pending, clearPending, onClose, docked, hidden }: Props) {
  const C = useTheme();
  const styles = useStyles();
  const tools = useStore((s) => s.pages[pageId]?.tools);
  const updatePage = useStore((s) => s.updatePage);
  const key = useAiKey((s) => s.key);
  const list = useMemo(() => tools ?? [], [tools]);
  // Every tool from the student's other notes: open any of them here without rebuilding.
  const pages = useStore((s) => s.pages);
  const library = useMemo(() => libraryOf(pages, pageId), [pages, pageId]);
  const [activeId, setActiveId] = useState<string | null>(() => list[list.length - 1]?.id ?? null);
  const active = list.find((t) => t.id === activeId) ?? null;
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<Busy | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [picker, setPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Errors belong to one run of one version of a tool; a reload or new version starts clean.
  const frameKey = active ? `${active.id}:${active.updatedAt}:${reloads}` : '';
  const [runErr, setRunErr] = useState<{ key: string; message: string } | null>(null);
  const runError = runErr?.key === frameKey ? runErr.message : null;

  // A new selection was sent here: start a new tool with it.
  const [seenPending, setSeenPending] = useState(pending);
  if (pending !== seenPending) {
    setSeenPending(pending);
    if (pending) {
      setActiveId(null);
      setFailure(null);
    }
  }

  async function run(prompt: string, previous?: { tool: StudyTool; error?: string }) {
    if (busy || (!prompt.trim() && !previous?.error)) return;
    if (!key) return router.push('/ai-key');
    const page = useStore.getState().pages[pageId];
    if (!page) return;
    const context = previous ? undefined : (pending?.context ?? noteContext(page, getView()));
    const abort = new AbortController();
    setBusy({ label: previous ? (previous.error ? 'Fixing the artifact…' : 'Changing the artifact…') : 'Building your artifact…', started: Date.now(), abort });
    setFailure(null);
    setPicker(false);
    try {
      const res = await buildTool(
        key,
        { prompt: prompt.trim(), context, previous: previous ? { html: previous.tool.html, error: previous.error } : undefined },
        abort.signal,
        (progress) => setBusy((b) => (b && b.abort === abort ? { ...b, progress } : b)),
      );
      const now = Date.now();
      useUsage.getState().record(res.usage, 'tools', pageId);
      if (previous) {
        const id = previous.tool.id;
        updatePage(pageId, (p) => ({
          tools: (p.tools ?? []).map((t) =>
            t.id === id ? { ...withNewVersion(t, res.title, res.html, now), lastUsage: res.usage, spent: addSpent(t.spent, res.usage) } : t,
          ),
        }));
      } else {
        const tool: StudyTool = {
          id: uid(),
          title: res.title,
          prompt: prompt.trim(),
          html: res.html,
          createdAt: now,
          updatedAt: now,
          lastUsage: res.usage,
          spent: addSpent(undefined, res.usage),
        };
        updatePage(pageId, (p) => ({ tools: [...(p.tools ?? []), tool] }));
        setActiveId(tool.id);
        clearPending();
      }
      setInput('');
    } catch (e) {
      if (abort.signal.aborted) return;
      if (e instanceof NoKeyError) router.push('/ai-key');
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  /** Bring a tool from another note into this one (a copy; nothing is rebuilt or charged). */
  function addFromLibrary(t: StudyTool) {
    const copy = copyTool(t);
    updatePage(pageId, (p) => ({ tools: [...(p.tools ?? []), copy] }));
    setActiveId(copy.id);
    setPicker(false);
    setInput('');
    setFailure(null);
  }

  function open(e: LibraryEntry) {
    if (e.pageId === pageId) {
      setActiveId(e.tool.id);
      setInput('');
    } else addFromLibrary(e.tool);
  }

  function undo(id: string) {
    updatePage(pageId, (p) => ({ tools: (p.tools ?? []).map((t) => (t.id === id ? undoVersion(t) : t)) }));
    setPicker(false);
  }

  // About to build something new: offer a tool they already have that looks the same.
  const similar = useMemo(
    () => (active || busy || input.trim().length < 4 ? [] : similarTools(input, [...list.map((tool) => ({ tool, pageId, pageTitle: 'this note' })), ...library])),
    [active, busy, input, list, library, pageId],
  );

  function remove(id: string) {
    const rest = list.filter((t) => t.id !== id);
    updatePage(pageId, () => ({ tools: rest }));
    setActiveId(rest[rest.length - 1]?.id ?? null);
    setPicker(false);
    setConfirmDelete(false);
  }

  // ---------------------------------------------------------------- resizing (docked only)
  const [width, setWidth] = useState(memory.width);
  const [dragging, setDragging] = useState(false);
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        memory.start = memory.width;
        setDragging(true);
      },
      onPanResponderMove: (_e, g) => {
        memory.width = Math.max(MIN_W, memory.start - g.dx);
        setWidth(memory.width);
      },
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
    }),
  );

  const send = () => (active ? run(input, { tool: active }) : run(input));
  const canSend = !busy && !!input.trim();

  return (
    <View style={[docked ? [styles.docked, { width, maxWidth: '70%' }] : styles.cover, hidden && { display: 'none' }]}>
      {docked && (
        <View style={styles.handle} {...pan.panHandlers}>
          <View style={styles.grip} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable style={styles.titleBtn} onPress={() => setPicker(!picker)} disabled={!!busy}>
            <MaterialCommunityIcons name="puzzle-outline" size={18} color={C.primary} />
            <Text style={styles.titleText} numberOfLines={1}>
              {active?.title ?? 'New artifact'}
            </Text>
            {(list.length > 0 || library.length > 0) && <MaterialCommunityIcons name={picker ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />}
          </Pressable>
          <View style={{ flexDirection: 'row' }}>
            {active && !busy && <IconBtn icon="refresh" onPress={() => setReloads(reloads + 1)} />}
            <IconBtn icon={docked ? 'close' : 'notebook-outline'} onPress={onClose} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          {busy ? (
            <Building busy={busy} onCancel={() => busy.abort.abort()} />
          ) : active ? (
            <>
              <ToolFrame key={frameKey} html={active.html} onError={(m) => setRunErr((cur) => (cur?.key === frameKey ? cur : { key: frameKey, message: m }))} />
              {runError && (
                <View style={[styles.errorBar, C.shadow]}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color={C.danger} />
                  <Text style={styles.errorText} numberOfLines={2}>
                    This artifact hit an error.
                  </Text>
                  <Pressable style={styles.fixBtn} onPress={() => run(input, { tool: active, error: runError })}>
                    <Text style={styles.fixText}>Fix it</Text>
                  </Pressable>
                  <IconBtn icon="close" size={18} onPress={() => setRunErr(null)} />
                </View>
              )}
            </>
          ) : (
            <Empty pending={pending} onClearPending={clearPending} hasKey={!!key} onPick={(t) => run(t)} library={library} onOpen={open} />
          )}

          {picker && (
            <View style={[styles.picker, C.shadow]}>
              <ScrollView style={{ maxHeight: 360 }}>
                {list.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      setActiveId(t.id);
                      setPicker(false);
                    }}
                    style={({ pressed }) => [styles.pickRow, (pressed || t.id === activeId) && { backgroundColor: C.selected }]}
                  >
                    <Text style={styles.pickText} numberOfLines={1}>
                      {t.title}
                    </Text>
                  </Pressable>
                ))}
                {library.length > 0 && <Text style={styles.pickHeading}>From your other notes · free to open</Text>}
                {library.map((e) => (
                  <Pressable key={`${e.pageId}:${e.tool.id}`} onPress={() => addFromLibrary(e.tool)} style={({ pressed }) => [styles.pickRow, pressed && { backgroundColor: C.selected }]}>
                    <Text style={styles.pickText} numberOfLines={1}>
                      {e.tool.title}
                    </Text>
                    <Text style={styles.pickSub} numberOfLines={1}>
                      {e.pageTitle}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.pickDivider} />
              <PickAction
                icon="plus"
                label="New artifact"
                onPress={() => {
                  setActiveId(null);
                  setPicker(false);
                }}
              />
              {active && !!active.versions?.length && (
                <PickAction icon="undo" label={`Undo last change (free) · ${active.versions.length} saved`} onPress={() => undo(active.id)} />
              )}
              {active && (
                <PickAction
                  icon="delete-outline"
                  label={confirmDelete ? 'Tap again to delete' : 'Delete this artifact'}
                  danger
                  onPress={() => (confirmDelete ? remove(active.id) : setConfirmDelete(true))}
                />
              )}
            </View>
          )}
        </View>

        <View style={styles.composer}>
          {!!failure && <Text style={styles.failure}>{failure}</Text>}
          {active?.lastUsage && !busy && (
            <Text style={styles.meta}>
              Last {active.createdAt === active.updatedAt ? 'build' : 'change'}: {fmtUsage(active.lastUsage.inputTokens + active.lastUsage.outputTokens, active.lastUsage.costUsd)}
              {active.spent && active.createdAt !== active.updatedAt ? `  ·  This artifact so far: ${fmtUsage(active.spent.tokens, active.spent.costUsd)}` : ''}
            </Text>
          )}
          {similar.map((e) => (
            <Pressable key={`${e.pageId}:${e.tool.id}`} onPress={() => open(e)} style={({ pressed }) => [styles.similar, pressed && { backgroundColor: C.selected }]}>
              <MaterialCommunityIcons name="puzzle-check-outline" size={16} color={C.primary} />
              <Text style={styles.similarText} numberOfLines={2}>
                You already have <Text style={{ fontWeight: '600' }}>{e.tool.title}</Text> ({e.pageTitle}). Open it, free
              </Text>
            </Pressable>
          ))}
          {!active && pending && (
            <View style={styles.pendingChip}>
              <MaterialCommunityIcons name="lasso" size={14} color={C.icon} />
              <Text style={styles.pendingText}>Using your {pending.label}</Text>
              <Pressable onPress={clearPending} hitSlop={6}>
                <MaterialCommunityIcons name="close" size={14} color={C.muted} />
              </Pressable>
            </View>
          )}
          <View style={[styles.inputRow, C.shadow]}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={active ? 'Change this artifact…' : 'What should Claude build?'}
              placeholderTextColor={C.muted}
              multiline
              editable={!busy}
              onKeyPress={enterToSend(() => canSend && send())}
            />
            <Pressable style={[styles.send, !canSend && { opacity: 0.25 }]} onPress={send} disabled={!canSend}>
              <MaterialCommunityIcons name="arrow-up" size={18} color={C.onPrimary} />
            </Pressable>
          </View>
        </View>
      </View>
      {/* While resizing, cover the tool so the frame doesn't swallow the drag. */}
      {dragging && <View style={[StyleSheet.absoluteFill, { left: 14 }]} />}
    </View>
  );
}

function Building({ busy, onCancel }: { busy: Busy; onCancel: () => void }) {
  const C = useTheme();
  const styles = useStyles();
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs(Math.floor((Date.now() - busy.started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [busy.started]);
  const p = busy.progress;
  const writing = !!p && p.chars > 0;
  // A typical tool is 15–30k characters; the bar fills toward that and never claims to be done.
  const fill = writing ? Math.min(0.95, p.chars / 28000) : 0;
  return (
    <View style={styles.center}>
      <ActivityIndicator color={C.muted} />
      <Text style={styles.centerTitle}>{p?.title ?? busy.label}</Text>
      <Text style={styles.centerSub}>
        {writing ? `Writing the artifact · ${(p.chars / 1000).toFixed(1)}k characters` : 'Planning the artifact…'}
      </Text>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${Math.round(fill * 100)}%` }]} />
      </View>
      <Text style={styles.centerSub}>{secs}s · You can keep taking notes.</Text>
      <Pressable onPress={onCancel} style={({ pressed }) => [styles.cancel, pressed && { backgroundColor: C.selected }]}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
      <View style={{ marginTop: 18, maxWidth: 320 }}>
        <Ticker items={FACTS} icon="lightbulb-on-outline" every={7000} size={13} />
      </View>
    </View>
  );
}

function Empty({
  pending,
  onClearPending,
  hasKey,
  onPick,
  library,
  onOpen,
}: {
  pending: PendingContext | null;
  onClearPending: () => void;
  hasKey: boolean;
  onPick: (t: string) => void;
  library: LibraryEntry[];
  onOpen: (e: LibraryEntry) => void;
}) {
  const C = useTheme();
  const styles = useStyles();
  const artifactModel = usePrefs((p) => p.models.artifacts);
  return (
    <ScrollView contentContainerStyle={styles.empty}>
      <MaterialCommunityIcons name="puzzle-outline" size={30} color={C.faint} />
      <Text style={styles.centerTitle}>Artifacts beside your notes</Text>
      <Text style={styles.centerSub}>
        Describe an artifact — a quiz, a simulator, a 3D model — and Claude builds it from {pending ? `your ${pending.label}` : 'this note'}.
        {pending ? '' : ' Lasso something first to focus on it.'}
      </Text>
      {!hasKey && (
        <Pressable onPress={() => router.push('/ai-key')} style={({ pressed }) => [styles.example, pressed && { backgroundColor: C.selected }]}>
          <MaterialCommunityIcons name="key-outline" size={15} color={C.icon} />
          <Text style={styles.exampleText}>Add your Claude key first</Text>
        </Pressable>
      )}
      {hasKey &&
        EXAMPLES.map((e) => (
          <Pressable key={e} onPress={() => onPick(e)} style={({ pressed }) => [styles.example, pressed && { backgroundColor: C.selected }]}>
            <Text style={styles.exampleText}>{e}</Text>
          </Pressable>
        ))}
      {hasKey && (
        <Text style={styles.costHint}>
          Artifacts are the biggest request in Claude Study: {perAction('artifacts', artifactModel)} with {modelName(artifactModel)}. You&apos;ll see what each one used.
        </Text>
      )}
      {pending && (
        <Pressable onPress={onClearPending} hitSlop={6}>
          <Text style={styles.link}>Use the whole note instead</Text>
        </Pressable>
      )}
      {library.length > 0 && (
        <View style={styles.libBox}>
          <Text style={styles.pickHeading}>Your artifacts from other notes · free to open</Text>
          {library.slice(0, 4).map((e) => (
            <Pressable key={`${e.pageId}:${e.tool.id}`} onPress={() => onOpen(e)} style={({ pressed }) => [styles.libRow, pressed && { backgroundColor: C.selected }]}>
              <MaterialCommunityIcons name="puzzle-outline" size={16} color={C.icon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pickText} numberOfLines={1}>
                  {e.tool.title}
                </Text>
                <Text style={styles.pickSub} numberOfLines={1}>
                  {e.pageTitle}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function PickAction({ icon, label, onPress, danger }: { icon: 'plus' | 'delete-outline' | 'undo'; label: string; onPress: () => void; danger?: boolean }) {
  const C = useTheme();
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pickRow, styles.pickAction, pressed && { backgroundColor: C.selected }]}>
      <MaterialCommunityIcons name={icon} size={18} color={danger ? C.danger : C.icon} />
      <Text style={[styles.pickText, danger && { color: C.danger }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((C) => ({
  docked: { flexDirection: 'row', minWidth: MIN_W, backgroundColor: C.bg, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 10, backgroundColor: C.bg },
  handle: { width: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.sidebar, cursor: 'col-resize' } as object,
  grip: { width: 4, height: 36, borderRadius: 2, backgroundColor: C.faint },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, height: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  titleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 8, borderRadius: R.sm },
  titleText: { flexShrink: 1, fontFamily: F.serifSemi, fontSize: 17, color: C.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  bar: { width: '70%', maxWidth: 260, height: 4, borderRadius: 2, backgroundColor: C.selected, overflow: 'hidden', alignSelf: 'center' },
  barFill: { height: 4, borderRadius: 2, backgroundColor: C.primary },
  centerTitle: { fontFamily: F.serif, fontSize: 24, color: C.text, textAlign: 'center' },
  centerSub: { fontSize: 14, lineHeight: 20, color: C.muted, textAlign: 'center' },
  cancel: { marginTop: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: R.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: C.faint },
  cancelText: { fontSize: 14, color: C.text },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 28, paddingVertical: 40 },
  example: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.sm + 2 },
  exampleText: { fontSize: 14, color: C.text },
  link: { fontSize: 13, color: C.focus, marginTop: 4 },
  errorBar: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderRadius: R.md, paddingLeft: 12, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  errorText: { flex: 1, fontSize: 14, color: C.text },
  fixBtn: { backgroundColor: C.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.sm },
  fixText: { color: C.onPrimary, fontWeight: '600', fontSize: 13 },
  picker: { position: 'absolute', top: 6, left: 8, width: 300, maxWidth: '90%', backgroundColor: C.surface, borderRadius: R.md, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  pickRow: { paddingHorizontal: 14, paddingVertical: 10 },
  pickAction: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickText: { fontSize: 15, color: C.text },
  pickHeading: { fontSize: 12, fontWeight: '600', color: C.muted, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  pickSub: { fontSize: 12, color: C.muted, marginTop: 1 },
  similar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 8 },
  similarText: { flex: 1, fontSize: 13, lineHeight: 18, color: C.text },
  libBox: { alignSelf: 'stretch', marginTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.border, paddingTop: 6 },
  libRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.sm },
  pickDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginVertical: 4 },
  composer: { padding: 12, paddingTop: 4, gap: 8 },
  failure: { fontSize: 13, lineHeight: 18, color: C.danger },
  meta: { fontSize: 12, color: C.muted },
  costHint: { fontSize: 12, lineHeight: 17, color: C.muted, textAlign: 'center', marginTop: 4 },
  pendingChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.bg, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5 },
  pendingText: { fontSize: 13, color: C.text },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.xl, padding: 8, paddingLeft: 14, minHeight: 56 },
  input: { flex: 1, minHeight: 32, maxHeight: 120, paddingVertical: 6, fontSize: 15, color: C.text, ...({ outlineStyle: 'none' } as object) },
  send: { width: 34, height: 34, borderRadius: 9, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
}));

/** Add one request's usage to a tool's running total (cost stays null if any part had no estimate). */
function addSpent(spent: StudyTool['spent'], usage: Usage | undefined): StudyTool['spent'] {
  if (!usage) return spent;
  const tokens = (spent?.tokens ?? 0) + usage.inputTokens + usage.outputTokens;
  const costUsd = usage.costUsd == null || (spent && spent.costUsd == null) ? null : (spent?.costUsd ?? 0) + usage.costUsd;
  return { tokens, costUsd };
}

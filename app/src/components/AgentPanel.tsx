import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ComponentProps, type ComponentRef } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { enterToSend } from '@/lib/enterToSend';
import { IconBtn } from '@/components/Toolbar';
import { RichText } from '@/components/RichText';
import { router } from 'expo-router';
import { ask, buildRequest, NoKeyError, type Mode } from '@/lib/api';
import { useAiKey } from '@/lib/aiKey';
import { AI_COLORS, applyModelOutput } from '@/lib/annotations';
import { uid } from '@/lib/ink';
import { renderPageView } from '@/lib/snapshot';
import { useStore } from '@/lib/store';
import { reportAiAnswer } from '@/lib/support';
import { fmtCost, fmtUsage, useUsage } from '@/lib/usage';
import { modelName, usePrefs } from '@/lib/prefs';
import { F, makeStyles, R, useTheme } from '@/lib/theme';
import type { ChatMessage, Chip, Rect } from '@/lib/types';
import { Working } from '@/components/Ticker';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  pageId: string;
  chips: Chip[];
  setChips: (c: Chip[]) => void;
  onClose: () => void;
  /** Page-space rect currently visible on screen. */
  getView: () => Rect;
  /** Attach everything on the page as a chip. */
  onAttachPage: () => void;
};

const QUICK: { mode: Mode; icon: IconName; label: string; prompt: string }[] = [
  { mode: 'mistake', icon: 'magnify', label: 'Find mistake', prompt: 'Can you find my mistake?' },
  { mode: 'explain', icon: 'lightbulb-outline', label: 'Explain', prompt: 'Explain this to me.' },
  { mode: 'transcribe', icon: 'text-recognition', label: 'To text', prompt: 'Convert my handwriting to text.' },
];

export function AgentPanel({ pageId, chips, setChips, onClose, getView, onAttachPage }: Props) {
  const C = useTheme();
  const styles = useStyles();
  const chat = useStore((s) => s.pages[pageId]?.chat ?? []);
  const updatePage = useStore((s) => s.updatePage);
  // Each user brings their own AI key (Settings → Claude key); it never leaves this device except to make the request.
  const key = useAiKey((s) => s.key);
  const aiName = 'Claude';
  const noteSpent = useUsage((s) => s.byNote[pageId]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  /** Web: copy to the clipboard. Tablet: the share sheet, which has Copy (no extra native module needed). */
  async function copyText(text: string, id: string) {
    if (Platform.OS === 'web') {
      await navigator.clipboard?.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } else {
      await Share.share({ message: text });
    }
  }
  const abortRef = useRef<AbortController | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const stop = () => abortRef.current?.abort();

  // Esc stops an answer in progress (web / hardware keyboards).
  useEffect(() => {
    if (Platform.OS !== 'web' || !busy) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && stop();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy]);
  useEffect(() => {
    if (!confirmNew) return;
    const t = setTimeout(() => setConfirmNew(false), 3000);
    return () => clearTimeout(t);
  }, [confirmNew]);

  /** `attach` and `base` let Retry resend an earlier question with its own selection. */
  async function send(mode: Mode, text: string, attach: Chip[] = chips, base: ChatMessage[] = chat) {
    if (busy || (!text.trim() && !attach.length)) return;
    if (!key) return router.push('/ai-key');
    const userMsg: ChatMessage = { id: uid(), role: 'user', text: text.trim(), chips: attach, mode };
    const history = [...base, userMsg];
    updatePage(pageId, () => ({ chat: history }));
    setInput('');
    setChips([]);
    setBusy(true);
    const abort = new AbortController();
    abortRef.current = abort;
    const chips_ = attach;
    try {
      // Always send what's on screen, so Claude can see context and write anywhere visible — selection or not.
      const viewRect = getView();
      const page = useStore.getState().pages[pageId];
      // The selection Claude should write next to (a whole-page attachment isn't a useful anchor).
      const anchor = chips_.find((c) => c.label !== 'whole page')?.bounds ?? null;
      const pageView = renderPageView(page, viewRect, anchor);
      const { messages, regions } = buildRequest(history, { view: pageView.image, viewRect, text: pageView.context });
      const res = await ask(key, mode, messages, abort.signal);
      useUsage.getState().record(res.usage, 'chat', pageId);
      const add = applyModelOutput(res.annotations, regions, { anchor, page });
      const wrote = add.annotations.length + add.texts.length + add.maths.length > 0;
      updatePage(
        pageId,
        (p) => ({
          chat: [...p.chat, { id: uid(), role: 'assistant', text: res.reply, transcription: res.transcription, usage: res.usage }],
          annotations: [...p.annotations, ...add.annotations],
          texts: [...p.texts, ...add.texts],
          maths: [...(p.maths ?? []), ...add.maths],
        }),
        wrote, // anything Claude puts on the page is one undo step
      );
    } catch (e) {
      if (e instanceof NoKeyError) router.push('/ai-key');
      const stopped = abort.signal.aborted;
      updatePage(pageId, (p) => ({
        chat: [...p.chat, { id: uid(), role: 'assistant', text: stopped ? 'Stopped.' : e instanceof Error ? e.message : String(e), error: true }],
      }));
    } finally {
      abortRef.current = null;
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  /** Ask the question behind a failed or stopped answer again. */
  function retry(errorId: string) {
    const i = chat.findIndex((m) => m.id === errorId);
    const question = chat[i - 1];
    if (i < 1 || question?.role !== 'user') return;
    void send(question.mode ?? 'ask', question.text, question.chips ?? [], chat.slice(0, i - 1));
  }

  /** Anchor point for pinning content: just right of the most recent selection on this page. */
  function lastAnchor() {
    const last = [...chat].reverse().find((m) => m.chips?.length)?.chips?.[0]?.bounds;
    return last ?? { x: 80, y: 80, w: 0, h: 0 };
  }

  function pinNote(text: string) {
    const b = lastAnchor();
    updatePage(
      pageId,
      (p) => ({
        annotations: [
          ...p.annotations,
          { id: uid(), kind: 'note', color: AI_COLORS.blue, text: text.slice(0, 280), rect: { x: b.x + b.w + 16, y: b.y, w: 260, h: 0 }, createdAt: Date.now() },
        ],
      }),
      true,
    );
  }

  function insertText(text: string) {
    const b = lastAnchor();
    updatePage(pageId, (p) => ({ texts: [...p.texts, { id: uid(), x: b.x, y: b.y + b.h + 12, width: Math.max(300, b.w), text }] }), true);
  }

  const canSend = !busy && (!!input.trim() || chips.length > 0);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name="creation" size={20} color={C.primary} />
          <View>
            <Text style={styles.titleText}>{aiName}</Text>
            {!!noteSpent?.tokens && <Text style={styles.spent}>This note: {fmtUsage(noteSpent.tokens, noteSpent.costUsd || null)}</Text>}
          </View>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {chat.length > 0 && !busy && (
            <Pressable onPress={() => (confirmNew ? (updatePage(pageId, () => ({ chat: [] })), setConfirmNew(false)) : setConfirmNew(true))} style={({ pressed }) => [styles.newChat, pressed && { backgroundColor: C.selected }]}>
              <MaterialCommunityIcons name="message-plus-outline" size={16} color={confirmNew ? C.danger : C.icon} />
              <Text style={[styles.newChatText, confirmNew && { color: C.danger }]}>{confirmNew ? 'Clear chat?' : 'New chat'}</Text>
            </Pressable>
          )}
          <IconBtn icon="close" onPress={onClose} />
        </View>
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>
        {!key && (
          <Pressable onPress={() => router.push('/ai-key')} style={({ pressed }) => [styles.keyCard, pressed && { opacity: 0.7 }]}>
            <MaterialCommunityIcons name="key-outline" size={22} color={C.text} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.keyTitle}>Add your Claude key</Text>
              <Text style={styles.keySub}>Claude Study runs on your own Claude API key, so you pay Anthropic only for what you use.</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={C.muted} />
          </Pressable>
        )}
        {chat.length === 0 && (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="lasso" size={28} color={C.faint} />
            <Text style={styles.emptyText}>Ask anything — {aiName} can see your screen and write on the page. Lasso something first to point at it.</Text>
          </View>
        )}
        {chat.map((m) =>
          m.role === 'user' ? (
            <View key={m.id} style={styles.userMsg}>
              {m.chips?.map((c) => <ChipPreview key={c.id} chip={c} />)}
              {!!m.text && <Text style={styles.msgText}>{m.text}</Text>}
            </View>
          ) : (
            <View key={m.id} style={styles.aiMsg}>
              {m.error ? <Text style={[styles.msgText, { color: m.text === 'Stopped.' ? C.muted : C.danger }]}>{m.text}</Text> : <RichText text={m.text} />}
              {m.error && !busy && (
                <View style={styles.msgActions}>
                  <Action icon="refresh" label="Retry" onPress={() => retry(m.id)} />
                </View>
              )}
              {!!m.transcription && (
                <View style={styles.transcript}>
                  <RichText text={m.transcription} />
                </View>
              )}
              {!m.error && (
                <View style={styles.msgActions}>
                  <Action icon={Platform.OS === 'web' ? 'content-copy' : 'share-variant-outline'} label={copied === m.id ? 'Copied' : Platform.OS === 'web' ? 'Copy' : 'Share'} onPress={() => void copyText(m.text, m.id)} />
                  <Action icon="pin-outline" label="Pin to page" onPress={() => pinNote(m.text)} />
                  {!!m.transcription && <Action icon="tray-arrow-down" label="Insert text" onPress={() => insertText(m.transcription!)} />}
                  <Action icon="flag-outline" label="Report" onPress={() => void reportAiAnswer(m.text)} />
                  {!!m.usage && <Text style={styles.usage}>{fmtUsage(m.usage.inputTokens + m.usage.outputTokens, m.usage.costUsd)}</Text>}
                </View>
              )}
            </View>
          ),
        )}
        {busy && <Working />}
      </ScrollView>

      <View style={styles.composer}>
        {chips.length > 0 && (
          <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingBottom: 10 }} style={{ flexGrow: 0 }}>
            {chips.map((c) => (
              <View key={c.id}>
                <ChipPreview chip={c} small />
                <Pressable style={styles.chipX} onPress={() => setChips(chips.filter((x) => x.id !== c.id))} hitSlop={6}>
                  <MaterialCommunityIcons name="close" size={12} color={C.onPrimary} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.quick}>
          <Pressable disabled={busy} onPress={onAttachPage} style={({ pressed }) => [styles.quickBtn, pressed && { backgroundColor: C.selected }, busy && { opacity: 0.4 }]}>
            <MaterialCommunityIcons name="file-document-outline" size={15} color={C.icon} />
            <Text style={styles.quickText}>Whole page</Text>
          </Pressable>
          {QUICK.map((q) => (
            <Pressable key={q.mode} disabled={busy} onPress={() => send(q.mode, input || q.prompt)} style={({ pressed }) => [styles.quickBtn, pressed && { backgroundColor: C.selected }, busy && { opacity: 0.4 }]}>
              <MaterialCommunityIcons name={q.icon} size={15} color={C.icon} />
              <Text style={styles.quickText}>{q.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.inputRow, C.shadow]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={chips.length ? 'Ask about your selection' : 'Ask anything'}
            placeholderTextColor={C.muted}
            multiline
            onKeyPress={enterToSend(() => canSend && void send('ask', input))}
          />
          {busy ? (
            <Pressable style={[styles.send, styles.stop]} onPress={stop} accessibilityLabel="Stop">
              <View style={styles.stopSquare} />
            </Pressable>
          ) : (
            <Pressable style={[styles.send, !canSend && { opacity: 0.25 }]} onPress={() => send('ask', input)} disabled={!canSend} accessibilityLabel="Send">
              <MaterialCommunityIcons name="arrow-up" size={18} color={C.onPrimary} />
            </Pressable>
          )}
        </View>
        <Footnote />
      </View>
    </View>
  );
}

/** claude.ai's reminder under the input, plus a heads-up once the monthly budget (Settings → Usage) is passed. */
function Footnote() {
  const C = useTheme();
  const styles = useStyles();
  const budget = usePrefs((p) => p.monthlyBudget);
  const spent = useUsage((u) => u.byKind.chat.costUsd + u.byKind.tools.costUsd + u.byKind.search.costUsd);
  const model = usePrefs((p) => p.models.chat);
  if (budget > 0 && spent >= budget)
    return (
      <Pressable onPress={() => router.push('/settings?section=usage')} style={styles.footRow}>
        <MaterialCommunityIcons name="alert-circle-outline" size={13} color={C.danger} />
        <Text style={[styles.foot, { color: C.danger }]}>
          Over your ${budget.toFixed(2)} monthly budget ({fmtCost(spent)} spent)
        </Text>
      </Pressable>
    );
  return (
    <Text style={styles.foot}>
      {modelName(model)} · Claude can make mistakes. Please double-check responses.
    </Text>
  );
}

function ChipPreview({ chip, small }: { chip: Chip; small?: boolean }) {
  const C = useTheme();
  const styles = useStyles();
  const h = small ? 56 : 96;
  // Show each layer that will be sent: ink, original images, and the combined view (if any).
  const layers = [chip.image, chip.ink, ...(chip.images ?? []), chip.combined].filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <View style={styles.chip}>
      {!!chip.label && <Text style={styles.chipLabel}>{chip.label}</Text>}
      {layers.length > 0 && (
        <View style={styles.chipLayers}>
          {layers.map((img, i) => (
            <Image
              key={i}
              source={{ uri: `data:${img.mime ?? 'image/png'};base64,${img.base64}` }}
              style={{ height: h, width: Math.min(small ? 110 : 220, (img.width / img.height) * h), backgroundColor: C.paper }}
              resizeMode="contain"
            />
          ))}
        </View>
      )}
      {!!chip.text && (
        <Text numberOfLines={small ? 2 : 6} style={styles.chipText}>
          {chip.text}
        </Text>
      )}
    </View>
  );
}

function Action({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const C = useTheme();
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.action, pressed && { opacity: 0.5 }]}>
      <MaterialCommunityIcons name={icon} size={14} color={C.muted} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((C) => ({
  panel: { width: 380, backgroundColor: C.bg, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 52 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  titleText: { fontFamily: F.serifSemi, fontSize: 18, color: C.text },
  spent: { fontSize: 11, color: C.muted, marginTop: 1 },
  usage: { marginLeft: 'auto', fontSize: 12, color: C.faint },
  keyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.lg, padding: 14 },
  keyTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  keySub: { fontSize: 13, lineHeight: 18, color: C.muted },
  empty: { alignItems: 'center', gap: 10, marginTop: 48, paddingHorizontal: 32 },
  emptyText: { fontFamily: F.serif, color: C.icon, textAlign: 'center', fontSize: 17, lineHeight: 25 },
  userMsg: { alignSelf: 'flex-end', maxWidth: '88%', backgroundColor: C.well, borderRadius: R.lg, paddingVertical: 10, paddingHorizontal: 14, gap: 8 },
  aiMsg: { alignSelf: 'stretch', gap: 8 },
  msgText: { fontSize: 15, lineHeight: 22, color: C.text },
  transcript: { backgroundColor: C.well, padding: 10, borderRadius: R.sm },
  msgActions: { flexDirection: 'row', gap: 16 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, color: C.muted },
  chip: { backgroundColor: C.paper, borderRadius: R.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden', alignSelf: 'flex-start' },
  chipText: { fontSize: 12, padding: 6, maxWidth: 220, color: C.text, fontFamily: 'monospace' },
  chipLabel: { fontSize: 11, fontWeight: '600', color: C.muted, paddingHorizontal: 6, paddingTop: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  chipLayers: { flexDirection: 'row', gap: 1, backgroundColor: C.border },
  chipX: { position: 'absolute', top: -6, right: -6, backgroundColor: C.text, borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  composer: { padding: 12, paddingTop: 4, paddingBottom: 8 },
  foot: { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 8 },
  footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  quick: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.sm },
  quickText: { fontSize: 13, color: C.text },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.xl, padding: 8, paddingLeft: 14, minHeight: 56 },
  input: { flex: 1, minHeight: 32, maxHeight: 120, paddingVertical: 6, fontSize: 15, color: C.text, ...({ outlineStyle: 'none' } as object) },
  stop: { backgroundColor: C.text },
  stopSquare: { width: 11, height: 11, borderRadius: 2, backgroundColor: C.bg },
  newChat: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 32, borderRadius: R.sm },
  newChatText: { fontSize: 13, color: C.icon },
  send: { width: 34, height: 34, borderRadius: 9, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
}));

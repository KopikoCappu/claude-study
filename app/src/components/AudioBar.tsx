import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatTime, useElapsed } from '@/components/Recorder';
import { IconBtn } from '@/components/Toolbar';
import { audioUri, deleteAudio } from '@/lib/audioFiles';
import { useAudioState } from '@/lib/audioState';
import { useStore } from '@/lib/store';
import { makeStyles, R, useTheme } from '@/lib/theme';
import type { Recording } from '@/lib/types';

const EMPTY: Recording[] = [];
/** Start replay a little before the ink was written: people write just after they hear something. */
const LEAD_MS = 2000;

type Props = { pageId: string; onClose: () => void; onMessage: (text: string) => void };

/**
 * Record a lecture while you write, then play it back. While this bar is open, tapping your writing
 * plays what was being said when you wrote it, and ink written later than the playing moment is dimmed.
 */
export function AudioBar({ pageId, onClose, onMessage }: Props) {
  const C = useTheme();
  const styles = useStyles();
  const recs = useStore((s) => s.pages[pageId]?.recordings ?? EMPTY);
  const hasTimedInk = useStore((s) => s.pages[pageId]?.strokes.some((st) => st.at != null) ?? false);
  const recording = useAudioState((s) => s.recording);
  const recHere = recording?.pageId === pageId;
  const elapsed = useElapsed(recHere ? recording.startedAt : undefined);

  const player = useAudioPlayer(null, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const [selId, setSelIdState] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const sel = recs.find((r) => r.id === selId) ?? recs[recs.length - 1];
  const selIndex = sel ? recs.indexOf(sel) : -1;
  const [missing, setMissing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [barWidth, setBarWidth] = useState(1);
  /** same as loadedId, readable right away inside async callbacks */
  const loaded = useRef<string | null>(null);
  const setSelId = (id: string | null) => {
    setSelIdState(id);
    setConfirmDelete(false);
  };
  const pendingSeek = useRef<number | null>(null);

  /** Point the player at a recording. 'ready' if it already was, 'loading' if just swapped in. */
  async function load(rec: Recording): Promise<'ready' | 'loading' | 'missing'> {
    if (loaded.current === rec.id) return 'ready';
    return applyUri(rec, await audioUri(rec.id));
  }

  function applyUri(rec: Recording, uri: string | null): 'ready' | 'loading' | 'missing' {
    if (loaded.current === rec.id) return 'ready'; // loaded meanwhile by another call
    if (!uri) {
      setMissing(true);
      return 'missing';
    }
    setMissing(false);
    player.replace({ uri });
    loaded.current = rec.id;
    setLoadedId(rec.id);
    return 'loading';
  }

  /** Jump to `ms` into `rec` and play (waits for the file to load if needed). */
  async function playAt(rec: Recording, ms: number) {
    const state = await load(rec);
    if (state === 'missing') return;
    const t = Math.max(0, Math.min(ms, rec.durationMs)) / 1000;
    if (state === 'loading') pendingSeek.current = t;
    else {
      await player.seekTo(t);
      player.play();
    }
  }

  // Load the selected recording so it's ready to play.
  useEffect(() => {
    if (!sel || loaded.current === sel.id) return;
    let alive = true;
    void audioUri(sel.id).then((uri) => alive && applyUri(sel, uri));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id]);

  // A seek requested before the file finished loading.
  useEffect(() => {
    if (!status.isLoaded || pendingSeek.current == null) return;
    const t = pendingSeek.current;
    pendingSeek.current = null;
    void player.seekTo(t).then(() => player.play());
  }, [status.isLoaded, player]);

  // Tell the canvas which moment is playing (dims ink written after it).
  const posMs = status.currentTime * 1000;
  const active = !!sel && loadedId === sel.id && (status.playing || status.currentTime > 0);
  useEffect(() => {
    useAudioState.setState({ playback: active && sel ? { pageId, at: sel.startedAt + posMs } : null });
  }, [active, posMs, sel, pageId]);

  // Tapping ink (see InkCanvas) jumps to when it was written.
  const recsRef = useRef(recs);
  useEffect(() => {
    recsRef.current = recs;
  });
  useEffect(() => {
    useAudioState.setState({
      seek: (at) => {
        const rec = recsRef.current.find((r) => at >= r.startedAt - 1000 && at <= r.startedAt + r.durationMs + 1000);
        if (!rec) return false;
        setSelId(rec.id);
        void playAt(rec, at - rec.startedAt - LEAD_MS);
        return true;
      },
    });
    return () => useAudioState.setState({ seek: null, playback: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  async function toggleRecord() {
    const { start, stop } = useAudioState.getState();
    if (recHere) {
      const err = await stop?.();
      if (err) onMessage(err);
      return;
    }
    player.pause();
    const err = start ? await start(pageId) : 'Recording is not available.';
    if (err) onMessage(err);
  }

  function togglePlay() {
    if (!sel) return;
    if (status.playing) return player.pause();
    // Finished: start again from the beginning.
    if (sel.durationMs - posMs < 300) return void playAt(sel, 0);
    if (loaded.current === sel.id) player.play();
    else void playAt(sel, 0);
  }

  function removeRecording() {
    if (!sel) return;
    if (!confirmDelete) return setConfirmDelete(true);
    player.pause();
    loaded.current = null;
    setLoadedId(null);
    void deleteAudio(sel.id).catch(() => {});
    useStore.getState().updatePage(pageId, (p) => ({ recordings: (p.recordings ?? []).filter((r) => r.id !== sel.id) }));
    setSelId(null);
    setConfirmDelete(false);
  }

  const total = sel?.durationMs ?? 0;
  const progress = total ? Math.min(1, posMs / total) : 0;
  const busyElsewhere = !!recording && !recHere;

  return (
    <View style={[styles.bar, C.shadow]}>
      <Pressable
        onPress={toggleRecord}
        disabled={busyElsewhere}
        style={({ pressed }) => [styles.recBtn, recHere && styles.recOn, (pressed || busyElsewhere) && { opacity: 0.6 }]}
      >
        <View style={[styles.recDot, recHere && styles.recSquare]} />
        <Text style={[styles.recText, recHere && { color: C.onPrimary }]}>
          {recHere ? `Stop ${formatTime(elapsed)}` : busyElsewhere ? 'Recording in another note' : 'Record'}
        </Text>
      </Pressable>

      {sel && !recHere ? (
        <>
          <IconBtn icon={status.playing ? 'pause' : 'play'} onPress={togglePlay} disabled={missing} />
          <Text style={styles.time}>
            {formatTime(posMs)} / {formatTime(total)}
          </Text>
          <Pressable
            style={styles.track}
            disabled={missing}
            onLayout={(e) => setBarWidth(Math.max(1, e.nativeEvent.layout.width))}
            onPress={(e) => void playAt(sel, (e.nativeEvent.locationX / barWidth) * total)}
          >
            <View style={styles.trackBg}>
              <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
            </View>
          </Pressable>
          {recs.length > 1 && (
            <View style={styles.picker}>
              <IconBtn icon="chevron-left" size={18} disabled={selIndex <= 0} onPress={() => setSelId(recs[selIndex - 1].id)} />
              <Text style={styles.pickText}>
                {selIndex + 1} of {recs.length}
              </Text>
              <IconBtn icon="chevron-right" size={18} disabled={selIndex >= recs.length - 1} onPress={() => setSelId(recs[selIndex + 1].id)} />
            </View>
          )}
          <Pressable onPress={removeRecording} hitSlop={4} style={styles.del}>
            <MaterialCommunityIcons name={confirmDelete ? 'check' : 'delete-outline'} size={18} color={C.danger} />
            {confirmDelete && <Text style={styles.delText}>Delete?</Text>}
          </Pressable>
        </>
      ) : (
        <Text style={styles.hint} numberOfLines={2}>
          {recHere ? 'Recording. Anything you write now is linked to this moment.' : 'Record while you write, then tap your writing to hear that moment.'}
        </Text>
      )}
      <IconBtn icon="close" size={18} onPress={onClose} />

      {(missing || (sel && hasTimedInk && !recHere)) && (
        <Text style={styles.sub}>{missing ? 'This recording was made on another device. Recordings stay on the device that made them.' : 'Tip: tap your writing to hear what was said when you wrote it.'}</Text>
      )}
    </View>
  );
}

const useStyles = makeStyles((C) => ({
  bar: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    width: 640,
    maxWidth: '94%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surface,
    borderRadius: R.lg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    zIndex: 5,
  },
  recBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 36, borderRadius: R.pill, backgroundColor: C.bg },
  recOn: { backgroundColor: C.danger },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.danger },
  recSquare: { borderRadius: 2, backgroundColor: C.onPrimary },
  recText: { fontSize: 14, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums'] },
  time: { fontSize: 13, color: C.icon, fontVariant: ['tabular-nums'], minWidth: 90, textAlign: 'center' },
  track: { flex: 1, minWidth: 80, height: 36, justifyContent: 'center' },
  trackBg: { height: 6, borderRadius: 3, backgroundColor: C.selected, overflow: 'hidden' },
  trackFill: { height: 6, backgroundColor: C.text },
  picker: { flexDirection: 'row', alignItems: 'center' },
  pickText: { fontSize: 12, color: C.muted, fontVariant: ['tabular-nums'] },
  del: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, height: 36 },
  delText: { fontSize: 13, fontWeight: '600', color: C.danger },
  hint: { flex: 1, fontSize: 13, color: C.muted, paddingHorizontal: 4 },
  sub: { width: '100%', fontSize: 12, color: C.muted, paddingHorizontal: 6, paddingBottom: 2 },
}));

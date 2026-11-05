import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, type RecordingOptions } from 'expo-audio';
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { deleteAudio, saveAudio } from '@/lib/audioFiles';
import { useAudioState } from '@/lib/audioState';
import { uid } from '@/lib/ink';
import { useStore } from '@/lib/store';
import { makeStyles, R, useTheme } from '@/lib/theme';

/** Speech-quality AAC: mono, 64 kbps (about 29 MB per hour). */
const VOICE: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
  web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
};

export const formatTime = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Owns the microphone. Mounted once at the app root so a recording keeps going while you move between
 * notes; a small pill shows it (and stops it) when you're not on the note being recorded.
 */
export function RecorderHost() {
  const C = useTheme();
  const styles = useStyles();
  const recorder = useAudioRecorder(VOICE);
  const recording = useAudioState((s) => s.recording);
  const title = useStore((s) => (recording ? s.pages[recording.pageId]?.title : undefined));
  const pathname = usePathname();
  const elapsed = useElapsed(recording?.startedAt);

  useEffect(() => {
    useAudioState.setState({
      start: async (pageId) => {
        if (useAudioState.getState().recording) return 'Already recording.';
        try {
          const perm = await requestRecordingPermissionsAsync();
          if (!perm.granted) return 'Claude Study needs microphone access to record. You can allow it in your device settings.';
          await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
          await recorder.prepareToRecordAsync();
          recorder.record();
          useAudioState.setState({ recording: { pageId, id: uid(), startedAt: Date.now() } });
          return null;
        } catch (e) {
          return `Couldn't start recording: ${e instanceof Error ? e.message : String(e)}`;
        }
      },
      stop: async () => {
        const rec = useAudioState.getState().recording;
        if (!rec) return null;
        useAudioState.setState({ recording: null });
        const durationMs = Date.now() - rec.startedAt;
        try {
          await recorder.stop();
          if (!recorder.uri) throw new Error('no audio was captured');
          await saveAudio(rec.id, recorder.uri);
          const { pages, updatePage } = useStore.getState();
          if (!pages[rec.pageId]) {
            await deleteAudio(rec.id); // the note was deleted while recording
            return null;
          }
          const mime = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
          updatePage(rec.pageId, (p) => ({ recordings: [...(p.recordings ?? []), { id: rec.id, startedAt: rec.startedAt, durationMs, mime }] }));
          return null;
        } catch (e) {
          return `Couldn't save the recording: ${e instanceof Error ? e.message : String(e)}`;
        } finally {
          setAudioModeAsync({ allowsRecording: false }).catch(() => {});
        }
      },
    });
    return () => useAudioState.setState({ start: null, stop: null });
  }, [recorder]);

  if (!recording || pathname === `/note/${recording.pageId}`) return null;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.pill, C.shadow]}>
        <Pressable onPress={() => router.push(`/note/${recording.pageId}`)} style={styles.info}>
          <View style={styles.dot} />
          <Text style={styles.text} numberOfLines={1}>
            Recording · {title || 'Untitled'} · {formatTime(elapsed)}
          </Text>
        </Pressable>
        <Pressable onPress={() => void useAudioState.getState().stop?.()} style={styles.stop} hitSlop={6}>
          <MaterialCommunityIcons name="stop" size={18} color={C.onPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

/** Milliseconds since `since`, updated every second (0 when not running). */
export function useElapsed(since: number | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  return since ? Math.max(0, now - since) : 0;
}

const useStyles = makeStyles((C) => ({
  wrap: { position: 'absolute', left: 16, bottom: 20 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, paddingLeft: 14, paddingRight: 6, height: 44, borderRadius: R.pill, maxWidth: 420 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.danger },
  text: { fontSize: 14, fontWeight: '600', color: C.text, flexShrink: 1, fontVariant: ['tabular-nums'] },
  stop: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' },
}));

import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { IconBtn } from '@/components/Toolbar';
import { F, makeStyles, R, useTheme } from '@/lib/theme';

const mod = typeof navigator !== 'undefined' && /Mac|iPad|iPhone/.test(navigator.platform) ? '⌘' : 'Ctrl';

const GROUPS: { title: string; keys: [string, string][] }[] = [
  { title: 'Notes', keys: [[`${mod} K`, 'Search notes'], ['N', 'New note'], ['?', 'Show these shortcuts']] },
  {
    title: 'Writing',
    keys: [
      ['P', 'Pen'],
      ['H', 'Highlighter'],
      ['S', 'Shapes'],
      ['E', 'Eraser'],
      ['L', 'Lasso'],
      ['T', 'Text'],
      [`${mod} Z`, 'Undo'],
      [`${mod} Shift Z`, 'Redo'],
      [`${mod} +  /  ${mod} −`, 'Zoom in / out'],
      [`${mod} 0`, 'Fit page to width'],
      ['Esc', 'Clear selection'],
    ],
  },
  {
    title: 'Claude',
    keys: [
      [`${mod} J`, 'Open or close the Claude panel'],
      [`${mod} I`, 'Open or close artifacts'],
      ['Enter', 'Send'],
      ['Shift Enter', 'New line'],
      ['Esc', 'Stop the answer'],
    ],
  },
];

/** Keyboard shortcuts, as a window over the current screen (like Settings). */
export default function Shortcuts() {
  const C = useTheme();
  const styles = useStyles();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View style={styles.backdrop}>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      <View style={[styles.window, C.shadow]}>
        <View style={styles.top}>
          <Text style={styles.h1}>Keyboard shortcuts</Text>
          <IconBtn icon="close" onPress={close} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, gap: 20 }}>
          {GROUPS.map((g) => (
            <View key={g.title} style={{ gap: 6 }}>
              <Text style={styles.group}>{g.title}</Text>
              {g.keys.map(([k, label]) => (
                <View key={g.title + k} style={styles.row}>
                  <Text style={styles.label}>{label}</Text>
                  <View style={styles.keys}>
                    {k.split('  /  ').map((part) => (
                      <Text key={part} style={styles.kbd}>
                        {part}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ))}
          <Text style={styles.note}>Works in the browser and with a keyboard attached to your tablet.</Text>
        </ScrollView>
      </View>
    </View>
  );
}

const useStyles = makeStyles((C) => ({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.backdrop, padding: 24 },
  window: { width: '100%', maxWidth: 520, maxHeight: '90%', backgroundColor: C.bg, borderRadius: R.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 12, paddingTop: 16, paddingBottom: 8 },
  h1: { fontFamily: F.serif, fontSize: 24, color: C.text },
  group: { fontFamily: F.serifMedium, fontSize: 17, color: C.text, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  label: { fontSize: 14, color: C.icon },
  keys: { flexDirection: 'row', gap: 6 },
  kbd: { fontSize: 12, fontWeight: '600', color: C.text, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  note: { fontSize: 12, color: C.muted },
}));

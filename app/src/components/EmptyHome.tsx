import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { IconName } from '@/components/settings/ui';
import { useAiKey } from '@/lib/aiKey';
import { uid } from '@/lib/ink';
import { modelName, usePrefs } from '@/lib/prefs';
import { useStore } from '@/lib/store';
import { F, makeStyles, R, useTheme } from '@/lib/theme';

/** A short note with a deliberate mistake (the derivative), so Find my mistake and artifacts have something to work on. */
function createSampleNote(folderId: string | null) {
  const { createPage, updatePage } = useStore.getState();
  const id = createPage(folderId);
  const line = (y: number, text: string, size = 22, color?: string) => ({ id: uid(), x: 72, y, width: 660, text, size, color });
  updatePage(id, () => ({
    title: 'Sample note',
    texts: [
      line(110, 'Product rule practice', 30),
      line(190, 'f(x) = x² · sin(x)'),
      line(240, "f'(x) = 2x · cos(x)"),
      line(330, 'Photosynthesis', 30),
      line(410, '6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂'),
      line(460, 'Light reactions happen in the thylakoids. The Calvin cycle happens in the stroma.'),
      line(560, 'Try it: lasso the derivative and tap Ask Claude → Find my mistake.\nOr open Artifacts (the puzzle icon) and ask for a quiz on this note.', 17, '#87867F'),
    ],
  }));
  return id;
}

const STARTERS: { icon: IconName; title: string; sub: string; action: 'new' | 'sample' | 'import' }[] = [
  { icon: 'magnify', title: 'Find my mistake', sub: 'Write out a problem, lasso it, and Claude circles the step that went wrong.', action: 'new' },
  { icon: 'puzzle-outline', title: 'Turn notes into an artifact', sub: 'Claude builds a quiz, flashcards or a simulator from what you wrote.', action: 'sample' },
  { icon: 'file-document-outline', title: 'Import a lecture', sub: 'Bring in a PDF or slides, write on top, and ask about any part.', action: 'import' },
];

/** The notes home before there are any notes: a claude.ai-style welcome with starters. */
export function EmptyHome({ folderId, onImport }: { folderId: string | null; onImport: () => void }) {
  const C = useTheme();
  const st = useStStyles();
  const hasKey = useAiKey((s) => !!s.key);
  const models = usePrefs((p) => p.models);
  const createPage = useStore((s) => s.createPage);

  function start(action: (typeof STARTERS)[number]['action']) {
    if (action === 'import') return onImport();
    const id = action === 'sample' ? createSampleNote(folderId) : createPage(folderId);
    router.push(`/note/${id}`);
  }

  return (
    <View style={st.wrap}>
      <Text style={st.lead}>What are we working on today?</Text>
      <Text style={st.sub}>Write by hand. Claude reads it, marks it up, and builds artifacts right beside it.</Text>

      {!hasKey && (
        <Pressable onPress={() => router.push('/settings?section=claude')} style={({ pressed }) => [st.keyCard, pressed && { opacity: 0.85 }]}>
          <MaterialCommunityIcons name="key-outline" size={20} color={C.onPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={st.keyTitle}>Connect Claude</Text>
            <Text style={st.keySub}>Add your Claude API key to start. You pay Anthropic only for what you use.</Text>
          </View>
          <MaterialCommunityIcons name="arrow-right" size={20} color={C.onPrimary} />
        </Pressable>
      )}

      <View style={st.grid}>
        {STARTERS.map((x) => (
          <Pressable key={x.title} onPress={() => start(x.action)} style={({ pressed }) => [st.card, C.shadow, pressed && { backgroundColor: C.well }]}>
            <View style={st.iconWrap}>
              <MaterialCommunityIcons name={x.icon} size={20} color={C.primary} />
            </View>
            <Text style={st.cardTitle}>{x.title}</Text>
            <Text style={st.cardSub}>{x.sub}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={() => start('sample')} hitSlop={6} style={({ pressed }) => [st.sample, pressed && { opacity: 0.6 }]}>
        <MaterialCommunityIcons name="notebook-outline" size={16} color={C.icon} />
        <Text style={st.sampleText}>Open a sample note</Text>
      </Pressable>

      <Text style={st.foot}>
        {modelName(models.chat)} answers · {modelName(models.artifacts)} builds artifacts · Claude can make mistakes, so check important answers.
      </Text>
    </View>
  );
}

const useStStyles = makeStyles((C) => ({
  wrap: { alignSelf: 'center', width: '100%', maxWidth: 820, alignItems: 'center', paddingTop: 36, paddingHorizontal: 8 },
  lead: { fontFamily: F.serif, fontSize: 30, color: C.text, textAlign: 'center' },
  sub: { fontSize: 15, lineHeight: 22, color: C.muted, textAlign: 'center', marginTop: 8, maxWidth: 520 },
  keyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', backgroundColor: C.primary, borderRadius: R.lg, paddingVertical: 14, paddingHorizontal: 18, marginTop: 28 },
  keyTitle: { color: C.onPrimary, fontSize: 15, fontWeight: '600' },
  keySub: { color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 18, marginTop: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignSelf: 'stretch', marginTop: 24 },
  card: { flex: 1, minWidth: 220, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, padding: 18, gap: 6 },
  iconWrap: { width: 36, height: 36, borderRadius: R.sm, backgroundColor: 'rgba(217,119,87,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  cardTitle: { fontFamily: F.serifMedium, fontSize: 18, color: C.text },
  cardSub: { fontSize: 13, lineHeight: 19, color: C.muted },
  sample: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 22, paddingHorizontal: 14, height: 36, borderRadius: R.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, backgroundColor: C.surface },
  sampleText: { fontSize: 14, fontWeight: '500', color: C.text },
  foot: { fontSize: 12, lineHeight: 18, color: C.muted, textAlign: 'center', marginTop: 28, maxWidth: 560 },
}));

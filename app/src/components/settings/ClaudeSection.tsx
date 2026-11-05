import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { IconBtn } from '@/components/Toolbar';
import { CLAUDE_KEY, useAiKey } from '@/lib/aiKey';
import { checkKey } from '@/lib/api';
import { indexHandwriting } from '@/lib/inkIndex';
import { MODELS, perAction, usePrefs, type Feature } from '@/lib/prefs';
import { makeStyles, R, useTheme } from '@/lib/theme';
import { Row, useSettingsStyles, Section } from './ui';

const mask = (k: string) => (k.length > 12 ? `${k.slice(0, 7)}…${k.slice(-4)}` : '••••');

const FEATURES: { feature: Feature; label: string; sub: string }[] = [
  { feature: 'chat', label: 'Ask Claude', sub: 'Answers, Find my mistake, Explain, and writing on your page' },
  { feature: 'artifacts', label: 'Artifacts', sub: 'Quizzes, simulators and diagrams built from your notes' },
  { feature: 'search', label: 'Handwriting search', sub: 'Reads your handwriting in the background so search finds it' },
];

/** Settings → Claude: the API key and which model each feature uses. */
export function ClaudeSection() {
  return (
    <>
      <KeyCard />
      <Section
        title="Models"
        sub="Pick the Claude model for each feature. Costs are estimates for a typical request in Claude Study; a long chat, a big selection or a long answer costs more. Anthropic bills by tokens (a token is about ¾ of a word), and you pay their list price: Claude Study adds nothing on top."
      >
        {FEATURES.map((f, i) => (
          <ModelPicker key={f.feature} {...f} first={i === 0} />
        ))}
      </Section>
    </>
  );
}

function KeyCard() {
  const C = useTheme();
  const st = useStStyles();
  const s = useSettingsStyles();
  const { key: current, setKey, removeKey } = useAiKey();
  const [draft, setDraft] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const problem = await checkKey(draft);
    setBusy(false);
    if (problem) return setError(problem);
    setKey(draft);
    void indexHandwriting();
    setDraft('');
    setSaved(true);
  }

  return (
    <Section
      title="Claude API key"
      sub="Claude Study runs on your own Claude API key, so you only pay Anthropic for what you use. The key stays on this device and is never uploaded with your notes."
    >
      <View style={s.pad}>
        <View style={st.status}>
          <MaterialCommunityIcons name={current ? 'check-circle' : 'key-outline'} size={18} color={current ? C.primary : C.icon} />
          <Text style={[s.rowLabel, { flex: 1 }]}>{current ? `Connected · ${mask(current)}` : 'No key yet'}</Text>
          {current && (
            <Pressable onPress={removeKey} hitSlop={6}>
              <Text style={[st.link, { color: C.danger }]}>Remove</Text>
            </Pressable>
          )}
        </View>
        <Text style={[s.rowSub, { marginTop: 10 }]}>{CLAUDE_KEY.hint}</Text>
        <Pressable onPress={() => Linking.openURL(CLAUDE_KEY.getKeyUrl)} hitSlop={6} style={st.linkRow}>
          <MaterialCommunityIcons name="open-in-new" size={15} color={C.text} />
          <Text style={st.link}>Get a key in the Claude Console</Text>
        </Pressable>

        <View style={st.keyRow}>
          <TextInput
            value={draft}
            onChangeText={(t) => (setDraft(t), setError(null), setSaved(false))}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            placeholder={current ? 'Paste a new key to replace it' : CLAUDE_KEY.placeholder}
            placeholderTextColor={C.faint}
            onSubmitEditing={() => draft.trim() && void save()}
            style={st.input}
          />
          <IconBtn icon={show ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShow(!show)} size={18} />
          <Pressable style={[st.save, (busy || !draft.trim()) && { opacity: 0.4 }]} disabled={busy || !draft.trim()} onPress={save}>
            {busy ? <ActivityIndicator color={C.onPrimary} size="small" /> : <Text style={st.saveText}>Save & test</Text>}
          </Pressable>
        </View>
        {!!error && <Text style={st.error}>{error}</Text>}
        {saved && <Text style={st.ok}>Key works and is saved.</Text>}
        <Text style={[s.rowSub, { marginTop: 12 }]}>Testing a key is free. Set a monthly spending limit in the Claude Console so you never get a surprise bill.</Text>
      </View>
    </Section>
  );
}

function ModelPicker({ feature, label, sub, first }: { feature: Feature; label: string; sub: string; first: boolean }) {
  const C = useTheme();
  const st = useStStyles();
  const s = useSettingsStyles();
  const chosen = usePrefs((p) => p.models[feature]);
  const setModel = usePrefs((p) => p.setModel);
  return (
    <View style={[st.picker, !first && s.rowBorder]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowSub}>{sub}</Text>
      <View style={st.options}>
        {MODELS.map((m) => {
          const on = m.id === chosen;
          return (
            <Pressable key={m.id} onPress={() => setModel(feature, m.id)} style={({ pressed }) => [st.option, on && st.optionOn, pressed && !on && { backgroundColor: C.selected }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name={on ? 'radiobox-marked' : 'radiobox-blank'} size={16} color={on ? C.primary : C.faint} />
                <Text style={st.optionName}>{m.name.replace('Claude ', '')}</Text>
              </View>
              <Text style={st.optionCost}>{perAction(feature, m.id)}</Text>
              <Text style={st.optionPrice}>
                ${m.input} in · ${m.output} out per million tokens
              </Text>
              <Text style={st.optionBlurb}>{m.blurb}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStStyles = makeStyles((C) => ({
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-start' },
  link: { fontSize: 14, fontWeight: '600', color: C.text, textDecorationLine: 'underline' },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.md, padding: 4, paddingLeft: 12, backgroundColor: C.bg },
  input: { flex: 1, paddingVertical: 8, fontSize: 15, color: C.text },
  save: { backgroundColor: C.primary, borderRadius: R.sm, height: 36, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: C.onPrimary, fontWeight: '600', fontSize: 14 },
  error: { color: C.danger, fontSize: 13, marginTop: 10 },
  ok: { color: '#4F7A3A', fontSize: 13, marginTop: 10, fontWeight: '600' },
  picker: { padding: 16, gap: 2 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  option: { flex: 1, minWidth: 150, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.md, padding: 10, gap: 3 },
  optionOn: { borderColor: C.primary, backgroundColor: 'rgba(217,119,87,0.07)' },
  optionName: { fontSize: 14, fontWeight: '600', color: C.text },
  optionCost: { fontSize: 14, color: C.text, fontVariant: ['tabular-nums'] },
  optionPrice: { fontSize: 11, color: C.muted, fontVariant: ['tabular-nums'] },
  optionBlurb: { fontSize: 12, lineHeight: 16, color: C.icon },
}));

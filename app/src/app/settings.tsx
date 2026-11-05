import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { ClaudeSection } from '@/components/settings/ClaudeSection';
import { Row, useSettingsStyles, Section, SmallButton, Toggle, type IconName } from '@/components/settings/ui';
import { UsageSection } from '@/components/settings/UsageSection';
import { IconBtn } from '@/components/Toolbar';
import { useAiKey } from '@/lib/aiKey';
import { modelName, perAction, usePrefs } from '@/lib/prefs';
import { indexHandwriting } from '@/lib/inkIndex';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { PRIVACY_URL, SUPPORT_EMAIL } from '@/lib/support';
import { useAuth } from '@/lib/sync';
import { F, makeStyles, R, setThemeMode, type ThemeMode, useTheme, useThemeMode } from '@/lib/theme';

const SECTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: 'general', label: 'General', icon: 'tune-variant' },
  { id: 'claude', label: 'Claude', icon: 'creation' },
  { id: 'usage', label: 'Usage', icon: 'chart-bar' },
  { id: 'account', label: 'Account', icon: 'account-circle-outline' },
  { id: 'data', label: 'Data & storage', icon: 'database-outline' },
  { id: 'about', label: 'About', icon: 'information-outline' },
];

/** Settings, laid out like claude.ai's: sections on the left, the chosen section on the right. */
export default function SettingsScreen() {
  const C = useTheme();
  const st = useStStyles();
  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState(SECTIONS.some((x) => x.id === params.section) ? params.section! : 'general');
  const { width } = useWindowDimensions();
  const wide = width >= 760;

  const nav = SECTIONS.map((x) => {
    const on = x.id === section;
    return (
      <Pressable key={x.id} onPress={() => setSection(x.id)} style={({ pressed }) => [st.navItem, !wide && st.navChip, (on || pressed) && { backgroundColor: on ? C.well : C.selected }]}>
        <MaterialCommunityIcons name={x.icon} size={18} color={on ? C.primary : C.icon} />
        <Text style={[st.navText, on && { color: C.text, fontWeight: '600' }]}>{x.label}</Text>
      </Pressable>
    );
  });

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const { height } = useWindowDimensions();

  return (
    <View style={st.backdrop}>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close settings" />
      <SafeAreaView style={[st.window, C.shadow, { height: Math.min(720, height - 48) }, !wide && st.windowNarrow]}>
      <View style={st.top}>
        <Text style={st.h1}>Settings</Text>
        <IconBtn icon="close" onPress={close} />
      </View>
      <View style={[st.body, !wide && { flexDirection: 'column' }]}>
        {wide ? (
          <View style={st.nav}>{nav}</View>
        ) : (
          <ScrollView horizontal style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingBottom: 8 }}>
            {nav}
          </ScrollView>
        )}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          <View style={st.column}>
            {section === 'general' && <General />}
            {section === 'claude' && <ClaudeSection />}
            {section === 'usage' && <UsageSection />}
            {section === 'account' && <Account />}
            {section === 'data' && <Data />}
            {section === 'about' && <About />}
          </View>
        </ScrollView>
      </View>
      </SafeAreaView>
    </View>
  );
}

function General() {
  const C = useTheme();
  const themeMode = useThemeMode();
  const penOnly = useStore((x) => x.penOnly);
  const searchHandwriting = useStore((x) => x.searchHandwriting);
  const searchModel = usePrefs((p) => p.models.search);
  const { setPenOnly, setSearchHandwriting } = useStore.getState();
  return (
    <Section title="General">
      <Row first label="Appearance" sub={themeMode === 'system' ? 'Follows your device.' : undefined} right={<ThemePicker />} />
      <Row label="Pen only" sub="Ignore fingers for drawing (palm rejection). Fingers still scroll and zoom." onPress={() => setPenOnly(!penOnly)} right={<Toggle on={penOnly} />} />
      <Row
        label="Make handwriting searchable"
        sub={`When you leave a note, Claude reads pages whose writing changed so search can find them. Uses your key: ${perAction('search', searchModel)} with ${modelName(searchModel)}.`}
        onPress={() => {
          setSearchHandwriting(!searchHandwriting);
          if (!searchHandwriting) void indexHandwriting();
        }}
        right={<Toggle on={searchHandwriting} />}
      />
      {Platform.OS === 'web' && (
        <Row label="Keyboard shortcuts" sub="Press ? anywhere to see them." onPress={() => router.push('/shortcuts')} right={<MaterialCommunityIcons name="chevron-right" size={20} color={C.muted} />} />
      )}
    </Section>
  );
}

function Account() {
  const C = useTheme();
  const session = useAuth((x) => x.session);
  const status = useAuth((x) => x.status);
  if (!supabase)
    return (
      <Section title="Account" sub="Accounts and cloud sync aren't set up in this build.">
        <Row first label="This device only" sub="Your notes, artifacts and Claude key are saved on this device. Back up your notes from Data & storage." />
      </Section>
    );
  return (
    <Section title="Account">
      <Row
        first
        label={session ? (session.user.email ?? 'Signed in') : 'Not signed in'}
        sub={session ? `Sync: ${status}` : 'Sign in to sync notes between your devices.'}
        onPress={() => router.push('/account')}
        right={<MaterialCommunityIcons name="chevron-right" size={20} color={C.muted} />}
      />
    </Section>
  );
}

function Data() {
  const st = useStStyles();
  const pages = useStore((x) => x.pages);
  const folders = useStore((x) => x.folders);
  const [confirm, setConfirm] = useState(false);
  const stats = useMemo(() => {
    const live = Object.values(pages).filter((p) => !p.deletedAt);
    const json = JSON.stringify({ pages, folders });
    return {
      notes: live.length,
      trashed: Object.keys(pages).length - live.length,
      folders: Object.keys(folders).length,
      artifacts: live.reduce((n, p) => n + (p.tools?.length ?? 0), 0),
      sheets: live.reduce((n, p) => n + (p.pageCount ?? 1), 0),
      mb: json.length / 1_000_000,
    };
  }, [pages, folders]);

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ app: 'kober', version: 1, exportedAt: new Date().toISOString(), pages, folders }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kober-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  return (
    <>
      <Section title="On this device">
        <View style={st.statGrid}>
          <Mini value={stats.notes} label="Notes" />
          <Mini value={stats.sheets} label="Pages" />
          <Mini value={stats.artifacts} label="Artifacts" />
          <Mini value={stats.folders} label="Folders" />
          <Mini value={`${stats.mb < 0.1 ? '<0.1' : stats.mb.toFixed(1)} MB`} label="Storage" />
        </View>
        {stats.trashed > 0 && <Row label={`${stats.trashed} in Recently deleted`} sub="Deleted for good after 30 days." />}
      </Section>
      <Section title="Backup">
        {Platform.OS === 'web' ? (
          <Row first label="Download a backup" sub="Every note, artifact and folder as one JSON file." right={<SmallButton icon="tray-arrow-down" label="Download" onPress={exportBackup} />} />
        ) : (
          <Row first label="Back up from the web version" sub="Open Claude Study in a browser to download a backup file. Single notes can be exported as PDF from the note's menu." />
        )}
      </Section>
      <Section title="Danger zone">
        <Row
          first
          label="Delete all notes"
          sub="Removes every note, artifact and folder from this device. This can't be undone."
          right={
            <SmallButton
              danger
              icon="delete-outline"
              label={confirm ? 'Tap again to delete' : 'Delete all'}
              disabled={stats.notes + stats.trashed + stats.folders === 0}
              onPress={() => (confirm ? (useStore.getState().resetData(), setConfirm(false)) : setConfirm(true))}
            />
          }
        />
      </Section>
    </>
  );
}

function About() {
  const st = useStStyles();
  const s = useSettingsStyles();
  const hasKey = useAiKey((x) => !!x.key);
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return (
    <>
      <View style={st.hero}>
        <Logo size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={st.heroTitle}>Claude Study</Text>
          <Text style={s.rowSub}>Handwritten notes, built for Claude · version {version}</Text>
        </View>
      </View>
      <Section title="The idea">
        <View style={s.pad}>
          <Text style={s.body}>
            Write by hand, lasso anything, and Claude answers beside your page, marks up your work, or builds an artifact from it: a quiz, a
            simulator, an interactive diagram that lives next to the notes it came from.
          </Text>
          <Text style={[s.rowSub, { marginTop: 12 }]}>A concept and working prototype for Claude. Not affiliated with or endorsed by Anthropic.</Text>
        </View>
      </Section>
      <Section title="Links">
        <Row first label="Claude Console" sub={hasKey ? 'Your key, billing and spending limits' : 'Create a Claude API key'} onPress={() => Linking.openURL('https://console.anthropic.com')} right={<Ext />} />
        <Row label="Anthropic's usage policy" onPress={() => Linking.openURL('https://www.anthropic.com/legal/aup')} right={<Ext />} />
        <Row label="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL)} right={<Ext />} />
        <Row label="Send feedback" sub={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Claude Study feedback')}`)} right={<Ext />} />
      </Section>
    </>
  );
}

/** System / Light / Dark, like claude.ai's appearance setting. */
function ThemePicker() {
  const mode = useThemeMode();
  const C = useTheme();
  const st = useStStyles();
  const options: { mode: ThemeMode; label: string; icon: IconName }[] = [
    { mode: 'system', label: 'System', icon: 'monitor' },
    { mode: 'light', label: 'Light', icon: 'white-balance-sunny' },
    { mode: 'dark', label: 'Dark', icon: 'weather-night' },
  ];
  return (
    <View style={st.segment}>
      {options.map((o) => {
        const on = o.mode === mode;
        return (
          <Pressable key={o.mode} onPress={() => setThemeMode(o.mode)} style={[st.segBtn, on && st.segOn]}>
            <MaterialCommunityIcons name={o.icon} size={15} color={on ? C.text : C.muted} />
            <Text style={[st.segText, on && { color: C.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Ext() {
  const C = useTheme();
  return <MaterialCommunityIcons name="open-in-new" size={16} color={C.muted} />;
}

function Mini({ value, label }: { value: number | string; label: string }) {
  const st = useStStyles();
  const s = useSettingsStyles();
  return (
    <View style={st.mini}>
      <Text style={st.miniValue}>{value}</Text>
      <Text style={s.rowSub}>{label}</Text>
    </View>
  );
}

const useStStyles = makeStyles((C) => ({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.backdrop, padding: 24 },
  window: { width: '100%', maxWidth: 1000, backgroundColor: C.bg, borderRadius: R.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden' },
  windowNarrow: { maxWidth: 640 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 12, paddingTop: 16, paddingBottom: 8 },
  h1: { fontFamily: F.serif, fontSize: 26, color: C.text },
  body: { flex: 1, flexDirection: 'row' },
  nav: { width: 210, paddingHorizontal: 12, paddingTop: 8, gap: 2 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, height: 40, borderRadius: R.sm },
  navChip: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  navText: { fontSize: 14, color: C.icon },
  content: { padding: 24, paddingTop: 8, paddingLeft: 12 },
  column: { width: '100%', maxWidth: 720 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  mini: { flex: 1, minWidth: 110, padding: 16, gap: 2 },
  miniValue: { fontFamily: F.serif, fontSize: 24, color: C.text, fontVariant: ['tabular-nums'] },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  segment: { flexDirection: 'row', backgroundColor: C.well, borderRadius: R.sm, padding: 3 },
  segBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 30, borderRadius: 6 },
  segOn: { backgroundColor: C.surface },
  segText: { fontSize: 13, fontWeight: '500', color: C.muted },
  heroTitle: { fontFamily: F.serifSemi, fontSize: 30, color: C.text },
}));

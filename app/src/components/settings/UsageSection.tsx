import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { modelName, usePrefs } from '@/lib/prefs';
import { useStore } from '@/lib/store';
import { makeStyles, R, useTheme } from '@/lib/theme';
import { dayKey, fmtCost, fmtTokens, useUsage, type Tally, type UsageKind } from '@/lib/usage';
import { Row, useSettingsStyles, Section, SmallButton, Stat } from './ui';

const KINDS: { kind: UsageKind; label: string }[] = [
  { kind: 'chat', label: 'Ask Claude' },
  { kind: 'tools', label: 'Artifacts' },
  { kind: 'search', label: 'Handwriting search' },
];
const DAYS = 30;
const money = (usd: number) => (usd > 0 ? (fmtCost(usd) ?? '$0') : '$0');

/** Settings → Usage: what Claude has cost on this device, by day, feature, model and note. */
export function UsageSection() {
  const st = useStStyles();
  const { byKind, byModel, byDay, allTime, byNote, month, resetMonth } = useUsage();
  const pages = useStore((st) => st.pages);
  const [confirm, setConfirm] = useState(false);
  const month$ = KINDS.reduce((n, k) => n + byKind[k.kind].costUsd, 0);
  const monthReq = KINDS.reduce((n, k) => n + byKind[k.kind].requests, 0);
  const monthTok = KINDS.reduce((n, k) => n + byKind[k.kind].tokens, 0);
  const monthName = new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long' });

  const topNotes = useMemo(
    () =>
      Object.entries(byNote)
        .filter(([id, t]) => pages[id] && t.tokens > 0)
        .sort((a, b) => b[1].costUsd - a[1].costUsd || b[1].tokens - a[1].tokens)
        .slice(0, 5),
    [byNote, pages],
  );
  const models = Object.entries(byModel ?? {}).sort((a, b) => b[1].costUsd - a[1].costUsd);

  return (
    <>
      <Section title={`Usage in ${monthName}`} sub="Estimated on this device from what Claude reports, at list prices. The Claude Console has the exact bill.">
        <View style={st.stats}>
          <Stat value={money(month$)} label="Spent this month" />
          <Stat value={String(monthReq)} label="Requests" />
          <Stat value={fmtTokens(monthTok).replace(' tokens', '')} label="Tokens" />
          <Stat value={money(allTime?.costUsd ?? 0)} label="All time" />
        </View>
        <Budget spent={month$} />
      </Section>

      <Section title="Last 30 days" sub="Estimated spend per day. Tap a bar to see that day.">
        <DailyChart byDay={byDay ?? {}} />
      </Section>

      <Section title="By feature">
        <Breakdown rows={KINDS.map((k) => ({ label: k.label, t: byKind[k.kind] }))} />
      </Section>

      {models.length > 0 && (
        <Section title="By model">
          <Breakdown rows={models.map(([id, t]) => ({ label: modelName(id), t }))} />
        </Section>
      )}

      <Section title="Notes that used the most" sub="Since each note was created.">
        {topNotes.length === 0 ? (
          <Row first label="Nothing yet" sub="Ask Claude about a note or build an artifact, and it shows up here." />
        ) : (
          topNotes.map(([id, t], i) => (
            <Row
              key={id}
              first={i === 0}
              label={pages[id]?.title || 'Untitled'}
              onPress={() => router.push(`/note/${id}`)}
              right={<Text style={st.value}>{fmtCost(t.costUsd) ?? fmtTokens(t.tokens)}</Text>}
            />
          ))
        )}
      </Section>

      <View style={{ flexDirection: 'row', marginBottom: 28 }}>
        <SmallButton
          icon="restore"
          label={confirm ? `Tap again to reset ${monthName}` : `Reset ${monthName}'s totals`}
          onPress={() => (confirm ? (resetMonth(), setConfirm(false)) : setConfirm(true))}
        />
      </View>
    </>
  );
}

/** Monthly budget meter. A warning only: Claude Study never blocks a request. */
function Budget({ spent }: { spent: number }) {
  const C = useTheme();
  const st = useStStyles();
  const s = useSettingsStyles();
  const budget = usePrefs((p) => p.monthlyBudget);
  const setBudget = usePrefs((p) => p.setMonthlyBudget);
  const [draft, setDraft] = useState(budget ? String(budget) : '');
  const ratio = budget > 0 ? spent / budget : 0;
  const over = budget > 0 && ratio >= 1;
  return (
    <View style={[s.pad, s.rowBorder, { gap: 10 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.rowLabel}>Monthly budget</Text>
          <Text style={s.rowSub}>Claude Study warns you when you pass it. Nothing is blocked.</Text>
        </View>
        <View style={st.budgetBox}>
          <Text style={st.dollar}>$</Text>
          <TextInput
            value={draft}
            onChangeText={(t) => setDraft(t.replace(/[^0-9.]/g, ''))}
            onBlur={() => setBudget(Number(draft) || 0)}
            onSubmitEditing={() => setBudget(Number(draft) || 0)}
            keyboardType="decimal-pad"
            placeholder="None"
            placeholderTextColor={C.faint}
            style={st.budgetInput}
          />
        </View>
      </View>
      {budget > 0 && (
        <>
          <View style={st.track}>
            <View style={[st.fill, { width: `${Math.min(100, ratio * 100)}%`, backgroundColor: over ? C.danger : C.primary }]} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {over && <MaterialCommunityIcons name="alert-circle-outline" size={15} color={C.danger} />}
            <Text style={[s.rowSub, over && { color: C.danger }]}>
              {over ? 'Over budget: ' : ''}
              {money(spent)} of ${budget.toFixed(2)} ({Math.round(ratio * 100)}%)
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

/** One bar per day, Claude orange, rounded tops on a shared baseline. */
function DailyChart({ byDay }: { byDay: Record<string, Tally> }) {
  const C = useTheme();
  const st = useStStyles();
  const s = useSettingsStyles();
  const days = useMemo(() => {
    const out: { key: string; date: Date; t: Tally | undefined }[] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86_400_000);
      const key = dayKey(date);
      out.push({ key, date, t: byDay[key] });
    }
    return out;
  }, [byDay]);
  const max = Math.max(...days.map((d) => d.t?.costUsd ?? 0), 0);
  const [picked, setPicked] = useState<string | null>(null);
  const shown = days.find((d) => d.key === picked) ?? days[days.length - 1];
  const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <View style={[s.pad, { gap: 12 }]}>
      <Text style={s.rowSub}>
        <Text style={{ color: C.text, fontWeight: '600' }}>{picked ? fmtDay(shown.date) : 'Today'}</Text>
        {'  '}
        {shown.t ? `${money(shown.t.costUsd)} · ${shown.t.requests} request${shown.t.requests === 1 ? '' : 's'} · ${fmtTokens(shown.t.tokens)}` : 'Nothing used'}
      </Text>
      <View style={st.plot}>
        {max > 0 && <Text style={st.axisMax}>{money(max)}</Text>}
        <View style={st.bars}>
          {days.map((d) => {
            const v = d.t?.costUsd ?? 0;
            const h = max > 0 ? Math.max(v > 0 ? 3 : 0, (v / max) * 100) : 0;
            const on = d.key === (picked ?? days[days.length - 1].key);
            return (
              <Pressable key={d.key} onPress={() => setPicked(d.key)} style={st.hit} hitSlop={{ top: 8, bottom: 8 }}>
                <View style={[st.bar, { height: `${h}%`, opacity: on || !picked ? 1 : 0.45 }]} />
              </Pressable>
            );
          })}
        </View>
        <View style={st.baseline} />
      </View>
      <View style={st.xLabels}>
        <Text style={st.axis}>{fmtDay(days[0].date)}</Text>
        <Text style={st.axis}>{fmtDay(days[15].date)}</Text>
        <Text style={st.axis}>Today</Text>
      </View>
    </View>
  );
}

/** Label, value, and a thin bar showing its share of the total. */
function Breakdown({ rows }: { rows: { label: string; t: Tally }[] }) {
  const st = useStStyles();
  const s = useSettingsStyles();
  const total = rows.reduce((n, r) => n + r.t.costUsd, 0);
  return (
    <>
      {rows.map((r, i) => (
        <View key={r.label} style={[s.pad, i > 0 && s.rowBorder, { gap: 8 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={[s.rowLabel, { flex: 1 }]}>{r.label}</Text>
            <Text style={st.value}>{money(r.t.costUsd)}</Text>
            <Text style={st.meta}>
              {r.t.requests} req{r.t.requests > 0 && r.t.costUsd > 0 ? ` · avg ${fmtCost(r.t.costUsd / r.t.requests)}` : ''} · {fmtTokens(r.t.tokens)}
            </Text>
          </View>
          <View style={st.track}>
            <View style={[st.fill, { width: `${total > 0 ? (r.t.costUsd / total) * 100 : 0}%` }]} />
          </View>
        </View>
      ))}
    </>
  );
}

const useStStyles = makeStyles((C) => ({
  stats: { flexDirection: 'row', flexWrap: 'wrap' },
  value: { fontSize: 14, fontWeight: '600', color: C.text, fontVariant: ['tabular-nums'] },
  meta: { fontSize: 12, color: C.muted, fontVariant: ['tabular-nums'], minWidth: 170, textAlign: 'right' },
  track: { height: 6, borderRadius: 3, backgroundColor: C.well, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: C.primary },
  budgetBox: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: 10, backgroundColor: C.bg, width: 110 },
  dollar: { fontSize: 15, color: C.muted },
  budgetInput: { flex: 1, paddingVertical: 8, paddingLeft: 4, fontSize: 15, color: C.text },
  plot: { height: 140, justifyContent: 'flex-end' },
  axisMax: { position: 'absolute', top: -2, left: 0, fontSize: 11, color: C.muted },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingTop: 16 },
  hit: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { backgroundColor: C.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  baseline: { height: StyleSheet.hairlineWidth, backgroundColor: C.faint },
  xLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  axis: { fontSize: 11, color: C.muted },
}));

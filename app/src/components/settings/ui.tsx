import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { F, makeStyles, R, useTheme } from '@/lib/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** A titled group of settings, like the cards in claude.ai's settings. */
export function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  const s = useSettingsStyles();
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {!!sub && <Text style={s.sectionSub}>{sub}</Text>}
      <View style={s.card}>{children}</View>
    </View>
  );
}

/** One line in a section: label (and optional detail) on the left, a control on the right. */
export function Row({ label, sub, right, onPress, first }: { label: string; sub?: string; right?: ReactNode; onPress?: () => void; first?: boolean }) {
  const C = useTheme();
  const s = useSettingsStyles();
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [s.row, !first && s.rowBorder, pressed && { backgroundColor: C.selected }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {!!sub && <Text style={s.rowSub}>{sub}</Text>}
      </View>
      {right}
    </Pressable>
  );
}

export function Toggle({ on }: { on: boolean }) {
  const C = useTheme();
  const s = useSettingsStyles();
  return (
    <View style={[s.toggle, on && { backgroundColor: C.primary }]}>
      <View style={[s.knob, on && { transform: [{ translateX: 14 }] }]} />
    </View>
  );
}

/** A quiet bordered button; `danger` for destructive actions. */
export function SmallButton({ label, icon, onPress, danger, disabled }: { label: string; icon?: IconName; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  const C = useTheme();
  const s = useSettingsStyles();
  const color = danger ? C.danger : C.text;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [s.btn, pressed && { backgroundColor: C.selected }, disabled && { opacity: 0.4 }]}>
      {icon && <MaterialCommunityIcons name={icon} size={16} color={color} />}
      <Text style={[s.btnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** Big number with a caption, for usage totals. */
export function Stat({ value, label }: { value: string; label: string }) {
  const s = useSettingsStyles();
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

export const useSettingsStyles = makeStyles((C) => ({
  section: { gap: 6, marginBottom: 28 },
  sectionTitle: { fontFamily: F.serifMedium, fontSize: 20, color: C.text },
  sectionSub: { fontSize: 13, lineHeight: 19, color: C.muted, marginBottom: 4 },
  card: { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  rowLabel: { fontSize: 15, color: C.text },
  rowSub: { fontSize: 13, lineHeight: 18, color: C.muted },
  toggle: { width: 34, height: 20, borderRadius: 10, backgroundColor: C.faint, padding: 2 },
  knob: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.surface },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: R.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, backgroundColor: C.surface },
  btnText: { fontSize: 14, fontWeight: '500' },
  stat: { flex: 1, minWidth: 120, padding: 16, gap: 2 },
  statValue: { fontFamily: F.serif, fontSize: 28, color: C.text, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 13, color: C.muted },
  body: { fontSize: 14, lineHeight: 21, color: C.icon },
  pad: { padding: 16 },
}));

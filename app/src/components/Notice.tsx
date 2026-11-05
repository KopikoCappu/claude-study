import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { makeStyles, R, useTheme } from '@/lib/theme';

/** `action` adds a button, e.g. Undo after a delete. */
export type NoticeState = { text: string; busy?: boolean; action?: { label: string; onPress: () => void } } | null;

/** Small status pill at the bottom of the screen (import progress, errors). Non-busy messages fade after a few seconds. */
export function useNotice() {
  const [notice, setNotice] = useState<NoticeState>(null);
  useEffect(() => {
    if (!notice || notice.busy) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  return [notice, setNotice] as const;
}

export function Notice({ notice, onDismiss }: { notice: NoticeState; onDismiss?: () => void }) {
  const C = useTheme();
  const styles = useStyles();
  if (!notice) return null;
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={[styles.pill, C.shadow]}>
        {notice.busy && <ActivityIndicator size="small" color={C.text} />}
        <Text style={styles.text}>{notice.text}</Text>
        {notice.action && (
          <Pressable
            hitSlop={8}
            onPress={() => {
              notice.action!.onPress();
              onDismiss?.();
            }}
          >
            <Text style={styles.action}>{notice.action.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((C) => ({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 28, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 520, backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.pill },
  text: { color: C.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  action: { color: C.primary, fontSize: 14, fontWeight: '700' },
}));

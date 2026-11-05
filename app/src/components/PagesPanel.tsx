import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { NoteThumb } from '@/components/NoteThumb';
import { IconBtn } from '@/components/Toolbar';
import { useStore } from '@/lib/store';
import { makeStyles, R, useTheme } from '@/lib/theme';
import { clampViewport, deletePageAt, DESK_PAD, duplicatePage, insertPage, movePage, pageAtCenter, pageCountFor, pageTop } from '@/lib/pages';
import type { Page } from '@/lib/types';
import type { Viewport } from '@/lib/viewport';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  pageId: string;
  viewport: Viewport;
  /** Size of the drawing area, to scroll and to tell which page is on screen. */
  getView: () => { width: number; height: number };
  onClose: () => void;
};

const WIDTH = 200;

/** Left sidebar: a thumbnail of every page; tap to jump there, or reorder / duplicate / insert / delete pages. */
export function PagesPanel({ pageId, viewport, getView, onClose }: Props) {
  const C = useTheme();
  const styles = useStyles();
  const page = useStore((s) => s.pages[pageId]);
  const count = page ? pageCountFor(page) : 1;
  const [current, setCurrent] = useState(0);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const openMenu = (i: number | null) => {
    setMenuFor(i);
    setConfirmDelete(false);
  };
  const viewH = getView().height;

  useAnimatedReaction(
    () => pageAtCenter(viewport.ty.get(), viewport.scale.get(), viewH, count),
    (v, prev) => {
      if (v !== prev) scheduleOnRN(setCurrent, v);
    },
    [viewH, count],
  );

  if (!page) return null;
  const update = (fn: (p: Page) => Partial<Page>) => useStore.getState().updatePage(pageId, fn, true); // one undo step each

  function goTo(i: number) {
    const { width, height } = getView();
    viewport.ty.set(DESK_PAD - pageTop(i) * viewport.scale.get());
    clampViewport(viewport, width, height, pageCountFor(useStore.getState().pages[pageId]));
  }

  function act(i: number, what: 'up' | 'down' | 'duplicate' | 'insert' | 'delete') {
    if (what === 'delete' && !confirmDelete) return setConfirmDelete(true);
    if (what === 'up') update((p) => movePage(p, i, i - 1));
    if (what === 'down') update((p) => movePage(p, i, i + 1));
    if (what === 'duplicate') update((p) => duplicatePage(p, i));
    if (what === 'insert') update((p) => insertPage(p, i + 1));
    if (what === 'delete') update((p) => deletePageAt(p, i));
    openMenu(null);
    // Keep showing the page that was acted on (or the new one).
    const next = what === 'up' ? i - 1 : what === 'down' ? i + 1 : what === 'delete' ? Math.max(0, i - 1) : i + 1;
    requestAnimationFrame(() => goTo(next));
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>Pages</Text>
        <IconBtn icon="close" size={18} onPress={onClose} />
      </View>
      <FlatList
        data={[...Array(count).keys()]}
        keyExtractor={(i) => String(i)}
        contentContainerStyle={{ padding: 12, gap: 14 }}
        renderItem={({ item: i }) => (
          <View>
            <Pressable onPress={() => goTo(i)} onLongPress={() => openMenu(i)} style={[styles.thumb, current === i && styles.thumbOn]}>
              <NoteThumb page={page} index={i} />
            </Pressable>
            <View style={styles.thumbMeta}>
              <Text style={[styles.num, current === i && { color: C.text, fontWeight: '700' }]}>{i + 1}</Text>
              <IconBtn icon="dots-horizontal" size={16} active={menuFor === i} onPress={() => openMenu(menuFor === i ? null : i)} />
            </View>
            {menuFor === i && (
              <View style={styles.menu}>
                {i > 0 && <Row icon="arrow-up" label="Move up" onPress={() => act(i, 'up')} />}
                {i < count - 1 && <Row icon="arrow-down" label="Move down" onPress={() => act(i, 'down')} />}
                <Row icon="content-copy" label="Duplicate" onPress={() => act(i, 'duplicate')} />
                <Row icon="plus" label="Blank page after" onPress={() => act(i, 'insert')} />
                {count > 1 && <Row icon="delete-outline" label={confirmDelete ? 'Tap again to delete' : 'Delete page'} danger onPress={() => act(i, 'delete')} />}
              </View>
            )}
          </View>
        )}
        ListFooterComponent={
          <Pressable onPress={() => act(count - 1, 'insert')} style={({ pressed }) => [styles.add, pressed && { opacity: 0.6 }]}>
            <MaterialCommunityIcons name="plus" size={18} color={C.muted} />
            <Text style={styles.addText}>Add page</Text>
          </Pressable>
        }
      />
    </View>
  );
}

function Row({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const C = useTheme();
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.selected }]}>
      <MaterialCommunityIcons name={icon} size={16} color={danger ? C.danger : C.icon} />
      <Text style={[styles.rowText, danger && { color: C.danger }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((C) => ({
  panel: { width: WIDTH, backgroundColor: C.surface, borderRightWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14, paddingRight: 4, height: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  title: { fontSize: 15, fontWeight: '700', color: C.text },
  thumb: { aspectRatio: 816 / 1056, borderRadius: R.sm, overflow: 'hidden', borderWidth: 2, borderColor: C.border },
  thumbOn: { borderColor: C.focus },
  thumbMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 4 },
  num: { fontSize: 12, color: C.muted, fontVariant: ['tabular-nums'] },
  menu: { backgroundColor: C.bg, borderRadius: R.sm, padding: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, height: 34, borderRadius: R.sm },
  rowText: { fontSize: 13, color: C.text },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: R.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: C.faint },
  addText: { fontSize: 13, fontWeight: '600', color: C.muted },
}));

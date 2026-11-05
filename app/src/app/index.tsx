import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps, type ComponentRef, type RefObject } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Notice, useNotice } from '@/components/Notice';
import { importFile, pickFiles, titleFrom } from '@/lib/importFiles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyHome } from '@/components/EmptyHome';
import { HomeBanner } from '@/components/HomeBanner';
import { Logo } from '@/components/Logo';
import { NoteThumb } from '@/components/NoteThumb';
import { SyncBadge } from '@/components/SyncBadge';
import { IconBtn } from '@/components/Toolbar';
import { useAiKey } from '@/lib/aiKey';
import { endDrag, justDragged, moveDrag, registerDropTarget, startDrag, useNoteDrag } from '@/lib/noteDrag';
import { usePrefs, type HomeSort } from '@/lib/prefs';
import { fmtCost, useUsage } from '@/lib/usage';
import { searchNotes, type SearchHit } from '@/lib/search';
import { TRASH_DAYS, useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/sync';
import { F, FOLDER_COLORS, folderColor, makeStyles, R, useTheme } from '@/lib/theme';
import type { Folder, Page } from '@/lib/types';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
const ALL = '__all__';
const SORTS: Record<HomeSort, { label: string; compare: (a: Page, b: Page) => number }> = {
  edited: { label: 'Last edited', compare: (a, b) => b.updatedAt - a.updatedAt },
  created: { label: 'Date created', compare: (a, b) => b.createdAt - a.createdAt },
  title: { label: 'Title', compare: (a, b) => (a.title || 'Untitled').localeCompare(b.title || 'Untitled', undefined, { numeric: true }) },
};
const TRASH = '__trash__';

export default function NotesHome() {
  const C = useTheme();
  const styles = useStyles();
  const pages = useStore((s) => s.pages);
  const folders = useStore((s) => s.folders);
  const { createPage, createFolder } = useStore.getState();
  const [selected, setCurrent] = useState<string>(ALL);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [cardMenu, setCardMenu] = useState<string | null>(null);
  const [mainWidth, setMainWidth] = useState(0);
  const [notice, setNotice] = useNotice();
  const [query, setQuery] = useState('');
  const searchRef = useRef<ComponentRef<typeof TextInput>>(null);
  useHomeShortcuts(searchRef, () => router.push(`/note/${createPage(current === ALL || current === TRASH ? null : current)}`));
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  useEffect(() => {
    if (!confirmEmpty) return;
    const t = setTimeout(() => setConfirmEmpty(false), 3000);
    return () => clearTimeout(t);
  }, [confirmEmpty]);

  // If the open folder was deleted, fall back to All notes.
  const current = selected === TRASH || (selected !== ALL && folders[selected]) ? selected : ALL;
  const folderList = Object.values(folders).sort((a, b) => a.createdAt - b.createdAt);
  const live = Object.values(pages).filter((p) => !p.deletedAt);
  const trashed = Object.values(pages)
    .filter((p) => p.deletedAt)
    .sort((a, b) => b.deletedAt! - a.deletedAt!);
  const searching = query.trim().length > 0;
  const hits = searching ? searchNotes(Object.values(pages), query) : [];
  const inFolder = current === ALL ? live : current === TRASH ? trashed : live.filter((p) => p.folderId === current);
  const sort = usePrefs((p) => p.homeSort);
  const list = current === TRASH ? inFolder : [...inFolder].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || SORTS[sort].compare(a, b));
  const cols = Math.max(2, Math.floor((mainWidth - 80) / 220));
  const heading = searching ? 'Search' : current === ALL ? 'All notes' : current === TRASH ? 'Recently deleted' : (folders[current]?.name ?? 'All notes');
  const [weekAgo] = useState(() => Date.now() - 7 * 864e5);
  const recent = list.filter((p) => p.updatedAt > weekAgo).length;
  const subtitle = searching
    ? `${hits.length} note${hits.length === 1 ? '' : 's'} match “${query.trim()}”`
    : current === TRASH
      ? `Notes here are deleted for good after ${TRASH_DAYS} days.`
      : `${list.length} note${list.length === 1 ? '' : 's'}${recent ? ` · ${recent} edited this week` : ''}`;
  const folderId = current === ALL || current === TRASH ? null : current;

  /** Each file (PDF, image, .txt/.md) becomes its own note in the open folder. */
  async function importNotes() {
    const files = await pickFiles();
    if (!files.length) return;
    const made: string[] = [];
    for (const file of files) {
      setNotice({ text: `Importing ${file.name}…`, busy: true });
      try {
        const got = await importFile(file, 0, (text) => setNotice({ text, busy: true }));
        const id = createPage(folderId);
        useStore.getState().updatePage(id, () => ({
          title: titleFrom(file),
          images: got.images,
          texts: got.texts,
          pageCount: got.pages,
          paper: got.images.length ? 'blank' : 'lined',
        }));
        made.push(id);
      } catch (e) {
        setNotice({ text: e instanceof Error ? e.message : String(e) });
        return;
      }
    }
    setNotice(null);
    if (made.length === 1) router.push(`/note/${made[0]}`);
    else setNotice({ text: `Imported ${made.length} notes.` });
  }

  function newFolder() {
    const id = createFolder();
    setCurrent(id);
    setRenaming(id);
  }

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.sidebar}>
        <Pressable
          onPress={() => {
            setQuery('');
            setCurrent(ALL);
          }}
          style={({ pressed }) => [styles.brandRow, pressed && { opacity: 0.7 }]}
        >
          <Logo size={30} />
          <Text style={styles.brand}>Claude Study</Text>
        </Pressable>
        <View style={styles.search}>
          <MaterialCommunityIcons name="magnify" size={18} color={C.muted} />
          <TextInput ref={searchRef} value={query} onChangeText={setQuery} placeholder="Search notes" placeholderTextColor={C.muted} autoCorrect={false} style={styles.searchInput} />
          {searching && <SmallIcon icon="close" onPress={() => setQuery('')} />}
        </View>
        <ScrollView contentContainerStyle={{ gap: 2 }}>
          <SideItem
            icon="note-multiple-outline"
            label="All notes"
            dropTarget={null}
            count={live.length}
            active={!searching && current === ALL}
            onPress={() => {
              setQuery('');
              setCurrent(ALL);
            }}
          />
          <Text style={styles.sideLabel}>Folders</Text>
          {folderList.map((f) => (
            <FolderItem
              key={f.id}
              folder={f}
              count={live.filter((p) => p.folderId === f.id).length}
              active={!searching && current === f.id}
              renaming={renaming === f.id}
              onPress={() => {
                setQuery('');
                setCurrent(f.id);
              }}
              onRename={() => setRenaming(f.id)}
              onDoneRename={() => setRenaming(null)}
            />
          ))}
          <Pressable onPress={newFolder} style={({ pressed }) => [styles.sideItem, pressed && { backgroundColor: C.selected }]}>
            <MaterialCommunityIcons name="folder-plus-outline" size={18} color={C.muted} />
            <Text style={[styles.sideText, { color: C.muted }]}>New folder</Text>
          </Pressable>
          <View style={styles.sideSep} />
          <SideItem
            icon="delete-outline"
            label="Recently deleted"
            count={trashed.length}
            active={!searching && current === TRASH}
            onPress={() => {
              setQuery('');
              setCurrent(TRASH);
            }}
          />
        </ScrollView>
        <AiKeyRow />
        <AccountRow />
      </View>

      <View style={styles.main} onLayout={(e) => setMainWidth(e.nativeEvent.layout.width)}>
        <View style={styles.header}>
          <HomeBanner
            color={searching || current === ALL || current === TRASH ? undefined : folderColor(folders[current])}
            title={heading}
            subtitle={subtitle}
            onRename={folderId ? (name) => useStore.getState().renameFolder(folderId, name.trim() || 'Untitled folder') : undefined}
            action={
              searching ? undefined : current === TRASH ? (
                trashed.length > 0 && (
                  <Pressable
                    style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => {
                      if (!confirmEmpty) return setConfirmEmpty(true);
                      useStore.getState().emptyTrash();
                      setConfirmEmpty(false);
                    }}
                  >
                    <MaterialCommunityIcons name="delete-forever-outline" size={18} color={C.danger} />
                    <Text style={[styles.newText, { color: C.danger }]}>{confirmEmpty ? 'Tap again to delete all' : 'Empty'}</Text>
                  </Pressable>
                )
              ) : (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.8 }]} onPress={importNotes}>
                  <MaterialCommunityIcons name="file-import-outline" size={18} color={C.text} />
                  <Text style={styles.newText}>Import</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.newBtn, styles.newPrimary, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push(`/note/${createPage(folderId)}`)}
                >
                  <MaterialCommunityIcons name="plus" size={18} color={C.onPrimary} />
                  <Text style={[styles.newText, { color: C.onPrimary }]}>New note</Text>
                </Pressable>
              </View>
              )
            }
          />
        </View>

        {mainWidth > 0 && searching && (
          <FlatList
            data={hits}
            keyExtractor={(h) => h.page.id}
            contentContainerStyle={{ gap: 10, paddingHorizontal: 40, paddingBottom: 48 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<SearchEmpty />}
            renderItem={({ item }) => <SearchResult hit={item} query={query} folder={item.page.folderId ? folders[item.page.folderId] : undefined} />}
          />
        )}
        {mainWidth > 0 && !searching && (
          <FlatList
            data={list}
            key={`cols-${cols}`}
            numColumns={cols}
            keyExtractor={(p) => p.id}
            columnWrapperStyle={{ gap: 20 }}
            contentContainerStyle={{ gap: 24, paddingHorizontal: 40, paddingBottom: 48 }}
            ListHeaderComponent={list.length > 1 && current !== TRASH ? <SortBar /> : undefined}
            ListHeaderComponentStyle={{ zIndex: 20 }}
            ListEmptyComponent={
              current === TRASH ? (
                <Text style={styles.empty}>Nothing here. Deleted notes stay here for {TRASH_DAYS} days.</Text>
              ) : (
                <EmptyHome folderId={folderId} onImport={importNotes} />
              )
            }
            renderItem={({ item }) => (
              <NoteCard
                page={item}
                width={(mainWidth - 80 - 20 * (cols - 1)) / cols}
                folders={folderList}
                folder={item.folderId ? folders[item.folderId] : undefined}
                showFolder={current === ALL}
                trashed={current === TRASH}
                menuOpen={cardMenu === item.id}
                setMenuOpen={(o) => setCardMenu(o ? item.id : null)}
                onDeleted={(id) => {
                  setCardMenu(null);
                  setNotice({ text: 'Moved to Recently deleted', action: { label: 'Undo', onPress: () => useStore.getState().restorePage(id) } });
                }}
              />
            )}
          />
        )}
      </View>
      <Notice notice={notice} onDismiss={() => setNotice(null)} />
      <DragGhost />
    </SafeAreaView>
  );
}

/** Bottom of the sidebar: Settings, with this month's spend (or a nudge to add a key). */
function AiKeyRow() {
  const C = useTheme();
  const styles = useStyles();
  const hasKey = useAiKey((s) => !!s.key);
  const spent = useUsage((s) => s.byKind.chat.costUsd + s.byKind.tools.costUsd + s.byKind.search.costUsd);
  return (
    <Pressable onPress={() => router.push(hasKey ? '/settings' : '/settings?section=claude')} style={({ pressed }) => [styles.sideItem, pressed && { backgroundColor: C.selected }]}>
      <MaterialCommunityIcons name="cog-outline" size={18} color={C.icon} />
      <Text style={styles.sideText} numberOfLines={1}>
        Settings
      </Text>
      <Text style={[styles.count, !hasKey && { color: C.primary, fontWeight: '600' }]}>{hasKey ? `${spent > 0 ? fmtCost(spent) : '$0'} this month` : 'Add Claude key'}</Text>
    </Pressable>
  );
}

function AccountRow() {
  const C = useTheme();
  const styles = useStyles();
  const session = useAuth((s) => s.session);
  if (!supabase) return null;
  return (
    <Pressable onPress={() => router.push('/account')} style={({ pressed }) => [styles.account, pressed && { backgroundColor: C.selected }]}>
      <MaterialCommunityIcons name="account-circle-outline" size={22} color={C.icon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.sideText} numberOfLines={1}>
          {session ? session.user.email : 'Sign in to sync'}
        </Text>
        {session ? <SyncBadge /> : <Text style={styles.count}>Notes stay on this device</Text>}
      </View>
    </Pressable>
  );
}

/** Register a sidebar row as a place to drop a dragged note; returns the ref to attach and whether a note is over it. */
function useDropTarget(folderId: string | null | undefined) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (folderId === undefined) return;
    return registerDropTarget(folderId, (done) => ref.current?.measureInWindow((x, y, w, h) => done({ x, y, w, h })));
  }, [folderId]);
  const over = useNoteDrag((d) => d.pageId !== null && folderId !== undefined && d.over === folderId);
  return { ref, over };
}

function SideItem({ icon, label, count, active, onPress, dropTarget }: { icon: IconName; label: string; count: number; active: boolean; onPress: () => void; dropTarget?: string | null }) {
  const C = useTheme();
  const styles = useStyles();
  const drop = useDropTarget(dropTarget);
  return (
    <Pressable ref={drop.ref} onPress={onPress} style={({ pressed }) => [styles.sideItem, (active || pressed) && { backgroundColor: C.selected }, drop.over && styles.dropOver]}>
      <MaterialCommunityIcons name={icon} size={18} color={active ? C.text : C.icon} />
      <Text style={[styles.sideText, active && { fontWeight: '600' }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.count}>{count}</Text>
    </Pressable>
  );
}

type FolderItemProps = {
  folder: Folder;
  count: number;
  active: boolean;
  renaming: boolean;
  onPress: () => void;
  onRename: () => void;
  onDoneRename: () => void;
};

function FolderItem({ folder, count, active, renaming, onPress, onRename, onDoneRename }: FolderItemProps) {
  const C = useTheme();
  const styles = useStyles();
  const { renameFolder, deleteFolder, setFolderColor } = useStore.getState();
  const [name, setName] = useState(folder.name);
  const [confirm, setConfirm] = useState(false);
  const [palette, setPalette] = useState(false);
  const color = folderColor(folder);
  const drop = useDropTarget(folder.id);
  const lastTap = useRef(0);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 3000);
    return () => clearTimeout(t);
  }, [confirm]);

  if (renaming) {
    return (
      <View style={[styles.sideItem, { backgroundColor: C.selected }]}>
        <MaterialCommunityIcons name="folder" size={18} color={color} />
        <TextInput
          value={name}
          onChangeText={setName}
          autoFocus
          selectTextOnFocus
          onSubmitEditing={() => {
            renameFolder(folder.id, name.trim() || 'Untitled folder');
            onDoneRename();
          }}
          onBlur={() => {
            renameFolder(folder.id, name.trim() || 'Untitled folder');
            onDoneRename();
          }}
          style={[styles.sideText, styles.renameInput]}
        />
      </View>
    );
  }

  return (
    <View>
      <Pressable
        ref={drop.ref}
        onPress={() => {
          // Double-tap (or press and hold) a folder to rename it.
          if (Date.now() - lastTap.current < 350) onRename();
          else onPress();
          lastTap.current = Date.now();
        }}
        onLongPress={onRename}
        style={({ pressed }) => [styles.sideItem, (active || pressed) && { backgroundColor: C.selected }, drop.over && styles.dropOver]}
      >
        <MaterialCommunityIcons name="folder" size={18} color={color} />
        <Text style={[styles.sideText, active && { fontWeight: '600' }]} numberOfLines={1}>
          {folder.name}
        </Text>
        {active ? (
          <View style={{ flexDirection: 'row' }}>
            <SmallIcon icon="palette-outline" onPress={() => setPalette(!palette)} />
            <SmallIcon icon="pencil-outline" onPress={onRename} />
            <SmallIcon icon={confirm ? 'check' : 'delete-outline'} danger={confirm} onPress={() => (confirm ? deleteFolder(folder.id) : setConfirm(true))} />
          </View>
        ) : (
          <Text style={styles.count}>{count}</Text>
        )}
      </Pressable>
      {active && palette && (
        <View style={styles.swatches}>
          {FOLDER_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setFolderColor(folder.id, c)}
              hitSlop={4}
              style={[styles.swatch, { backgroundColor: c }, c === color && styles.swatchOn]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

type NoteCardProps = {
  page: Page;
  width: number;
  folders: Folder[];
  folder?: Folder;
  showFolder: boolean;
  menuOpen: boolean;
  setMenuOpen: (o: boolean) => void;
  /** In Recently deleted: tapping opens Restore / Delete forever instead of the note. */
  trashed?: boolean;
  /** Called after the note is moved to Recently deleted (to offer Undo). */
  onDeleted?: (id: string) => void;
};

/** "just now", "5m ago", "2h ago", "yesterday", "3d ago", then the date. */
function edited(at: number, now: number) {
  const m = Math.round((now - at) / 60_000);
  if (m < 1) return 'Edited just now';
  if (m < 60) return `Edited ${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `Edited ${h}h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'Edited yesterday';
  if (d < 7) return `Edited ${d}d ago`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function NoteCard({ page, width, folders, folder, showFolder, menuOpen, setMenuOpen, trashed, onDeleted }: NoteCardProps) {
  const C = useTheme();
  const styles = useStyles();
  const { movePage, restorePage, renamePage, setPinned, duplicateNote } = useStore.getState();
  const [now] = useState(() => Date.now());
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(page.title);
  const lastTitleTap = useRef(0);
  const daysLeft = page.deletedAt ? Math.max(0, Math.ceil(TRASH_DAYS - (now - page.deletedAt) / 864e5)) : 0;
  const artifacts = page.tools?.length ?? 0;
  // The menu opens in a full-screen overlay so a tap anywhere outside it closes it.
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number; w: number } | null>(null);
  useEffect(() => {
    if (!menuOpen) return setAnchor(null);
    cardRef.current?.measureInWindow((x, y, w) => setAnchor({ x, y, w }));
  }, [menuOpen]);
  const closeMenu = () => setMenuOpen(false);

  const startRename = () => {
    setName(page.title);
    setRenaming(true);
    setMenuOpen(false);
  };
  const finishRename = () => {
    renamePage(page.id, name);
    setRenaming(false);
  };

  // Press and hold, then drag onto a folder in the sidebar. Holding without moving opens the menu.
  const drag = Gesture.Pan()
    .runOnJS(true)
    .enabled(!trashed && !renaming)
    .activateAfterLongPress(350)
    .onStart((e) => startDrag(page.id, page.title || 'Untitled', e.absoluteX, e.absoluteY))
    .onUpdate((e) => moveDrag(e.absoluteX, e.absoluteY))
    .onEnd((e) => {
      const moved = Math.hypot(e.translationX, e.translationY) > 12;
      const target = endDrag();
      if (!moved) setMenuOpen(true);
      else if (target !== undefined && target !== (page.folderId ?? null)) movePage(page.id, target);
    })
    .onFinalize(() => {
      if (useNoteDrag.getState().pageId === page.id) endDrag();
    });

  return (
    <View ref={cardRef} style={{ width }}>
      <GestureDetector gesture={drag}>
        <Pressable onPress={() => (justDragged() ? undefined : trashed ? setMenuOpen(!menuOpen) : router.push(`/note/${page.id}`))} onLongPress={trashed ? () => setMenuOpen(true) : undefined}>
          <View style={[styles.card, C.shadow, trashed && { opacity: 0.6 }]}>
            <NoteThumb page={page} />
            {folder && <View style={[styles.stripe, { backgroundColor: folderColor(folder) }]} />}
            <View style={styles.badges}>
              {page.pinned && !trashed && (
                <View style={styles.badge}>
                  <MaterialCommunityIcons name="pin" size={12} color={C.primary} />
                </View>
              )}
              {artifacts > 0 && (
                <View style={styles.badge}>
                  <MaterialCommunityIcons name="puzzle-outline" size={12} color={C.primary} />
                  <Text style={styles.badgeText}>{artifacts}</Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      </GestureDetector>
      <View style={styles.cardMeta}>
        <View style={{ flex: 1 }}>
          {renaming ? (
            <TextInput value={name} onChangeText={setName} autoFocus selectTextOnFocus onSubmitEditing={finishRename} onBlur={finishRename} style={[styles.title, styles.renameInput]} />
          ) : (
            <Pressable
              disabled={trashed}
              onPress={() => {
                // Double-tap the title to rename.
                if (Date.now() - lastTitleTap.current < 350) startRename();
                lastTitleTap.current = Date.now();
              }}
            >
              <Text style={styles.title} numberOfLines={1}>
                {page.title || 'Untitled'}
              </Text>
            </Pressable>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{trashed ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : edited(page.updatedAt, now)}</Text>
            {showFolder && folder && (
              <View style={[styles.tag, { backgroundColor: folderColor(folder) + '22' }]}>
                <View style={[styles.tagDot, { backgroundColor: folderColor(folder) }]} />
                <Text style={styles.tagText} numberOfLines={1}>
                  {folder.name}
                </Text>
              </View>
            )}
          </View>
        </View>
        <IconBtn icon="dots-horizontal" size={18} active={menuOpen} onPress={() => setMenuOpen(!menuOpen)} />
      </View>

      <Modal visible={menuOpen && !!anchor} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={closeMenu}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
        {anchor && (
          <View style={[styles.cardMenu, C.shadow, { top: anchor.y + 40, left: anchor.x, right: undefined, width: anchor.w }]}>
            {trashed ? (
              <>
          <MenuRow
            icon="restore"
            label="Restore"
            onPress={() => {
              restorePage(page.id);
              setMenuOpen(false);
            }}
          />
          <DeleteForeverRow pageId={page.id} />
              </>
            ) : (
              <>
          <MenuRow icon="pencil-outline" label="Rename" onPress={startRename} />
          <MenuRow
            icon={page.pinned ? 'pin-off-outline' : 'pin-outline'}
            label={page.pinned ? 'Unpin' : 'Pin to top'}
            onPress={() => (setPinned(page.id, !page.pinned), setMenuOpen(false))}
          />
          <MenuRow icon="content-copy" label="Duplicate" onPress={() => (duplicateNote(page.id), setMenuOpen(false))} />
          <View style={styles.sep} />
          <Text style={styles.menuLabel}>Move to</Text>
          <MenuRow icon="inbox-outline" label="No folder" checked={!page.folderId} onPress={() => (movePage(page.id, null), setMenuOpen(false))} />
          {folders.map((f) => (
            <MenuRow key={f.id} icon="folder" iconColor={folderColor(f)} label={f.name} checked={page.folderId === f.id} onPress={() => (movePage(page.id, f.id), setMenuOpen(false))} />
          ))}
          <View style={styles.sep} />
          <DeleteRow pageId={page.id} onDeleted={onDeleted} />
              </>
            )}
          </View>
        )}
      </Modal>
    </View>
  );
}

/** Deleting moves the note to Recently deleted, where it can be restored, so one tap is enough. */
function DeleteRow({ pageId, onDeleted }: { pageId: string; onDeleted?: (id: string) => void }) {
  return (
    <MenuRow
      icon="delete-outline"
      label="Delete note"
      danger
      onPress={() => {
        useStore.getState().deletePage(pageId);
        onDeleted?.(pageId);
      }}
    />
  );
}

/** Two-tap permanent delete; lives inside the menu so its confirm state resets whenever the menu closes. */
function DeleteForeverRow({ pageId }: { pageId: string }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <MenuRow
      icon="delete-forever-outline"
      label={confirm ? "Tap again: can't be undone" : 'Delete forever'}
      danger
      onPress={() => (confirm ? useStore.getState().deleteForever(pageId) : setConfirm(true))}
    />
  );
}

const WHERE: Record<SearchHit['where'], string> = { title: 'Title', typed: 'Typed text', handwriting: 'Handwriting', equation: 'Equation', chat: 'AI chat' };

/** A search result: title, where it matched, and the matching words in context. Opens the note at that page. */
function SearchResult({ hit, query, folder }: { hit: SearchHit; query: string; folder?: Folder }) {
  const C = useTheme();
  const styles = useStyles();
  const { page, pageIndex, snippet, where } = hit;
  const open = () => router.push(pageIndex != null ? `/note/${page.id}?page=${pageIndex + 1}` : `/note/${page.id}`);
  return (
    <Pressable onPress={open} style={({ pressed }) => [styles.result, C.shadow, pressed && { opacity: 0.8 }]}>
      <View style={styles.resultThumb}>
        <NoteThumb page={page} index={pageIndex ?? 0} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.title} numberOfLines={1}>
          <Highlighted text={page.title || 'Untitled'} query={query} />
        </Text>
        {!!snippet && (
          <Text style={styles.snippet} numberOfLines={2}>
            <Highlighted text={snippet} query={query} />
          </Text>
        )}
        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {WHERE[where]}
            {pageIndex != null ? ` · page ${pageIndex + 1}` : ''}
          </Text>
          {folder && (
            <View style={[styles.tag, { backgroundColor: folderColor(folder) + '22' }]}>
              <View style={[styles.tagDot, { backgroundColor: folderColor(folder) }]} />
              <Text style={styles.tagText} numberOfLines={1}>
                {folder.name}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `text` with every word of `query` highlighted. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const styles = useStyles();
  const words = query.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (!words.length) return <>{text}</>;
  // split() with a capture group puts the matches at the odd indexes.
  const parts = text.split(new RegExp(`(${words.join('|')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 ? (
          <Text key={i} style={styles.mark}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </>
  );
}

function SearchEmpty() {
  const styles = useStyles();
  const hasKey = useAiKey((s) => !!s.key);
  const on = useStore((s) => s.searchHandwriting);
  return (
    <View style={{ alignItems: 'center', marginTop: 60, gap: 8 }}>
      <Text style={[styles.empty, { marginTop: 0 }]}>No notes match.</Text>
      {!(hasKey && on) && (
        <Pressable onPress={() => router.push('/ai-key')}>
          <Text style={styles.emptyHint}>To search handwriting too, add your Claude key and turn on “Make handwriting searchable”.</Text>
        </Pressable>
      )}
    </View>
  );
}

type MenuRowProps = { icon: IconName; iconColor?: string; label: string; onPress: () => void; checked?: boolean; danger?: boolean };

function MenuRow({ icon, iconColor, label, onPress, checked, danger }: MenuRowProps) {
  const C = useTheme();
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: C.selected }]}>
      <MaterialCommunityIcons name={icon} size={18} color={danger ? C.danger : (iconColor ?? C.icon)} />
      <Text style={[styles.menuText, danger && { color: C.danger }]} numberOfLines={1}>
        {label}
      </Text>
      {checked && <MaterialCommunityIcons name="check" size={16} color={C.text} />}
    </Pressable>
  );
}

function SmallIcon({ icon, onPress, danger }: { icon: IconName; onPress: () => void; danger?: boolean }) {
  const C = useTheme();
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.smallIcon}>
      <MaterialCommunityIcons name={icon} size={16} color={danger ? C.danger : C.muted} />
    </Pressable>
  );
}

/** "Sort: Last edited" above the notes grid. */
function SortBar() {
  const C = useTheme();
  const styles = useStyles();
  const sort = usePrefs((p) => p.homeSort);
  const setSort = usePrefs((p) => p.setHomeSort);
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.sortBar}>
      <Pressable onPress={() => setOpen(!open)} style={({ pressed }) => [styles.sortBtn, (open || pressed) && { backgroundColor: C.selected }]}>
        <MaterialCommunityIcons name="sort" size={16} color={C.icon} />
        <Text style={styles.sortText}>{SORTS[sort].label}</Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
      </Pressable>
      {open && (
        <View style={[styles.sortMenu, C.shadow]}>
          {(Object.keys(SORTS) as HomeSort[]).map((k) => (
            <MenuRow key={k} icon="sort" label={SORTS[k].label} checked={k === sort} onPress={() => (setSort(k), setOpen(false))} />
          ))}
        </View>
      )}
    </View>
  );
}

/** The note title that follows your finger while dragging a card onto a folder. */
function DragGhost() {
  const C = useTheme();
  const styles = useStyles();
  const d = useNoteDrag();
  if (!d.pageId) return null;
  return (
    <View pointerEvents="none" style={[styles.ghost, C.shadow, { left: d.x + 12, top: d.y + 12 }]}>
      <MaterialCommunityIcons name={d.over !== undefined ? 'folder-arrow-right-outline' : 'note-outline'} size={16} color={C.primary} />
      <Text style={styles.ghostText} numberOfLines={1}>
        {d.title}
      </Text>
    </View>
  );
}

/** Home keyboard shortcuts (web and hardware keyboards): Ctrl/Cmd+K search, N new note, ? shortcut list. */
function useHomeShortcuts(searchRef: RefObject<ComponentRef<typeof TextInput> | null>, newNote: () => void) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(e.target.tagName));
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (!typing && !mod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        newNote();
      } else if (!typing && e.key === '?') {
        router.push('/shortcuts');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchRef, newNote]);
}

const useStyles = makeStyles((C) => ({
  root: { flex: 1, flexDirection: 'row', backgroundColor: C.bg },
  sidebar: { width: 248, backgroundColor: C.sidebar, borderRightWidth: StyleSheet.hairlineWidth, borderColor: C.border, paddingHorizontal: 12, paddingTop: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, marginBottom: 18 },
  brand: { fontFamily: F.serifSemi, fontSize: 22, color: C.text, letterSpacing: -0.3 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 38, paddingRight: 10, paddingVertical: 8 },
  swatch: { width: 20, height: 20, borderRadius: 10 },
  swatchOn: { borderWidth: 3, borderColor: C.surface, transform: [{ scale: 1.15 }] },
  sideLabel: { fontSize: 12, fontWeight: '500', color: C.muted, paddingHorizontal: 10, marginTop: 18, marginBottom: 4 },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, height: 38, borderRadius: R.sm },
  sideText: { flex: 1, fontSize: 14, color: C.text },
  renameInput: { paddingVertical: 4, borderBottomWidth: 1, borderColor: C.text },
  count: { fontSize: 12, color: C.muted, fontVariant: ['tabular-nums'] },
  smallIcon: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  account: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, marginVertical: 12, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },

  main: { flex: 1 },
  header: { paddingHorizontal: 40, paddingTop: 36, paddingBottom: 24 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, paddingHorizontal: 14, height: 38, borderRadius: R.sm + 2, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  newPrimary: { backgroundColor: C.primary, borderColor: C.primary },
  newText: { color: C.text, fontWeight: '600', fontSize: 14 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 80, fontSize: 15 },
  emptyHint: { color: C.icon, textAlign: 'center', fontSize: 13, textDecorationLine: 'underline', maxWidth: 420 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.sm + 2, paddingLeft: 10, paddingRight: 2, height: 38, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: C.text, paddingVertical: 6 },
  sideSep: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginVertical: 8, marginHorizontal: 10 },
  result: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: C.surface, borderRadius: R.md, padding: 10 },
  resultThumb: { width: 54, aspectRatio: 816 / 1056, borderRadius: 6, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  snippet: { fontSize: 13, lineHeight: 18, color: C.icon },
  mark: { backgroundColor: '#FFE58F', color: '#141413', fontWeight: '700' },

  card: { aspectRatio: 816 / 1056, backgroundColor: C.paper, borderRadius: R.md, overflow: 'hidden' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  title: { fontSize: 14, fontWeight: '600', color: C.text },
  meta: { fontSize: 12, color: C.muted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  badges: { position: 'absolute', top: 10, right: 8, flexDirection: 'row', gap: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.surface, borderRadius: R.pill, paddingHorizontal: 7, height: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  badgeText: { fontSize: 11, fontWeight: '700', color: C.primary },
  dropOver: { backgroundColor: 'rgba(217,119,87,0.18)', borderWidth: 1, borderColor: C.primary },
  sortBar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: -8, zIndex: 20 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 32, borderRadius: R.sm },
  sortText: { fontSize: 13, color: C.icon },
  sortMenu: { position: 'absolute', top: 36, right: 0, width: 200, backgroundColor: C.surface, borderRadius: R.md, padding: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  ghost: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 240, backgroundColor: C.surface, paddingHorizontal: 12, height: 34, borderRadius: R.sm, borderWidth: 1, borderColor: C.primary },
  ghostText: { fontSize: 13, fontWeight: '600', color: C.text, flexShrink: 1 },
  stripe: { position: 'absolute', left: 0, right: 0, top: 0, height: 5 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, height: 20, borderRadius: R.pill, flexShrink: 1 },
  tagDot: { width: 7, height: 7, borderRadius: 4 },
  tagText: { fontSize: 11, fontWeight: '600', color: C.icon, flexShrink: 1 },
  cardMenu: { position: 'absolute', top: 40, right: 0, left: 0, backgroundColor: C.surface, borderRadius: R.md, padding: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  menuLabel: { fontSize: 11, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 8, paddingVertical: 6 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, height: 36, borderRadius: R.sm },
  menuText: { flex: 1, fontSize: 14, color: C.text },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginVertical: 4 },
}));

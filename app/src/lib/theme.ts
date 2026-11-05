import * as SecureStore from 'expo-secure-store';
import { Appearance, Platform, StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { create } from 'zustand';

/** Claude's palette (Anthropic brand colors): ivory and warm grays, with Claude orange for the one strong element. */
const LIGHT = {
  bg: '#FAF9F5', // main area (claude.ai's page color)
  sidebar: '#F5F4ED', // sidebar and side panels
  paper: '#FFFFFF',
  surface: '#FFFFFF',
  /** User message boxes and quiet fills. */
  well: '#F0EEE6',
  border: 'rgba(20,20,19,0.10)',
  text: '#141413',
  icon: '#3D3D3A',
  muted: '#87867F',
  faint: '#B0AEA5',
  selected: 'rgba(20,20,19,0.06)',
  primary: '#C96442', // Claude orange, a shade darker so white text stays readable (Ask Claude, send, build)
  onPrimary: '#FFFFFF',
  focus: '#6A9BCC', // selection outline (Anthropic blue)
  danger: '#E5484D',
  /** Around the note's pages. */
  desk: '#EEECE3',
  backdrop: 'rgba(20,20,19,0.45)',
};

/** Claude's dark palette: warm charcoal surfaces (like claude.ai in dark mode), the same orange. */
const DARK: typeof LIGHT = {
  bg: '#262624',
  sidebar: '#1F1E1D',
  paper: '#FFFFFF',
  surface: '#30302E',
  well: '#3A3936',
  border: 'rgba(250,249,245,0.10)',
  text: '#FAF9F5',
  icon: '#C2C0B6',
  muted: '#9C9A92',
  faint: '#5E5D59',
  selected: 'rgba(250,249,245,0.07)',
  primary: '#C96442',
  onPrimary: '#FFFFFF',
  focus: '#6A9BCC',
  danger: '#F06A6E',
  desk: '#1A1A19',
  backdrop: 'rgba(0,0,0,0.6)',
};

export type ThemeMode = 'system' | 'light' | 'dark';
const THEME_KEY = 'kober-theme';

/** A palette plus what depends on it. */
export type Palette = typeof LIGHT & { dark: boolean; shadow: ViewStyle };

const shadowFor = (dark: boolean): ViewStyle =>
  Platform.select({
    web: { boxShadow: dark ? '0 1px 2px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)' } as ViewStyle,
    default: { shadowColor: '#000', shadowOpacity: dark ? 0.3 : 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  })!;
const PALETTES = {
  light: { ...LIGHT, dark: false, shadow: shadowFor(false) } as Palette,
  dark: { ...DARK, dark: true, shadow: shadowFor(true) } as Palette,
};

/** The saved choice, read synchronously so the first frame already has the right colors. */
function readMode(): ThemeMode {
  try {
    const v = Platform.OS === 'web' ? globalThis.localStorage?.getItem(THEME_KEY) : SecureStore.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}
const resolve = (mode: ThemeMode) => PALETTES[mode === 'system' ? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light') : mode];

const useThemeStore = create<{ mode: ThemeMode; palette: Palette }>(() => {
  const mode = readMode();
  return { mode, palette: resolve(mode) };
});

// "System" follows the device as it changes.
Appearance.addChangeListener(() => {
  const { mode } = useThemeStore.getState();
  if (mode === 'system') useThemeStore.setState({ palette: resolve('system') });
});

/** The current palette. Components re-render when the theme changes. */
export const useTheme = () => useThemeStore((t) => t.palette);
export const useThemeMode = () => useThemeStore((t) => t.mode);
/** The current palette outside React (event handlers, canvas drawing). */
export const getTheme = () => useThemeStore.getState().palette;

/** Switch themes instantly and remember the choice. */
export function setThemeMode(mode: ThemeMode) {
  try {
    if (Platform.OS === 'web') localStorage.setItem(THEME_KEY, mode);
    else SecureStore.setItem(THEME_KEY, mode);
  } catch {}
  useThemeStore.setState({ mode, palette: resolve(mode) });
}

/**
 * Styles that follow the theme: `const useStyles = makeStyles((C) => ({ ... }))`, then `const styles = useStyles()`
 * in the component. Each theme's styles are built once and cached.
 */
export function makeStyles<T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(build: (C: Palette) => T): () => T {
  const cache = new Map<Palette, T>();
  return function useStyles() {
    const C = useTheme();
    let styles = cache.get(C);
    if (!styles) {
      styles = StyleSheet.create(build(C) as never) as T;
      cache.set(C, styles);
    }
    return styles;
  };
}

export const R = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

/** Serif for headings and Claude's replies, like claude.ai (Source Serif 4, loaded in app/_layout.tsx). */
export const F = {
  serif: 'SourceSerif4_400Regular',
  serifMedium: 'SourceSerif4_500Medium',
  serifSemi: 'SourceSerif4_600SemiBold',
};

/** Folder color tags (sidebar icons, card stripes, banner tint). */
export const FOLDER_COLORS = ['#D97757', '#6A9BCC', '#788C5D', '#D4A27F', '#BF4D43', '#A67CB5', '#E5B94E', '#87867F'];

/** A folder's color; older folders without one get a stable color from their id. */
export function folderColor(f: { id: string; color?: string } | undefined | null) {
  if (!f) return getTheme().muted;
  if (f.color) return f.color;
  let h = 0;
  for (const ch of f.id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return FOLDER_COLORS[Math.abs(h) % FOLDER_COLORS.length];
}

/** Mix a hex color toward white (t=0 → color, t=1 → white). */
export function tint(hex: string, t: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0');
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

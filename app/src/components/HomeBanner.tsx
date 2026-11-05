import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Logo } from '@/components/Logo';
import { FACTS, Ticker } from '@/components/Ticker';
import { API_URL } from '@/lib/api';
import { F, makeStyles, useTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type Weather = { available: true; city: string | null; tempF: number; code: number; isDay: boolean } | { available: false };

/** Greeting by time of day. */
function greetingFor(hour: number) {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 22) return 'Good evening';
  return 'Up late?';
}

/** WMO weather code → icon + short label (https://open-meteo.com/en/docs). */
function describe(code: number, isDay: boolean): { icon: IconName; label: string } {
  if (code === 0) return isDay ? { icon: 'weather-sunny', label: 'Clear' } : { icon: 'weather-night', label: 'Clear' };
  if (code <= 2) return isDay ? { icon: 'weather-partly-cloudy', label: 'Partly cloudy' } : { icon: 'weather-night-partly-cloudy', label: 'Partly cloudy' };
  if (code === 3) return { icon: 'weather-cloudy', label: 'Cloudy' };
  if (code <= 48) return { icon: 'weather-fog', label: 'Foggy' };
  if (code <= 57) return { icon: 'weather-rainy', label: 'Drizzle' };
  if (code <= 67) return { icon: 'weather-pouring', label: 'Rain' };
  if (code <= 77) return { icon: 'weather-snowy', label: 'Snow' };
  if (code <= 82) return { icon: 'weather-pouring', label: 'Showers' };
  if (code <= 86) return { icon: 'weather-snowy-heavy', label: 'Snow showers' };
  return { icon: 'weather-lightning-rainy', label: 'Storms' };
}

let cachedWeather: { at: number; data: Weather } | null = null;

function useWeather() {
  const [weather, setWeather] = useState<Weather | null>(cachedWeather?.data ?? null);
  useEffect(() => {
    if (cachedWeather && Date.now() - cachedWeather.at < 10 * 60_000) return;
    let alive = true;
    fetch(`${API_URL}/weather`)
      .then((r) => r.json() as Promise<Weather>)
      .then((data) => {
        cachedWeather = { at: Date.now(), data };
        if (alive) setWeather(data);
      })
      .catch(() => {}); // the banner just skips weather when offline
    return () => {
      alive = false;
    };
  }, []);
  return weather;
}

type Props = {
  /** Folder color; omit for the "All notes" sky banner. */
  color?: string;
  title: string;
  subtitle: string;
  /** Rendered on the right (e.g. the New note button). */
  action?: ReactNode;
  /** Given for folders: tapping the title renames the folder. */
  onRename?: (name: string) => void;
};

/** The header on the notes home, styled after claude.ai's greeting: the mark, a serif title, date and weather. */
export function HomeBanner({ color, title, subtitle, action, onRename }: Props) {
  const C = useTheme();
  const styles = useStyles();
  const [now] = useState(() => new Date());
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(title);
  const finish = () => {
    onRename?.(name);
    setEditing(false);
  };
  const weather = useWeather();
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const w = weather?.available ? { ...weather, ...describe(weather.code, weather.isDay) } : null;

  return (
    <View style={styles.banner}>
      <View style={styles.left}>
        <View style={styles.titleRow}>
          {color ? <View style={[styles.folderDot, { backgroundColor: color }]} /> : <Logo size={40} />}
          {editing ? (
            <TextInput value={name} onChangeText={setName} autoFocus selectTextOnFocus onSubmitEditing={finish} onBlur={finish} style={[styles.title, styles.titleInput]} />
          ) : (
            <Pressable disabled={!onRename} onPress={() => (setName(title), setEditing(true))} style={{ flexShrink: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {color ? title : title === 'All notes' ? greetingFor(now.getHours()) : title}
              </Text>
            </Pressable>
          )}
        </View>
        <View style={styles.row}>
          <Text style={styles.sub}>
            {date} · {subtitle}
          </Text>
          {w && (
            <View style={styles.weather}>
              <MaterialCommunityIcons name={w.icon} size={15} color={C.muted} />
              <Text style={styles.sub}>
                {w.tempF}° {w.label}
                {w.city ? ` · ${w.city}` : ''}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.fact}>
          <Ticker items={FACTS} icon="lightbulb-on-outline" />
        </View>
      </View>
      <View style={styles.right}>{action}</View>
    </View>
  );
}

const useStyles = makeStyles((C) => ({
  banner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 16 },
  left: { flex: 1, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  folderDot: { width: 18, height: 18, borderRadius: 9, marginHorizontal: 11 },
  title: { fontFamily: F.serif, fontSize: 38, color: C.text, letterSpacing: -0.5, flexShrink: 1 },
  titleInput: { flex: 1, minWidth: 200, paddingVertical: 0, borderBottomWidth: 1, borderColor: C.primary },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingLeft: 52 },
  sub: { fontSize: 14, color: C.muted },
  fact: { paddingLeft: 52, minHeight: 20 },
  weather: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
}));

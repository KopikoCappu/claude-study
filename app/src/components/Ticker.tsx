import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';

const nativeDriver = Platform.OS !== 'web';

/** Short facts for the home header. Mostly about learning, plus a few for fun. */
export const FACTS = [
  'Testing yourself beats rereading. Recalling something makes it stick (the "testing effect").',
  'Spreading study over several days beats one long cram session (the "spacing effect").',
  "Hermann Ebbinghaus mapped how fast we forget in 1885. Most of it goes within a day unless you review.",
  'Explaining an idea to someone else is one of the fastest ways to find the gaps in it.',
  'Mixing problem types in one session (interleaving) feels harder but helps you learn more.',
  'Sleep helps lock in what you learned that day.',
  'Linear B, a script on 3,400-year-old clay tablets, was finally deciphered in 1952.',
  'A day on Venus is longer than its year.',
  'Octopuses have three hearts.',
  'Bananas are berries. Strawberries are not.',
  'Sharks are older than trees.',
  'Oxford University is older than the Aztec Empire.',
  'Wombat poop is cube-shaped.',
  'There are more possible chess games than atoms in the observable universe.',
  'Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.',
  'The word "nerd" first appeared in a Dr. Seuss book in 1950.',
  'A group of flamingos is called a flamboyance.',
  'Pi has been calculated to more than 100 trillion digits.',
  'The Eiffel Tower grows a few centimeters taller in summer heat.',
];

/** Status words while Claude works, like Claude Code's spinner. */
export const VERBS = [
  'Pondering',
  'Sharpening pencils',
  'Flipping through your notes',
  'Doodling in the margins',
  'Connecting the dots',
  'Cross-referencing',
  'Highlighting',
  'Mulling it over',
  'Double-checking',
  'Erasing smudges',
  'Cramming',
  'Annotating',
  'Puzzling it out',
  'Consulting the textbook',
];

function shuffled<T>(items: T[]) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Cycles through items in random order with a quick fade. Tap to skip ahead. */
export function Ticker({ items, every = 8000, icon, suffix = '', size = 14 }: { items: string[]; every?: number; icon?: 'lightbulb-on-outline' | 'creation'; suffix?: string; size?: number }) {
  const C = useTheme();
  const [order] = useState(() => shuffled(items));
  const [i, setI] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  const next = () =>
    Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: nativeDriver }).start(() => {
      setI((n) => (n + 1) % order.length);
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: nativeDriver }).start();
    });

  useEffect(() => {
    const t = setInterval(next, every);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [every]);

  return (
    <Pressable onPress={next} style={styles.row} hitSlop={4}>
      {icon && <MaterialCommunityIcons name={icon} size={size + 1} color={C.primary} />}
      <Animated.View style={{ opacity: fade, flexShrink: 1 }}>
        <Text style={{ fontSize: size, color: C.muted }} numberOfLines={2}>
          {order[i]}
          {suffix}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** A spinner with cycling status words, for while Claude is working. */
export function Working() {
  const C = useTheme();
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name="creation" size={15} color={C.primary} />
      <Ticker items={VERBS} every={2500} suffix="…" size={13} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
});

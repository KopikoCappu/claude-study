import { Caveat_600SemiBold, useFonts } from '@expo-google-fonts/caveat';
import { SourceSerif4_400Regular, SourceSerif4_500Medium, SourceSerif4_600SemiBold } from '@expo-google-fonts/source-serif-4';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PdfRenderHost } from '@/components/PdfRenderHost';
import { RecorderHost } from '@/components/Recorder';
import { indexHandwriting } from '@/lib/inkIndex';
import { useStore } from '@/lib/store';
import { startSync } from '@/lib/sync';

SplashScreen.preventAutoHideAsync();
// Accounts + cloud sync (no-op when the build has no Supabase config).
startSync();
// Handwriting search: read any notes changed since last time (notes and the AI key load from storage first).
const indexSoon = () => setTimeout(() => void indexHandwriting(), 8000);
if (useStore.persist.hasHydrated()) indexSoon();
else useStore.persist.onFinishHydration(indexSoon);

export default function RootLayout() {
  const [loaded, fontError] = useFonts({ Caveat_600SemiBold, SourceSerif4_400Regular, SourceSerif4_500Medium, SourceSerif4_600SemiBold });
  // A font that fails to load must never block the app — fall back to the system font instead.
  const ready = loaded || !!fontError;
  useEffect(() => {
    if (fontError) console.warn('[fonts] falling back to system font:', fontError.message);
    if (ready) SplashScreen.hideAsync();
  }, [ready, fontError]);
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        {/* Settings opens as a window over the current screen, like claude.ai's. */}
        <Stack.Screen name="settings" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
        <Stack.Screen name="shortcuts" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
      </Stack>
      <PdfRenderHost />
      <RecorderHost />
    </GestureHandlerRootView>
  );
}

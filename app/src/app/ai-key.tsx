import { Redirect } from 'expo-router';

/** Old address for the key screen: it now lives in Settings → Claude. */
export default function AiKeyScreen() {
  return <Redirect href="/settings?section=claude" />;
}

import { Linking } from 'react-native';

/** Public contact address (Play listing, privacy policy, deletion requests, AI-content reports). */
export const SUPPORT_EMAIL = 'podplananything@gmail.com';

/** Public website (site/). Its legal pages are generated from server/src/legal.ts. */
export const SITE_URL = 'https://kober-site.vercel.app';
export const PRIVACY_URL = `${SITE_URL}/privacy`;
export const DELETE_ACCOUNT_URL = `${SITE_URL}/delete-account`;

/** Open the user's email app with a report about an AI answer (required for apps with AI-generated content). */
export function reportAiAnswer(answer: string) {
  const excerpt = answer.length > 1200 ? `${answer.slice(0, 1200)}…` : answer;
  const subject = 'Claude Study: report an AI answer';
  const body = `What's wrong with this answer? (offensive, harmful, wrong, other)\n\n\n--- AI answer ---\n${excerpt}`;
  return Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
}

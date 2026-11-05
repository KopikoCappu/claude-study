// Public pages linked from the app and the Google Play listing.
// Keep these in sync with what the app actually does (and with the Play Console "Data safety" form).

export const SUPPORT_EMAIL = 'podplananything@gmail.com';
const UPDATED = 'October 23, 2026';

const page = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Claude Study</title>
<style>
  body { font: 16px/1.6 -apple-system, Roboto, 'Segoe UI', sans-serif; color: #1d1b26; background: #fff; margin: 0; padding: 32px 16px; }
  main { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 28px; margin: 0 0 4px; } h2 { font-size: 19px; margin-top: 28px; }
  .muted { color: #6b6880; } a { color: #5B3FE6; }
  @media (prefers-color-scheme: dark) { body { background: #15131c; color: #ece9f5; } .muted { color: #a9a5bb; } a { color: #a996ff; } }
</style></head><body><main>${body}</main></body></html>`;

export const PRIVACY_HTML = page(
  'Privacy policy',
  `<h1>Claude Study privacy policy</h1>
<p class="muted">Last updated ${UPDATED}</p>

<p>Claude Study is a handwritten-notes app with an AI study assistant. This policy explains what data the app handles, why, and the choices you have. Questions: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>

<h2>Your notes</h2>
<p>Your notes (pen strokes, typed text, photos and files you add, and your chats with the assistant) are saved on your device. If you create an account, they are also stored in our database (hosted by Supabase) so they sync between your devices. Each account can only read its own notes. We don't read your notes, sell them, or use them for advertising.</p>

<h2>Your account</h2>
<p>An account is optional. If you create one, we store your email address and a securely hashed password, used only to sign you in and sync your notes. We don't send marketing email.</p>

<h2>The AI assistant and your AI key</h2>
<p>The assistant runs on your own Claude API key from Anthropic. The key is stored only on your device (encrypted on Android) and is never uploaded with your notes.</p>
<p>When you ask the assistant something, the app sends what you selected, a picture of what's on your screen, and the conversation so far to our server, which forwards it to Anthropic's Claude API, using your key. Our server does not store your key or the content of your requests. Anthropic's handling of that data is governed by your agreement with them: <a href="https://www.anthropic.com/legal/privacy">Anthropic privacy policy</a>.</p>

<p>If <b>Make handwriting searchable</b> is on (Settings → AI key), then when you leave a note the app sends an image of the handwriting on each page you changed to the same AI provider, with your key, so the text can be searched. The text that comes back is saved in the note. You can turn this off at any time.</p>

<h2>Weather on the home screen</h2>
<p>To show the local weather, our server uses the approximate city-level location that our host (Vercel) derives from your IP address, and asks Open-Meteo for the forecast. The app never asks for your device location, and we don't store it.</p>

<h2>Camera and photos</h2>
<p>The camera and photo library are used only when you choose to add a picture to a note. The picture is saved in that note.</p>

<h2>Microphone and recordings</h2>
<p>The microphone is used only while you are recording, after you tap <b>Record</b> in a note. Recordings are saved only on the device that made them. They are not uploaded to our servers, not synced, and not sent to any AI provider. Deleting a recording, or deleting its note for good, removes it from the device.</p>

<h2>Technical logs</h2>
<p>Our hosting providers keep short-lived technical logs (such as IP address, time, and which feature was used) to run and protect the service. They don't include your notes or your AI key.</p>

<h2>What we don't do</h2>
<p>No ads, no analytics or tracking SDKs, and we never sell or share your personal data with third parties for their own use.</p>

<h2>Security</h2>
<p>All data is sent over encrypted connections (HTTPS). Account data is protected by access rules that limit each user to their own data.</p>

<h2>Deleting your data</h2>
<p>You can delete your account and every note stored in it at any time: in the app, tap your email address at the bottom of the sidebar, then <b>Delete account</b>. You can also <a href="/delete-account">request deletion by email</a>. Notes saved only on your device are removed when you uninstall the app. Notes you delete go to <b>Recently deleted</b> first, where you can restore them for 30 days; after that, or when you empty it, they are deleted for good.</p>

<h2>Age</h2>
<p>Claude Study is intended for people 18 and older, which matches the age requirement of the AI providers it uses. It is not directed at children.</p>

<h2>Changes</h2>
<p>If this policy changes, we'll update this page and the date above.</p>`,
);

export const DELETE_ACCOUNT_HTML = page(
  'Delete your account',
  `<h1>Delete your Claude Study account</h1>
<p class="muted">Claude Study · com.kopikocappu.kober</p>

<h2>In the app (fastest)</h2>
<ol><li>Open Claude Study and tap your email address at the bottom of the home-screen sidebar.</li>
<li>Tap <b>Delete account</b>, then <b>Delete forever</b>.</li></ol>

<h2>By email</h2>
<p>Send an email from your account's email address to <a href="mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20Claude%20Study%20account">${SUPPORT_EMAIL}</a> with the subject "Delete my Claude Study account". We'll delete it within 30 days and reply to confirm.</p>

<h2>What gets deleted</h2>
<p>Your account (email address and password) and every note, folder, photo and chat stored in it are permanently deleted. Nothing is kept, apart from short-lived hosting logs, which expire on their own within 30 days.</p>
<p>Your AI key is never stored by us. It stays on your device until you remove it under <b>AI key</b> in the sidebar or uninstall the app.</p>`,
);

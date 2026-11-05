// Writes the privacy policy and account-deletion pages into ../site so the landing page serves the same
// text as the API (server/src/legal.ts is the one source). Run: cd server && npm run build:site
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DELETE_ACCOUNT_HTML, PRIVACY_HTML } from '../src/legal.js';

const site = fileURLToPath(new URL('../../site/', import.meta.url));
const withHomeLink = (html: string) => html.replace('<main>', '<main><p><a href="/">← Claude Study</a></p>');

for (const [dir, html] of [['privacy', PRIVACY_HTML], ['delete-account', DELETE_ACCOUNT_HTML]] as const) {
  mkdirSync(`${site}${dir}`, { recursive: true });
  writeFileSync(`${site}${dir}/index.html`, withHomeLink(html));
  console.log(`site/${dir}/index.html`);
}

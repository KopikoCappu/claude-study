// Draws the app icon, Android adaptive icon layers, favicon, splash and SVG logos from src/lib/logo.ts.
// Run from app/: node scripts/icons.mjs   (needs Chrome; set CHROME=/path/to/chrome if it isn't in the usual place)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { logoSvg, CLAY, CREAM, INK } = await import(pathToFileURL(resolve('src/lib/logo.ts')).href);

const chrome =
  process.env.CHROME ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(existsSync);
if (!chrome) throw new Error('Chrome not found: set CHROME to its path.');

const tmp = mkdtempSync(join(tmpdir(), 'kober-icons-'));

/** Screenshot an SVG at `size`×`size` (transparent where the SVG has no background). */
function png(svg, size, out, round = 0) {
  const html = join(tmp, 'icon.html');
  const sized = svg.replace('width="100" height="100"', `width="${size}" height="${size}"`);
  const clip = round ? `border-radius:${round}px;overflow:hidden;` : '';
  writeFileSync(html, `<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;${clip}">${sized}</div></body></html>`);
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000', `--window-size=${size},${size}`, `--screenshot=${resolve(out)}`, pathToFileURL(html).href], { stdio: 'ignore' });
  console.log(out);
}

png(logoSvg({ background: CLAY, color: CREAM, scale: 0.7 }), 1024, 'assets/images/icon.png');
png(logoSvg({ background: CLAY, color: CLAY }), 1024, 'assets/images/android-icon-background.png');
// Android crops adaptive icons to the middle ~66%, so the foreground tablet is drawn small.
png(logoSvg({ color: CREAM, scale: 0.56 }), 1024, 'assets/images/android-icon-foreground.png');
png(logoSvg({ color: '#FFFFFF', scale: 0.56 }), 1024, 'assets/images/android-icon-monochrome.png');
png(logoSvg({ background: CLAY, color: CREAM, scale: 0.8 }), 96, 'assets/images/favicon.png', 20);
png(logoSvg({ color: CLAY }), 512, 'assets/images/splash-icon.png');

const svgs = { 'assets/logo-ink.svg': INK, 'assets/logo-white.svg': '#FFFFFF', 'assets/logo-icon.svg': CLAY };
for (const [out, color] of Object.entries(svgs)) {
  writeFileSync(out, logoSvg({ color }).replace('width="100" height="100"', 'width="1024" height="1024"'));
  console.log(out);
}

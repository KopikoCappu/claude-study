import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import path from 'path';
const root = process.cwd();
const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts') });
const composition = await selectComposition({ serveUrl, id: process.env.COMP || 'InkBuddyDemo' });
const secs = process.argv.slice(2).map(Number);
for (const s of secs) {
  await renderStill({ serveUrl, composition, frame: Math.round(s * 60), output: path.join(root, `out/s${s}.png`), scale: 0.5 });
  console.log('ok', s);
}

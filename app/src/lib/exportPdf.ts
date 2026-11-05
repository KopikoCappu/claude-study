import { ImageFormat, PaintStyle, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia';
import { isDark } from '@/components/PaperBackground';
import { annotationPath } from './annotations';
import { LINE_SPACING, strokeBounds, strokePath, TEXT_SIZE, textLineHeight } from './ink';
import { renderMath } from './katexRender';
import { PAGE_GAP, PAGE_H, PAGE_W, RULE_TOP, pageCountFor, pageTop } from './pages';
import { skImageFor } from './snapshot';
import type { Page, Rect } from './types';

/**
 * Export a note as a PDF (web). Each page is printed exactly as it looks in the app:
 *  - ink, photos, paper lines and AI marks are drawn into one sharp image per page (Skia, 2×)
 *  - typed text, equations (KaTeX) and AI notes are laid on top as real text, so they stay crisp and selectable
 * The browser's print dialog then saves it ("Save as PDF" on a laptop; Share → Save to Files on iPad).
 */

const RENDER_SCALE = 2; // 2× page resolution: crisp ink when printed or zoomed
const RULE_BOTTOM = 48; // matches PaperBackground
const NOTE_SIZE = 26; // matches InkCanvas AiNote
const NOTE_MAX_WIDTH = 280;
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Background, paper, photos, ink and AI marks of page `i`, as a PNG data URL. */
function renderPageLayer(page: Page, i: number): string | null {
  const top = pageTop(i);
  const area: Rect = { x: 0, y: top, w: PAGE_W, h: PAGE_H };
  const width = PAGE_W * RENDER_SCALE;
  const height = PAGE_H * RENDER_SCALE;
  const surface = Skia.Surface.Make(width, height) ?? Skia.Surface.MakeOffscreen(width, height);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const bg = page.bg ?? '#FFFFFF';
  canvas.drawColor(Skia.Color(bg));
  canvas.scale(RENDER_SCALE, RENDER_SCALE);
  canvas.translate(0, -top);

  // Paper pattern
  const paper = page.paper ?? 'blank';
  if (paper !== 'blank') {
    const dark = isDark(bg);
    const lines = Skia.Paint();
    lines.setAntiAlias(true);
    lines.setColor(Skia.Color(dark ? 'rgba(255,255,255,0.10)' : paper === 'dots' ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.08)'));
    const b = Skia.PathBuilder.Make();
    const step = LINE_SPACING;
    if (paper === 'lined') {
      for (let y = top + RULE_TOP; y <= top + PAGE_H - RULE_BOTTOM; y += step) {
        b.moveTo(0, y);
        b.lineTo(PAGE_W, y);
      }
    } else if (paper === 'grid') {
      for (let y = top + step; y < top + PAGE_H; y += step) {
        b.moveTo(0, y);
        b.lineTo(PAGE_W, y);
      }
      for (let x = step; x < PAGE_W; x += step) {
        b.moveTo(x, top);
        b.lineTo(x, top + PAGE_H);
      }
    } else if (paper === 'dots') {
      for (let y = top + step; y < top + PAGE_H; y += step) for (let x = step; x < PAGE_W; x += step) b.addCircle(x, y, 1.3);
    }
    if (paper !== 'dots') {
      lines.setStyle(PaintStyle.Stroke);
      lines.setStrokeWidth(1);
    }
    canvas.drawPath(b.detach(), lines);
  }

  const imgPaint = Skia.Paint();
  for (const im of page.images) {
    if (!overlaps(im, area)) continue;
    const sk = skImageFor(im);
    if (sk) canvas.drawImageRect(sk, Skia.XYWHRect(0, 0, sk.width(), sk.height()), Skia.XYWHRect(im.x, im.y, im.w, im.h), imgPaint);
  }

  for (const s of page.strokes) {
    if (!overlaps(strokeBounds(s), area)) continue;
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color(s.color));
    if (s.tool !== 'pen') {
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(s.size);
      paint.setStrokeCap(StrokeCap.Round);
      paint.setStrokeJoin(StrokeJoin.Round);
      if (s.tool === 'highlighter') paint.setAlphaf(0.35);
    }
    canvas.drawPath(strokePath(s), paint);
  }

  // AI marks (circles, checks, highlights…). AI notes are text, added in the HTML layer.
  for (const a of page.annotations) {
    if (a.kind === 'note' || !overlaps(a.rect, { ...area, y: area.y - 40, h: area.h + 80 })) continue;
    const path = annotationPath(a);
    if (!path) continue;
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color(a.color));
    if (a.kind === 'highlight') paint.setAlphaf(0.28);
    else {
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(3.5 * (a.scale ?? 1));
      paint.setStrokeCap(StrokeCap.Round);
      paint.setStrokeJoin(StrokeJoin.Round);
    }
    canvas.drawPath(path, paint);
  }

  surface.flush();
  return `data:image/png;base64,${surface.makeImageSnapshot().encodeToBase64(ImageFormat.PNG, 100)}`;
}

/** Typed text, equations and AI notes that start on page `i`, positioned relative to the page. */
function textLayer(page: Page, i: number): string {
  const top = pageTop(i);
  const onPage = (y: number) => y >= top - PAGE_GAP / 2 && y < top + PAGE_H + PAGE_GAP / 2;
  const textColor = isDark(page.bg ?? '#FFFFFF') ? '#F2F2F2' : '#1C1C1E';
  const out: string[] = [];
  for (const t of page.texts) {
    if (!t.text.trim() || !onPage(t.y)) continue;
    const size = t.size ?? TEXT_SIZE;
    out.push(
      `<div class="text" style="left:${t.x}px;top:${t.y - top}px;width:${t.width}px;font-size:${size}px;line-height:${textLineHeight(t)}px;color:${esc(t.color ?? textColor)}">${esc(t.text)}</div>`,
    );
  }
  for (const m of page.maths ?? []) {
    if (!onPage(m.y)) continue;
    out.push(`<div class="math" style="left:${m.x}px;top:${m.y - top}px;font-size:${m.size ?? 24}px;color:${esc(m.color ?? textColor)}">${renderMath(m.latex, true)}</div>`);
  }
  for (const a of page.annotations) {
    if (a.kind !== 'note' || !a.text || !onPage(a.rect.y)) continue;
    const k = a.scale ?? 1;
    out.push(
      `<div class="note" style="left:${a.rect.x}px;top:${a.rect.y - top}px;max-width:${NOTE_MAX_WIDTH * k}px;font-size:${NOTE_SIZE * k}px;line-height:${(NOTE_SIZE + 2) * k}px;color:${esc(a.color)}">${esc(a.text)}</div>`,
    );
  }
  return out.join('');
}

function buildHtml(page: Page): string {
  const count = pageCountFor(page);
  const pages: string[] = [];
  for (let i = 0; i < count; i++) {
    const layer = renderPageLayer(page, i);
    pages.push(`<section class="page">${layer ? `<img class="layer" src="${layer}" alt="">` : ''}${textLayer(page, i)}</section>`);
  }
  // Reuse the app's stylesheets: KaTeX styles and the handwriting font used by AI notes.
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><base href="${esc(location.origin)}/"><title>${esc(page.title || 'Note')}</title>
${styles}
<style>
  @page { size: 8.5in 11in; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { position: relative; width: ${PAGE_W}px; height: ${PAGE_H}px; overflow: hidden; break-after: page; page-break-after: always; }
  .page:last-child { break-after: auto; page-break-after: auto; }
  .layer { position: absolute; left: 0; top: 0; width: ${PAGE_W}px; height: ${PAGE_H}px; }
  .text { position: absolute; padding: 0 4px; font-family: ${FONT}; white-space: pre-wrap; overflow-wrap: break-word; }
  .math { position: absolute; padding: 0 4px; white-space: nowrap; line-height: 1.2; }
  .note { position: absolute; font-family: 'Caveat_600SemiBold', cursive; white-space: pre-wrap; }
</style></head><body>${pages.join('')}</body></html>`;
}

/** Render the note and open the print dialog, where it can be saved as a PDF. */
export async function exportNoteAsPdf(page: Page): Promise<void> {
  const html = buildHtml(page);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();

  // Wait for page images and fonts, or the PDF could come out with blank pages or fallback fonts.
  await Promise.all(Array.from(doc.images).map((img) => img.decode().catch(() => undefined)));
  await doc.fonts?.ready;

  // Chrome names the PDF after the page title.
  const prevTitle = document.title;
  document.title = page.title || 'Note';
  const win = iframe.contentWindow!;
  const cleanup = () => {
    document.title = prevTitle;
    iframe.remove();
  };
  win.addEventListener('afterprint', () => setTimeout(cleanup, 100), { once: true });
  setTimeout(() => iframe.isConnected && cleanup(), 10 * 60_000); // in case afterprint never fires
  win.focus();
  win.print();
}

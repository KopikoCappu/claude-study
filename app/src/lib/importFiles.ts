import { LINE_SPACING, uid } from './ink';
import { decodeImage, readText, renderPdf } from './importSource';
import { PAGE_H, PAGE_W, RULE_TOP, pageTop, snapToRule } from './pages';
import type { PageImage, TextBlock } from './types';

/**
 * Bringing outside files into notes: PDFs, images and text files, on web and on the app.
 * Picking and decoding files is platform-specific (importSource.ts / importSource.web.ts); laying the
 * content out on note pages is shared here.
 */

export { fromFile, imagesIn, IMPORT_ACCEPT, loadImage, pickSources as pickFiles } from './importSource';

export type LoadedImage = { base64: string; width: number; height: number; mime: string };

/** A picked file: a browser File on web, a local file URI on the app. */
export type ImportSource = { name: string; type: string; file?: File; uri?: string };

/** Rendered PDF pages (up to the limit) plus the document's real page count. */
export type PdfPages = { pages: LoadedImage[]; total: number };

/** What a file turns into: content laid out on pages starting at `startPage`. */
export type ImportedContent = { images: PageImage[]; texts: TextBlock[]; pages: number };

const MAX_PDF_PAGES = 100;

const isPdf = (f: ImportSource) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isText = (f: ImportSource) => f.type.startsWith('text/') || /\.(txt|md|markdown)$/i.test(f.name);
export const isImage = (f: { type: string; name?: string }) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|heic|heif|bmp)$/i.test(f.name ?? '');

/** Note title from a file name: "Week 3 worksheet.pdf" → "Week 3 worksheet". */
export const titleFrom = (f: { name: string }) => f.name.replace(/\.[^.]+$/, '').trim() || 'Imported';

/** Fit an image onto page `i` as a locked background (so you can write on top of it). */
function backgroundOnPage(img: LoadedImage, i: number): PageImage {
  const aspect = img.height / img.width;
  let w = PAGE_W;
  let h = PAGE_W * aspect;
  if (h > PAGE_H) {
    h = PAGE_H;
    w = PAGE_H / aspect;
  }
  return { id: uid(), x: (PAGE_W - w) / 2, y: pageTop(i) + (PAGE_H - h) / 2, w, h, base64: img.base64, mime: img.mime, locked: true };
}

/** Each PDF page becomes a background image on its own note page. */
async function importPdf(src: ImportSource, startPage: number, onProgress?: (msg: string) => void): Promise<ImportedContent> {
  // 1.5× the on-screen page width: sharp when zoomed in, without huge files.
  const { pages, total } = await renderPdf(src, MAX_PDF_PAGES, Math.round(PAGE_W * 1.5), onProgress);
  if (!pages.length) throw new Error(`"${src.name}" has no pages.`);
  if (total > MAX_PDF_PAGES) onProgress?.(`Only the first ${MAX_PDF_PAGES} pages were imported.`);
  return { images: pages.map((p, n) => backgroundOnPage(p, startPage + n)), texts: [], pages: pages.length };
}

// ---------------------------------------------------------------- text files

const WRAP_AT = 72; // characters per line at the default text size across the page
const LEFT = 72;
const LINES_PER_PAGE = Math.floor((PAGE_H - RULE_TOP - 64) / LINE_SPACING);

function wrap(line: string): string[] {
  if (line.length <= WRAP_AT) return [line];
  const out: string[] = [];
  let cur = '';
  for (const word of line.split(/(\s+)/)) {
    if ((cur + word).length > WRAP_AT && cur.trim()) {
      out.push(cur.trimEnd());
      cur = word.trimStart();
    } else cur += word;
    while (cur.length > WRAP_AT) {
      out.push(cur.slice(0, WRAP_AT));
      cur = cur.slice(WRAP_AT);
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Typed text on the ruled lines, one text box per page so nothing runs into the gap between pages. */
async function importText(src: ImportSource, startPage: number): Promise<ImportedContent> {
  const lines = (await readText(src)).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n').flatMap(wrap);
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const texts: TextBlock[] = [];
  for (let i = 0; i * LINES_PER_PAGE < lines.length; i++) {
    const chunk = lines.slice(i * LINES_PER_PAGE, (i + 1) * LINES_PER_PAGE).join('\n');
    const page = startPage + i;
    texts.push({ id: uid(), x: LEFT, y: snapToRule(pageTop(page) + RULE_TOP, LINE_SPACING), width: PAGE_W - LEFT * 2, text: chunk });
  }
  return { images: [], texts, pages: Math.max(1, texts.length) };
}

// ----------------------------------------------------------------

/** Turn one file into page content starting at `startPage` (0-based). Throws a readable error for unsupported files. */
export async function importFile(src: ImportSource, startPage: number, onProgress?: (msg: string) => void): Promise<ImportedContent> {
  if (isPdf(src)) return importPdf(src, startPage, onProgress);
  if (isImage(src)) return { images: [backgroundOnPage(await decodeImage(src), startPage)], texts: [], pages: 1 };
  if (isText(src)) return importText(src, startPage);
  if (/\.(docx?|pages|odt|pptx?|key|one|goodnotes|note)$/i.test(src.name)) {
    throw new Error(`"${src.name}" can't be imported directly. Export it as a PDF from the app it came from, then import the PDF.`);
  }
  throw new Error(`"${src.name}" isn't a supported file. You can import PDFs, images, and .txt/.md files.`);
}

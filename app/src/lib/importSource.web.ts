import type { ImportSource, LoadedImage, PdfPages } from './importFiles';

/** Web: the browser's file chooser, canvas image decoding, and PDF.js loaded from a CDN. */

export const IMPORT_ACCEPT = '.pdf,.txt,.md,.markdown,image/*';

/** A browser File (from the chooser, a paste, or a drop) as an import source. */
export const fromFile = (f: File): ImportSource => ({ name: f.name, type: f.type, file: f });

/** Open the browser's file chooser. Resolves with [] if the user cancels. */
export function pickSources(accept = IMPORT_ACCEPT, multiple = true): Promise<ImportSource[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []).map(fromFile));
    input.oncancel = () => resolve([]);
    input.click();
  });
}

/** Image files out of a paste or drop. */
export function imagesIn(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter((f) => f.type.startsWith('image/'));
}

const canvasToImage = (canvas: HTMLCanvasElement, quality: number): LoadedImage => ({
  base64: canvas.toDataURL('image/jpeg', quality).split(',')[1],
  width: canvas.width,
  height: canvas.height,
  mime: 'image/jpeg',
});

/** Decode an image and store a downscaled JPEG copy (≤2048px): crisp for the AI, small enough to save and sync. */
export async function loadImage(blob: Blob, maxSide = 2048): Promise<LoadedImage> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF'; // transparent PNGs → white, not black, as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvasToImage(canvas, 0.88);
}

export const readText = (src: ImportSource) => src.file!.text();
export const decodeImage = (src: ImportSource) => loadImage(src.file!);

// ---------------------------------------------------------------- PDF (rendered with PDF.js)

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';
let pdfjs: Promise<any> | null = null;
function loadPdfJs() {
  pdfjs ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${PDFJS}/pdf.min.js`;
    s.onload = () => {
      const lib = (window as any).pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.js`;
      resolve(lib);
    };
    s.onerror = () => {
      pdfjs = null;
      reject(new Error('Could not load the PDF reader. Check your internet connection and try again.'));
    };
    document.head.appendChild(s);
  });
  return pdfjs;
}

/** Render up to `maxPages` pages, each `width` px wide, as JPEGs. */
export async function renderPdf(src: ImportSource, maxPages: number, width: number, onProgress?: (msg: string) => void): Promise<PdfPages> {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: await src.file!.arrayBuffer() }).promise;
  const count = Math.min(doc.numPages, maxPages);
  const pages: LoadedImage[] = [];
  for (let n = 1; n <= count; n++) {
    onProgress?.(`Importing page ${n} of ${count}…`);
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: width / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push(canvasToImage(canvas, 0.82));
    page.cleanup();
  }
  const total = doc.numPages;
  await doc.destroy();
  return { pages, total };
}

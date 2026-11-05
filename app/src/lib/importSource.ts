import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { renderPdfPages } from '@/components/PdfRenderHost';
import type { ImportSource, LoadedImage, PdfPages } from './importFiles';
import { prepareImage } from './snapshot';

/** Native (Android/iOS): the system file picker, Skia image decoding, and PDF.js in a hidden WebView. */

export const IMPORT_ACCEPT = '.pdf,.txt,.md,.markdown,image/*';

// Web-only helpers (paste / drop). Never called on native; kept so shared imports type-check.
export const fromFile = (f: { name: string; type: string }): ImportSource => ({ name: f.name, type: f.type });
export const imagesIn = (_data: unknown): Blob[] => [];
export async function loadImage(_blob: Blob, _maxSide?: number): Promise<LoadedImage> {
  throw new Error('Not available on this device.');
}

const PICK_TYPES = ['application/pdf', 'image/*', 'text/plain', 'text/markdown', 'text/x-markdown'];

/** Open the system file picker. Resolves with [] if the user cancels. */
export async function pickSources(_accept?: string, multiple = true): Promise<ImportSource[]> {
  const res = await DocumentPicker.getDocumentAsync({ type: PICK_TYPES, multiple, copyToCacheDirectory: true });
  if (res.canceled) return [];
  return res.assets.map((a) => ({ name: a.name, type: a.mimeType ?? '', uri: a.uri }));
}

export const readText = (src: ImportSource) => new File(src.uri!).text();

export async function decodeImage(src: ImportSource): Promise<LoadedImage> {
  const img = prepareImage(await new File(src.uri!).base64());
  if (!img) throw new Error(`Couldn't read the image "${src.name}".`);
  return img;
}

const MAX_PDF_BYTES = 40 * 1024 * 1024;

export async function renderPdf(src: ImportSource, maxPages: number, width: number, onProgress?: (msg: string) => void): Promise<PdfPages> {
  const file = new File(src.uri!);
  if ((file.size ?? 0) > MAX_PDF_BYTES) throw new Error(`"${src.name}" is too large to import (over 40 MB).`);
  return renderPdfPages(await file.base64(), maxPages, width, onProgress);
}

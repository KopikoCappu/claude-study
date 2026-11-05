import { fetch as streamingFetch } from 'expo/fetch';
import { Platform } from 'react-native';
import type { ModelAnnotation } from './annotations';
import type { RenderedImage } from './snapshot';
import { modelFor } from './prefs';
import type { ChatMessage, Rect, Usage } from './types';

// Where the server lives: EXPO_PUBLIC_API_URL (app/.env, eas.json) — the hosted API on Vercel.
// Without it: on web, the page's own origin (when the laptop server hosts the web build), else the local server.
function resolveApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.port !== '8081') return window.location.origin;
  return 'http://localhost:8787';
}
export const API_URL = resolveApiUrl();

export type Mode = 'ask' | 'mistake' | 'explain' | 'transcribe';

export type AskResponse = {
  reply: string;
  annotations: ModelAnnotation[];
  transcription?: string;
  usage?: Usage;
};

type WireImage = RenderedImage & { label?: string; mime?: string };
type WireMessage = { role: 'user' | 'assistant'; text: string; images?: WireImage[] };

/** Extra context attached to the newest user message only (not stored in chat history). */
export type PageContext = { view: RenderedImage | null; viewRect: Rect; text: string };

function chipText(m: ChatMessage) {
  return [
    m.text,
    ...(m.chips ?? []).map((c) => (c.text ? `Typed text / equations from my ${c.label ?? 'selection'} (exact text, not an image):\n${c.text}` : '')),
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Every image a chip contributes, each with a label and the page-space region it shows. */
function chipImages(m: ChatMessage, n: { k: number }): { img: WireImage; region: Rect }[] {
  return (m.chips ?? []).flatMap((c) => {
    const name = c.label ?? `selection ${++n.k}`;
    const out: { img: WireImage; region: Rect }[] = [];
    if (c.image) out.push({ img: { ...c.image, label: name }, region: c.bounds }); // legacy chips
    if (c.ink) out.push({ img: { ...c.ink, label: `${name}: handwriting/ink only (no background)` }, region: c.bounds });
    (c.images ?? []).forEach((im, i) => out.push({ img: { ...im, label: `${name}: image ${i + 1} (original)` }, region: im.region }));
    if (c.combined) out.push({ img: { ...c.combined, label: `${name}: ink and image together, as laid out on the page` }, region: c.bounds });
    return out;
  });
}

/**
 * Build the request. Returns the page-space region each image of the newest message shows, in order,
 * so annotation boxes (which reference images by index) can be mapped back onto the page.
 */
export function buildRequest(history: ChatMessage[], ctx: PageContext): { messages: WireMessage[]; regions: Rect[] } {
  let regions: Rect[] = [];
  const messages = history
    .filter((m) => !m.error)
    .map((m, i, all): WireMessage => {
      const parts = chipImages(m, { k: 0 });
      // Only the newest message carries images (keeps requests under the host's 4.5 MB body limit);
      // earlier turns keep their text so the conversation still makes sense.
      if (i !== all.length - 1) {
        const note = parts.length ? `\n\n(${parts.length} image${parts.length > 1 ? 's' : ''} I attached earlier, omitted)` : '';
        return { role: m.role, text: (chipText(m) || '(see images)') + note };
      }

      regions = parts.map((p) => p.region);
      const images = parts.map((p) => p.img);
      if (ctx.view) {
        images.push({ ...ctx.view, label: 'page view (what is on my screen right now)' });
        regions.push(ctx.viewRect);
      }
      return { role: m.role, text: [chipText(m) || '(see images)', ctx.text].filter(Boolean).join('\n\n'), images };
    });
  return { messages, regions };
}

/** Thrown when no AI key is saved, so the UI can point to Settings → Claude key. */
export class NoKeyError extends Error {
  constructor() {
    super('Add your Claude key to use Claude Study.');
  }
}

async function serverError(res: Response) {
  const j = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
  if (j?.code === 'no_key') return new NoKeyError();
  return new Error(j?.error ?? `Server error ${res.status}`);
}

/** Ask Claude using the user's own key (see lib/aiKey.ts). */
/** `signal` stops the request; the server then cancels it with Claude, so a stopped answer stops costing. */
export async function ask(key: string | undefined, mode: Mode, messages: WireMessage[], signal?: AbortSignal): Promise<AskResponse> {
  if (!key) throw new NoKeyError();
  const res = await fetch(`${API_URL}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1', 'x-ai-key': key },
    body: JSON.stringify({ model: modelFor('chat'), mode, messages }),
    signal,
  });
  if (!res.ok) throw await serverError(res);
  return res.json();
}

/** Check a key works (free — no AI request is made). Resolves with an error message, or null if it's good. */
export async function checkKey(key: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/check-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1', 'x-ai-key': key.trim() },
      body: '{}',
    });
    if (res.ok) return null;
    return (await serverError(res)).message;
  } catch {
    return "Couldn't reach the server. Check your internet connection.";
  }
}

/** Read the handwriting in one page image (for search), with the user's own key. */
export async function readHandwriting(key: string, image: RenderedImage & { mime?: string }): Promise<{ text: string; usage?: Usage }> {
  const res = await fetch(`${API_URL}/read-handwriting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1', 'x-ai-key': key },
    body: JSON.stringify({ model: modelFor('search'), image }),
  });
  if (!res.ok) throw await serverError(res);
  const j = (await res.json()) as { text?: string; usage?: Usage };
  return { text: j.text ?? '', usage: j.usage };
}

export type BuiltTool = { title: string; html: string; usage?: Usage };

/** How far along a tool build is: characters written so far, and its title once the AI has written it. */
export type ToolProgress = { chars: number; title?: string };

/**
 * Build a study tool, or fix / change one (`previous`), with the user's own key. Usually 20–60 s.
 * `context` is what the AI sees of the notes (lib/studyTools.ts). Progress streams in as the tool is written;
 * aborting `signal` also stops the AI request on the server, so a cancelled build stops costing anything.
 */
export async function buildTool(
  key: string | undefined,
  body: { prompt: string; context?: { text?: string; image?: WireImage }; previous?: { html: string; error?: string } },
  signal?: AbortSignal,
  onProgress?: (p: ToolProgress) => void,
): Promise<BuiltTool> {
  if (!key) throw new NoKeyError();
  // expo/fetch can read a response as it arrives on Android and iOS (React Native's own fetch can't).
  const res = await streamingFetch(`${API_URL}/build-tool`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson',
      'ngrok-skip-browser-warning': '1',
      'x-ai-key': key,
    },
    body: JSON.stringify({ model: modelFor('artifacts'), ...body }),
    signal,
  });
  if (!res.ok) throw await serverError(res as unknown as Response);
  if (!res.body || !res.headers.get('content-type')?.includes('ndjson')) return (await res.json()) as BuiltTool;

  // One JSON object per line: { progress } while the tool is written, then { tool } or { error }.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  for (;;) {
    const { done, value } = await reader.read();
    buffered += done ? decoder.decode() : decoder.decode(value, { stream: true });
    const lines = buffered.split('\n');
    buffered = done ? '' : (lines.pop() ?? '');
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line) as { progress?: ToolProgress; tool?: BuiltTool; error?: string };
      if (msg.tool) return msg.tool;
      if (msg.error) throw new Error(msg.error);
      if (msg.progress) onProgress?.(msg.progress);
    }
    if (done) break;
  }
  throw new Error('The connection dropped before the tool finished. Try again.');
}

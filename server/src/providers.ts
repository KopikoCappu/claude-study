import Anthropic from '@anthropic-ai/sdk';
import { claudeUsage } from './usage.js';
import { MODE_INSTRUCTIONS, SYSTEM_PROMPT, TOOL_SYSTEM_PROMPT, toolUserText } from './prompts.js';
import { RESPONSE_JSON_SCHEMA, type AskRequest, type AskResponse, type BuildToolRequest, type BuildToolResponse, type ImagePart, type Usage } from './schema.js';

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5';

/** Models the app may ask for (Settings → Claude → Models). Anything else falls back to the default for that feature. */
export const MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] as const;
const pickModel = (requested: string | undefined, fallback: string) =>
  requested && (MODELS as readonly string[]).includes(requested) ? requested : fallback;

/**
 * If a safety classifier declines, the API retries on a suitable fallback model.
 * Haiku 5.5 has no server-side fallback, so its requests go without it.
 */
const refusalFallback = (model: string) =>
  model.startsWith('claude-haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };

// Every AI call uses the key the user sent with that request (bring your own key).
// The server has no AI key of its own and never stores, logs or reads one from the environment.
const claudeClient = (apiKey: string) => new Anthropic({ apiKey, maxRetries: 1 });

/** Check a key without spending anything: listing models is free. Throws if the key is rejected. */
export async function checkKey(apiKey: string): Promise<void> {
  await claudeClient(apiKey).models.list({ limit: 1 });
}

const mediaType = (img: ImagePart) => (img.mime === 'image/jpeg' ? 'image/jpeg' : img.mime === 'image/webp' ? 'image/webp' : 'image/png') as 'image/png' | 'image/jpeg' | 'image/webp';

const imageLabel = (img: ImagePart, i: number) => `Image ${i}${img.label ? ` — ${img.label}` : ''} (${img.width}×${img.height}px):`;

function withModeInstruction(req: AskRequest) {
  // Append the mode instruction to the latest user turn so it applies to this request only.
  const messages = req.messages.map((m) => ({ ...m }));
  const last = messages[messages.length - 1];
  if (last?.role === 'user') {
    last.text = `${last.text}\n\n[Mode instruction] ${MODE_INSTRUCTIONS[req.mode]}`.trim();
  }
  return messages;
}

/** `signal` stops the request (and its billing) when the student taps Stop or closes the app. */
export async function askClaude(req: AskRequest, apiKey: string, signal?: AbortSignal): Promise<AskResponse> {
  const anthropic = claudeClient(apiKey);
  const messages = withModeInstruction(req);

  // Structured outputs: the API guarantees the reply matches RESPONSE_JSON_SCHEMA.
  // (Forced tool_choice is not supported on current models.)
  const res = await anthropic.beta.messages.create({
    model: pickModel(req.model, ANTHROPIC_MODEL),
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: RESPONSE_JSON_SCHEMA as unknown as Record<string, unknown> },
    },
    ...refusalFallback(pickModel(req.model, ANTHROPIC_MODEL)),
    messages: messages.map((m) => ({
      role: m.role,
      content: [
        ...(m.images ?? []).flatMap((img, i) => [
          { type: 'text' as const, text: imageLabel(img, i) },
          { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType(img), data: img.base64 } },
        ]),
        { type: 'text' as const, text: m.text || '(see image)' },
      ],
    })),
  }, { signal });

  const usage = claudeUsage(res.model, res.usage);
  if (res.stop_reason === 'refusal') {
    return { reply: "Sorry — I can't help with that one.", annotations: [], usage };
  }
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  try {
    return { ...normalize(JSON.parse(text)), usage };
  } catch {
    return { reply: text || '(no response)', annotations: [], usage };
  }
}

// Defensive cleanup: models occasionally return out-of-range or malformed boxes.
function normalize(raw: unknown): AskResponse {
  const r = (raw ?? {}) as Partial<AskResponse>;
  const clamp = (n: number) => Math.max(0, Math.min(1000, Math.round(Number(n) || 0)));
  const annotations = (Array.isArray(r.annotations) ? r.annotations : [])
    .filter((a) => a && Array.isArray(a.box) && a.box.length === 4)
    .map((a) => {
      const [y0, x0, y1, x1] = a.box.map(clamp);
      return {
        ...a,
        image: Math.max(0, Math.round(Number(a.image) || 0)),
        box: [Math.min(y0, y1), Math.min(x0, x1), Math.max(y0, y1), Math.max(x0, x1)] as [number, number, number, number],
        from: Array.isArray(a.from) && a.from.length === 2 ? ([clamp(a.from[0]), clamp(a.from[1])] as [number, number]) : undefined,
      };
    });
  return { reply: String(r.reply ?? ''), annotations, transcription: r.transcription };
}

// ---------------------------------------------------------------- handwriting search

/** Default model for reading handwriting so notes are searchable: Haiku is plenty for transcription and costs very little. */
const INDEX_MODEL = process.env.ANTHROPIC_INDEX_MODEL ?? 'claude-haiku-5-5';

const READ_PROMPT = `This image is one page of a student's handwritten notes. Transcribe every handwritten word on it, in reading order,
as plain text so the notes can be searched. Write math in plain words or simple symbols (x^2, sqrt, =). Skip drawings and
doodles; for a labeled diagram, list its labels. If there is no readable writing, return an empty string.`;

const READ_SCHEMA = {
  type: 'object',
  properties: { text: { type: 'string', description: 'All handwriting on the page as plain text.' } },
  required: ['text'],
  additionalProperties: false,
} as const;

/** Read the handwriting on one page image (for search). Returns plain text. */
export async function readHandwriting(apiKey: string, image: ImagePart, requestedModel?: string): Promise<{ text: string; usage: Usage }> {
  const res = await claudeClient(apiKey).beta.messages.create({
    model: pickModel(requestedModel, INDEX_MODEL),
    max_tokens: 16000,
    // Plain transcription doesn't need deep reasoning.
    output_config: { effort: 'low', format: { type: 'json_schema', schema: READ_SCHEMA as unknown as Record<string, unknown> } },
    ...refusalFallback(pickModel(requestedModel, INDEX_MODEL)),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType(image), data: image.base64 } },
          { type: 'text', text: READ_PROMPT },
        ],
      },
    ],
  });
  const usage = claudeUsage(res.model, res.usage);
  if (res.stop_reason === 'refusal') return { text: '', usage };
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  try {
    return { text: String((JSON.parse(text) as { text?: string }).text ?? ''), usage };
  } catch {
    return { text: '', usage };
  }
}

// ---------------------------------------------------------------- study tools

/** Largest tool the app will store (they sync with the note). */
const MAX_TOOL_BYTES = 300_000;

/** A model's reply couldn't be used as a tool; the message is shown to the student as is. */
export class ToolError extends Error {}

/**
 * Model for study tools. Sonnet costs half what Opus does and, at low effort, builds a tool in well under a minute.
 * Set ANTHROPIC_TOOL_MODEL=claude-opus-5-5 for the most polished (slower, pricier) tools.
 */
const TOOL_MODEL = process.env.ANTHROPIC_TOOL_MODEL ?? 'claude-sonnet-5-5';
const TOOL_EFFORT = (process.env.ANTHROPIC_TOOL_EFFORT ?? 'low') as 'low' | 'medium' | 'high';

/** How far along a build is: characters of the tool written so far, and its title once the AI has written it. */
export type ToolProgress = { chars: number; title?: string };

/**
 * Build, fix or change a study tool with the user's key. Returns the finished HTML page.
 * `onProgress` is called as the tool is written; aborting `signal` stops the AI request (and its billing).
 */
export async function buildTool(
  req: BuildToolRequest,
  apiKey: string,
  onProgress?: (p: ToolProgress) => void,
  signal?: AbortSignal,
): Promise<BuildToolResponse> {
  const image = req.context?.image;
  const text = toolUserText(req.prompt, req.context?.text, !!image, req.previous);
  let written = '';
  let title: string | undefined;
  const progress = (delta: string) => {
    written += delta;
    title ??= written.match(/<title[^>]*>([^<]{1,80})<\/title>/i)?.[1]?.trim() || undefined;
    onProgress?.({ chars: written.length, title });
  };

  const stream = claudeClient(apiKey).beta.messages.stream(
    {
      model: pickModel(req.model, TOOL_MODEL),
      max_tokens: 64000,
      system: TOOL_SYSTEM_PROMPT,
      output_config: { effort: TOOL_EFFORT },
      ...refusalFallback(pickModel(req.model, TOOL_MODEL)),
      messages: [
        {
          role: 'user',
          content: [
            ...(image
              ? [
                  { type: 'text' as const, text: imageLabel(image, 0) },
                  { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType(image), data: image.base64 } },
                ]
              : []),
            { type: 'text' as const, text },
          ],
        },
      ],
    },
    { signal },
  );
  stream.on('text', progress);
  const res = await stream.finalMessage();
  if (res.stop_reason === 'refusal') throw new ToolError("Sorry — I can't build that one.");
  if (res.stop_reason === 'max_tokens') throw new ToolError('That artifact came out too long. Try asking for something smaller.');
  return { ...extractTool(res.content.map((b) => (b.type === 'text' ? b.text : '')).join('')), usage: claudeUsage(res.model, res.usage) };
}

/** Pull the HTML document (and its <title>) out of the reply, with or without a code fence around it. */
export function extractTool(reply: string): BuildToolResponse {
  const fenced = reply.match(/```(?:html)?\s*\n([\s\S]*?)```/i)?.[1];
  let html = (fenced ?? reply).trim();
  const start = html.search(/<!doctype html|<html[\s>]/i);
  if (start < 0) throw new ToolError("The AI didn't return a working artifact. Try again.");
  html = html.slice(start);
  const end = html.toLowerCase().lastIndexOf('</html>');
  if (end >= 0) html = html.slice(0, end + '</html>'.length);
  if (html.length > MAX_TOOL_BYTES) throw new ToolError('That artifact came out too large. Try asking for something smaller.');
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || 'Artifact';
  return { title: title.slice(0, 80), html };
}

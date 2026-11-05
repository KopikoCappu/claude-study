import type { Usage } from './schema.js';

/**
 * What each request used, so the app can show students what they're spending on their own key.
 * Claude prices are USD per million tokens (input, output, cache read, cache write). Thinking is billed as output.
 * Checked against https://platform.claude.com/docs/en/about-claude/pricing on 2026-11-04. Update when prices change.
 * `cacheWrite` is the 5-minute cache write price.
 */
const CLAUDE_PRICES: { match: RegExp; input: number; output: number; cacheRead: number; cacheWrite: number }[] = [
  { match: /^claude-fable-5/, input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 },
  { match: /^claude-opus-5-5/, input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  { match: /^claude-opus-/, input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  { match: /^claude-sonnet-5-5/, input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  { match: /^claude-sonnet-5/, input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  { match: /^claude-sonnet-4/, input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  // Haiku 5.5 is priced by prompt length; see HAIKU_LONG below for prompts over 100,000 tokens.
  { match: /^claude-haiku-5-5/, input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  { match: /^claude-haiku-4/, input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
];

/** Claude Haiku 5.5 when the whole prompt (input + cache reads + cache writes) is over 100,000 tokens. */
const HAIKU_LONG = { input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite: 0.625 };

type ClaudeUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

/** `model` is the model that actually answered (a refusal fallback can switch it). */
export function claudeUsage(model: string, u: ClaudeUsage): Usage {
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  const prompt = u.input_tokens + cacheRead + cacheWrite;
  const p = model.startsWith('claude-haiku-5-5') && prompt > 100_000 ? HAIKU_LONG : CLAUDE_PRICES.find((x) => x.match.test(model));
  const costUsd = p
    ? (u.input_tokens * p.input + u.output_tokens * p.output + cacheRead * p.cacheRead + cacheWrite * p.cacheWrite) / 1_000_000
    : null;
  return { provider: 'claude', model, inputTokens: u.input_tokens + cacheRead + cacheWrite, outputTokens: u.output_tokens, costUsd };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** The Claude models Claude Study offers. Prices are USD per million tokens (input / output), from Anthropic's price list. */
export const MODELS = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', blurb: 'Most capable. Best at reading handwriting and finding mistakes.', input: 4, output: 20 },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', blurb: 'Fast and capable. Half the price of Opus.', input: 2, output: 10 },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', blurb: 'Fastest and cheapest. Good for transcribing.', input: 0.1, output: 0.5 },
] as const;
export type ModelId = (typeof MODELS)[number]['id'];

export const modelName = (id: string) => MODELS.find((m) => id.startsWith(m.id))?.name ?? id;

/**
 * A typical Claude Study request, in tokens, to turn per-million prices into per-action costs.
 * Measured from Claude Study's own prompts (2026-11-04): Ask sends ~1,300 tokens of instructions plus one or two
 * page images (~1,300–1,600 tokens each) and gets back a reply, page marks and thinking. An artifact is a
 * 15–60 KB HTML page (~4,000–15,000 tokens). Search reads one page image and returns its text.
 * Real requests vary with what you select, how long the chat is, and how long the answer is.
 */
const TYPICAL: Record<Feature, { input: number; output: number; unit: string }> = {
  chat: { input: 4000, output: 2000, unit: 'question' },
  artifacts: { input: 3000, output: 9000, unit: 'artifact' },
  search: { input: 1800, output: 400, unit: 'page' },
};

/** Estimated cost of one typical request for a feature on a model, in USD. */
export function typicalCost(feature: Feature, modelId: string): number {
  const m = MODELS.find((x) => modelId.startsWith(x.id)) ?? MODELS[0];
  const t = TYPICAL[feature];
  return (t.input * m.input + t.output * m.output) / 1_000_000;
}

/** "about 5¢ per question", "under 0.1¢ per page" */
export function perAction(feature: Feature, modelId: string): string {
  const usd = typicalCost(feature, modelId);
  const unit = TYPICAL[feature].unit;
  if (usd < 0.001) return `under 0.1¢ per ${unit}`;
  if (usd < 0.01) return `about ${(usd * 100).toFixed(1)}¢ per ${unit}`;
  if (usd < 1) return `about ${Math.round(usd * 100)}¢ per ${unit}`;
  return `about $${usd.toFixed(2)} per ${unit}`;
}

/** Which model each feature uses. */
export type Feature = 'chat' | 'artifacts' | 'search';

export type HomeSort = 'edited' | 'created' | 'title';

type PrefsState = {
  /** How the notes home is ordered (pinned notes always come first). */
  homeSort: HomeSort;
  setHomeSort: (s: HomeSort) => void;
  models: Record<Feature, ModelId>;
  /** Monthly spending you want to stay under, in USD. 0 = no budget. A warning only; nothing is blocked. */
  monthlyBudget: number;
  setModel: (f: Feature, m: ModelId) => void;
  setMonthlyBudget: (usd: number) => void;
};

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      models: { chat: 'claude-opus-5-5', artifacts: 'claude-sonnet-5-5', search: 'claude-haiku-5-5' },
      monthlyBudget: 0,
      homeSort: 'edited',
      setHomeSort: (homeSort) => set({ homeSort }),
      setModel: (f, m) => set((s) => ({ models: { ...s.models, [f]: m } })),
      setMonthlyBudget: (usd) => set({ monthlyBudget: Math.max(0, Math.round(usd * 100) / 100) }),
    }),
    { name: 'kober-prefs', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** The model to send for a feature (read at request time, outside React). */
export const modelFor = (f: Feature) => usePrefs.getState().models[f];

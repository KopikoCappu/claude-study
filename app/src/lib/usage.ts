import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Usage } from './types';

/**
 * A running tally of what the AI has used on this device, so spending on the student's own key is never a surprise.
 * Totals reset each calendar month; per-note totals are kept for good. Costs are estimates at list prices — the
 * Claude Console has the exact bill.
 */
export type UsageKind = 'chat' | 'tools' | 'search';
export type Tally = { tokens: number; costUsd: number; requests: number };
const ZERO: Tally = { tokens: 0, costUsd: 0, requests: 0 };
const add = (t: Tally | undefined, tokens: number, cost: number): Tally => ({
  tokens: (t?.tokens ?? 0) + tokens,
  costUsd: (t?.costUsd ?? 0) + cost,
  requests: (t?.requests ?? 0) + 1,
});

/** Days of daily history to keep (for the chart in Settings → Usage). */
const KEEP_DAYS = 90;

type UsageState = {
  month: string; // "2026-10"
  byKind: Record<UsageKind, Tally>;
  /** This month, per model id. */
  byModel: Record<string, Tally>;
  /** Local date "2026-11-04" → that day's total. */
  byDay: Record<string, Tally>;
  /** Everything since Claude Study was installed (never reset by the monthly rollover). */
  allTime: Tally;
  byNote: Record<string, { tokens: number; costUsd: number }>;
  record: (usage: Usage | undefined, kind: UsageKind, noteId?: string) => void;
  resetMonth: () => void;
};

const thisMonth = () => new Date().toISOString().slice(0, 7);
/** Local calendar date, "YYYY-MM-DD". */
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const freshMonth = () => ({ month: thisMonth(), byKind: { chat: { ...ZERO }, tools: { ...ZERO }, search: { ...ZERO } }, byModel: {} as Record<string, Tally> });

function trimDays(days: Record<string, Tally>): Record<string, Tally> {
  const oldest = dayKey(new Date(Date.now() - KEEP_DAYS * 86_400_000));
  return Object.fromEntries(Object.entries(days).filter(([d]) => d >= oldest));
}

export const useUsage = create<UsageState>()(
  persist(
    (set) => ({
      ...freshMonth(),
      byDay: {},
      allTime: { ...ZERO },
      byNote: {},
      record: (usage, kind, noteId) =>
        set((s) => {
          if (!usage) return s;
          const tokens = usage.inputTokens + usage.outputTokens;
          const cost = usage.costUsd ?? 0;
          const base = s.month === thisMonth() ? s : { ...s, ...freshMonth() };
          const today = dayKey(new Date());
          const note = noteId ? (s.byNote[noteId] ?? { tokens: 0, costUsd: 0 }) : null;
          return {
            month: base.month,
            byKind: { ...base.byKind, [kind]: add(base.byKind[kind], tokens, cost) },
            byModel: { ...(base.byModel ?? {}), [usage.model]: add(base.byModel?.[usage.model], tokens, cost) },
            byDay: trimDays({ ...(s.byDay ?? {}), [today]: add(s.byDay?.[today], tokens, cost) }),
            allTime: add(s.allTime, tokens, cost),
            byNote: noteId && note ? { ...s.byNote, [noteId]: { tokens: note.tokens + tokens, costUsd: note.costUsd + cost } } : s.byNote,
          };
        }),
      resetMonth: () => set(freshMonth()),
    }),
    { name: 'kober-usage', storage: createJSONStorage(() => AsyncStorage), partialize: ({ record: _r, resetMonth: _m, ...rest }) => rest },
  ),
);

/** "820 tokens", "12.4k tokens", "1.2M tokens" */
export function fmtTokens(n: number): string {
  if (n < 1000) return `${n} tokens`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k tokens`;
  return `${(n / 1_000_000).toFixed(1)}M tokens`;
}

/** "<0.1¢", "~0.4¢", "~$0.48", "~$12" — or null when there's no estimate. */
export function fmtCost(usd: number | null | undefined): string | null {
  if (usd == null) return null;
  if (usd < 0.001) return '<0.1¢';
  if (usd < 0.01) return `~${(usd * 100).toFixed(1)}¢`;
  if (usd < 0.995) return `~${Math.round(usd * 100)}¢`;
  return usd < 10 ? `~$${usd.toFixed(2)}` : `~$${Math.round(usd)}`;
}

/** "1.2k tokens · ~0.4¢" (tokens only when the model has no price). */
export function fmtUsage(tokens: number, usd: number | null | undefined): string {
  const cost = fmtCost(usd);
  return cost ? `${fmtTokens(tokens)} · ${cost}` : fmtTokens(tokens);
}

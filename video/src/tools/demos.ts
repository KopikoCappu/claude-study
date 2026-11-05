import { createContext, useContext } from 'react';

/**
 * What the main scene shows: the handwritten notes, the request, and the real tool the app built from them.
 * Tool screenshots are 720 px wide at 2× (positions below are in capture pixels).
 */
export type Demo = {
  noteTitle: string;
  notes: { text: string; color: 'text' | 'red' | 'blue'; size?: number }[];
  marginNote: string;
  prompt: string;
  /** Real build: seconds, characters written, tool title, model that built it. */
  real: { secs: number; chars: number; title: string; model: string };
  /** Width of the tool screenshots in pixels (captured at 2×). */
  shotWidth: number;
  /** Screenshots of the tool in use: shown from `at` seconds. */
  shots: { at: number; src: string }[];
  taps: { at: number; x: number; y: number }[];
  scrolls: { at: number; dur: number; to: number }[];
  ring: { at: number; x: number; y: number; w: number; h: number };
  captions: { play: string; check: string };
  /** For the opening scene. */
  hook: { file: string; lines: string[]; shot: string };
};

export const POKER: Demo = {
  noteTitle: 'Poker · pot odds',
  notes: [
    { text: 'Poker — pot odds & EV', color: 'text', size: 62 },
    { text: 'me: A♥ K♥     flop: Q♥ 7♥ 2♣', color: 'red' },
    { text: 'flush draw = 9 outs  →  ~36%', color: 'text' },
    { text: 'pot $60, bet $20  →  call 20 to win 80', color: 'text' },
    { text: 'pot odds = 20 / 100 = 20%', color: 'text' },
    { text: 'EV = eq × win − (1 − eq) × call', color: 'blue' },
  ],
  marginNote: '36% > 20%  →  CALL  (+$16)',
  prompt: 'deal me hands like this and let me call or fold, then show the pot odds vs my equity and the EV',
  real: { secs: 57, chars: 8818, title: 'Pot Odds Table', model: 'Claude Sonnet 5.5' }, // public/tools/poker-sim-0.json
  shotWidth: 1440,
  shots: [
    { at: 0, src: 'ps-tall-0' },
    { at: 9.55, src: 'ps-tall-1' },
  ],
  taps: [{ at: 9.45, x: 366, y: 1091 }],
  scrolls: [{ at: 9.9, dur: 0.8, to: 590 }],
  ring: { at: 11.0, x: 60, y: 1395, w: 720, h: 44 },
  captions: { play: 'Play the hand.', check: 'It shows the math.' },
  hook: { file: 'poker-notes.pdf', lines: ['Poker — pot odds & EV', 'A♥ K♥   flop Q♥ 7♥ 2♣', '9 outs → ~36%', 'pot odds = 20 / 100 = 20%'], shot: 'ps-tall-0' },
};

export const BIO: Demo = {
  noteTitle: 'Bio · genetics',
  notes: [
    { text: 'Bio — Mendelian genetics', color: 'text', size: 62 },
    { text: 'B = brown (dominant)    b = blue', color: 'text' },
    { text: 'Bb × Bb  →  Punnett square', color: 'red' },
    { text: 'genotypes:  1 BB : 2 Bb : 1 bb', color: 'text' },
    { text: 'phenotypes:  3 brown : 1 blue', color: 'text' },
    { text: 'hetero = Bb      homo = BB or bb', color: 'blue' },
  ],
  marginNote: '→ 75% brown, 25% blue  ✓',
  prompt: 'let me practice filling in Punnett squares for different crosses and predict the ratios',
  real: { secs: 165, chars: 25025, title: 'Punnett Square Lab', model: 'Gemini Flash' }, // public/tools/punnett-gemini.json
  shotWidth: 1200, // captured 600 px wide so the tool fills the panel
  // Fill the square (cell, then genotype button), pick the ratios, press Check.
  shots: [
    { at: 0, src: 'pu-0' },
    { at: 9.8, src: 'pu-1' },
    { at: 10.5, src: 'pu-2' },
    { at: 11.05, src: 'pu-3' },
    { at: 11.55, src: 'pu-4' },
  ],
  taps: [
    { at: 8.95, x: 560, y: 592 },
    { at: 9.2, x: 206, y: 1010 },
    { at: 9.45, x: 744, y: 592 },
    { at: 9.7, x: 468, y: 1010 },
    { at: 9.95, x: 560, y: 776 },
    { at: 10.15, x: 468, y: 1010 },
    { at: 10.3, x: 744, y: 776 },
    { at: 10.45, x: 732, y: 1010 },
    { at: 11.4, x: 600, y: 1526 },
  ],
  scrolls: [{ at: 10.6, dur: 0.5, to: 720 }],
  ring: { at: 11.9, x: 62, y: 1594, w: 1076, h: 140 },
  captions: { play: 'Fill in the square.', check: 'It checks your work.' },
  hook: { file: 'bio-notes.pdf', lines: ['Mendelian genetics', 'Bb × Bb → Punnett square', '1 BB : 2 Bb : 1 bb', '3 brown : 1 blue'], shot: 'pu-0' },
};

export const DEMOS = { poker: POKER, bio: BIO };
export type Topic = keyof typeof DEMOS;

/** How the logo scenes look: the bright purple circle, the logo over the photo, or a deep indigo night. */
export type Brand = 'purple' | 'photo' | 'indigo';

export const VideoContext = createContext<{ demo: Demo; brand: Brand }>({ demo: POKER, brand: 'purple' });
export const useDemo = () => useContext(VideoContext).demo;
export const useBrand = () => useContext(VideoContext).brand;
export const VideoProvider = VideoContext.Provider;

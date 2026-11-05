/**
 * Kober mark: a clay tablet with Linear B-style signs cut into it (one color; the signs are real holes, even-odd fill).
 * 100×100 viewBox. Used by <Logo> and by scripts/icons.mjs for the app icon, favicon and splash.
 */

/** Claude orange, and the ivory the icon's tablet is drawn in (Anthropic brand colors). */
export const CLAY = '#D97757';
export const CREAM = '#FAF9F5';
/** Anthropic's near-black, for the mark on light photos or print. */
export const INK = '#141413';

const TABLET = 'M18 14 C35 10.5 65 10.5 82 14 C85.5 30 85.5 70 82 86 C65 89.5 35 89.5 18 86 C14.5 70 14.5 30 18 14 Z';

const SIGNS = [
  // Row 1
  'M26 21 H34 V23.6 H31.3 V32 H28.7 V23.6 H26 Z',
  'M40 32 L46 21 L52 32 Z',
  'M60 25.4 H64.7 V21 H67.3 V25.4 H72 V28 H67.3 V32.4 H64.7 V28 H60 Z',
  // Ruled lines
  'M24 37 H76 V38.6 H24 Z',
  'M24 62 H76 V63.6 H24 Z',
  // Row 2 (the ring's inner circle fills back in)
  'M31 44 a6 6 0 1 0 0.001 0 Z',
  'M31 47.4 a2.6 2.6 0 1 0 0.001 0 Z',
  'M42 46 H44.4 V55 H42 Z',
  'M52 44 H70 V46.8 H52 Z',
  'M53 48.6 H55.4 V57 H53 Z',
  'M59.8 48.6 H62.2 V57 H59.8 Z',
  'M66.6 48.6 H69 V57 H66.6 Z',
  // Row 3: still being written
  'M30 68.5 L35.5 74.5 L30 80.5 L24.5 74.5 Z',
  'M40 69 H50 V80 H47.4 V71.6 H42.6 V80 H40 Z',
  'M55 73.4 H62 V75.8 H55 Z',
];

/** `scale` shrinks the tablet inside the 100×100 box (app icons need padding). */
export function logoSvg({ background, color = INK, scale = 0.94 }: { background?: string; color?: string; scale?: number } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
${background ? `<rect width="100" height="100" fill="${background}"/>` : ''}
<g transform="translate(50 50) rotate(-8) scale(${scale}) translate(-50 -50)">
  <path fill="${color}" fill-rule="evenodd" d="${TABLET} ${SIGNS.join(' ')}"/>
</g>
</svg>`;
}

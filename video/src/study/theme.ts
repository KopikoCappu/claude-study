import { loadFont as loadSerif } from '@remotion/google-fonts/SourceSerif4';

/** Claude Study colors, from app/src/lib/theme.ts and logo.ts. */
export const CS = {
  bg: '#FAF9F5', // claude.ai page color
  cream: '#F5F4ED',
  paper: '#FFFFFF',
  ink: '#141413',
  text: '#141413',
  icon: '#3D3D3A',
  muted: '#87867F',
  border: 'rgba(20,20,19,0.10)',
  selected: 'rgba(20,20,19,0.06)',
  clay: '#D97757', // Claude orange (logo)
  primary: '#C96442', // buttons
  night: '#1F1E1D',
  rule: 'rgba(20,20,19,0.07)', // notebook lines
  lasso: '#2F6FEB',
  red: '#C8463D',
  green: '#3E8E5E',
};

export const serif = loadSerif('normal', { weights: ['400', '500', '600'], subsets: ['latin'] }).fontFamily;

/** The app's mark: a clay tablet with signs cut into it (same paths as app/src/lib/logo.ts). */
export const TABLET = 'M18 14 C35 10.5 65 10.5 82 14 C85.5 30 85.5 70 82 86 C65 89.5 35 89.5 18 86 C14.5 70 14.5 30 18 14 Z';
export const SIGNS = [
  'M26 21 H34 V23.6 H31.3 V32 H28.7 V23.6 H26 Z',
  'M40 32 L46 21 L52 32 Z',
  'M60 25.4 H64.7 V21 H67.3 V25.4 H72 V28 H67.3 V32.4 H64.7 V28 H60 Z',
  'M24 37 H76 V38.6 H24 Z',
  'M24 62 H76 V63.6 H24 Z',
  'M31 44 a6 6 0 1 0 0.001 0 Z',
  'M31 47.4 a2.6 2.6 0 1 0 0.001 0 Z',
  'M42 46 H44.4 V55 H42 Z',
  'M52 44 H70 V46.8 H52 Z',
  'M53 48.6 H55.4 V57 H53 Z',
  'M59.8 48.6 H62.2 V57 H59.8 Z',
  'M66.6 48.6 H69 V57 H66.6 Z',
  'M30 68.5 L35.5 74.5 L30 80.5 L24.5 74.5 Z',
  'M40 69 H50 V80 H47.4 V71.6 H42.6 V80 H40 Z',
  'M55 73.4 H62 V75.8 H55 Z',
];

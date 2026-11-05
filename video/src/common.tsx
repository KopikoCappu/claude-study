import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TransitionPresentation, TransitionPresentationComponentProps } from '@remotion/transitions';
import { loadFont as loadCaveat } from '@remotion/google-fonts/Caveat';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';

export const hand = loadCaveat('normal', { weights: ['600', '700'], subsets: ['latin'] }).fontFamily;
export const sans = loadInter('normal', { weights: ['400', '500', '600', '700', '800', '900'], subsets: ['latin'] }).fontFamily;

export const FPS = 60;
export const sec = (s: number) => Math.round(s * FPS);

/** Brand colors, taken from app/src/lib/theme.ts and the app icon. */
export const B = {
  purple: '#5B3FE6',
  lilac: '#A996FF',
  ink: '#1C1C1E',
  night: '#0B0B10',
  bg: '#F4F4F2',
  paper: '#FFFEFB',
  muted: '#8E8E93',
  border: 'rgba(0,0,0,0.08)',
  focus: '#2F6FEB',
  red: '#E5484D',
  green: '#14A38B',
  blue: '#2F80ED',
  yellow: '#FFE27A',
  folder: ['#7B61FF', '#2F80ED', '#14A38B', '#F2994A', '#EB5757', '#E84393', '#F2C94C', '#56657F'],
};

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
};

/** Current scene time in seconds. */
/** Slows a whole video down: 1.3 means every animation takes 30% longer. */
export const PaceCtx = React.createContext(1);

export function useT() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pace = React.useContext(PaceCtx);
  return frame / fps / pace;
}

/** 0→1 between `start` and `start + dur` seconds. */
export function prog(t: number, start: number, dur: number, e: (x: number) => number = ease.inOut) {
  return interpolate(t, [start, start + dur], [0, 1], { ...clamp, easing: e });
}

/** Spring that starts at `start` seconds. */
export function springAt(t: number, start: number, config: Partial<{ damping: number; mass: number; stiffness: number }> = {}) {
  return spring({ frame: (t - start) * FPS, fps: FPS, config: { damping: 14, mass: 0.6, stiffness: 160, ...config } });
}

/** Render children only between two times. */
export const Show: React.FC<{ from?: number; to?: number; children: React.ReactNode }> = ({ from = -1, to = 1e9, children }) => {
  const t = useT();
  return t >= from && t < to ? <>{children}</> : null;
};

/** Text that "writes itself" left to right, like a pen stroke. */
export const Handwrite: React.FC<{ text: string; start: number; dur: number; style?: React.CSSProperties }> = ({
  text,
  start,
  dur,
  style,
}) => {
  const p = prog(useT(), start, dur, Easing.inOut(Easing.quad));
  return (
    <div
      style={{
        fontFamily: hand,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        display: 'inline-block',
        clipPath: `inset(-30% ${100 - p * 106}% -30% -5%)`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};

/** A line that slides up out of a mask (and optionally out the top). */
export const MaskUp: React.FC<{
  at: number;
  out?: number;
  dur?: number;
  style?: React.CSSProperties;
  wrap?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ at, out, dur = 0.55, style, wrap, children }) => {
  const t = useT();
  const i = prog(t, at, dur, ease.out);
  const o = out !== undefined ? prog(t, out, 0.35, ease.in) : 0;
  return (
    <div style={{ overflow: 'hidden', padding: '0.06em 0.1em 0.14em', margin: '-0.06em -0.1em -0.14em', ...wrap }}>
      <div style={{ transform: `translateY(${(1 - i) * 115 - o * 115}%)`, ...style }}>{children}</div>
    </div>
  );
};

/** Words punch in one by one: big + blurred → crisp. */
export const Slam: React.FC<{
  text: string;
  at: number;
  stagger?: number;
  out?: number;
  accent?: number[];
  accentColor?: string;
  style?: React.CSSProperties;
}> = ({ text, at, stagger = 0.07, out, accent = [], accentColor = B.lilac, style }) => {
  const t = useT();
  const o = out !== undefined ? prog(t, out, 0.25, ease.in) : 0;
  return (
    <div style={{ fontFamily: sans, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, ...style }}>
      {text.split(' ').map((w, i) => {
        const k = springAt(t, at + i * stagger, { damping: 12, mass: 0.5, stiffness: 200 });
        const kin = Math.min(1, k);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              marginRight: '0.24em',
              opacity: Math.min(1, k * 2) * (1 - o),
              transform: `translateY(${(1 - kin) * 0.25 - o * 0.2}em) scale(${1.5 - 0.5 * k + o * 0.15})`,
              filter: `blur(${Math.max(0, (1 - kin) * 14 + o * 18)}px)`,
              color: accent.includes(i) ? accentColor : undefined,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** Dark background with slowly drifting brand-color glows. */
export const Night: React.FC<{ children?: React.ReactNode; hue?: string }> = ({ children, hue = B.purple }) => {
  const t = useT();
  return (
    <AbsoluteFill style={{ background: B.night, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          width: 1300,
          height: 1300,
          left: 900 + Math.sin(t * 0.5) * 160,
          top: -500 + Math.cos(t * 0.4) * 120,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${hue}88, ${hue}00 65%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1100,
          height: 1100,
          left: -350 + Math.cos(t * 0.45) * 140,
          top: 380 + Math.sin(t * 0.35) * 120,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${B.blue}55, ${B.blue}00 65%)`,
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

/** The InkBuddy squid mark (same geometry as app/assets/logo-*.svg). */
export const Squid: React.FC<{ size: number; color: string; style?: React.CSSProperties; wiggle?: number }> = ({
  size,
  color,
  style,
  wiggle = 0,
}) => {
  const tentacles = [
    'M43.6 72 C38 76 30 78 27 85',
    'M45.2 72 C41 80 36 84 34 90',
    'M46.8 72 C45 82 40 88 41 93',
    'M48.4 72 C48 84 46 90 48 95',
    'M51.6 72 C52 84 54 90 52 95',
    'M53.2 72 C55 82 60 88 59 93',
    'M54.8 72 C59 80 64 84 66 90',
    'M56.4 72 C62 76 70 78 73 85',
  ];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={style}>
      <g transform="translate(52 48) rotate(24) scale(0.8) translate(-50 -52)">
        <path
          fill={color}
          fillRule="evenodd"
          d="M50 1 C55 5 65 11 74 17 C80 21 82 27 80 32 C77 29 70 27 63 30
    C66 37 67 44 66.5 51 C66 58 62 63 58.5 65 C59.5 68 59.5 71 58 74 L42 74 C40.5 71 40.5 68 41.5 65
    C38 63 34 58 33.5 51 C33 44 34 37 37 30 C30 27 23 29 20 32 C18 27 20 21 26 17 C35 11 45 5 50 1 Z
    M55.5 67.5 m-3.4 0 a3.4 3 0 1 0 6.8 0 a3.4 3 0 1 0 -6.8 0 Z"
        />
        <g fill="none" stroke={color} strokeLinecap="round">
          {tentacles.map((d, i) => (
            <path key={i} d={d} strokeWidth={3} transform={`rotate(${Math.sin(wiggle + i * 0.7) * 3} 50 72)`} />
          ))}
          <path d="M47 73 C44 84 32 84 28 91 C25 96 20 97 17 95" strokeWidth={1.6} transform={`rotate(${Math.sin(wiggle) * 4} 50 72)`} />
          <path d="M53 73 C56 84 68 84 72 91 C75 96 80 97 83 95" strokeWidth={1.6} transform={`rotate(${-Math.sin(wiggle) * 4} 50 72)`} />
        </g>
        <g transform={`rotate(${Math.sin(wiggle) * 4} 50 72)`}>
          <ellipse cx="16" cy="94.4" rx="3.4" ry="2" transform="rotate(30 16 94.4)" fill={color} />
        </g>
        <g transform={`rotate(${-Math.sin(wiggle) * 4} 50 72)`}>
          <ellipse cx="84" cy="94.4" rx="3.4" ry="2" transform="rotate(-30 84 94.4)" fill={color} />
        </g>
      </g>
    </svg>
  );
};

/** A hand-drawn looking loop (slightly more than one turn, with wobble). */
export function roughEllipse(cx: number, cy: number, rx: number, ry: number, seed = 1) {
  const pts: string[] = [];
  const turns = 1.12;
  const n = 80;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * turns * Math.PI * 2 - 2.6;
    const wob = 1 + 0.035 * Math.sin(i * 0.45 + seed) + (i / n) * 0.06;
    pts.push(`${(cx + Math.cos(a) * rx * wob).toFixed(1)} ${(cy + Math.sin(a) * ry * wob).toFixed(1)}`);
  }
  return 'M ' + pts.join(' L ');
}

/** Lined notebook paper. */
export const Paper: React.FC<{ lineGap?: number; margin?: number; style?: React.CSSProperties }> = ({ lineGap = 64, margin, style }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: `repeating-linear-gradient(to bottom, transparent 0, transparent ${lineGap - 2}px, rgba(47,128,237,0.13) ${lineGap - 2}px, rgba(47,128,237,0.13) ${lineGap}px), ${B.paper}`,
      ...style,
    }}
  >
    {margin !== undefined && <div style={{ position: 'absolute', top: 0, bottom: 0, left: margin, width: 2, background: 'rgba(229,72,77,0.35)' }} />}
  </div>
);

/* ---------- transition: zoom through with blur ---------- */

const ZoomBlurComp: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
}) => {
  const entering = presentationDirection === 'entering';
  const style: React.CSSProperties = entering
    ? { opacity: Math.min(1, p * 1.6), transform: `scale(${0.86 + 0.14 * p})`, filter: `blur(${(1 - p) * 24}px)` }
    : { opacity: 1 - p, transform: `scale(${1 + 0.3 * p})`, filter: `blur(${p * 24}px)` };
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

export const zoomBlur = (): TransitionPresentation<Record<string, never>> => ({ component: ZoomBlurComp, props: {} });

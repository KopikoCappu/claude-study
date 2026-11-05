import React from 'react';
import { roughEllipse, useT, prog, ease } from '../common';
import { CS } from './theme';
import { Ink, Stroke } from './ui';

/**
 * A real-looking page of notes: a hand-drawn cell with labels in different pens, a highlighted list, a plant-cell
 * sketch, side notes and doodles. Nothing points at the mitochondrion: the student just wants to ask about it.
 * Sheet coordinates: 1000 wide; everything that matters sits in the left ~900 so the Claude panel never covers it.
 */
export const PAGE_W = 1000;
export const PAGE_H = 1200;

const PEN = { ink: '#2A2926', blue: '#2F5FD0', green: '#2E8B57', red: '#C8463D', pencil: '#8C8A84', purple: '#7A4FB5' };
const HIGHLIGHT = 'rgba(255,214,0,0.42)';

/** The part the student asks about, in sheet coordinates. */
export const TARGET = { cx: 240, cy: 492 };
export const LASSO = roughEllipse(238, 494, 96, 56, 3);
/** Box around the lasso, for showing "just the selection" as a picture. */
export const LASSO_BOX = { x: 130, y: 428, w: 220, h: 132 };

/** Wobbly closed shape: an ellipse with a little hand jitter. */
function wobble(cx: number, cy: number, rx: number, ry: number, seed: number, n = 60) {
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = 1 + 0.025 * Math.sin(i * 0.9 + seed) + 0.015 * Math.sin(i * 2.3 + seed * 2);
    pts.push(`${(cx + Math.cos(a) * rx * w).toFixed(1)} ${(cy + Math.sin(a) * ry * w).toFixed(1)}`);
  }
  return 'M ' + pts.join(' L ') + ' Z';
}

const Arrow: React.FC<{ d: string; head: [number, number, number]; color: string; w?: number }> = ({ d, head: [x, y, a], color, w = 3 }) => (
  <g stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
    <path d={`M ${x} ${y} l ${Math.cos(a + 2.6) * 16} ${Math.sin(a + 2.6) * 16} M ${x} ${y} l ${Math.cos(a - 2.6) * 16} ${Math.sin(a - 2.6) * 16}`} />
  </g>
);

/** Static ink (already on the page). */
const S: React.FC<{ text: string; x: number; y: number; size: number; color?: string; rotate?: number }> = (p) => <Ink start={-10} dur={0.1} {...p} />;

export const MessyPage: React.FC<{
  /** Draw the student's lasso: starts at `lassoAt`, fades from `lassoOut`. */
  lassoAt?: number;
  lassoOut?: number;
  /** When Claude writes its label next to the part. */
  labelAt?: number;
  /** Highlight Claude's label (when the 3D view points back to it). */
  glowAt?: number;
  /** Pulse a ring around the part ("this one"). */
  pulseAt?: [number, number];
}> = ({ lassoAt, lassoOut = 1e9, labelAt, glowAt, pulseAt }) => {
  const t = useT();
  const lassoFade = 1 - prog(t, lassoOut, 0.4);
  const glow = glowAt === undefined ? 0 : prog(t, glowAt, 0.5, ease.out);
  const pulse = pulseAt && t > pulseAt[0] && t < pulseAt[1] ? 0.5 + 0.5 * Math.sin((t - pulseAt[0]) * 8) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        top: 36,
        width: PAGE_W,
        height: PAGE_H,
        background: `repeating-linear-gradient(to bottom, transparent 0, transparent 58px, ${CS.rule} 58px, ${CS.rule} 60px), ${CS.paper}`,
        boxShadow: '0 2px 14px rgba(60,40,20,0.08)',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {/* highlighter first, so ink sits on top */}
      <div style={{ position: 'absolute', left: 664, top: 120, width: 268, height: 40, background: HIGHLIGHT, borderRadius: 6, transform: 'rotate(-1deg)' }} />
      {glow > 0 && <div style={{ position: 'absolute', left: 28, top: 594, width: 300 * glow, height: 62, borderRadius: 10, background: 'rgba(217,119,87,0.25)' }} />}

      <S text="Unit 3 · Cells" x={56} y={38} size={66} />
      <svg width={PAGE_W} height={PAGE_H} style={{ position: 'absolute', left: 0, top: 0 }}>
        <path d="M 58 112 C 160 106 280 110 372 104" stroke={PEN.ink} strokeWidth={3} fill="none" strokeLinecap="round" />
        {/* TEST FRI box */}
        <path d="M 752 30 L 948 26 L 952 92 L 748 96 Z" stroke={PEN.red} strokeWidth={3.5} fill="none" strokeLinejoin="round" />

        {/* the cell */}
        <path d={wobble(392, 420, 250, 196, 1)} stroke={PEN.ink} strokeWidth={4.5} fill="none" />
        <path d={wobble(420, 396, 78, 70, 2)} stroke={PEN.ink} strokeWidth={4} fill="rgba(122,79,181,0.10)" />
        <circle cx={436} cy={404} r={16} fill={PEN.ink} opacity={0.85} />
        {/* ER: wavy lines hugging the nucleus */}
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M ${520 + i * 16} ${330 + i * 6} q 14 22 0 44 t 0 44 t 0 44`} stroke="#5E7FA8" strokeWidth={2.6} fill="none" />
        ))}
        {/* golgi */}
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M ${300 - i * 4} ${548 + i * 13} q 50 -18 100 0`} stroke={PEN.ink} strokeWidth={3} fill="none" strokeLinecap="round" />
        ))}
        {/* ribosomes */}
        {Array.from({ length: 26 }, (_, i) => {
          const a = i * 2.4;
          const r = 120 + ((i * 53) % 90);
          const x = 400 + Math.cos(a) * r * 1.1;
          const y = 420 + Math.sin(a) * r * 0.8;
          if (Math.hypot(x - TARGET.cx, y - TARGET.cy) < 70) return null;
          return <circle key={i} cx={x} cy={y} r={4.2} fill={PEN.green} />;
        })}
        {/* the mitochondrion (what the student asks about) */}
        <g transform={`translate(${TARGET.cx} ${TARGET.cy}) rotate(-18)`}>
          <path d={wobble(0, 0, 56, 26, 4, 40)} stroke={PEN.ink} strokeWidth={4} fill="rgba(217,119,87,0.12)" />
          <path d="M -40 0 q 7 -15 14 0 t 14 0 t 14 0 t 14 0 t 14 0" stroke={PEN.ink} strokeWidth={2.6} fill="none" strokeLinecap="round" />
        </g>
        {pulse > 0 && <ellipse cx={TARGET.cx} cy={TARGET.cy} rx={78 + pulse * 8} ry={44 + pulse * 6} fill="none" stroke={CS.clay} strokeWidth={4} opacity={0.3 + 0.5 * pulse} />}

        {/* labels and arrows in different pens */}
        <Arrow d="M 560 250 C 530 280 490 310 470 330" head={[470, 330, 2.2]} color={PEN.blue} />
        <Arrow d="M 700 470 C 660 470 620 462 596 452" head={[596, 452, 3.4]} color={PEN.green} />

        {/* plant cell sketch */}
        <path d="M 690 300 L 900 296 L 904 430 L 694 434 Z" stroke={PEN.green} strokeWidth={4} fill="none" strokeLinejoin="round" />
        <path d="M 702 310 L 890 307 L 893 420 L 705 423 Z" stroke={PEN.green} strokeWidth={2} fill="none" />
        {[
          [730, 340],
          [860, 330],
          [740, 400],
          [870, 400],
        ].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx={18} ry={10} fill="rgba(46,139,87,0.5)" transform={`rotate(${i * 30} ${x} ${y})`} />
        ))}
        <path d={wobble(800, 366, 50, 34, 6)} stroke={PEN.blue} strokeWidth={2.5} fill="rgba(47,95,208,0.08)" />

        {/* doodles */}
        <path d="M 900 690 l 8 18 l 20 2 l -15 13 l 5 20 l -18 -10 l -18 10 l 5 -20 l -15 -13 l 20 -2 Z" stroke={PEN.purple} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
        <path d="M 660 640 C 700 630 760 650 820 636" stroke={PEN.pencil} strokeWidth={2} fill="none" strokeDasharray="6 6" />

        {lassoAt !== undefined && (
          <g opacity={lassoFade}>
            <Stroke d={LASSO} start={lassoAt} dur={0.8} color={CS.lasso} width={4} dash="12 10" />
          </g>
        )}
        {labelAt !== undefined && (
          <>
            <Stroke d="M 120 590 C 150 570 170 548 186 528" start={labelAt} dur={0.3} color={CS.primary} width={4} />
          </>
        )}
      </svg>

      <S text="TEST FRI!!" x={772} y={36} size={52} color={PEN.red} rotate={-2} />
      <S text="nucleus" x={556} y={196} size={46} color={PEN.blue} />
      <S text="ribosomes" x={706} y={444} size={42} color={PEN.green} />
      <S text="golgi" x={410} y={566} size={36} color={PEN.ink} />
      <S text="cytoplasm" x={250} y={290} size={32} color={PEN.pencil} />

      <S text="Plant vs animal" x={670} y={120} size={40} />
      <S text="• plant = cell wall" x={676} y={172} size={32} color={PEN.ink} />
      <S text="• chloroplasts (green!)" x={676} y={214} size={32} color={PEN.green} />
      <S text="• 1 big vacuole" x={676} y={256} size={32} color={PEN.blue} />
      <S text="osmosis → water moves" x={660} y={560} size={30} color={PEN.pencil} />
      <S text="to the saltier side" x={690} y={596} size={30} color={PEN.pencil} />
      <S text="ask Ms. K" x={720} y={690} size={40} color={PEN.purple} rotate={-3} />
      <S text="ER" x={570} y={480} size={34} color="#5E7FA8" />

      {labelAt !== undefined && <Ink text="mitochondrion!" x={36} y={600} start={labelAt + 0.25} dur={0.9} size={52} color={CS.primary} rotate={-2} />}
    </div>
  );
};

/** Just one region of the page, as a picture (a screenshot crop or the lasso selection). */
export const PageCrop: React.FC<{ x: number; y: number; w: number; h: number; scale: number; style?: React.CSSProperties; labeled?: boolean }> = ({ x, y, w, h, scale, style, labeled }) => (
  <div style={{ width: w * scale, height: h * scale, overflow: 'hidden', position: 'relative', borderRadius: 10, background: CS.paper, ...style }}>
    <div style={{ position: 'absolute', left: (-x - 60) * scale, top: (-y - 36) * scale, width: PAGE_W + 60, height: PAGE_H + 36, transformOrigin: '0 0', transform: `scale(${scale})` }}>
      <MessyPage labelAt={labeled ? -10 : undefined} />
    </div>
  </div>
);

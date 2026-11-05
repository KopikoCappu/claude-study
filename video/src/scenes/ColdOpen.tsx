import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { B, MaskUp, Night, Paper, Show, Slam, clamp, ease, hand, prog, sans, springAt, useT } from '../common';

export const COLD_OPEN_S = 8.6;

/** A little photo of handwritten notes (what people screenshot today). */
const NoteCard: React.FC<{ w: number; h: number; style?: React.CSSProperties; seed?: number }> = ({ w, h, style, seed = 0 }) => {
  const lines = [
    ['3(x + 2) = 15', '3x + 2 = 15', '3x = 13'],
    ['∫ 2x dx = x² + C', 'd/dx sin x = cos x', 'u = x², du = 2x'],
    ['F = ma', 'a = 9.8 m/s²', 'F = 4.9 N'],
    ['ATP → ADP + P', 'glycolysis: 2 ATP', 'Krebs → NADH'],
  ][seed % 4];
  return (
    <div
      style={{
        position: 'absolute',
        width: w,
        height: h,
        borderRadius: w * 0.03,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        ...style,
      }}
    >
      <Paper lineGap={h / 5} margin={w * 0.09} />
      <div style={{ position: 'absolute', left: w * 0.14, top: h * 0.13, fontFamily: hand, fontWeight: 600, fontSize: h * 0.15, color: B.ink, lineHeight: `${h / 5}px` }}>
        {lines.map((l) => (
          <div key={l} style={{ whiteSpace: 'nowrap' }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
};

/** The four corner brackets of a screenshot / crop box. */
const Brackets: React.FC<{ x: number; y: number; w: number; h: number; color?: string; opacity?: number }> = ({
  x,
  y,
  w,
  h,
  color = 'white',
  opacity = 1,
}) => {
  const L = 46;
  const s = { position: 'absolute' as const, width: L, height: L, borderColor: color, borderStyle: 'solid', opacity };
  return (
    <>
      <div style={{ ...s, left: x, top: y, borderWidth: '7px 0 0 7px' }} />
      <div style={{ ...s, left: x + w - L, top: y, borderWidth: '7px 7px 0 0' }} />
      <div style={{ ...s, left: x, top: y + h - L, borderWidth: '0 0 7px 7px' }} />
      <div style={{ ...s, left: x + w - L, top: y + h - L, borderWidth: '0 7px 7px 0' }} />
    </>
  );
};

const PILE = Array.from({ length: 18 }, (_, i) => {
  const r = (n: number) => {
    const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  return {
    fromX: (r(1) - 0.5) * 3600,
    fromY: (r(2) - 0.5) * 2200,
    x: 1160 + (r(3) - 0.5) * 520,
    y: 540 + (r(4) - 0.5) * 380,
    rot: (r(5) - 0.5) * 40,
    at: 4.0 + i * 0.055,
  };
});

export const ColdOpen: React.FC = () => {
  const t = useT();

  // the "ritual" card
  const cardIn = springAt(t, 1.15, { damping: 15 });
  const flash = interpolate(t, [1.55, 1.6, 1.9], [0, 0.95, 0], clamp);
  const shotBump = interpolate(t, [1.55, 1.62, 1.8], [1, 0.95, 1], clamp);
  const crop = prog(t, 2.2, 0.45, ease.out);
  const paste = prog(t, 3.0, 0.55, ease.inOut);
  const barIn = prog(t, 2.85, 0.4, ease.out);
  const barOut = prog(t, 3.75, 0.3, ease.in);

  // card geometry (center 1180, 520) → shrinks into chat bar thumbnail
  const cw = 760;
  const ch = 500;
  const cx = interpolate(paste, [0, 1], [1380, 760]);
  const cy = interpolate(paste, [0, 1], [500, 905]);
  const cs = interpolate(paste, [0, 1], [1, 0.13]) * shotBump * (0.6 + 0.4 * cardIn);
  // crop box (in card coordinates)
  const box = {
    x: interpolate(crop, [0, 1], [0, 80]),
    y: interpolate(crop, [0, 1], [0, 40]),
    w: interpolate(crop, [0, 1], [cw, 560]),
    h: interpolate(crop, [0, 1], [ch, 340]),
  };

  // counter + blur-out for the pile
  const count = Math.round(interpolate(t, [4.0, 5.1], [0, 47], clamp));
  const dim = prog(t, 5.2, 0.4, ease.out);
  const pileOut = prog(t, 6.55, 0.3, ease.in);

  return (
    <Night>
      {/* 1 — the question */}
      <Show to={1.4}>
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Slam text="Studying with Claude?" at={0.05} stagger={0.09} out={1.1} accent={[2]} style={{ fontSize: 150, color: 'white' }} />
        </AbsoluteFill>
      </Show>

      {/* 2 — screenshot, crop, paste */}
      <Show from={1.1} to={4.2}>
        <div style={{ position: 'absolute', left: 140, top: 400, fontFamily: sans, fontWeight: 900, fontSize: 150, letterSpacing: '-0.05em', color: 'white' }}>
          <MaskUp at={1.25} out={2.05}>Screenshot.</MaskUp>
        </div>
        <div style={{ position: 'absolute', left: 140, top: 400, fontFamily: sans, fontWeight: 900, fontSize: 150, letterSpacing: '-0.05em', color: 'white' }}>
          <MaskUp at={2.1} out={2.85}>Crop.</MaskUp>
        </div>
        <div style={{ position: 'absolute', left: 140, top: 250, fontFamily: sans, fontWeight: 900, fontSize: 150, letterSpacing: '-0.05em', color: 'white' }}>
          <MaskUp at={2.9} out={3.75}>Paste.</MaskUp>
        </div>

        {/* chat input bar */}
        <div
          style={{
            position: 'absolute',
            left: 660,
            top: 850,
            width: 1000,
            height: 110,
            borderRadius: 30,
            background: '#1E1E26',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 200,
            boxSizing: 'border-box',
            fontFamily: sans,
            fontSize: 34,
            color: 'rgba(255,255,255,0.45)',
            opacity: barIn * (1 - barOut),
            transform: `translateY(${(1 - barIn) * 80 + barOut * 80}px)`,
          }}
        >
          “what did I do wrong here??”
        </div>

        <div
          style={{
            position: 'absolute',
            left: cx - cw / 2,
            top: cy - ch / 2,
            width: cw,
            height: ch,
            transform: `scale(${cs}) rotate(${(1 - cardIn) * 8 - 3 * (1 - paste)}deg)`,
            opacity: Math.min(1, cardIn * 2) * (1 - barOut),
          }}
        >
          <NoteCard w={cw} h={ch} />
          {/* outside-the-crop dimming */}
          <div
            style={{
              position: 'absolute',
              left: box.x,
              top: box.y,
              width: box.w,
              height: box.h,
              boxShadow: `0 0 0 2000px rgba(0,0,0,${0.55 * crop * (1 - paste)})`,
              borderRadius: 4,
            }}
          />
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 22 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'white', opacity: flash }} />
          </div>
          <Brackets x={box.x - 18} y={box.y - 18} w={box.w + 36} h={box.h + 36} opacity={t > 1.5 ? 1 - paste : 0} />
        </div>
      </Show>

      {/* 3 — repeat */}
      <Show from={3.8} to={7.0}>
        <div style={{ position: 'absolute', left: 140, top: 400, fontFamily: sans, fontWeight: 900, fontSize: 150, letterSpacing: '-0.05em', color: 'white', opacity: 1 - dim }}>
          <MaskUp at={3.85}>Repeat.</MaskUp>
        </div>
        {PILE.map((c, i) => {
          const k = springAt(t, c.at, { damping: 16, stiffness: 140 });
          const x = interpolate(k, [0, 1], [c.x + c.fromX, c.x]);
          const y = interpolate(k, [0, 1], [c.y + c.fromY, c.y]);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: x - 220,
                top: y - 145,
                width: 440,
                height: 290,
                transform: `rotate(${c.rot * k + (1 - k) * 60}deg) scale(${1 + dim * 0.15 + pileOut * 0.4})`,
                opacity: (t >= c.at ? 1 : 0) * (1 - pileOut),
                filter: `blur(${dim * 10}px) brightness(${1 - dim * 0.55})`,
              }}
            >
              <NoteCard w={440} h={290} seed={i} />
            </div>
          );
        })}
        <div
          style={{
            position: 'absolute',
            right: 120,
            top: 90,
            fontFamily: sans,
            fontWeight: 700,
            fontSize: 30,
            color: 'rgba(255,255,255,0.6)',
            textAlign: 'right',
            opacity: prog(t, 4.0, 0.2) * (1 - dim),
          }}
        >
          screenshots today
          <div style={{ fontSize: 96, fontWeight: 900, color: B.red, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em' }}>{count}</div>
        </div>
      </Show>

      {/* 4 — every single time */}
      <Show from={5.2} to={6.9}>
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Slam text="Every. Single. Time." at={5.3} stagger={0.22} out={6.55} style={{ fontSize: 170, color: 'white' }} accent={[2]} accentColor={B.red} />
        </AbsoluteFill>
      </Show>

      {/* 5 — the turn */}
      <Show from={6.75}>
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: sans, fontWeight: 900, fontSize: 130, letterSpacing: '-0.045em', color: 'white', textAlign: 'center' }}>
          <MaskUp at={6.8} out={8.25}>What if your notes</MaskUp>
          <MaskUp at={6.95} out={8.3}>
            could just{' '}
            <span style={{ fontFamily: hand, fontWeight: 700, fontSize: 170, letterSpacing: 0, color: B.yellow }}>answer back?</span>
          </MaskUp>
        </AbsoluteFill>
      </Show>
    </Night>
  );
};

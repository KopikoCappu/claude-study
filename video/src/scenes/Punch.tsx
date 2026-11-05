import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { B, MaskUp, Night, Paper, Slam, clamp, ease, hand, prog, roughEllipse, sans, springAt, useT } from '../common';

/* ---------------- No screenshots ---------------- */

export const NO_MORE_S = 4.0;

export const NoMore: React.FC = () => {
  const t = useT();
  const rows = [
    { text: 'No screenshots.', at: 0.05, strike: 0.45 },
    { text: 'No copy-paste.', at: 0.3, strike: 0.7 },
    { text: 'No blurry crops.', at: 0.55, strike: 0.95 },
  ];
  return (
    <Night>
      <div style={{ position: 'absolute', left: 170, top: 150 }}>
        {rows.map((r) => {
          const s = prog(t, r.strike, 0.3, ease.out);
          return (
            <div key={r.text} style={{ position: 'relative', height: 150, width: 'fit-content' }}>
              <MaskUp at={r.at}>
                <div
                  style={{
                    fontFamily: sans,
                    fontWeight: 900,
                    fontSize: 128,
                    letterSpacing: '-0.05em',
                    color: `rgba(255,255,255,${1 - 0.6 * s})`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.text}
                </div>
              </MaskUp>
              <div
                style={{
                  position: 'absolute',
                  left: -14,
                  top: 74,
                  height: 12,
                  width: `${s * 104}%`,
                  borderRadius: 6,
                  background: B.red,
                  transform: 'rotate(-1.5deg)',
                }}
              />
            </div>
          );
        })}
        <div style={{ marginTop: 40 }}>
          <Slam text="Just lasso and ask." at={1.45} stagger={0.1} accent={[1, 3]} accentColor={B.lilac} style={{ fontSize: 150, color: 'white' }} />
        </div>
      </div>
    </Night>
  );
};

/* ---------------- Everywhere ---------------- */

export const EVERYWHERE_S = 5.6;

const MiniPage: React.FC<{ w: number; h: number; circleAt: number }> = ({ w, h, circleAt }) => {
  const t = useT();
  const fs = Math.min(h * 0.15, w * 0.14);
  const gap = fs * 1.5;
  const left = w * 0.13;
  const top = gap * 0.5;
  const c = prog(t, circleAt, 0.45);
  const path = roughEllipse(left + fs * 2.4, top + gap * 1.5, fs * 3.2, fs * 0.62, 3);
  const evo = evolvePath(c, path);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <Paper lineGap={gap} margin={w * 0.07} />
      <div style={{ position: 'absolute', left, top, fontFamily: hand, fontWeight: 600, fontSize: fs, lineHeight: `${gap}px`, color: B.ink, whiteSpace: 'nowrap' }}>
        <div>3(x + 2) = 15</div>
        <div>3x + 2 = 15</div>
        <div style={{ color: B.blue }}>3x + 6 = 15</div>
      </div>
      <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
        <path d={path} fill="none" stroke={B.red} strokeWidth={Math.max(3, fs * 0.07)} strokeLinecap="round" {...evo} />
      </svg>
    </div>
  );
};

export const Everywhere: React.FC = () => {
  const t = useT();
  const tab = springAt(t, 0.15, { damping: 16 });
  const lap = springAt(t, 0.45, { damping: 16 });
  const pho = springAt(t, 0.7, { damping: 16 });
  const bob = (o: number) => Math.sin(t * 2 + o) * 6;
  const pulse = prog(t, 1.85, 0.5, ease.inOut);

  return (
    <AbsoluteFill style={{ background: B.bg, overflow: 'hidden' }}>
      {/* headline */}
      <div style={{ position: 'absolute', top: 70, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Slam text="Tablet. Web. Android." at={0.05} stagger={0.28} accent={[1]} accentColor={B.purple} style={{ fontSize: 120, color: B.ink }} />
      </div>

      {/* laptop / browser (left) */}
      <div
        style={{
          position: 'absolute',
          left: 110,
          top: 360,
          width: 640,
          height: 430,
          transform: `translateX(${(1 - lap) * -900}px) translateY(${bob(1)}px) rotate(${(1 - lap) * -10}deg)`,
          borderRadius: 18,
          background: 'white',
          boxShadow: '0 30px 70px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}
      >
        <div style={{ height: 50, background: '#EDEDF0', display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px' }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
            <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
          ))}
          <div style={{ marginLeft: 16, flex: 1, height: 30, borderRadius: 8, background: 'white', fontFamily: sans, fontSize: 18, color: B.muted, display: 'flex', alignItems: 'center', paddingLeft: 14 }}>
            inkbuddy.vercel.app
          </div>
        </div>
        <div style={{ position: 'absolute', top: 50, left: 0, right: 0, bottom: 0 }}>
          <MiniPage w={640} h={380} circleAt={2.35} />
        </div>
      </div>

      {/* tablet (center) */}
      <div
        style={{
          position: 'absolute',
          left: 620,
          top: 290,
          width: 680,
          height: 520,
          transform: `translateY(${(1 - tab) * 900 + bob(0)}px)`,
          borderRadius: 36,
          background: B.ink,
          padding: 16,
          boxSizing: 'border-box',
          boxShadow: '0 40px 90px rgba(0,0,0,0.25)',
          zIndex: 2,
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 22, overflow: 'hidden' }}>
          <MiniPage w={648} h={488} circleAt={1.35} />
        </div>
      </div>

      {/* phone (right) */}
      <div
        style={{
          position: 'absolute',
          left: 1420,
          top: 300,
          width: 290,
          height: 560,
          transform: `translateX(${(1 - pho) * 900}px) translateY(${bob(2)}px) rotate(${(1 - pho) * 12}deg)`,
          borderRadius: 44,
          background: B.ink,
          padding: 12,
          boxSizing: 'border-box',
          boxShadow: '0 30px 70px rgba(0,0,0,0.22)',
          zIndex: 3,
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 34, overflow: 'hidden' }}>
          <MiniPage w={266} h={536} circleAt={2.35} />
        </div>
      </div>

      {/* sync pulses from tablet to the others */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none' }}>
        {[
          'M 960 300 C 820 180, 600 220, 450 360',
          'M 960 300 C 1150 170, 1450 200, 1560 300',
        ].map((d, i) => {
          const draw = evolvePath(prog(t, 1.75, 0.5), d);
          const fade = 1 - prog(t, 2.6, 0.4);
          return (
            <g key={i} opacity={fade}>
              <path d={d} fill="none" stroke={B.purple} strokeWidth={4} strokeDasharray="2 14" strokeLinecap="round" opacity={0.5} />
              <path d={d} fill="none" stroke={B.purple} strokeWidth={5} strokeLinecap="round" {...draw} />
            </g>
          );
        })}
        {pulse > 0 && pulse < 1 && (
          <>
            <circle cx={interpolate(pulse, [0, 1], [960, 450])} cy={interpolate(pulse, [0, 0.5, 1], [300, 225, 360])} r={12} fill={B.purple} />
            <circle cx={interpolate(pulse, [0, 1], [960, 1560])} cy={interpolate(pulse, [0, 0.5, 1], [300, 215, 300])} r={12} fill={B.purple} />
          </>
        )}
      </svg>

      {/* caption */}
      <div style={{ position: 'absolute', bottom: 80, width: '100%', display: 'flex', justifyContent: 'center', fontFamily: sans, fontWeight: 800, fontSize: 64, letterSpacing: '-0.035em', color: B.ink, gap: 22 }}>
        <MaskUp at={2.6}>One notebook.</MaskUp>
        <MaskUp at={2.8}>
          <span style={{ color: B.purple }}>Synced everywhere.</span>
        </MaskUp>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- Rapid-fire features ---------------- */

const FLASHES: [string, string][] = [
  ['Infinite canvas.', B.ink],
  ['Real pen pressure.', B.folder[1]],
  ['LaTeX that renders.', B.folder[2]],
  ['Lasso anything.', B.folder[3]],
  ['Move. Resize. Recolor.', B.folder[5]],
  ['Stacked pages.', B.folder[7]],
  ['11 kinds of AI ink.', B.folder[4]],
  ['Powered by Claude.', B.purple],
];
const FLASH_S = 0.58;
export const RAPID_S = FLASHES.length * FLASH_S + 0.25;

export const Rapid: React.FC = () => {
  const t = useT();
  const i = Math.min(FLASHES.length - 1, Math.floor(t / FLASH_S));
  const local = t - i * FLASH_S;
  const [text, bg] = FLASHES[i];
  const k = springAt(local, 0, { damping: 13, mass: 0.45, stiffness: 220 });
  const drift = 1 + local * 0.05;
  return (
    <AbsoluteFill style={{ background: bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {/* big ghost index */}
      <div
        style={{
          position: 'absolute',
          right: 60,
          bottom: -80,
          fontFamily: sans,
          fontWeight: 900,
          fontSize: 520,
          color: 'rgba(255,255,255,0.08)',
          letterSpacing: '-0.06em',
          transform: `translateY(${(1 - Math.min(1, k)) * 120}px)`,
        }}
      >
        0{i + 1}
      </div>
      <div
        style={{
          fontFamily: sans,
          fontWeight: 900,
          fontSize: 150,
          color: 'white',
          letterSpacing: '-0.05em',
          whiteSpace: 'nowrap',
          transform: `scale(${(1.35 - 0.35 * k) * drift})`,
          filter: `blur(${Math.max(0, (1 - Math.min(1, k)) * 16)}px)`,
          opacity: interpolate(k, [0, 0.4], [0, 1], clamp),
        }}
      >
        {text}
      </div>
      <div style={{ position: 'absolute', left: 80, top: 70, fontFamily: sans, fontWeight: 700, fontSize: 28, letterSpacing: 6, color: 'rgba(255,255,255,0.7)' }}>
        INKBUDDY
      </div>
    </AbsoluteFill>
  );
};

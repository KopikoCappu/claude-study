import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { B, MaskUp, Night, Slam, clamp, ease, hand, prog, sans, springAt, useT } from '../common';

/* ---------------- How it works ---------------- */

export const HOW_S = 5.6;

const NODES = [
  { title: 'Ink is vectors', sub: 'Every stroke is [x, y, pressure] from the S Pen', color: B.folder[1] },
  { title: 'Crisp 4× render', sub: 'Lassoed strokes redrawn sharp, no blurry screenshots', color: B.folder[2] },
  { title: 'Claude Opus 5.5', sub: 'Structured output: a reply + exact boxes on the page', color: B.purple },
  { title: 'AI ink', sub: 'Circles, checks, notes and LaTeX drawn back in place', color: B.folder[4] },
];

const JSON_LINES: [string, string][] = [
  ['{', '#E6E6EA'],
  ['  "reply": "Step 2 is the slip…",', '#E6E6EA'],
  ['  "annotations": [', '#E6E6EA'],
  ['    { "kind": "circle", "box": [212, 80, 340, 610], "color": "red" },', '#FF8A8D'],
  ['    { "kind": "note", "text": "3 × 2 = 6, not 2!", "place": "right" },', '#FF8A8D'],
  ['    { "kind": "check", "box": [40, 520, 150, 600], "color": "green" }', '#5EE0C4'],
  ['  ]', '#E6E6EA'],
  ['}', '#E6E6EA'],
];

export const HowItWorks: React.FC = () => {
  const t = useT();
  const nodeW = 380;
  const gap = 40;
  const left = 140;
  const top = 290;
  return (
    <AbsoluteFill style={{ background: B.bg }}>
      <div style={{ position: 'absolute', top: 80, left: 140 }}>
        <MaskUp at={0}>
          <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 26, letterSpacing: 6, color: B.purple }}>HOW IT WORKS</div>
        </MaskUp>
        <div style={{ marginTop: 10 }}>
          <Slam text="Pen stroke → AI ink." at={0.08} stagger={0.07} style={{ fontSize: 96, color: B.ink }} accent={[3]} accentColor={B.purple} />
        </div>
      </div>

      {NODES.map((n, i) => {
        const s = springAt(t, 0.35 + i * 0.16, { damping: 14 });
        const bar = prog(t, 0.45 + i * 0.16, 0.4, ease.out);
        return (
          <div
            key={n.title}
            style={{
              position: 'absolute',
              left: left + i * (nodeW + gap),
              top,
              width: nodeW,
              height: 290,
              background: 'white',
              borderRadius: 24,
              boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 14px 40px rgba(0,0,0,0.08)',
              padding: 30,
              boxSizing: 'border-box',
              opacity: Math.min(1, s * 2),
              transform: `translateY(${(1 - s) * 80}px) rotate(${(1 - s) * 4}deg)`,
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', left: 0, top: 0, height: 8, width: `${bar * 100}%`, background: n.color }} />
            <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 22, color: n.color, letterSpacing: 2 }}>0{i + 1}</div>
            <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 40, color: B.ink, marginTop: 10, letterSpacing: '-0.03em' }}>{n.title}</div>
            <div style={{ fontFamily: sans, fontSize: 25, color: '#55555A', marginTop: 12, lineHeight: 1.35 }}>{n.sub}</div>
          </div>
        );
      })}

      {/* the contract */}
      {(() => {
        const s = springAt(t, 1.2, { damping: 18 });
        return (
          <div
            style={{
              position: 'absolute',
              left,
              top: 630,
              width: 1640,
              background: '#16161C',
              borderRadius: 22,
              padding: '26px 36px',
              boxSizing: 'border-box',
              fontFamily: 'Consolas, Menlo, monospace',
              fontSize: 26,
              lineHeight: 1.5,
              whiteSpace: 'pre',
              opacity: s,
              transform: `translateY(${(1 - s) * 60}px)`,
            }}
          >
            {JSON_LINES.map(([line, c], i) => {
              const shown = interpolate(t, [1.4 + i * 0.13, 1.6 + i * 0.13], [0, line.length], clamp);
              return (
                <div key={i} style={{ color: c, minHeight: 39 }}>
                  {line.slice(0, Math.floor(shown))}
                </div>
              );
            })}
            <div style={{ position: 'absolute', right: 40, top: 30 }}>
              <MaskUp at={2.7}>
                <div style={{ fontFamily: hand, fontWeight: 700, fontSize: 50, color: B.lilac, transform: 'rotate(-3deg)' }}>mapped back onto your page ↵</div>
              </MaskUp>
            </div>
          </div>
        );
      })()}
    </AbsoluteFill>
  );
};

/* ---------------- Built at SwampHacks ---------------- */

export const BUILT_S = 3.8;

const STATS = [
  { n: 2, label: 'days' },
  { n: 32, label: 'commits' },
  { n: 11, label: 'kinds of AI ink' },
];
const STACK = ['Expo SDK 58', 'React Native Skia', 'Claude Opus 5.5', 'Supabase', 'Vercel', 'EAS Build'];

export const Built: React.FC = () => {
  const t = useT();
  return (
    <Night>
      <AbsoluteFill style={{ alignItems: 'center' }}>
        <div style={{ marginTop: 130 }}>
          <Slam text="Built at SwampHacks." at={0} stagger={0.08} accent={[2]} style={{ fontSize: 96, color: 'white' }} />
        </div>
        <div style={{ display: 'flex', gap: 150, marginTop: 80 }}>
          {STATS.map((s, i) => {
            const p = prog(t, 0.25 + i * 0.12, 0.8, ease.out);
            const k = springAt(t, 0.25 + i * 0.12, { damping: 12 });
            return (
              <div key={s.label} style={{ textAlign: 'center', transform: `scale(${k})` }}>
                <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 190, color: 'white', lineHeight: 1, letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(s.n * p)}
                </div>
                <div style={{ fontFamily: sans, fontSize: 34, color: 'rgba(255,255,255,0.65)', marginTop: 12, fontWeight: 600 }}>{s.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 18, marginTop: 100 }}>
          {STACK.map((name, i) => {
            const sp = springAt(t, 0.9 + i * 0.07, { damping: 12 });
            const hi = name.startsWith('Claude');
            return (
              <div
                key={name}
                style={{
                  fontFamily: sans,
                  fontWeight: 700,
                  fontSize: 30,
                  color: 'white',
                  border: `2px solid ${hi ? B.purple : 'rgba(255,255,255,0.25)'}`,
                  background: hi ? B.purple : 'rgba(255,255,255,0.04)',
                  padding: '14px 28px',
                  borderRadius: 999,
                  whiteSpace: 'nowrap',
                  transform: `translateY(${(1 - Math.min(1, sp)) * 40}px) scale(${sp})`,
                }}
              >
                {name}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Night>
  );
};

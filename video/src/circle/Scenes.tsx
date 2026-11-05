import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { evolvePath, getLength, getPointAtLength } from '@remotion/paths';
import { B, Handwrite, MaskUp, Night, Slam, Squid, clamp, ease, hand, prog, roughEllipse, sans, springAt, useT } from '../common';
import { Hero, PW, SPRITES, cloudX, idx } from './Hero';
import { AppFrame, Captions, Dots, PAGE_X, PAGE_Y, PANEL_W, PressButton, mono, typed, type Cam } from './ui';

const C3 = idx('c3.webp');

/** Pen-stroke reveal; hidden until it starts so round caps don't leave a dot. */
const draw = (p: number, d: string) => ({ ...evolvePath(p, d), opacity: p > 0 ? 1 : 0 });

/* ===================================================================== */
/* 1. The problem: words are bad at pointing                              */
/* ===================================================================== */

export const PROBLEM_S = 8.6;


const Bubble: React.FC<{ me?: boolean; at: number; children: React.ReactNode }> = ({ me, at, children }) => {
  const t = useT();
  const k = springAt(t, at, { damping: 16 });
  if (t < at) return null;
  return (
    <div
      style={{
        alignSelf: me ? 'flex-end' : 'flex-start',
        maxWidth: me ? 420 : 470,
        background: me ? B.ink : 'transparent',
        color: me ? 'white' : B.ink,
        padding: me ? '14px 20px' : '4px 2px',
        borderRadius: 20,
        fontSize: 25,
        lineHeight: 1.4,
        fontWeight: me ? 500 : 400,
        opacity: Math.min(1, k * 1.5),
        transform: `translateY(${(1 - Math.min(1, k)) * 16}px)`,
      }}
    >
      {children}
    </div>
  );
};

export const Problem: React.FC = () => {
  const t = useT();
  const W = 1120;
  const k = W / PW;
  const enter = springAt(t, 0, { damping: 20 });

  const U1 = 'Remove the cloud on the left.';
  const C1 = 'Happy to. Which one, though? There are a lot of clouds on the left side.';
  const U2 = 'uh… the puffy one? kind of near the top?';
  const C2 = 'A few of them are puffy and near the top. I still can’t tell which one you mean.';

  return (
    <Night>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${(1 - enter) * 80}px)`, opacity: Math.min(1, enter * 1.4) }}>
        {/* browser window with the portfolio */}
        <div style={{ position: 'absolute', left: 70, top: 120, width: W, borderRadius: 18, overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.5)', background: '#1d1d22' }}>
          <div style={{ height: 46, display: 'flex', alignItems: 'center', gap: 9, padding: '0 18px' }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
              <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
            ))}
            <div style={{ marginLeft: 22, flex: 1, maxWidth: 520, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)', fontFamily: sans, fontSize: 15, display: 'flex', alignItems: 'center', padding: '0 14px' }}>
              localhost:5173 · my portfolio
            </div>
          </div>
          <Hero width={W} t={t}>
            {(() => {
              // One loose region over the whole left sky: "it's somewhere in here", not a numbered pick list.
              const R = { x: 40, y: 170, w: 700, h: 300 };
              const p = springAt(t, 3.4, { damping: 14 });
              const sw = 3 / k;
              return (
                <div style={{ position: 'absolute', left: R.x, top: R.y, width: R.w, height: R.h, opacity: Math.min(1, p), transform: `scale(${0.92 + 0.08 * Math.min(1, p)})` }}>
                  <svg width={R.w} height={R.h} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
                    <rect x={0} y={0} width={R.w} height={R.h} rx={22 / k} fill="rgba(255,226,122,0.08)" stroke={B.yellow} strokeWidth={sw} strokeDasharray={`${12 / k} ${9 / k}`} strokeDashoffset={-t * 40} />
                  </svg>
                  <div style={{ position: 'absolute', left: 0, top: -54 / k, background: B.yellow, color: B.ink, fontFamily: hand, fontWeight: 700, fontSize: 30 / k, lineHeight: 1, padding: `${6 / k}px ${16 / k}px`, borderRadius: 999 }}>
                    which one??
                  </div>
                </div>
              );
            })()}
          </Hero>
        </div>

        {/* plain chat */}
        <div
          style={{
            position: 'absolute',
            left: 1230,
            top: 120,
            width: 620,
            height: 676,
            borderRadius: 18,
            background: 'white',
            boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
            padding: 30,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            fontFamily: sans,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 22, color: B.muted, letterSpacing: '0.02em' }}>Chat</div>
          <Bubble me at={0.5}>
            {typed(U1, t, 0.5, 1.7)}
          </Bubble>
          {t >= 1.9 && t < 2.4 && <Dots t={t} />}
          <Bubble at={2.4}>{typed(C1, t, 2.4, 3.4)}</Bubble>
          <Bubble me at={4.4}>
            {typed(U2, t, 4.4, 5.4)}
          </Bubble>
          {t >= 5.5 && t < 5.9 && <Dots t={t} />}
          <Bubble at={5.9}>{typed(C2, t, 5.9, 6.7)}</Bubble>
        </div>
      </div>
      <Captions items={[[6.9, 99, <>Words are bad at <span style={{ color: B.yellow }}>pointing.</span></>]]} />
    </Night>
  );
};

/* ===================================================================== */
/* 2. Circle it                                                          */
/* ===================================================================== */

export const CIRCLE_S = 9.8;

const HW = 1180; // hero width on the page
const HK = HW / PW;
const HERO_X = 34; // page coords
const HERO_Y = 52;

// lasso around c3, relative to the cloud's center (photo px)
const LASSO = 'M -6 -84 C 78 -88, 134 -44, 128 6 C 122 62, 56 88, -14 84 C -88 80, -132 42, -126 -4 C -118 -58, -66 -82, 8 -86';
const AI_LOOP = roughEllipse(0, 0, 112, 76, 3);
const CHECK = 'M 150 -60 L 172 -36 L 214 -92';
const ARROW = 'M 300 150 C 290 175, 270 190, 245 205 M 245 205 L 262 204 M 245 205 L 252 190';

export const CircleIt: React.FC = () => {
  const t = useT();
  const cx = cloudX(C3, t) + SPRITES[C3].w / 2;
  const cy = SPRITES[C3].y + SPRITES[C3].h / 2;

  const lasso = prog(t, 0.45, 0.8);
  const lassoFill = prog(t, 1.25, 0.15);
  const lassoGone = prog(t, 3.0, 0.25);
  const arrow = prog(t, 2.25, 0.25);
  const aiLoop = prog(t, 4.3, 0.5);
  const check = prog(t, 4.9, 0.22, ease.out);
  const gone = prog(t, 6.1, 0.9); // the circled cloud dissolves
  const inkOut = 1 - prog(t, 7.5, 0.45); // then Claude's circle clears, leaving open sky

  const barPop = springAt(t, 1.35, { damping: 13 }) * (1 - prog(t, 2.95, 0.15));

  const tip = lasso > 0 && lasso < 1 ? getPointAtLength(LASSO, getLength(LASSO) * lasso) : null;

  const cloudStyle = (i: number): React.CSSProperties | undefined =>
    i === C3
      ? {
          opacity: 1 - gone,
          filter: `blur(${gone * 6}px)`,
          transform: `scale(${1 + gone * 0.06})`,
        }
      : undefined;

  const page = (
    <>
      <div style={{ position: 'absolute', left: HERO_X, top: HERO_Y, borderRadius: 10, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.18)' }}>
        <Hero width={HW} t={t} cloudStyle={cloudStyle}>
          <svg width={PW} height={941} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            <g transform={`translate(${cx} ${cy})`}>
              <g opacity={1 - lassoGone}>
                <path d={LASSO} fill={B.focus} fillOpacity={0.12 * lassoFill} stroke="none" />
                <path d={LASSO} fill="none" stroke="white" strokeWidth={6} strokeLinecap="round" {...draw(lasso, LASSO)} />
                {tip && <circle cx={tip.x} cy={tip.y} r={9} fill="white" stroke={B.ink} strokeWidth={3} />}
              </g>
              <g opacity={inkOut}>
                <path d={AI_LOOP} fill="none" stroke={B.yellow} strokeWidth={7} strokeLinecap="round" {...draw(aiLoop, AI_LOOP)} />
              <path d={CHECK} fill="none" stroke={B.yellow} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" {...draw(check, CHECK)} />
              </g>
            </g>
            <path d={ARROW} fill="none" stroke="white" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" {...draw(arrow, ARROW)} />
          </svg>
          <div style={{ position: 'absolute', left: 250, top: 88 }}>
            <Handwrite text="remove this cloud" start={1.6} dur={0.65} style={{ fontSize: 56, color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.35)' }} />
          </div>
        </Hero>
      </div>

      {/* selection action bar */}
      <div
        style={{
          position: 'absolute',
          left: HERO_X + (cx - 120) * HK,
          top: HERO_Y + (cy + 100) * HK,
          display: 'flex',
          gap: 10,
          padding: 10,
          background: 'white',
          borderRadius: 18,
          boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          transform: `scale(${barPop})`,
          transformOrigin: 'top left',
          fontFamily: sans,
          fontSize: 22,
          fontWeight: 600,
          zIndex: 3,
        }}
      >
        <div style={{ padding: '12px 18px', borderRadius: 12, color: B.ink, background: 'rgba(0,0,0,0.05)' }}>Copy</div>
        <PressButton at={2.75}>✦ Ask AI</PressButton>
      </div>
    </>
  );

  const REPLY = 'This one: the puffy cloud top-left, just above the long streak. On your site it’s its own sprite, so I’ll remove just that one.';
  const item = springAt(t, 3.2, { damping: 15 });
  const thumbW = 200;
  const crop = { x: 120, y: 196, w: 240, h: 160 };
  const tk = thumbW / crop.w;

  const panel = (
    <>
      <div style={{ alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, opacity: item, transform: `translateY(${(1 - item) * 20}px)` }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', border: `1px solid ${B.border}`, borderRadius: 14, padding: 8, background: B.paper }}>
          <div style={{ width: thumbW, height: crop.h * tk, borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', left: -crop.x * tk, top: -crop.y * tk }}>
              <Hero width={PW * tk} t={3.2} overlay={false} />
            </div>
          </div>
          <div style={{ fontSize: 16, color: B.muted, lineHeight: 1.35, paddingRight: 8 }}>
            <div style={{ fontWeight: 700, color: B.ink, fontSize: 17 }}>Selection</div>
            187 × 124 px
            <br />+ where it sits on the page
          </div>
        </div>
        <div style={{ background: B.ink, color: 'white', fontSize: 22, fontWeight: 500, padding: '12px 18px', borderRadius: 18, fontFamily: hand, letterSpacing: 0.3 }}>
          <span style={{ fontSize: 28 }}>“remove this cloud”</span>
        </div>
      </div>

      {t >= 3.4 && t < 3.8 && <Dots t={t} />}
      {t >= 3.8 && <div style={{ fontSize: 23, lineHeight: 1.45, color: B.ink }}>{typed(REPLY, t, 3.8, 4.9)}</div>}

      <div style={{ opacity: prog(t, 5.1, 0.25), transform: `translateY(${(1 - prog(t, 5.1, 0.3, ease.out)) * 14}px)`, border: `1px solid ${B.border}`, borderRadius: 14, padding: 16, background: '#FAFAF8' }}>
        <div style={{ fontFamily: mono, fontSize: 18, color: B.ink, fontWeight: 600 }}>clouds/c3.webp</div>
        <div style={{ fontFamily: mono, fontSize: 16, color: B.muted, marginTop: 6 }}>remove sprite from the hero</div>
        <div style={{ fontFamily: mono, fontSize: 16, color: B.green, marginTop: 4 }}>the other 19 clouds: unchanged</div>
        <div style={{ display: 'flex', marginTop: 14 }}>
          <PressButton at={5.85} color={B.ink}>
            Apply
          </PressButton>
        </div>
      </div>
    </>
  );

  // stage coords of the cloud, for the camera
  const sx = PAGE_X + HERO_X + cx * HK;
  const sy = PAGE_Y + HERO_Y + cy * HK;
  const cam: Cam = [
    [0, 1.75, sx + 160, sy + 40],
    [2.4, 1.75, sx + 170, sy + 40],
    [3.1, 1, 960, 540],
    [6.0, 1, 960, 540],
    [6.7, 2.1, sx + 30, sy + 10],
    [9.8, 2.2, sx + 30, sy + 10],
  ];

  return (
    <Night>
      <AppFrame title="portfolio ideas" lasso={t >= 0.35 && t < 3.0} panelAt={3.0} cam={cam} page={page} panel={panel} />
      <Captions
        items={[
          [0.2, 2.7, 'Circle it.'],
          [3.2, 5.9, 'Claude knows exactly which one.'],
          [6.2, 99, <>Only <span style={{ color: B.yellow }}>that</span> cloud goes.</>],
        ]}
      />
    </Night>
  );
};

/* ===================================================================== */
/* 3. Sketch it: a whiteboard Claude can read                             */
/* ===================================================================== */

export const SKETCH_S = 12.2;

const NODES = [
  { x: 210, y: 150, rx: 165, label: 'genomes (FASTA)' },
  { x: 640, y: 150, rx: 180, label: 'count k-mers, k=31' },
  { x: 640, y: 370, rx: 190, label: 'clean: drop rare ones' },
  { x: 210, y: 370, rx: 180, label: 'sample × k-mer table' },
  { x: 425, y: 590, rx: 200, label: 'model → resistant?' },
];
const ARROWS = [
  'M 380 150 L 455 150 M 455 150 L 438 140 M 455 150 L 438 160',
  'M 640 216 L 640 300 M 640 300 L 630 284 M 640 300 L 650 284',
  'M 446 370 L 396 370 M 396 370 L 413 360 M 396 370 L 413 380',
  'M 230 436 C 240 500, 290 530, 330 545 M 330 545 L 312 547 M 330 545 L 320 530',
];
const STEP = 0.66;
const SKETCH_LASSO = 'M 430 34 C 790 24, 905 140, 895 360 C 890 610, 710 696, 430 694 C 130 692, 6 612, 12 370 C 18 114, 140 36, 440 36';

const PLAN = [
  'Load the genomes from FASTA files',
  'Count k-mers (k = 31) per genome',
  'Drop k-mers seen in fewer than 5 genomes',
  'Build a genome × k-mer feature table',
  'Train a model to predict resistance',
];

const TERM = [
  ['›', 'plan from InkBuddy sketch · 5 steps', B.lilac],
  ['●', 'Write(pipeline/load_genomes.py)', '#E8E8E8'],
  ['●', 'Write(pipeline/count_kmers.py)', '#E8E8E8'],
  ['●', 'Write(pipeline/clean_kmers.py)', '#E8E8E8'],
  ['●', 'Write(pipeline/build_table.py)', '#E8E8E8'],
  ['●', 'Write(pipeline/train_model.py)', '#E8E8E8'],
  ['✓', '5 files, ready for your review', '#4ADE80'],
] as const;

export const Sketch: React.FC = () => {
  const t = useT();
  const start = (i: number) => 0.35 + i * STEP;

  const lasso = prog(t, 3.85, 0.6);
  const lassoGone = prog(t, 4.95, 0.2);
  const barPop = springAt(t, 4.45, { damping: 13 }) * (1 - prog(t, 4.95, 0.15));
  const tip = lasso > 0 && lasso < 1 ? getPointAtLength(SKETCH_LASSO, getLength(SKETCH_LASSO) * lasso) : null;
  const listAt = (i: number) => 6.05 + i * 0.36;

  const page = (
    <>
      <div style={{ position: 'absolute', inset: 0, background: B.paper, backgroundImage: 'radial-gradient(rgba(0,0,0,0.13) 1.4px, transparent 1.6px)', backgroundSize: '34px 34px' }} />
      <div style={{ position: 'absolute', left: 120, top: 40 }}>
        <svg width={1000} height={760} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          {NODES.map((n, i) => {
            const d = roughEllipse(n.x, n.y, n.rx, 64, i + 1);
            return <path key={i} d={d} fill="none" stroke={B.ink} strokeWidth={4.5} strokeLinecap="round" {...draw(prog(t, start(i), 0.3), d)} />;
          })}
          {ARROWS.map((d, i) => {
            // draw the shaft, then pop the head on
            const cut = d.indexOf(' M ');
            const p = prog(t, start(i) + 0.52, 0.16);
            return (
              <g key={i} fill="none" stroke={B.ink} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round">
                <path d={d.slice(0, cut)} {...draw(p, d.slice(0, cut))} />
                <path d={d.slice(cut + 1)} opacity={p >= 1 ? 1 : 0} />
              </g>
            );
          })}
          <g opacity={1 - lassoGone}>
            <path d={SKETCH_LASSO} fill={B.focus} fillOpacity={0.06 * prog(t, 4.45, 0.15)} stroke="none" />
            <path d={SKETCH_LASSO} fill="none" stroke={B.focus} strokeWidth={4} strokeLinecap="round" {...draw(lasso, SKETCH_LASSO)} />
            {tip && <circle cx={tip.x} cy={tip.y} r={8} fill="white" stroke={B.ink} strokeWidth={3} />}
          </g>
          {/* AI ink: Claude numbers each bubble as it reads it back */}
          {NODES.map((n, i) => {
            const p = springAt(t, listAt(i), { damping: 11 });
            const x = n.x - n.rx - 6;
            const y = n.y - 52;
            return (
              <g key={i} transform={`translate(${x} ${y}) scale(${Math.min(1.15, p)})`} opacity={Math.min(1, p * 2)}>
                <circle r={24} fill={B.purple} />
                <text textAnchor="middle" dy={11} fill="white" style={{ fontFamily: hand, fontWeight: 700, fontSize: 34 }}>
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
        {NODES.map((n, i) => (
          <div key={i} style={{ position: 'absolute', left: n.x, top: n.y, transform: 'translate(-50%, -54%)' }}>
            <Handwrite text={n.label} start={start(i) + 0.2} dur={0.36} style={{ fontSize: 46, color: B.ink }} />
          </div>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 520,
          top: 760 - 30,
          display: 'flex',
          gap: 10,
          padding: 10,
          background: 'white',
          borderRadius: 18,
          boxShadow: '0 4px 24px rgba(0,0,0,0.16)',
          transform: `scale(${barPop})`,
          transformOrigin: 'top left',
          zIndex: 3,
        }}
      >
        <PressButton at={4.8}>✦ Ask AI</PressButton>
      </div>
    </>
  );

  const item = springAt(t, 5.15, { damping: 15 });
  const panel = (
    <>
      <div style={{ alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, opacity: item, transform: `translateY(${(1 - item) * 20}px)` }}>
        <div style={{ border: `1px solid ${B.border}`, borderRadius: 12, padding: 8, background: B.paper }}>
          {/* thumbnail of the lassoed sketch */}
          <svg width={250} height={170} viewBox="0 70 860 600">
            {NODES.map((n, i) => (
              <g key={i}>
                <path d={roughEllipse(n.x, n.y, n.rx, 64, i + 1)} fill="none" stroke={B.ink} strokeWidth={7} />
                <text x={n.x} y={n.y + 14} textAnchor="middle" fill={B.ink} style={{ fontFamily: hand, fontWeight: 600, fontSize: 44 }}>
                  {n.label}
                </text>
              </g>
            ))}
            {ARROWS.map((d, i) => (
              <path key={i} d={d} fill="none" stroke={B.ink} strokeWidth={7} strokeLinecap="round" />
            ))}
          </svg>
        </div>
      </div>
      {t >= 5.3 && t < 5.7 && <Dots t={t} />}
      {t >= 5.7 && (
        <div style={{ fontSize: 23, lineHeight: 1.4, color: B.ink }}>
          <div style={{ fontWeight: 700, fontSize: 26 }}>{typed('Is this what you mean?', t, 5.7, 6.05)}</div>
          <ol style={{ margin: '10px 0 0', paddingLeft: 30, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {PLAN.map((s, i) => (
              <li key={i} style={{ opacity: prog(t, listAt(i), 0.2), transform: `translateX(${(1 - prog(t, listAt(i), 0.3, ease.out)) * 16}px)` }}>
                {s}
              </li>
            ))}
          </ol>
          <div style={{ opacity: prog(t, 7.95, 0.25), marginTop: 10, color: B.muted }}>Anything I got wrong?</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, opacity: prog(t, 8.1, 0.25) }}>
        <PressButton at={8.75}>Yes, build it</PressButton>
        <div style={{ padding: '12px 20px', borderRadius: 12, border: `1px solid ${B.border}`, color: B.ink, fontSize: 22, fontWeight: 600 }}>Not quite</div>
      </div>
    </>
  );

  const term = springAt(t, 9.0, { damping: 18 });
  const over = (
    <div
      style={{
        position: 'absolute',
        left: 40,
        bottom: 34,
        width: 760,
        height: 360,
        borderRadius: 16,
        background: '#141418',
        boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
        transform: `translateY(${(1 - term) * 460}px)`,
        padding: '18px 26px',
        boxSizing: 'border-box',
        fontFamily: mono,
        fontSize: 21,
        zIndex: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.5)', fontFamily: sans, fontSize: 16, fontWeight: 600, marginBottom: 14 }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <div key={c} style={{ width: 11, height: 11, borderRadius: 6, background: c }} />
        ))}
        <span style={{ marginLeft: 10 }}>Claude Code · ~/amr-research</span>
      </div>
      {TERM.map(([m, s, c], i) => {
        const a = 9.35 + i * 0.28;
        return (
          <div key={i} style={{ color: c, opacity: prog(t, a, 0.12), lineHeight: 1.6, whiteSpace: 'nowrap' }}>
            <span style={{ display: 'inline-block', width: 28 }}>{m}</span>
            {s}
          </div>
        );
      })}
    </div>
  );

  const cam: Cam = [
    [0, 1.25, 760, 460],
    [3.7, 1.25, 760, 470],
    [4.4, 1, 960, 540],
  ];

  return (
    <Night>
      <AppFrame title="AMR pipeline" lasso={t >= 3.75 && t < 4.95} panelAt={4.95} cam={cam} page={page} panel={panel} over={over} />
      <Captions
        items={[
          [0.2, 3.7, 'Sketch it.'],
          [5.2, 8.8, 'Claude reads it back.'],
          [9.0, 99, 'Then builds it.'],
        ]}
      />
    </Night>
  );
};

/* ===================================================================== */
/* 4. Outro                                                               */
/* ===================================================================== */

export const END_S = 5.4;

export const End: React.FC = () => {
  const t = useT();
  const logo = springAt(t, 1.5, { damping: 12 });
  return (
    <Night>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 34, color: 'white' }}>
        <Slam text="Point. Circle. Sketch." at={0.15} stagger={0.16} accent={[1]} style={{ fontSize: 132 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, opacity: Math.min(1, logo), transform: `scale(${0.8 + 0.2 * Math.min(1, logo)})` }}>
          <div style={{ width: 84, height: 84, borderRadius: 22, background: B.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Squid size={74} color="white" wiggle={t * 3} />
          </div>
          <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 64, letterSpacing: '-0.03em' }}>InkBuddy</div>
        </div>
        <MaskUp at={2.0} style={{ fontFamily: sans, fontSize: 38, fontWeight: 500, color: 'rgba(255,255,255,0.82)' }}>
          A whiteboard Claude can read.
        </MaskUp>
        <div style={{ position: 'absolute', bottom: 70, fontFamily: sans, fontSize: 22, color: 'rgba(255,255,255,0.5)', opacity: prog(t, 2.8, 0.5), textAlign: 'center', lineHeight: 1.5 }}>
          Concept video. Lasso → Claude works in InkBuddy today; editing sites and sending sketches to Claude Code is what’s next.
        </div>
      </AbsoluteFill>
    </Night>
  );
};

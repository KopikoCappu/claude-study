import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { MaskUp, clamp, ease, prog, sans, springAt, useT } from '../common';
import { CellViz, PICK_AT as CELL_PICK, VIZ, pickedPoint } from '../study/Cell';
import { MessyPage, TARGET } from '../study/Messy';
import { CS, serif } from '../study/theme';
import { Backdrop, Captions, Ink, LookCtx, Logo, Sparkle, Stroke, TitleCtx, typed } from '../study/ui';

/**
 * "One desk, one take." A single camera glides over a desk of paper. The story is told in the student's handwriting
 * and Claude's replies, on the pages themselves: the old way gets crossed out, the student draws an arrow and asks,
 * Claude answers in the margin and draws back, a 3D cell unfolds, and the desk fills with every other subject.
 */
export const VISION_S = 37;

const PEN = '#2A2926';
const CLAY_INK = CS.primary;

// ---------------------------------------------------------------- world layout (desk coordinates)

const INTRO = { x: -1400, y: 0, w: 1000, h: 760 };
const CELLPAGE = { x: 0, y: 0 }; // MessyPage: its sheet is 1000 wide, 1200 tall
const MARGIN = { x: 1060, y: 30, w: 580, h: 630 };
const ART = { x: 1060, y: 700, w: 584, h: 470 };
const ROW = 1320;
const HISTORY = { x: -1400, y: ROW, w: 1000, h: 760 };
const CHEM = { x: -300, y: ROW, w: 1000, h: 760 };
const MUSIC = { x: 800, y: ROW, w: 1000, h: 760 };
const PHYS = { x: 1900, y: ROW, w: 1000, h: 760 };
const END = { x: 3100, y: 0, w: 1000, h: 760 };

// Camera: [time, scale, focusX, focusY]
const CAM: [number, number, number, number][] = [
  [0, 1.3, -900, 230],
  [2.7, 1.3, -900, 230],
  [3.4, 1.02, -900, 400],
  [8.3, 1.02, -900, 400],
  [9.7, 1.3, 300, 520],
  [11.7, 1.3, 300, 520],
  [12.6, 0.92, 790, 420],
  [17.0, 0.92, 790, 420],
  [18.2, 0.9, 960, 690],
  [25.0, 0.9, 960, 690],
  [26.6, 0.34, 1250, 1060],
  [31.2, 0.34, 1250, 1060],
  [33.0, 1.05, 3600, 380],
  [VISION_S, 1.08, 3600, 380],
];

function camAt(t: number) {
  const ts = CAM.map((k) => k[0]);
  const at = (i: number) => interpolate(t, ts, CAM.map((k) => k[i]), { ...clamp, easing: ease.inOut });
  return { s: at(1), x: at(2), y: at(3) };
}

// ---------------------------------------------------------------- pieces

const Paper: React.FC<{ box: { x: number; y: number; w: number; h: number }; lined?: boolean; children?: React.ReactNode; style?: React.CSSProperties }> = ({ box, lined = true, children, style }) => (
  <div
    style={{
      position: 'absolute',
      left: box.x,
      top: box.y,
      width: box.w,
      height: box.h,
      background: lined ? `repeating-linear-gradient(to bottom, transparent 0, transparent 58px, ${CS.rule} 58px, ${CS.rule} 60px), ${CS.paper}` : CS.paper,
      boxShadow: '0 18px 50px rgba(60,40,20,0.13), 0 2px 6px rgba(60,40,20,0.06)',
      borderRadius: 4,
      overflow: 'hidden',
      ...style,
    }}
  >
    {children}
  </div>
);

/** A path that draws itself, with an arrowhead that pops at the end. */
const ArrowStroke: React.FC<{ d: string; head: [number, number, number]; start: number; dur: number; color: string; w?: number }> = ({ d, head: [x, y, a], start, dur, color, w = 4 }) => {
  const t = useT();
  const headOn = t > start + dur * 0.92;
  return (
    <>
      <Stroke d={d} start={start} dur={dur} color={color} width={w} />
      {headOn && <path d={`M ${x} ${y} l ${Math.cos(a + 2.6) * 18} ${Math.sin(a + 2.6) * 18} M ${x} ${y} l ${Math.cos(a - 2.6) * 18} ${Math.sin(a - 2.6) * 18}`} stroke={color} strokeWidth={w} strokeLinecap="round" fill="none" />}
    </>
  );
};

const Svg: React.FC<{ w: number; h: number; children: React.ReactNode }> = ({ w, h, children }) => (
  <svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
    {children}
  </svg>
);

/** Hand-wobbled ellipse that draws itself (Claude circling something). */
function loop(cx: number, cy: number, rx: number, ry: number, seed = 1) {
  const pts: string[] = [];
  const n = 70;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2.15 - 2.4;
    const w = 1 + 0.04 * Math.sin(i * 0.5 + seed) + (i / n) * 0.05;
    pts.push(`${(cx + Math.cos(a) * rx * w).toFixed(1)} ${(cy + Math.sin(a) * ry * w).toFixed(1)}`);
  }
  return 'M ' + pts.join(' L ');
}

// ---------------------------------------------------------------- 1. the intro page: the old way, crossed out

const STEPS = ['1. screenshot the page', '2. crop it (badly)', '3. switch apps', '4. describe your own drawing'];

const IntroPage: React.FC = () => (
  <Paper box={INTRO}>
    <Ink text="studying is mostly" x={70} y={60} start={0.4} dur={1.0} size={84} color={PEN} />
    <Ink text="asking questions." x={70} y={160} start={1.5} dur={0.95} size={84} color={PEN} />
    <Svg w={INTRO.w} h={INTRO.h}>
      <Stroke d="M 74 262 C 220 254 400 258 560 250" start={2.45} dur={0.35} color={CLAY_INK} width={5} />
      {STEPS.map((_, i) => (
        <Stroke key={i} d={`M 76 ${400 + i * 66} C 260 ${396 + i * 66 - (i % 2) * 4} 480 ${402 + i * 66} ${i === 3 ? 720 : 560} ${396 + i * 66}`} start={6.7 + i * 0.25} dur={0.25} color={CS.red} width={5} />
      ))}
      <ArrowStroke d="M 230 676 C 420 700 700 690 960 620" head={[960, 620, -0.27]} start={8.15} dur={0.5} color={PEN} />
    </Svg>
    <Ink text="the usual way to ask about one part:" x={70} y={296} start={3.0} dur={1.0} size={48} color={CS.muted} />
    {STEPS.map((s, i) => (
      <Ink key={s} text={s} x={80} y={364 + i * 66} start={4.05 + i * 0.62} dur={0.55} size={50} color={PEN} />
    ))}
    <Ink text="or…" x={76} y={630} start={7.75} dur={0.4} size={70} color={PEN} />
  </Paper>
);

// ---------------------------------------------------------------- 2. the cell page: draw an arrow, ask

const ASK = { arrow: 9.9, text: 10.4, spark: 11.3, reply: [11.8, 13.6] as const, label: 13.8, sketch: 14.6, more: 17.4 };

const CellPage: React.FC = () => {
  const t = useT();
  const spark = springAt(t, ASK.spark, { damping: 10 });
  const glow = prog(t, ART_T.link + 0.3, 0.5, ease.out);
  // MessyPage positions its sheet at (60, 36) inside its parent; shift so the sheet sits at the world origin.
  return (
    <div style={{ position: 'absolute', left: CELLPAGE.x - 60, top: CELLPAGE.y - 36, width: 1060, height: 1236, filter: 'drop-shadow(0 18px 40px rgba(60,40,20,0.13))' }}>
      <MessyPage />
      <div style={{ position: 'absolute', left: 60, top: 36, width: 1000, height: 1200 }}>
        {glow > 0 && <div style={{ position: 'absolute', left: 30, top: 716, width: 330 * glow, height: 62, borderRadius: 10, background: 'rgba(217,119,87,0.22)' }} />}
        <Svg w={1000} h={1200}>
          <ArrowStroke d="M 120 648 C 140 600 170 560 206 524" head={[206, 524, -0.85]} start={ASK.arrow} dur={0.5} color={PEN} />
        </Svg>
        <Ink text="what's this?" x={40} y={650} start={ASK.text} dur={0.75} size={54} color={PEN} rotate={-2} />
        {spark > 0.01 && (
          <div style={{ position: 'absolute', left: 300, top: 650, transform: `scale(${spark}) rotate(${(1 - spark) * 90}deg)` }}>
            <Sparkle size={44} color={CS.clay} />
          </div>
        )}
        <Ink text="→ mitochondrion" x={44} y={722} start={ASK.label} dur={0.9} size={56} color={CLAY_INK} rotate={-1} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- 3. Claude's margin: the answer, and a sketch

const REPLY = 'That’s a mitochondrion. It turns food into energy (ATP) your cells can use.';

const Margin: React.FC = () => {
  const t = useT();
  const k = springAt(t, ASK.spark + 0.2, { damping: 16 });
  const thinking = t > ASK.spark + 0.2 && t < ASK.reply[0];
  return (
    <div
      style={{
        position: 'absolute',
        left: MARGIN.x,
        top: MARGIN.y,
        width: MARGIN.w,
        height: MARGIN.h,
        background: CS.bg,
        border: `1.5px solid ${CS.border}`,
        borderRadius: 22,
        boxShadow: '0 18px 50px rgba(60,40,20,0.12)',
        opacity: Math.min(1, k * 1.4),
        transform: `translateX(${(1 - Math.min(1, k)) * -40}px)`,
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', left: 30, top: 26, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Logo size={38} />
        <div style={{ fontFamily: serif, fontSize: 28, fontWeight: 500, color: CS.text }}>Claude</div>
      </div>
      <div style={{ position: 'absolute', left: 30, right: 30, top: 88, fontFamily: serif, fontSize: 29, lineHeight: 1.42, color: CS.text }}>
        {thinking ? <span style={{ color: CS.muted, fontSize: 24 }}>Looking at what you pointed at…</span> : typed(REPLY, t, ASK.reply[0], ASK.reply[1])}
      </div>
      <Svg w={MARGIN.w} h={MARGIN.h}>
        {/* Claude's own sketch: a mitochondrion cut open */}
        <g transform="translate(250 340)">
          <Stroke d={loop(0, 0, 170, 78, 2)} start={ASK.sketch} dur={0.8} color={CLAY_INK} width={5} />
          <Stroke d="M -135 0 C -120 -50 -100 -50 -95 0 C -90 50 -70 50 -60 0 C -50 -50 -30 -50 -20 0 C -10 50 10 50 20 0 C 30 -50 50 -50 60 0 C 70 50 90 50 100 0 C 110 -45 125 -40 135 0" start={ASK.sketch + 0.8} dur={0.7} color={CLAY_INK} width={3.5} />
        </g>
        <ArrowStroke d="M 410 470 C 380 450 360 420 345 392" head={[345, 392, -2.1]} start={ASK.sketch + 1.5} dur={0.3} color={CLAY_INK} w={3} />
      </Svg>
      <Ink text="folds = more room to make ATP" x={150} y={470} start={ASK.sketch + 1.6} dur={0.9} size={38} color={CLAY_INK} />
      <Ink text="can I see it in 3D?" x={40} y={555} start={ASK.more} dur={0.9} size={46} color={PEN} rotate={-1} />
    </div>
  );
};

// ---------------------------------------------------------------- 4. the 3D cell, unfolding from the margin

const ART_T = { open: 18.6, pick: 23.0, link: 23.3 };
const CELL_SHIFT = ART_T.pick - CELL_PICK; // CellViz runs on its own clock; this lines its tap up with ours
const VIZ_IN = { x: 28, y: 64 };

const Artifact: React.FC = () => {
  const t = useT();
  const unfold = springAt(t, ART_T.open, { damping: 15, mass: 0.8 });
  const info = prog(t, ART_T.pick + 0.3, 0.4, ease.out);
  if (t < ART_T.open) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: ART.x,
        top: ART.y,
        width: ART.w,
        height: ART.h,
        background: CS.paper,
        borderRadius: 22,
        border: `1px solid ${CS.border}`,
        boxShadow: '0 24px 60px rgba(60,40,20,0.16)',
        transformOrigin: '50% 0%',
        transform: `perspective(1400px) rotateX(${(1 - Math.min(1, unfold)) * -80}deg)`,
        opacity: Math.min(1, unfold * 2),
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', left: 28, right: 28, top: 22, display: 'flex', alignItems: 'center', fontFamily: sans, fontSize: 19, fontWeight: 600, color: CS.muted }}>
        <span style={{ color: CS.clay }}>✦</span>&nbsp; 3D cell · built from your notes
      </div>
      <div style={{ position: 'absolute', left: VIZ_IN.x, top: VIZ_IN.y }}>
        <CellViz t={t - CELL_SHIFT} />
      </div>
      <div style={{ position: 'absolute', left: 28, right: 28, top: VIZ_IN.y + VIZ.h + 10, fontFamily: sans, fontSize: 21, color: CS.text, opacity: info }}>
        <b>Mitochondria</b> · <span style={{ color: CS.primary }}>linked to your page</span>
      </div>
    </div>
  );
};

/** A fingertip tap in world coordinates. */
const WorldTap: React.FC<{ x: number; y: number; at: number }> = ({ x, y, at }) => {
  const t = useT();
  const show = interpolate(t, [at - 0.3, at - 0.15, at + 0.25, at + 0.45], [0, 1, 1, 0], clamp);
  const ripple = prog(t, at, 0.45, ease.out);
  return (
    <div style={{ position: 'absolute', left: x - 30, top: y - 30, width: 60, height: 60 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 30, background: 'rgba(20,20,19,0.22)', opacity: show }} />
      {ripple > 0 && ripple < 1 && <div style={{ position: 'absolute', inset: -30, borderRadius: 60, border: `4px solid ${CS.clay}`, opacity: 1 - ripple, transform: `scale(${0.3 + ripple})` }} />}
    </div>
  );
};

// ---------------------------------------------------------------- 5. every page, every subject

const M = { history: 26.9, chem: 27.6, music: 28.3, phys: 29.0 };

const HistoryPage: React.FC = () => (
  <Paper box={HISTORY}>
    <S text="The Silk Road" x={60} y={40} size={64} />
    <Svg w={1000} h={760}>
      <path d="M 80 300 C 160 240 300 230 380 280 C 460 330 520 300 600 260 C 700 210 820 230 920 300 L 930 560 C 800 600 600 590 420 560 C 260 540 140 560 70 520 Z" fill="rgba(46,139,87,0.07)" stroke={PEN} strokeWidth={3} />
      <path d="M 150 420 C 300 380 420 440 560 400 C 680 370 780 420 880 380" stroke="#8B5A2B" strokeWidth={4} strokeDasharray="12 10" fill="none" />
      {[
        [150, 420],
        [560, 400],
        [880, 380],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={9} fill={PEN} />
      ))}
      <Stroke d={loop(560, 400, 90, 50, 3)} start={M.history} dur={0.6} color={CLAY_INK} width={5} />
    </Svg>
    <S text="Constantinople" x={70} y={440} size={34} />
    <S text="Samarkand" x={500} y={430} size={34} />
    <S text="Chang'an" x={820} y={400} size={34} />
    <S text="why here??" x={500} y={210} size={44} color={CS.red} />
    <Ink text="routes crossed here → trade hub" x={360} y={600} start={M.history + 0.5} dur={0.9} size={46} color={CLAY_INK} />
  </Paper>
);

const ChemPage: React.FC = () => {
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return [500 + Math.cos(a) * 150, 380 + Math.sin(a) * 150];
  });
  return (
    <Paper box={CHEM}>
      <S text="Benzene  C₆H₆" x={60} y={40} size={64} />
      <Svg w={1000} h={760}>
        <path d={'M ' + hex.map((p) => p.join(' ')).join(' L ') + ' Z'} stroke={PEN} strokeWidth={5} fill="none" strokeLinejoin="round" />
        {[0, 2, 4].map((i) => {
          const [x1, y1] = hex[i];
          const [x2, y2] = hex[(i + 1) % 6];
          const k = 0.8;
          return <line key={i} x1={500 + (x1 - 500) * k} y1={380 + (y1 - 380) * k} x2={500 + (x2 - 500) * k} y2={380 + (y2 - 380) * k} stroke={PEN} strokeWidth={4} />;
        })}
        <Stroke d={loop(500, 380, 92, 92, 4)} start={M.chem} dur={0.6} color={CLAY_INK} width={5} />
      </Svg>
      <S text="why so stable?" x={640} y={170} size={44} color={CS.red} />
      <Ink text="6 shared electrons → extra stable" x={250} y={600} start={M.chem + 0.5} dur={0.9} size={46} color={CLAY_INK} />
    </Paper>
  );
};

const MusicPage: React.FC = () => {
  const staffY = 300;
  const gap = 28;
  // C4 (ledger line), E4, G4 stacked: a C major chord
  const notes = [staffY + gap * 5, staffY + gap * 4, staffY + gap * 3];
  return (
    <Paper box={MUSIC} lined={false}>
      <S text="Chords, week 2" x={60} y={40} size={64} />
      <Svg w={1000} h={760}>
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={80} x2={920} y1={staffY + i * gap} y2={staffY + i * gap} stroke={PEN} strokeWidth={2.5} />
        ))}
        <line x1={470} x2={550} y1={staffY + gap * 5} y2={staffY + gap * 5} stroke={PEN} strokeWidth={2.5} />
        {notes.map((y, i) => (
          <ellipse key={i} cx={510} cy={y} rx={19} ry={14} fill={PEN} transform={`rotate(-20 510 ${y})`} />
        ))}
        {[
          [300, staffY + gap * 2],
          [720, staffY + gap * 1.5],
        ].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx={19} ry={14} fill={PEN} transform={`rotate(-20 ${x} ${y})`} />
        ))}
        <Stroke d={loop(510, staffY + gap * 4, 70, 92, 5)} start={M.music} dur={0.6} color={CLAY_INK} width={5} />
      </Svg>
      <S text="𝄞" x={90} y={250} size={150} />
      <S text="this one?" x={560} y={170} size={44} color={CS.red} />
      <Ink text="C major: C · E · G" x={330} y={530} start={M.music + 0.5} dur={0.8} size={50} color={CLAY_INK} />
    </Paper>
  );
};

const PhysPage: React.FC = () => (
  <Paper box={PHYS}>
    <S text="Forces on a ramp" x={60} y={40} size={64} />
    <Svg w={1000} h={760}>
      <path d="M 120 600 L 860 600 L 120 260 Z" stroke={PEN} strokeWidth={4} fill="none" strokeLinejoin="round" />
      <g transform="translate(430 400) rotate(24.7)">
        <rect x={-60} y={-110} width={120} height={110} stroke={PEN} strokeWidth={4} fill="rgba(47,95,208,0.08)" />
      </g>
      <ArrowStroke d="M 440 360 L 440 520" head={[440, 520, Math.PI / 2]} start={-10} dur={0.1} color="#2F5FD0" />
      <ArrowStroke d="M 400 330 L 350 222" head={[350, 222, -2.0]} start={-10} dur={0.1} color="#2F5FD0" />
      <ArrowStroke d="M 470 320 L 330 256" head={[330, 256, -2.71]} start={M.phys} dur={0.5} color={CLAY_INK} w={5} />
    </Svg>
    <S text="mg" x={455} y={490} size={40} color="#2F5FD0" />
    <S text="N" x={320} y={190} size={40} color="#2F5FD0" />
    <S text="friction??" x={620} y={300} size={44} color={CS.red} />
    <Ink text="friction points up the ramp" x={300} y={640} start={M.phys + 0.5} dur={0.9} size={46} color={CLAY_INK} />
  </Paper>
);

/** Static handwriting. */
const S: React.FC<{ text: string; x: number; y: number; size: number; color?: string }> = ({ color = PEN, ...p }) => <Ink start={-10} dur={0.1} color={color} {...p} />;

// ---------------------------------------------------------------- 6. the end page

const EndPage: React.FC = () => {
  const t = useT();
  const { handTitle } = React.useContext(TitleCtx);
  const pop = springAt(t, 33.2, { damping: 12 });
  return (
    <Paper box={END} lined={false}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
        <Logo size={104} style={{ transform: `scale(${pop})` }} />
        <div style={{ fontFamily: serif, fontWeight: 500, fontSize: 108, letterSpacing: '-0.035em', color: CS.ink, opacity: handTitle ? 0 : 1 }}>
          <MaskUp at={33.4}>Claude Study</MaskUp>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 430, textAlign: 'center', fontFamily: serif, fontSize: 40, color: CS.muted }}>
        <MaskUp at={34.0}>
          Ask about anything you can <span style={{ color: CS.primary, fontStyle: 'italic' }}>point at.</span>
        </MaskUp>
      </div>
    </Paper>
  );
};

// ---------------------------------------------------------------- the take

export const VisionVideo: React.FC<{ handTitle: boolean }> = ({ handTitle }) => (
  <LookCtx.Provider value="claude">
    <TitleCtx.Provider value={{ handTitle }}>
      <Take />
    </TitleCtx.Provider>
  </LookCtx.Provider>
);

const Take: React.FC = () => {
  const t = useT();
  const cam = camAt(t);
  const [px, py] = pickedPoint();
  const fadeIn = prog(t, 0, 0.6);
  return (
    <AbsoluteFill>
      <Backdrop />
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(960px, 540px) scale(${cam.s}) translate(${-cam.x}px, ${-cam.y}px)`, opacity: fadeIn }}>
        <IntroPage />
        <CellPage />
        <Margin />
        <Artifact />
        <HistoryPage />
        <ChemPage />
        <MusicPage />
        <PhysPage />
        <EndPage />
        <ThreadDraw />
        <WorldTap x={ART.x + VIZ_IN.x + px} y={ART.y + VIZ_IN.y + py} at={ART_T.pick} />
        <Drag />
      </div>
      <Captions
        items={[
          [9.8, 11.6, 'Just draw on your notes. Ask right there.'],
          [11.75, 14.5, 'Claude sees exactly what you pointed at…'],
          [14.6, 17.3, '…and answers on your page.'],
          [17.4, 20.6, 'Ask for more.'],
          [20.7, 25.3, 'Explore it in 3D, linked back to your notes.'],
          [26.6, 31.4, 'Every page. Every subject.'],
        ]}
      />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 40, textAlign: 'center', fontFamily: sans, fontSize: 20, color: CS.muted, opacity: prog(t, 34.6, 0.6) }}>
        A concept built on the Claude API · Not affiliated with or endorsed by Anthropic
      </div>
    </AbsoluteFill>
  );
};

/** The finger spinning the cell (matches CellViz's drag window). */
const Drag: React.FC = () => {
  const t = useT();
  const a = 6.6 + CELL_SHIFT;
  const b = 7.9 + CELL_SHIFT;
  const p = prog(t, a, b - a, ease.inOut);
  const show = interpolate(t, [a - 0.25, a, b, b + 0.25], [0, 1, 1, 0], clamp);
  const x = ART.x + VIZ_IN.x + 120 + 280 * p;
  const y = ART.y + VIZ_IN.y + 290;
  return <div style={{ position: 'absolute', left: x - 30, top: y - 30, width: 60, height: 60, borderRadius: 30, background: 'rgba(20,20,19,0.22)', border: '3px solid rgba(255,255,255,0.85)', opacity: show }} />;
};

/** Dotted orange thread from the 3D mitochondrion back to Claude's label on the page, drawn progressively. */
const ThreadDraw: React.FC = () => {
  const t = useT();
  const [px, py] = pickedPoint();
  const x0 = ART.x + VIZ_IN.x + px;
  const y0 = ART.y + VIZ_IN.y + py;
  const x1 = 395;
  const y1 = 752;
  const p = prog(t, ART_T.link, 0.8, ease.inOut);
  if (p <= 0) return null;
  const d = `M ${x0} ${y0} C ${x0 - 160} ${y0 + 160} ${x1 + 300} ${y1 + 160} ${x1} ${y1}`;
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width={1} height={1}>
      <defs>
        <mask id="thread" maskUnits="userSpaceOnUse" x={-5000} y={-5000} width={10000} height={10000}>
          <path d={d} fill="none" stroke="white" strokeWidth={16} pathLength={1} strokeDasharray={`${p} 2`} />
        </mask>
      </defs>
      <path d={d} fill="none" stroke={CS.clay} strokeWidth={4.5} strokeDasharray="12 10" strokeLinecap="round" mask="url(#thread)" />
      {p > 0.95 && <circle cx={x1} cy={y1} r={9} fill={CS.clay} />}
    </svg>
  );
};


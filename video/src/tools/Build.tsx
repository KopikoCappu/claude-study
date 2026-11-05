import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { Handwrite, MaskUp, Paper, Squid, clamp, ease, hand, prog, sans, springAt, useT } from '../common';
import { S } from './palette';
import { useDemo } from './demos';

/**
 * The main scene: handwritten notes → lasso → "Make a tool" → the tool builds beside the notes → use it.
 * The topic (notes, request, tool) comes from demos.ts. Each tool is a real one the app built, captured in a browser
 * at each step (public/tools/shots). Build times are the real numbers from those builds.
 */
export const BUILD_S = 15.4;

const TAB = { x: 150, y: 120, w: 1620, h: 900, bezel: 18 };
const SCREEN_W = TAB.w - TAB.bezel * 2;
const BAR_H = 72;
const PANEL_W = 720;
const TOOL_W = PANEL_W - 40;
const ROW = 92;
const BLUE = '#2F6FEB'; // the app's selection outline
const RED = '#C8463D';

function captions(play: string, check: string): [number, number, React.ReactNode][] {
  return [
    [0.1, 1.6, 'Your notes.'],
    [1.65, 3.2, 'Lasso them.'],
    [3.25, 5.0, 'Ask for a practice tool.'],
    [5.05, 8.3, <>Built from <span style={{ color: S.glow }}>your</span> notes.</>],
    [8.35, 9.95, play],
    [10.0, 12.9, check],
    [12.95, 99, <>Keep writing. <span style={{ color: S.glow }}>It stays open.</span></>],
  ];
}

const Caption: React.FC = () => {
  const D = useDemo();
  return (
  <div style={{ position: 'absolute', left: 90, bottom: 60, zIndex: 10 }}>
    {captions(D.captions.play, D.captions.check).map(([a, b, text], i) => (
      <div key={i} style={{ position: 'absolute', left: 0, bottom: 0 }}>
        <MaskUp at={a} out={b} dur={0.45}>
          <div
            style={{
              whiteSpace: 'nowrap',
              background: 'rgba(11,11,16,0.92)',
              color: S.cream,
              fontFamily: sans,
              fontWeight: 800,
              fontSize: 60,
              letterSpacing: '-0.035em',
              padding: '16px 32px',
              borderRadius: 22,
            }}
          >
            {text}
          </div>
        </MaskUp>
      </div>
    ))}
  </div>
  );
};

const Icon: React.FC<{ active?: boolean; children: React.ReactNode }> = ({ active, children }) => (
  <div style={{ width: 50, height: 50, borderRadius: 12, background: active ? S.selected : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={S.icon} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  </div>
);

/** Puzzle-piece icon (the app's "Study tools" button). */
export const Puzzle: React.FC<{ size?: number; color?: string }> = ({ size = 30, color = S.icon }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round">
    <path d="M10 4a2 2 0 1 1 4 0v1h4v4h-1a2 2 0 1 0 0 4h1v5h-5v-1a2 2 0 1 0-4 0v1H4v-5h1a2 2 0 1 0 0-4H4V5h6z" />
  </svg>
);

const TopBar: React.FC<{ lasso: boolean; tools: boolean }> = ({ lasso, tools }) => {
  const D = useDemo();
  return (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: BAR_H,
      background: 'white',
      borderBottom: `1px solid ${S.border}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 10,
      zIndex: 5,
    }}
  >
    <Squid size={40} color={S.ink} />
    <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 22, color: S.text, marginLeft: 8, marginRight: 30 }}>{D.noteTitle}</div>
    <Icon active={!lasso}>
      <path d="M4 20l4-1 11-11-3-3L5 16z" />
    </Icon>
    <Icon>
      <path d="M9 15l-4 5h6l8-8-4-4z" />
    </Icon>
    <Icon active={lasso}>
      <path d="M12 4c5 0 8 2.5 8 5.5S16.5 15 12 15 4 12.5 4 9.5 7 4 12 4z" strokeDasharray="2.5 2.5" />
      <path d="M8 14c-1 2 0 4 2 5" />
    </Icon>
    <div style={{ flex: 1 }} />
    <div style={{ width: 50, height: 50, borderRadius: 12, background: tools ? S.selected : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Puzzle color={tools ? S.ink : S.icon} />
    </div>
    <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 20, color: S.onInk, background: S.ink, padding: '12px 22px', borderRadius: 999 }}>✦ Ask</div>
  </div>
  );
};

const LASSO = 'M 500 18 C 860 10, 990 70, 985 300 C 980 560, 860 640, 500 640 C 160 640, 40 580, 44 330 C 48 90, 170 24, 510 22';
const UNDERLINE = 'M 96 122 C 300 114, 520 118, 640 112';

const Page: React.FC = () => {
  const t = useT();
  const D = useDemo();
  const ink = { text: S.text, red: RED, blue: BLUE };
  const lasso = evolvePath(prog(t, 1.65, 0.6), LASSO);
  const lassoFill = prog(t, 2.2, 0.15);
  const lassoGone = prog(t, 3.2, 0.2);
  const bar = springAt(t, 2.3, { damping: 13 }) * (1 - prog(t, 3.15, 0.15));
  const press = interpolate(t, [2.85, 2.93, 3.05], [1, 0.9, 1], clamp);
  const ripple = prog(t, 2.9, 0.4, ease.out);
  const under = evolvePath(prog(t, 0.05, 0.35), UNDERLINE);

  return (
    <div style={{ position: 'absolute', top: BAR_H, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <Paper
        lineGap={ROW}
        margin={70}
        style={{ background: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW - 2}px, ${S.rule} ${ROW - 2}px, ${S.rule} ${ROW}px), ${S.paper}` }}
      />
      {D.notes.map((l, i) => (
        <div key={i} style={{ position: 'absolute', left: 100, top: 30 + i * ROW, height: ROW, display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
          <Handwrite text={l.text} start={0.1 + i * 0.2} dur={0.45} style={{ fontSize: l.size ?? 52, color: ink[l.color], lineHeight: 1, whiteSpace: 'pre' }} />
        </div>
      ))}

      {/* written later, while the tool is open */}
      <div style={{ position: 'absolute', left: 100, top: 30 + 6 * ROW + 10, height: ROW, display: 'flex', alignItems: 'flex-end' }}>
        <Handwrite text={D.marginNote} start={13.0} dur={0.9} style={{ fontSize: 56, color: RED, lineHeight: 1 }} />
      </div>

      <svg width={SCREEN_W} height={830} style={{ position: 'absolute', inset: 0 }}>
        <path d={UNDERLINE} fill="none" stroke={S.accent} strokeWidth={4} strokeLinecap="round" {...under} opacity={0.55} />
        <g opacity={1 - lassoGone}>
          <path d={LASSO} fill={BLUE} fillOpacity={0.07 * lassoFill} stroke="none" />
          <path d={LASSO} fill="none" stroke={BLUE} strokeWidth={4} strokeLinecap="round" {...lasso} />
        </g>
      </svg>

      {/* selection action bar */}
      <div
        style={{
          position: 'absolute',
          left: 140,
          top: 660,
          display: 'flex',
          gap: 10,
          padding: 10,
          background: 'white',
          borderRadius: 18,
          boxShadow: '0 4px 24px rgba(0,0,0,0.16)',
          transform: `scale(${bar})`,
          transformOrigin: 'top left',
          fontFamily: sans,
          fontSize: 24,
          fontWeight: 600,
        }}
      >
        <div style={{ padding: '14px 22px', borderRadius: 12, color: S.text, background: S.selected }}>✦ Ask</div>
        <div style={{ position: 'relative', transform: `scale(${press})` }}>
          <div style={{ padding: '14px 22px', borderRadius: 12, color: S.onInk, background: S.accent, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Puzzle size={26} color={S.onInk} /> Make a tool
          </div>
          <Ripple p={ripple} color={S.accent} />
        </div>
      </div>
    </div>
  );
};

const Ripple: React.FC<{ p: number; color: string; size?: number }> = ({ p, color, size = 160 }) => (
  <div
    style={{
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: size,
      height: size,
      marginLeft: -size / 2,
      marginTop: -size / 2,
      borderRadius: size / 2,
      border: `5px solid ${color}`,
      opacity: p > 0 && p < 1 ? 1 - p : 0,
      transform: `scale(${0.2 + p})`,
      pointerEvents: 'none',
    }}
  />
);

/** A finger tap: a dot that presses in and a ring that spreads. Position in panel pixels. */
const Tap: React.FC<{ at: number; x: number; y: number }> = ({ at, x, y }) => {
  const t = useT();
  const p = prog(t, at, 0.45, ease.out);
  const dot = interpolate(t, [at - 0.25, at, at + 0.35, at + 0.55], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, zIndex: 3 }}>
      <div
        style={{
          position: 'absolute',
          width: 48,
          height: 48,
          left: -24,
          top: -24,
          borderRadius: 24,
          background: S.tap,
          border: `3px solid ${S.accent}`,
          opacity: dot,
          transform: `scale(${1 - 0.15 * dot})`,
        }}
      />
      <Ripple p={p} color={S.accent} size={100} />
    </div>
  );
};

const T_SEND = 4.75;
const T_BUILT = 8.2;

const Panel: React.FC = () => {
  const t = useT();
  const D = useDemo();
  const REAL = D.real;
  const SHOT_SCALE = TOOL_W / D.shotWidth;
  const PROMPT = D.prompt;
  const slide = springAt(t, 3.15, { damping: 20, mass: 0.7 });
  const typed = Math.floor(interpolate(t, [3.45, 4.55], [0, PROMPT.length], clamp));
  const sent = t >= T_SEND;
  const building = sent && t < T_BUILT;
  const built = t >= T_BUILT;
  const pressSend = interpolate(t, [T_SEND - 0.12, T_SEND - 0.04, T_SEND + 0.08], [1, 0.85, 1], clamp);

  // Building: shown sped up, with the real build's time and size.
  const bp = interpolate(t, [T_SEND + 0.15, T_BUILT - 0.1], [0, 1], clamp);
  const writing = bp > 0.22;
  const chars = Math.round(interpolate(bp, [0.22, 1], [0, REAL.chars], clamp));
  const secs = Math.round(bp * REAL.secs);
  const fill = Math.min(0.95, chars / (REAL.chars * 1.08));

  const toolIn = springAt(t, T_BUILT, { damping: 18 });
  const shot = [...D.shots].reverse().find((x) => t >= x.at)?.src ?? D.shots[0].src;
  const scroll = D.scrolls.reduce((y, sc) => y + prog(t, sc.at, sc.dur, ease.inOut) * (sc.to - (D.scrolls[D.scrolls.indexOf(sc) - 1]?.to ?? 0)), 0) * SHOT_SCALE;
  const ring = prog(t, D.ring.at, 0.5, ease.out);
  const EV_LINE = D.ring;

  return (
    <div
      style={{
        position: 'absolute',
        top: BAR_H,
        bottom: 0,
        right: 0,
        width: PANEL_W,
        background: 'white',
        borderLeft: `1px solid ${S.border}`,
        boxShadow: '-8px 0 30px rgba(0,0,0,0.08)',
        transform: `translateX(${(1 - slide) * (PANEL_W + 40)}px)`,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: sans,
        zIndex: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${S.border}` }}>
        <Puzzle size={28} color={S.ink} />
        <div style={{ fontWeight: 700, fontSize: 22, color: S.text, whiteSpace: 'nowrap' }}>{built ? REAL.title : 'New tool'}</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: S.muted, border: `1px solid ${S.border}`, padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>{REAL.model}</div>
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: S.bg }}>
        {!sent && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 }}>
            <Puzzle size={44} color={S.faint} />
            <div style={{ fontSize: 26, fontWeight: 700, color: S.text }}>Practice beside your notes</div>
            <div style={{ fontSize: 20, color: S.muted, textAlign: 'center', lineHeight: 1.45 }}>
              Describe a tool — a quiz, a simulator, a 3D model — and Claude builds it from your selection.
            </div>
          </div>
        )}

        {building && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 40 }}>
            <Spinner />
            <div style={{ fontSize: 26, fontWeight: 700, color: S.text, textAlign: 'center' }}>{writing ? REAL.title : 'Building your tool…'}</div>
            <div style={{ fontSize: 20, color: S.muted }}>{writing ? `Writing the tool · ${(chars / 1000).toFixed(1)}k characters` : 'Planning the tool…'}</div>
            <div style={{ width: 340, height: 6, borderRadius: 3, background: '#ECEBF5', overflow: 'hidden' }}>
              <div style={{ width: `${fill * 100}%`, height: 6, borderRadius: 3, background: S.accent }} />
            </div>
            <div style={{ fontSize: 20, color: S.muted }}>{secs}s · You can keep taking notes.</div>
          </div>
        )}

        {built && (
          <div
            style={{
              position: 'absolute',
              left: 20,
              top: 16,
              width: TOOL_W,
              bottom: 16,
              borderRadius: 14,
              overflow: 'hidden',
              border: `1px solid ${S.border}`,
              background: '#FAFAFA',
              opacity: Math.min(1, toolIn * 1.5),
              transform: `translateY(${(1 - toolIn) * 30}px)`,
            }}
          >
            <div style={{ position: 'absolute', left: 0, top: -scroll, width: TOOL_W }}>
              <Img src={staticFile(`tools/shots/${shot}.png`)} style={{ width: TOOL_W, display: 'block' }} />
              {D.taps.map((p, i) => (
                <Tap key={i} at={p.at} x={p.x * SHOT_SCALE} y={p.y * SHOT_SCALE} />
              ))}
              <div
                style={{
                  position: 'absolute',
                  left: EV_LINE.x * SHOT_SCALE - 8,
                  top: EV_LINE.y * SHOT_SCALE - 8,
                  width: EV_LINE.w * SHOT_SCALE + 16,
                  height: EV_LINE.h * SHOT_SCALE + 16,
                  borderRadius: 10,
                  border: `4px solid ${S.accent}`,
                  opacity: interpolate(ring, [0, 0.3, 1], [0, 1, 0.9]),
                  transform: `scale(${1.15 - 0.15 * ring})`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${S.border}`, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10, background: 'white' }}>
        {!built && <div style={{ alignSelf: 'flex-start', fontSize: 17, fontWeight: 600, color: S.ink, background: S.selected, padding: '6px 12px', borderRadius: 999 }}>Using your selection</div>}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div
            style={{
              flex: 1,
              fontSize: 21,
              lineHeight: 1.35,
              color: !sent && typed ? S.text : S.muted,
              border: `1px solid ${S.border}`,
              background: S.bg,
              borderRadius: 14,
              padding: '12px 16px',
              minHeight: 30,
            }}
          >
            {!sent && typed ? PROMPT.slice(0, typed) : built ? 'Change this tool…' : 'What do you want to practice?'}
            {!sent && t > 3.4 && Math.floor(t * 2.5) % 2 === 0 ? <span style={{ color: S.accent }}>|</span> : null}
          </div>
          <div style={{ width: 50, height: 50, borderRadius: 25, background: S.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${pressSend})` }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={S.onInk} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </div>
        </div>
      </div>

      {building && (
        <div style={{ position: 'absolute', top: 82, right: 20, fontSize: 16, fontWeight: 700, color: S.onInk, background: S.night, padding: '6px 12px', borderRadius: 8, opacity: 0.85 }}>
          SPED UP · REAL TIME {REAL.secs}s
        </div>
      )}
    </div>
  );
};

const Spinner: React.FC = () => {
  const t = useT();
  return (
    <svg width={44} height={44} viewBox="0 0 44 44" style={{ transform: `rotate(${t * 400}deg)` }}>
      <circle cx={22} cy={22} r={18} fill="none" stroke={S.selected} strokeWidth={5} />
      <path d="M22 4 A18 18 0 0 1 40 22" fill="none" stroke={S.accent} strokeWidth={5} strokeLinecap="round" />
    </svg>
  );
};

/** Camera keyframes: [time, scale, focusX, focusY] in stage coordinates. */
const CAM: [number, number, number, number][] = [
  [0, 1.45, 620, 430],
  [1.5, 1.4, 640, 470],
  [2.5, 1.0, 960, 570],
  [8.3, 1.0, 960, 570],
  [9.0, 1.4, 1380, 560],
  [12.4, 1.4, 1380, 560],
  [13.1, 1.0, 960, 570],
];

export const Build: React.FC = () => {
  const t = useT();
  const ts = CAM.map((k) => k[0]);
  const at = (i: number) => interpolate(t, ts, CAM.map((k) => k[i]), { ...clamp, easing: ease.inOut });
  const enter = springAt(t, 0, { damping: 20 });

  return (
    <AbsoluteFill style={{ background: S.desk, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: '0 0',
          transform: `translate(960px, 540px) scale(${at(1)}) translate(${-at(2)}px, ${-at(3)}px) translateY(${(1 - enter) * 120}px)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: TAB.x,
            top: TAB.y,
            width: TAB.w,
            height: TAB.h,
            borderRadius: 44,
            background: S.night,
            padding: TAB.bezel,
            boxSizing: 'border-box',
            boxShadow: '0 40px 100px rgba(0,0,0,0.28)',
          }}
        >
          <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 28, overflow: 'hidden', background: 'white' }}>
            <TopBar lasso={t >= 1.5 && t < 3.2} tools={t >= 3.15} />
            <Page />
            <Panel />
          </div>
        </div>
      </div>
      <Caption />
      <div style={{ position: 'absolute', opacity: 0, fontFamily: hand }}>.</div>
    </AbsoluteFill>
  );
};

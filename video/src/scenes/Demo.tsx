import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { B, Handwrite, MaskUp, Paper, Squid, clamp, ease, hand, prog, roughEllipse, sans, springAt, useT } from '../common';

export const DEMO_S = 10.8;

// Tablet geometry (stage coordinates, before the camera)
const TAB = { x: 180, y: 150, w: 1560, h: 880, bezel: 18 };
const SCREEN_W = TAB.w - TAB.bezel * 2;
const BAR_H = 72;
const PANEL_W = 480;
const ROW = 110;

const CAPTIONS: [number, number, React.ReactNode][] = [
  [0.1, 2.0, 'Write.'],
  [2.05, 3.2, 'Lasso.'],
  [3.25, 4.5, 'Ask.'],
  [4.55, 8.5, <>It writes back. <span style={{ color: B.lilac }}>On your page.</span></>],
  [8.55, 99, 'Move it. Resize it. It’s ink.'],
];

const Caption: React.FC = () => (
  <div style={{ position: 'absolute', left: 90, bottom: 70, zIndex: 10 }}>
    {CAPTIONS.map(([a, b, text], i) => (
      <div key={i} style={{ position: 'absolute', left: 0, bottom: 0 }}>
        <MaskUp at={a} out={b} dur={0.45}>
          <div
            style={{
              whiteSpace: 'nowrap',
              background: 'rgba(11,11,16,0.92)',
              color: 'white',
              fontFamily: sans,
              fontWeight: 800,
              fontSize: 64,
              letterSpacing: '-0.035em',
              padding: '18px 34px',
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

const ToolIcon: React.FC<{ active?: boolean; children: React.ReactNode }> = ({ active, children }) => (
  <div
    style={{
      width: 50,
      height: 50,
      borderRadius: 12,
      background: active ? 'rgba(0,0,0,0.07)' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#3A3A3C" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  </div>
);

const TopBar: React.FC<{ lassoActive: boolean }> = ({ lassoActive }) => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: BAR_H,
      background: 'white',
      borderBottom: `1px solid ${B.border}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 10,
      zIndex: 5,
    }}
  >
    <Squid size={40} color={B.ink} />
    <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 22, color: B.ink, marginLeft: 8, marginRight: 30 }}>Algebra HW</div>
    <ToolIcon active={!lassoActive}>
      <path d="M4 20l4-1 11-11-3-3L5 16z" />
    </ToolIcon>
    <ToolIcon>
      <path d="M9 15l-4 5h6l8-8-4-4z" />
    </ToolIcon>
    <ToolIcon active={lassoActive}>
      <path d="M12 4c5 0 8 2.5 8 5.5S16.5 15 12 15 4 12.5 4 9.5 7 4 12 4z" strokeDasharray="2.5 2.5" />
      <path d="M8 14c-1 2 0 4 2 5" />
    </ToolIcon>
    <ToolIcon>
      <path d="M8 20h10M5 15l9-9 5 5-6 6H9z" />
    </ToolIcon>
    <div style={{ flex: 1 }} />
    <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 20, color: 'white', background: B.ink, padding: '12px 22px', borderRadius: 999 }}>✦ Ask AI</div>
  </div>
);

const LINES = [
  { text: '3(x + 2) = 15', start: 0.15 },
  { text: '3x + 2 = 15', start: 0.6 },
  { text: '3x = 13', start: 1.05 },
  { text: 'x = 13/3', start: 1.45 },
];
const LASSO = 'M 390 52 C 620 40, 735 120, 715 290 C 700 470, 610 540, 390 535 C 160 530, 62 470, 70 290 C 78 110, 170 58, 400 54';
const CIRCLE = roughEllipse(330, 244, 262, 60, 2);
const CHECK = 'M 655 122 L 683 152 L 735 84';

const Page: React.FC = () => {
  const t = useT();

  const lasso = prog(t, 2.25, 0.55);
  const lassoFill = prog(t, 2.75, 0.15);
  const lassoGone = prog(t, 3.95, 0.2);
  const barPop = springAt(t, 2.9, { damping: 13 });
  const barGone = prog(t, 3.9, 0.15);
  const press = interpolate(t, [3.55, 3.63, 3.75], [1, 0.9, 1], clamp);
  const ripple = prog(t, 3.6, 0.4, ease.out);

  const circle = prog(t, 4.85, 0.5);
  const check = prog(t, 5.95, 0.2, ease.out);
  const moveP = prog(t, 9.0, 0.45);
  const selBox = prog(t, 8.7, 0.15) * (1 - prog(t, 9.9, 0.2));

  const lassoEvo = evolvePath(lasso, LASSO);
  const circleEvo = evolvePath(circle, CIRCLE);
  const checkEvo = evolvePath(check, CHECK);
  const noteDy = moveP * 46;

  return (
    <div style={{ position: 'absolute', top: BAR_H, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <Paper lineGap={ROW} margin={70} />

      {LINES.map((l, i) => (
        <div key={i} style={{ position: 'absolute', left: 110, top: 70 + i * ROW, height: ROW, display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
          <Handwrite text={l.text} start={l.start} dur={0.42} style={{ fontSize: 96, color: B.ink, lineHeight: 1 }} />
        </div>
      ))}

      <svg width={SCREEN_W} height={800} style={{ position: 'absolute', inset: 0 }}>
        <g opacity={1 - lassoGone}>
          <path d={LASSO} fill={B.focus} fillOpacity={0.07 * lassoFill} stroke="none" />
          <path d={LASSO} fill="none" stroke={B.focus} strokeWidth={4} strokeLinecap="round" {...lassoEvo} />
        </g>
        <path d={CHECK} fill="none" stroke={B.green} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" {...checkEvo} />
        <path d={CIRCLE} fill="none" stroke={B.red} strokeWidth={7} strokeLinecap="round" {...circleEvo} />
      </svg>

      {/* AI margin note (movable) */}
      <div style={{ position: 'absolute', left: 615, top: 168, transform: `translateY(${noteDy}px)` }}>
        <Handwrite text="3 × 2 = 6, not 2!" start={5.35} dur={0.5} style={{ fontSize: 58, color: B.red }} />
        <div style={{ position: 'absolute', inset: '-10px -16px', border: `3px solid ${B.focus}`, borderRadius: 8, opacity: selBox }}>
          {[
            { top: -9, left: -9 },
            { top: -9, right: -9 },
            { bottom: -9, left: -9 },
            { bottom: -9, right: -9 },
          ].map((pos, i) => (
            <div key={i} style={{ position: 'absolute', width: 16, height: 16, borderRadius: 8, background: 'white', border: `3px solid ${B.focus}`, ...pos }} />
          ))}
        </div>
      </div>

      {/* AI writes the fix */}
      <div style={{ position: 'absolute', left: 110, top: 70 + 4 * ROW, height: ROW, display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
        <Handwrite text="3x + 6 = 15  →  x = 3" start={6.3} dur={0.7} style={{ fontSize: 86, color: B.blue }} />
      </div>

      {/* selection action bar */}
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 555,
          display: 'flex',
          gap: 10,
          padding: 10,
          background: 'white',
          borderRadius: 18,
          boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
          transform: `scale(${barPop * (1 - barGone)})`,
          transformOrigin: 'top left',
          fontFamily: sans,
          fontSize: 24,
          fontWeight: 600,
        }}
      >
        <div style={{ padding: '14px 22px', borderRadius: 12, color: B.ink, background: 'rgba(0,0,0,0.05)' }}>✦ Ask AI</div>
        <div style={{ position: 'relative', transform: `scale(${press})` }}>
          <div style={{ padding: '14px 22px', borderRadius: 12, color: 'white', background: B.purple }}>Find my mistake</div>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 160,
              height: 160,
              marginLeft: -80,
              marginTop: -80,
              borderRadius: 80,
              border: `5px solid ${B.purple}`,
              opacity: ripple > 0 && ripple < 1 ? 1 - ripple : 0,
              transform: `scale(${0.2 + ripple})`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

const REPLY = 'Step 2 is the slip. The 3 multiplies both terms inside the parentheses:';

const Panel: React.FC = () => {
  const t = useT();
  const slide = springAt(t, 3.9, { damping: 20, mass: 0.7 });
  const chars = Math.floor(interpolate(t, [4.75, 5.5], [0, REPLY.length], clamp));
  const dotsOn = t >= 4.3 && t < 4.75;
  const item = springAt(t, 4.1, { damping: 15 });

  return (
    <div
      style={{
        position: 'absolute',
        top: BAR_H,
        bottom: 0,
        right: 0,
        width: PANEL_W,
        background: 'white',
        borderLeft: `1px solid ${B.border}`,
        boxShadow: '-8px 0 30px rgba(0,0,0,0.06)',
        transform: `translateX(${(1 - slide) * (PANEL_W + 40)}px)`,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        fontFamily: sans,
        zIndex: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: B.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Squid size={38} color="white" />
        </div>
        <div style={{ fontWeight: 700, fontSize: 24, color: B.ink }}>InkBuddy</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: B.muted, border: `1px solid ${B.border}`, padding: '6px 12px', borderRadius: 999 }}>Claude Opus 5.5</div>
      </div>

      <div style={{ alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, opacity: item, transform: `translateY(${(1 - item) * 20}px)` }}>
        <div style={{ border: `1px solid ${B.border}`, borderRadius: 12, padding: '8px 16px', background: B.paper, fontFamily: hand, fontWeight: 600, fontSize: 26, lineHeight: 1.05, color: B.ink }}>
          {LINES.map((l) => (
            <div key={l.text}>{l.text}</div>
          ))}
        </div>
        <div style={{ background: B.ink, color: 'white', fontSize: 22, fontWeight: 500, padding: '12px 18px', borderRadius: 18 }}>Find my mistake</div>
      </div>

      {dotsOn && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 4px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: 6, background: B.muted, opacity: 0.35 + 0.65 * Math.max(0, Math.sin(t * 14 - i)) }} />
          ))}
        </div>
      )}

      {t >= 4.75 && (
        <div style={{ fontSize: 24, lineHeight: 1.45, color: B.ink }}>
          {REPLY.slice(0, chars)}
          <div
            style={{
              opacity: prog(t, 5.55, 0.2),
              margin: '14px 0',
              padding: '14px 18px',
              background: '#F6F4FF',
              borderRadius: 12,
              fontFamily: 'Times New Roman, serif',
              fontStyle: 'italic',
              fontSize: 30,
              textAlign: 'center',
            }}
          >
            3(x + 2) = 3x + 6
          </div>
          <div style={{ opacity: prog(t, 5.8, 0.2) }}>
            So 3x = 9, and <b>x = 3</b>. I circled the step on your page.
          </div>
        </div>
      )}
    </div>
  );
};

/** Camera keyframes: [time, scale, focusX, focusY] in stage coordinates. */
const CAM: [number, number, number, number][] = [
  [0, 1.5, 620, 500],
  [1.9, 1.42, 640, 520],
  [2.6, 1, 960, 590],
  [4.6, 1, 960, 590],
  [5.3, 1.45, 800, 560],
  [7.9, 1.5, 800, 600],
  [8.5, 1, 960, 590],
];

export const Demo: React.FC = () => {
  const t = useT();
  const ts = CAM.map((k) => k[0]);
  const at = (i: number) => interpolate(t, ts, CAM.map((k) => k[i]), { ...clamp, easing: ease.inOut });
  const s = at(1);
  const fx = at(2);
  const fy = at(3);
  const enter = springAt(t, 0, { damping: 20 });

  return (
    <AbsoluteFill style={{ background: B.bg, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: '0 0',
          transform: `translate(960px, 540px) scale(${s}) translate(${-fx}px, ${-fy}px) translateY(${(1 - enter) * 120}px)`,
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
            background: B.ink,
            padding: TAB.bezel,
            boxSizing: 'border-box',
            boxShadow: '0 40px 100px rgba(0,0,0,0.22)',
          }}
        >
          <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 28, overflow: 'hidden', background: 'white' }}>
            <TopBar lassoActive={t >= 2.1 && t < 3.95} />
            <Page />
            <Panel />
          </div>
        </div>
      </div>
      <Caption />
    </AbsoluteFill>
  );
};

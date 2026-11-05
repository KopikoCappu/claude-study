import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { MaskUp, clamp, ease, hand, prog, sans, springAt, useT } from '../common';
import { CS, SIGNS, TABLET, serif } from './theme';

export const typed = (s: string, t: number, a: number, b: number) => s.slice(0, Math.floor(interpolate(t, [a, b], [0, s.length], clamp)));

/** Title-card settings. handTitle hides the "Claude Study" lettering so a hand-drawn version can be laid over it. */
export const TitleCtx = React.createContext({ handTitle: false });

/** photo: the landscape look (like the Pufferfish video). claude: claude.ai's ivory, serif and orange. */
export type Look = 'photo' | 'claude';
export const LookCtx = React.createContext<Look>('photo');

export function useLook() {
  const claude = React.useContext(LookCtx) === 'claude';
  return claude
    ? { claude, head: CS.ink, headFont: serif, headWeight: 500, headTrack: '-0.03em', sub: CS.muted, shadow: 'none' }
    : { claude, head: 'white', headFont: sans, headWeight: 900, headTrack: '-0.045em', sub: 'rgba(255,255,255,0.9)', shadow: '0 4px 30px rgba(0,0,0,0.35)' };
}

export const Logo: React.FC<{ size: number; color?: string; style?: React.CSSProperties }> = ({ size, color = CS.clay, style }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} style={style}>
    <g transform="translate(50 50) rotate(-8) scale(0.94) translate(-50 -50)">
      <path fill={color} fillRule="evenodd" d={`${TABLET} ${SIGNS.join(' ')}`} />
    </g>
  </svg>
);

/** A path that draws itself between `start` and `start + dur`. */
export const Stroke: React.FC<{ d: string; start: number; dur: number; color: string; width: number; dash?: string; opacity?: number }> = ({
  d,
  start,
  dur,
  color,
  width,
  dash,
  opacity = 1,
}) => {
  const p = prog(useT(), start, dur, ease.out);
  if (p <= 0) return null;
  if (dash) {
    // Dashed lines can't use the dash trick to draw on, so reveal them with a growing mask instead.
    const ev = evolvePath(p, d);
    return (
      <>
        <defs>
          <mask id={`m${start}`}>
            <path d={d} fill="none" stroke="white" strokeWidth={width + 6} strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
          </mask>
        </defs>
        <path d={d} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" mask={`url(#m${start})`} opacity={opacity} />
      </>
    );
  }
  const ev = evolvePath(p, d);
  return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} opacity={opacity} />;
};

/** Bottom-left captions: white pills that slide up out of a mask (same look as the Pufferfish video). */
export const Captions: React.FC<{ items: [number, number, React.ReactNode][] }> = ({ items }) => {
  const L = useLook();
  const look: React.CSSProperties = L.claude
    ? { background: CS.paper, border: `1.5px solid ${CS.border}`, fontFamily: serif, fontWeight: 500, fontSize: 56, letterSpacing: '-0.02em', padding: '14px 30px 18px' }
    : { background: 'white', fontFamily: sans, fontWeight: 800, fontSize: 62, letterSpacing: '-0.045em', padding: '16px 30px 20px' };
  return (
  <div style={{ position: 'absolute', left: 90, bottom: 56, zIndex: 20 }}>
    {items.map(([a, b, text], i) => (
      <div key={i} style={{ position: 'absolute', left: 0, bottom: 0 }}>
        <MaskUp at={a} out={b} dur={0.45}>
          <div
            style={{
              whiteSpace: 'nowrap',
              color: CS.ink,
              borderRadius: 24,
              ...look,
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

/** The highlighted words in a caption: white on Claude orange. */
export const Hl: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const L = useLook();
  if (L.claude) return <span style={{ color: CS.primary, fontStyle: 'italic' }}>{children}</span>;
  return <span style={{ background: CS.clay, color: 'white', padding: '0 12px 4px', borderRadius: 12, display: 'inline-block' }}>{children}</span>;
};

/** The background photo for the Claude Study video. Drop an image in video/public/bg/ and put its name here. */
export const BG_PHOTO = 'bg/forest.jpg';

/** The landscape photo behind every scene. Blur it behind the app, dim it behind big text. */
export const Backdrop: React.FC<{ blur?: number; dim?: number }> = ({ blur = 0, dim = 0 }) => {
  const t = useT();
  const L = useLook();
  if (L.claude) {
    // Ivory page with a soft orange glow that drifts, and a faint dot grid.
    return (
      <AbsoluteFill style={{ background: CS.bg, overflow: 'hidden' }}>
        <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(20,20,19,0.07) 1.5px, transparent 1.5px)', backgroundSize: '34px 34px' }} />
        <div
          style={{
            position: 'absolute',
            width: 1500,
            height: 1500,
            left: 700 + Math.sin(t * 0.4) * 120,
            top: -700 + Math.cos(t * 0.3) * 80,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${CS.clay}2E, ${CS.clay}00 60%)`,
          }}
        />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: CS.night }}>
      <Img
        src={staticFile(BG_PHOTO)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${1.08 + t * 0.004})`,
          filter: blur ? `blur(${blur}px)` : undefined,
        }}
      />
      {dim > 0 && <AbsoluteFill style={{ background: `rgba(10,10,8,${dim})` }} />}
    </AbsoluteFill>
  );
};

/** A tap: finger-sized dot that presses in, with a ripple. */
export const Tap: React.FC<{ x: number; y: number; at: number }> = ({ x, y, at }) => {
  const t = useT();
  const show = interpolate(t, [at - 0.3, at - 0.15, at + 0.25, at + 0.45], [0, 1, 1, 0], clamp);
  const press = interpolate(t, [at - 0.1, at, at + 0.15], [1, 0.8, 1], clamp);
  const ripple = prog(t, at, 0.45, ease.out);
  return (
    <div style={{ position: 'absolute', left: x - 30, top: y - 30, width: 60, height: 60, pointerEvents: 'none', zIndex: 30 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 30, background: 'rgba(20,20,19,0.22)', opacity: show, transform: `scale(${press})` }} />
      {ripple > 0 && ripple < 1 && (
        <div style={{ position: 'absolute', inset: -30, borderRadius: 60, border: `4px solid ${CS.clay}`, opacity: 1 - ripple, transform: `scale(${0.3 + ripple})` }} />
      )}
    </div>
  );
};

// ---------------------------------------------------------------- tablet + app chrome

export const TAB = { x: 140, y: 56, w: 1640, h: 900, bezel: 18 };
export const SCREEN_W = TAB.w - TAB.bezel * 2;
export const SCREEN_H = TAB.h - TAB.bezel * 2;
export const BAR_H = 72;
export const PANEL_W = 640;

const Icon: React.FC<{ active?: boolean; children: React.ReactNode }> = ({ active, children }) => (
  <div style={{ width: 48, height: 48, borderRadius: 12, background: active ? CS.selected : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={CS.icon} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  </div>
);

export const Sparkle: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
  </svg>
);

const TopBar: React.FC<{ title: string; lasso: boolean; tools: boolean }> = ({ title, lasso, tools }) => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: BAR_H,
      background: CS.bg,
      borderBottom: `1px solid ${CS.border}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 6,
      zIndex: 5,
      fontFamily: sans,
    }}
  >
    <Icon>
      <path d="M15 5l-7 7 7 7" />
    </Icon>
    <div style={{ fontWeight: 600, fontSize: 22, color: CS.text, marginLeft: 6 }}>{title}</div>
    <div style={{ flex: 1 }} />
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
    <div style={{ width: 30, height: 30, borderRadius: 15, background: CS.ink, margin: '0 10px' }} />
    <div style={{ width: 1, height: 30, background: CS.border, margin: '0 6px' }} />
    <Icon>
      <path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />
    </Icon>
    <Icon active={tools}>
      <path d="M10 4a2 2 0 1 1 4 0v1h4v4h-1a2 2 0 1 0 0 4h1v5h-5v-1a2 2 0 1 0-4 0v1H4v-5h1a2 2 0 1 0 0-4H4V5h6z" />
    </Icon>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 19, color: 'white', background: CS.primary, padding: '11px 20px', borderRadius: 999, marginLeft: 8 }}>
      <Sparkle size={18} color="white" />
      Ask Claude
    </div>
  </div>
);

/** A stylus resting against the tablet's right edge. */
export const Stylus: React.FC = () => (
  <div style={{ position: 'absolute', left: TAB.x + TAB.w + 26, top: TAB.y + 150, width: 26, height: 620, transform: 'rotate(2deg)', filter: 'drop-shadow(0 12px 18px rgba(0,0,0,0.3))' }}>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 70, borderRadius: '13px 13px 4px 4px', background: 'linear-gradient(to right, #FFFFFF, #E9E7E1 60%, #CFCCC4)' }} />
    <div style={{ position: 'absolute', left: 3, right: 3, bottom: 14, height: 60, clipPath: 'polygon(0 0, 100% 0, 60% 100%, 40% 100%)', background: 'linear-gradient(to right, #F4F2EC, #C9C6BE)' }} />
    <div style={{ position: 'absolute', left: 11, width: 4, bottom: 6, height: 12, borderRadius: 2, background: '#55534E' }} />
  </div>
);

/** Camera keyframes: [time, scale, focusX, focusY] in stage pixels. */
export type Cam = [number, number, number, number][];

export const Tablet: React.FC<{
  title?: string;
  lasso?: boolean;
  tools?: boolean;
  panelAt: number;
  cam?: Cam;
  enterAt?: number;
  page: React.ReactNode;
  panel: React.ReactNode;
  over?: React.ReactNode;
}> = ({ title = 'Bio · The cell', lasso = false, tools = false, panelAt, cam = [[0, 1, 960, 540]], enterAt = 0, page, panel, over }) => {
  const t = useT();
  const ts = cam.map((k) => k[0]);
  const at = (i: number) => (cam.length === 1 ? cam[0][i] : interpolate(t, ts, cam.map((k) => k[i]), { ...clamp, easing: ease.inOut }));
  const enter = enterAt < 0 ? 1 : springAt(t, enterAt, { damping: 20 });
  const slide = springAt(t, panelAt, { damping: 20, mass: 0.7 });
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transformOrigin: '0 0',
        transform: `translate(960px, 540px) scale(${at(1)}) translate(${-at(2)}px, ${-at(3)}px) translateY(${(1 - enter) * 140}px)`,
        opacity: Math.min(1, enter * 1.5),
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: TAB.x,
          top: TAB.y,
          width: TAB.w,
          height: TAB.h,
          borderRadius: 46,
          background: CS.night,
          padding: TAB.bezel,
          boxSizing: 'border-box',
          boxShadow: '0 50px 120px rgba(60,40,20,0.28)',
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 30, overflow: 'hidden', background: CS.bg }}>
          <TopBar title={title} lasso={lasso} tools={tools} />
          <div style={{ position: 'absolute', top: BAR_H, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>{page}</div>
          <div
            style={{
              position: 'absolute',
              top: BAR_H,
              bottom: 0,
              right: 0,
              width: PANEL_W,
              background: CS.bg,
              borderLeft: `1px solid ${CS.border}`,
              boxShadow: '-10px 0 30px rgba(60,40,20,0.06)',
              transform: `translateX(${(1 - slide) * (PANEL_W + 40)}px)`,
              padding: 28,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              fontFamily: sans,
              zIndex: 4,
            }}
          >
            {panel}
          </div>
          {over}
        </div>
      </div>
      <Stylus />
    </div>
  );
};

/** White lined page sitting on the app's ivory background. */
export const Sheet: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      position: 'absolute',
      left: 60,
      top: 36,
      width: 1000,
      height: 1200,
      background: `repeating-linear-gradient(to bottom, transparent 0, transparent 98px, ${CS.rule} 98px, ${CS.rule} 100px), ${CS.paper}`,
      boxShadow: '0 2px 14px rgba(60,40,20,0.08)',
      borderRadius: 4,
    }}
  >
    {children}
  </div>
);

/** Handwriting that writes itself left to right. */
export const Ink: React.FC<{ text: string; x: number; y: number; start: number; dur: number; size?: number; color?: string; rotate?: number }> = ({
  text,
  x,
  y,
  start,
  dur,
  size = 78,
  color = '#2A2926',
  rotate = 0,
}) => {
  const p = prog(useT(), start, dur, (v) => v);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        fontFamily: hand,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1,
        color,
        whiteSpace: 'nowrap',
        transform: `rotate(${rotate}deg)`,
        clipPath: `inset(-40% ${100 - p * 106}% -40% -5%)`,
      }}
    >
      {text}
    </div>
  );
};

export const PanelHeader: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <Logo size={40} />
    <div style={{ fontFamily: serif, fontWeight: 500, fontSize: 28, color: CS.text }}>{label}</div>
    <div style={{ flex: 1 }} />
    <div style={{ fontSize: 16, fontWeight: 600, color: CS.muted, border: `1px solid ${CS.border}`, padding: '6px 12px', borderRadius: 999 }}>Claude Opus 5.5</div>
  </div>
);

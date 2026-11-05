import React from 'react';
import { interpolate } from 'remotion';
import { B, MaskUp, Squid, clamp, ease, prog, sans, springAt, useT } from '../common';

export const mono = 'ui-monospace, "Cascadia Code", Consolas, monospace';

export const typed = (s: string, t: number, a: number, b: number) =>
  s.slice(0, Math.floor(interpolate(t, [a, b], [0, s.length], clamp)));

/** Bottom-left captions that slide in and out, like the main demo. */
export const Captions: React.FC<{ items: [number, number, React.ReactNode][] }> = ({ items }) => (
  <div style={{ position: 'absolute', left: 90, bottom: 56, zIndex: 20 }}>
    {items.map(([a, b, text], i) => (
      <div key={i} style={{ position: 'absolute', left: 0, bottom: 0 }}>
        <MaskUp at={a} out={b} dur={0.45}>
          <div
            style={{
              whiteSpace: 'nowrap',
              background: 'rgba(11,11,16,0.92)',
              color: 'white',
              fontFamily: sans,
              fontWeight: 800,
              fontSize: 58,
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

export const Dots: React.FC<{ t: number }> = ({ t }) => (
  <div style={{ display: 'flex', gap: 8, padding: '8px 4px' }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ width: 12, height: 12, borderRadius: 6, background: B.muted, opacity: 0.35 + 0.65 * Math.max(0, Math.sin(t * 14 - i)) }} />
    ))}
  </div>
);

/** A button that gets pressed at `at` with a ripple. */
export const PressButton: React.FC<{ at: number; children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({
  at,
  children,
  color = B.purple,
  style,
}) => {
  const t = useT();
  const press = interpolate(t, [at - 0.08, at, at + 0.12], [1, 0.9, 1], clamp);
  const ripple = prog(t, at, 0.4, ease.out);
  return (
    <div style={{ position: 'relative', transform: `scale(${press})`, ...style }}>
      <div style={{ padding: '12px 22px', borderRadius: 12, color: 'white', background: color, fontFamily: sans, fontWeight: 600, fontSize: 22 }}>{children}</div>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 150,
          height: 150,
          marginLeft: -75,
          marginTop: -75,
          borderRadius: 75,
          border: `5px solid ${color}`,
          opacity: ripple > 0 && ripple < 1 ? 1 - ripple : 0,
          transform: `scale(${0.2 + ripple})`,
        }}
      />
    </div>
  );
};

// ---------- InkBuddy app frame (tablet) ----------

export const APP = { x: 80, y: 46, w: 1760, h: 880, bezel: 16 };
export const INNER_W = APP.w - APP.bezel * 2;
export const BAR_H = 72;
export const PANEL_W = 480;
export const PAGE_H = APP.h - APP.bezel * 2 - BAR_H;
/** Stage position of the page's top-left corner. */
export const PAGE_X = APP.x + APP.bezel;
export const PAGE_Y = APP.y + APP.bezel + BAR_H;

const ToolIcon: React.FC<{ active?: boolean; children: React.ReactNode }> = ({ active, children }) => (
  <div style={{ width: 50, height: 50, borderRadius: 12, background: active ? 'rgba(0,0,0,0.07)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#3A3A3C" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  </div>
);

const TopBar: React.FC<{ title: string; lasso: boolean }> = ({ title, lasso }) => (
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
    <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 22, color: B.ink, marginLeft: 8, marginRight: 30 }}>{title}</div>
    <ToolIcon active={!lasso}>
      <path d="M4 20l4-1 11-11-3-3L5 16z" />
    </ToolIcon>
    <ToolIcon>
      <path d="M9 15l-4 5h6l8-8-4-4z" />
    </ToolIcon>
    <ToolIcon active={lasso}>
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

export const PanelHeader: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{ width: 44, height: 44, borderRadius: 12, background: B.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Squid size={38} color="white" />
    </div>
    <div style={{ fontWeight: 700, fontSize: 24, color: B.ink }}>InkBuddy</div>
    <div style={{ flex: 1 }} />
    <div style={{ fontSize: 16, fontWeight: 600, color: B.muted, border: `1px solid ${B.border}`, padding: '6px 12px', borderRadius: 999 }}>Claude Opus 5.5</div>
  </div>
);

/** Camera keyframes: [time, scale, focusX, focusY] in stage coordinates. */
export type Cam = [number, number, number, number][];

export const AppFrame: React.FC<{
  title: string;
  lasso: boolean;
  panelAt: number;
  cam: Cam;
  page: React.ReactNode;
  panel: React.ReactNode;
  over?: React.ReactNode;
}> = ({ title, lasso, panelAt, cam, page, panel, over }) => {
  const t = useT();
  const ts = cam.map((k) => k[0]);
  const at = (i: number) => interpolate(t, ts, cam.map((k) => k[i]), { ...clamp, easing: ease.inOut });
  const enter = springAt(t, 0, { damping: 20 });
  const slide = springAt(t, panelAt, { damping: 20, mass: 0.7 });
  return (
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
          left: APP.x,
          top: APP.y,
          width: APP.w,
          height: APP.h,
          borderRadius: 44,
          background: B.ink,
          padding: APP.bezel,
          boxSizing: 'border-box',
          boxShadow: '0 40px 100px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 28, overflow: 'hidden', background: B.bg }}>
          <TopBar title={title} lasso={lasso} />
          <div style={{ position: 'absolute', top: BAR_H, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>{page}</div>
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
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              fontFamily: sans,
              zIndex: 4,
            }}
          >
            <PanelHeader />
            {panel}
          </div>
          {over}
        </div>
      </div>
    </div>
  );
};

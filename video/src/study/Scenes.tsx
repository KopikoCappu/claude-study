import React, { useContext } from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { MaskUp, clamp, ease, hand, prog, roughEllipse, sans, springAt, useT } from '../common';
import { CS, serif } from './theme';
import { CellViz, DRAG, PICK_AT, pickedPoint } from './Cell';
import { LASSO_BOX, MessyPage, PageCrop } from './Messy';
import { BAR_H, Backdrop, Captions, Hl, Ink, Logo, useLook, PANEL_W, PanelHeader, SCREEN_W, Sheet, Sparkle, Stroke, TAB, Tablet, Tap, TitleCtx, typed } from './ui';

// Stage position of the panel's content box (below its header), for placing taps.
const PANEL_X = TAB.x + TAB.bezel + SCREEN_W - PANEL_W + 28;
const PANEL_Y = TAB.y + TAB.bezel + BAR_H + 86;

const VERBS = ['Pondering', 'Sharpening pencils', 'Flipping through your notes', 'Connecting the dots', 'Double-checking'];

// ---------------------------------------------------------------- 1. cold open: the payoff first

export const OPEN_S = 3.6;

export const Open: React.FC = () => {
  const t = useT();
  const push = interpolate(t, [0, OPEN_S], [1.42, 1.5], clamp);
  return (
    <AbsoluteFill>
      <Backdrop blur={22} dim={0.12} />
      <div style={{ position: 'absolute', left: 900 - 270 * push, filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.25))', top: 470 - 560 * push, width: 1100, height: 1300, transformOrigin: '0 0', transform: `scale(${push})` }}>
        <MessyPage lassoAt={0.3} labelAt={1.3} />
      </div>
      <Captions items={[[0.5, 99, <>Circle it. <Hl>Claude knows what you mean.</Hl></>]]} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 2. the question

export const QUESTION_S = 3.3;

export const Question: React.FC = () => {
  const t = useT();
  const L = useLook();
  const words = ['point', 'at', 'it?'];
  return (
    <AbsoluteFill>
      <Backdrop dim={0.55} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: L.headFont, fontWeight: L.headWeight, fontSize: L.claude ? 120 : 124, letterSpacing: L.claude ? '-0.035em' : '-0.05em', color: L.head }}>
        <MaskUp at={0.1}>What if you could just</MaskUp>
        <div style={{ display: 'flex', gap: 26, marginTop: 18 }}>
          {words.map((w, i) => {
            const k = springAt(t, 0.55 + i * 0.12, { damping: 12, mass: 0.5, stiffness: 200 });
            return (
              <div
                key={w}
                style={{
                  background: 'white',
                  color: CS.ink,
                  border: L.claude ? `2px solid ${CS.border}` : undefined,
                  boxShadow: L.claude ? '0 10px 30px rgba(60,40,20,0.10)' : undefined,
                  padding: '0 26px 14px',
                  borderRadius: 22,
                  opacity: Math.min(1, k * 2),
                  transform: `scale(${0.6 + 0.4 * k}) rotate(${(1 - k) * -6}deg)`,
                }}
              >
                {i === 2 ? <span style={{ color: CS.clay }}>{w}</span> : w}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 3. title

export const TITLE_S = 3.2;

export const Title: React.FC = () => {
  const t = useT();
  const L = useLook();
  const { handTitle } = useContext(TitleCtx);
  const pop = springAt(t, 0.15, { damping: 11 });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Backdrop blur={16} dim={0.35} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
        <Logo size={170} style={{ transform: `scale(${pop}) rotate(${(1 - pop) * -30}deg)`, filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.35))' }} />
        <div style={{ fontFamily: serif, fontWeight: 500, fontSize: 168, letterSpacing: '-0.035em', color: L.head, opacity: handTitle ? 0 : 1, textShadow: L.shadow }}>
          <MaskUp at={0.35}>Claude Study</MaskUp>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 700, fontFamily: L.claude ? serif : sans, fontWeight: L.claude ? 400 : 600, fontSize: 44, letterSpacing: '-0.02em', color: L.sub }}>
        <MaskUp at={0.95}>Ask Claude right on your notes.</MaskUp>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 4. point at it

export const POINT_S = 9.6;

const LASSO_AT = 0.7;
const ASK_AT = 2.2;
const REPLY = 'That’s a mitochondrion. It turns food into energy (ATP) the cell can use. I labeled it on your page.';

const SelectionBar: React.FC = () => {
  const t = useT();
  const s = springAt(t, LASSO_AT + 0.9, { damping: 16 });
  const out = prog(t, ASK_AT + 0.2, 0.25);
  if (s <= 0.01 || out >= 1) return null;
  const press = interpolate(t, [ASK_AT - 0.1, ASK_AT, ASK_AT + 0.1], [1, 0.9, 1], clamp);
  const btn = (label: string, primary = false) => (
    <div
      style={{
        padding: '12px 20px',
        borderRadius: 999,
        fontFamily: sans,
        fontWeight: 600,
        fontSize: 21,
        color: primary ? 'white' : CS.text,
        background: primary ? CS.primary : 'transparent',
        transform: `scale(${primary ? press : 1})`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {primary && <Sparkle size={18} color="white" />}
      {label}
    </div>
  );
  return (
    <div
      style={{
        position: 'absolute',
        left: 60 + 40,
        top: 36 + 592,
        display: 'flex',
        gap: 4,
        padding: 6,
        background: CS.paper,
        border: `1px solid ${CS.border}`,
        borderRadius: 999,
        boxShadow: '0 10px 30px rgba(60,40,20,0.14)',
        opacity: Math.min(1, s) * (1 - out),
        transform: `translateY(${(1 - s) * 16}px)`,
        zIndex: 3,
      }}
    >
      {btn('Ask')}
      {btn('What is this?', true)}
      {btn('Explain')}
    </div>
  );
};

const Working: React.FC<{ t: number }> = ({ t }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, color: CS.muted }}>
    <div style={{ transform: `rotate(${t * 240}deg) scale(${1 + 0.12 * Math.sin(t * 9)})` }}>
      <Sparkle size={24} color={CS.clay} />
    </div>
    {VERBS[Math.floor(t / 0.5) % VERBS.length]}…
  </div>
);

const PointPanel: React.FC = () => {
  const t = useT();
  const user = springAt(t, ASK_AT + 0.4, { damping: 18 });
  const thinking = t >= ASK_AT + 0.7 && t < 4.0;
  return (
    <>
      <PanelHeader label="Claude" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 10 }}>
        <div style={{ alignSelf: 'flex-end', opacity: Math.min(1, user), transform: `translateY(${(1 - user) * 20}px)`, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ padding: 6, border: `2px dashed ${CS.lasso}`, borderRadius: 14, background: CS.paper }}>
            <PageCrop {...LASSO_BOX} scale={0.8} />
          </div>
          <div style={{ background: 'rgba(20,20,19,0.06)', padding: '12px 18px', borderRadius: 18, fontSize: 22, color: CS.text }}>What is this?</div>
        </div>
        {thinking && <Working t={t} />}
        {t >= 4.0 && <div style={{ fontFamily: serif, fontSize: 27, lineHeight: 1.45, color: CS.text }}>{typed(REPLY, t, 4.0, 5.6)}</div>}
      </div>
    </>
  );
};

export const Point: React.FC = () => {
  const t = useT();
  return (
    <AbsoluteFill>
      <Backdrop blur={22} dim={0.12} />
      <Tablet
        title="Unit 3 · Cells"
        lasso={t > LASSO_AT - 0.2 && t < ASK_AT + 0.3}
        panelAt={ASK_AT + 0.2}
        cam={[
          [0, 1, 960, 540],
          [0.4, 1.45, 560, 640],
          [ASK_AT, 1.45, 560, 640],
          [ASK_AT + 0.6, 1, 960, 540],
          [4.6, 1, 960, 540],
          [5.1, 1.12, 900, 580],
          [POINT_S, 1.12, 900, 580],
        ]}
        page={
          <>
            <MessyPage lassoAt={LASSO_AT} lassoOut={ASK_AT + 0.6} labelAt={5.2} />
            <SelectionBar />
          </>
        }
        panel={<PointPanel />}
      />
      <Captions
        items={[
          [0.3, 2.3, <>Just <Hl>circle the part</Hl> you mean.</>],
          [2.35, 4.0, 'Ask Claude.'],
          [4.05, 6.0, <>Claude sees <Hl>exactly what you circled.</Hl></>],
          [6.05, 99, <>…and labels it <Hl>on your page.</Hl></>],
        ]}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 5. build an artifact: a 3D cell

export const BUILD_S = 12.6;

const PROMPT = 'Show me this in 3D';
const FACTS = ['Testing yourself beats rereading. Recalling something makes it stick.', 'Explaining an idea to someone else is one of the fastest ways to find the gaps in it.'];
const CARD = { top: 94, h: 530 };
const VIZ_AT = { left: 28, top: 70 };
const PARTS = ['Nucleus', 'Mitochondria', 'Ribosomes'];

const Building: React.FC<{ t: number }> = ({ t }) => {
  const p = prog(t, 2.0, 3.1, (v) => v);
  const chars = (p * 24.8).toFixed(1);
  const secs = Math.floor(p * 22);
  const fact = FACTS[t < 3.7 ? 0 : 1];
  const factFade = interpolate(t, [3.55, 3.7, 3.85], [1, 0, 1], clamp);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 70, textAlign: 'center' }}>
      <svg width={48} height={48} viewBox="0 0 48 48" style={{ transform: `rotate(${t * 360}deg)` }}>
        <circle cx={24} cy={24} r={19} fill="none" stroke={CS.border} strokeWidth={5} />
        <path d="M24 5 A19 19 0 0 1 43 24" fill="none" stroke={CS.clay} strokeWidth={5} strokeLinecap="round" />
      </svg>
      <div style={{ fontFamily: serif, fontSize: 32, fontWeight: 500, color: CS.text }}>3D cell explorer</div>
      <div style={{ fontSize: 19, color: CS.muted }}>{p < 0.12 ? 'Planning the artifact…' : `Writing the artifact · ${chars}k characters`}</div>
      <div style={{ width: 420, height: 8, borderRadius: 4, background: CS.selected, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(95, p * 100)}%`, height: '100%', background: CS.clay, borderRadius: 4 }} />
      </div>
      <div style={{ fontSize: 18, color: CS.muted }}>{secs}s · You can keep taking notes.</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 440, marginTop: 30, fontSize: 18, color: CS.muted, opacity: factFade }}>
        <span style={{ fontSize: 22 }}>💡</span>
        {fact}
      </div>
    </div>
  );
};

const Artifact: React.FC<{ t: number }> = ({ t }) => {
  const k = springAt(t, 5.15, { damping: 13, mass: 0.7 });
  const glow = prog(t, 5.15, 1.2, ease.out);
  const picked = t >= PICK_AT;
  const info = prog(t, PICK_AT + 0.3, 0.45, ease.out);
  const hint = interpolate(t, [5.6, 6.0, DRAG[1], DRAG[1] + 0.3], [0, 1, 1, 0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        top: CARD.top,
        left: 0,
        right: 0,
        height: CARD.h,
        background: CS.paper,
        borderRadius: 22,
        border: `1px solid ${CS.border}`,
        boxShadow: `0 20px 50px rgba(60,40,20,0.12), 0 0 0 ${(1 - glow) * 22}px rgba(217,119,87,${0.35 * (1 - glow)})`,
        opacity: Math.min(1, k * 1.4),
        transform: `translateY(${(1 - Math.min(1, k)) * 40}px) scale(${0.9 + 0.1 * k})`,
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', left: 28, right: 28, top: 24, display: 'flex', alignItems: 'center', fontSize: 18, fontWeight: 600, color: CS.muted }}>
        <span style={{ color: CS.clay }}>✦</span>&nbsp; 3D cell explorer
        <div style={{ flex: 1 }} />
        <span style={{ opacity: hint }}>Drag to spin · tap a part</span>
      </div>
      <div style={{ position: 'absolute', left: VIZ_AT.left, top: VIZ_AT.top }}>
        <CellViz t={t} />
      </div>
      <div style={{ position: 'absolute', left: 28, right: 28, top: 412, display: 'flex', gap: 10 }}>
        {PARTS.map((p) => {
          const on = picked && p === 'Mitochondria';
          return (
            <div key={p} style={{ padding: '8px 16px', borderRadius: 999, fontSize: 18, fontWeight: 600, border: `1.5px solid ${on ? CS.clay : CS.border}`, background: on ? 'rgba(217,119,87,0.12)' : CS.bg, color: on ? CS.primary : CS.muted }}>
              {p}
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 28, right: 28, top: 462, fontSize: 21, lineHeight: 1.35, color: CS.text, opacity: info, transform: `translateY(${(1 - info) * 10}px)` }}>
        <b>Mitochondria</b> turn food into energy (ATP). <span style={{ color: CS.primary }}>That’s the part you circled.</span>
      </div>
    </div>
  );
};

const BuildPanel: React.FC = () => {
  const t = useT();
  const sendPress = interpolate(t, [1.6, 1.7, 1.82], [1, 0.85, 1], clamp);
  const sent = t >= 1.75;
  const building = t >= 1.95 && t < 5.3;
  const buildOut = 1 - prog(t, 4.95, 0.3);
  return (
    <>
      <PanelHeader label="Artifacts" />
      <div style={{ position: 'relative', flex: 1 }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 64,
            borderRadius: 16,
            border: `1px solid ${CS.border}`,
            background: CS.paper,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 20,
            fontSize: 22,
            color: sent ? CS.muted : CS.text,
          }}
        >
          {sent ? 'Ask for another…' : typed(PROMPT, t, 0.25, 1.4)}
          {!sent && t % 1 < 0.55 && <span style={{ width: 2, height: 26, background: CS.text, marginLeft: 2 }} />}
          <div style={{ position: 'absolute', right: 8, top: 8, width: 48, height: 48, borderRadius: 12, background: CS.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${sendPress})` }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </div>
        </div>
        {building && (
          <div style={{ position: 'absolute', top: CARD.top, left: 0, right: 0, opacity: buildOut, transform: `scale(${0.96 + 0.04 * buildOut})` }}>
            <Building t={t} />
          </div>
        )}
        {t >= 5.1 && <Artifact t={t} />}
      </div>
    </>
  );
};

const BUILD_CAM: [number, number, number, number][] = [
  [0, 1.08, 1100, 520],
  [1.9, 1.08, 1100, 520],
  [2.6, 1, 960, 540],
  [4.9, 1, 960, 540],
  [5.6, 1.17, 1240, 530],
  [9.0, 1.17, 1240, 530],
  [9.8, 1.06, 1060, 540],
  [12.6, 1.06, 1060, 540],
];

/** A finger dragging across the cell to spin it. */
const Drag: React.FC<{ x0: number; x1: number; y: number }> = ({ x0, x1, y }) => {
  const t = useT();
  const p = prog(t, DRAG[0], DRAG[1] - DRAG[0], ease.inOut);
  const show = interpolate(t, [DRAG[0] - 0.25, DRAG[0], DRAG[1], DRAG[1] + 0.25], [0, 1, 1, 0], clamp);
  const x = x0 + (x1 - x0) * p;
  return (
    <div style={{ position: 'absolute', left: x - 30, top: y - 30, width: 60, height: 60, opacity: show }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 30, background: 'rgba(20,20,19,0.22)', border: '3px solid rgba(255,255,255,0.8)' }} />
      <div style={{ position: 'absolute', right: 52, top: 26, width: Math.min(160, (x - x0) * 0.8), height: 8, borderRadius: 4, background: 'linear-gradient(to left, rgba(20,20,19,0.18), rgba(20,20,19,0))' }} />
    </div>
  );
};

export const Build: React.FC = () => {
  const t = useT();
  const L = useLook();
  const vx = PANEL_X + VIZ_AT.left;
  const vy = PANEL_Y + CARD.top + VIZ_AT.top;
  const [px, py] = pickedPoint();
  return (
    <AbsoluteFill>
      <Backdrop blur={22} dim={0.12} />
      <Tablet tools enterAt={-1} panelAt={-5} cam={BUILD_CAM} title="Unit 3 · Cells" page={<MessyPage labelAt={-10} glowAt={PICK_AT + 0.5} />} panel={<BuildPanel />} />
      {/* Taps are drawn on the stage, so they follow the camera through a matching transform. */}
      <CamLayer t={t} cam={BUILD_CAM}>
        <Tap x={PANEL_X + PANEL_W - 56 - 32} y={PANEL_Y + 32} at={1.7} />
        <Drag x0={vx + 120} x1={vx + 400} y={vy + 330} />
        <Tap x={vx + px} y={vy + py} at={PICK_AT} />
      </CamLayer>
      <Captions
        items={[
          [0.2, 1.9, 'Want to see it in 3D?'],
          [1.95, 5.0, 'Claude builds it from your notes.'],
          [5.05, 8.6, <>A 3D cell. <Hl>Spin it.</Hl></>],
          [8.65, 99, <>Tap a part. <Hl>It links back to your notes.</Hl></>],
        ]}
      />
      <div style={{ position: 'absolute', right: 70, top: 30, fontFamily: sans, fontSize: 20, fontWeight: 700, color: L.claude ? CS.muted : 'rgba(255,255,255,0.85)', opacity: interpolate(t, [1.9, 2.2, 4.8, 5.1], [0, 1, 1, 0], clamp) }}>
        build sped up 6×
      </div>
    </AbsoluteFill>
  );
};

const CamLayer: React.FC<{ t: number; cam: [number, number, number, number][]; children: React.ReactNode }> = ({ t, cam, children }) => {
  const ts = cam.map((k) => k[0]);
  const at = (i: number) => interpolate(t, ts, cam.map((k) => k[i]), { ...clamp, easing: ease.inOut });
  return (
    <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(960px, 540px) scale(${at(1)}) translate(${-at(2)}px, ${-at(3)}px)`, pointerEvents: 'none' }}>
      {children}
    </div>
  );
};

// ---------------------------------------------------------------- 6. anywhere: the same notebook on every device

export const ANY_S = 8;

// Device boxes on the stage.
const DEV = {
  tab: { x: 70, y: 200, w: 640, h: 450, at: 0.2 },
  lap: { x: 750, y: 150, w: 760, h: 476, at: 1.7 },
  phone: { x: 1580, y: 210, w: 262, h: 520, at: 3.2 },
};
const CELL_T = 9.2; // CellViz clock offset: shows the cell already spun, with the mitochondrion picked

const Synced: React.FC<{ at: number; x: number; y: number }> = ({ at, x, y }) => {
  const t = useT();
  const k = springAt(t, at, { damping: 14 });
  if (k < 0.01) return null;
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translateX(-50%) scale(${0.7 + 0.3 * Math.min(1, k)})`, opacity: Math.min(1, k * 1.5), display: 'flex', alignItems: 'center', gap: 8, background: 'white', borderRadius: 999, padding: '8px 18px', fontFamily: sans, fontSize: 20, fontWeight: 700, color: CS.green, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', whiteSpace: 'nowrap' }}>
      ✓ Synced
    </div>
  );
};

const enterStyle = (t: number, at: number): React.CSSProperties => {
  const k = springAt(t, at, { damping: 16 });
  return { opacity: Math.min(1, k * 1.5), transform: `translateY(${(1 - Math.min(1, k)) * 80}px)` };
};

const MiniCell: React.FC<{ scale: number; t: number }> = ({ scale, t }) => (
  <div style={{ width: 528 * scale, height: 330 * scale, position: 'relative' }}>
    <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `scale(${scale})` }}>
      <CellViz t={t + CELL_T} />
    </div>
  </div>
);

export const Anywhere: React.FC = () => {
  const t = useT();
  const { tab, lap, phone } = DEV;
  // Laptop cursor glides onto the cell and clicks.
  const cx = interpolate(t, [lap.at + 0.4, lap.at + 1.1], [lap.x + 250, lap.x + 560], { ...clamp, easing: ease.inOut });
  const cy = interpolate(t, [lap.at + 0.4, lap.at + 1.1], [lap.y + 380, lap.y + 230], { ...clamp, easing: ease.inOut });
  const click = prog(t, lap.at + 1.15, 0.4, ease.out);
  const curOn = interpolate(t, [lap.at + 0.3, lap.at + 0.5], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Backdrop blur={22} dim={0.22} />

      {/* sync lines between the devices */}
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Stroke d={`M ${tab.x + tab.w - 40} ${tab.y + 60} C ${tab.x + tab.w + 40} ${tab.y - 60} ${lap.x + 40} ${lap.y - 60} ${lap.x + 120} ${lap.y + 20}`} start={lap.at - 0.3} dur={0.6} color="white" width={4} dash="10 12" />
        <Stroke d={`M ${lap.x + lap.w - 60} ${lap.y + 40} C ${lap.x + lap.w + 30} ${lap.y - 70} ${phone.x + 40} ${phone.y - 70} ${phone.x + 120} ${phone.y + 10}`} start={phone.at - 0.3} dur={0.6} color="white" width={4} dash="10 12" />
      </svg>

      {/* tablet: the page with Claude's label */}
      <div style={{ position: 'absolute', left: tab.x, top: tab.y, width: tab.w, height: tab.h, borderRadius: 30, background: CS.night, padding: 14, boxSizing: 'border-box', boxShadow: '0 30px 70px rgba(0,0,0,0.4)', ...enterStyle(t, tab.at) }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 18, overflow: 'hidden', background: CS.bg }}>
          <PageCrop x={0} y={0} w={1000} h={700} scale={0.612} labeled style={{ borderRadius: 0 }} />
        </div>
      </div>

      {/* laptop: page + the 3D cell side by side */}
      <div style={{ position: 'absolute', left: lap.x, top: lap.y, width: lap.w, height: lap.h + 40, ...enterStyle(t, lap.at) }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: lap.w, height: lap.h, borderRadius: '22px 22px 6px 6px', background: CS.night, padding: 14, boxSizing: 'border-box', boxShadow: '0 30px 70px rgba(0,0,0,0.4)' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden', background: CS.bg, display: 'flex' }}>
            <PageCrop x={0} y={0} w={1000} h={1200} scale={0.375} labeled style={{ borderRadius: 0, flexShrink: 0 }} />
            <div style={{ flex: 1, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 10, borderLeft: `1px solid ${CS.border}` }}>
              <div style={{ fontFamily: sans, fontSize: 15, fontWeight: 600, color: CS.muted }}>
                <span style={{ color: CS.clay }}>✦</span> 3D cell · built from your notes
              </div>
              <MiniCell scale={0.66} t={t} />
              <div style={{ fontFamily: sans, fontSize: 16, color: CS.text }}>
                <b>Mitochondria</b> · <span style={{ color: CS.primary }}>linked to your page</span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ position: 'absolute', left: -70, right: -70, top: lap.h, height: 26, background: 'linear-gradient(#D8D6CF, #A9A69E)', clipPath: 'polygon(4% 0, 96% 0, 100% 100%, 0 100%)', borderRadius: '0 0 14px 14px' }} />
        {curOn > 0 && (
          <div style={{ position: 'absolute', left: cx - lap.x, top: cy - lap.y, opacity: curOn }}>
            {click > 0 && click < 1 && <div style={{ position: 'absolute', left: -24, top: -24, width: 48, height: 48, borderRadius: 24, border: `3px solid ${CS.clay}`, opacity: 1 - click, transform: `scale(${0.4 + click})` }} />}
            <svg width={30} height={36} viewBox="0 0 17 20" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
              <path d="M1 1 L1 16 L5 12.5 L8 19 L10.5 18 L7.6 11.6 L13 11.6 Z" fill="#111" stroke="white" strokeWidth={1.3} strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>

      {/* phone: the artifact, on the go */}
      <div style={{ position: 'absolute', left: phone.x, top: phone.y, width: phone.w, height: phone.h, borderRadius: 40, background: CS.night, padding: 11, boxSizing: 'border-box', boxShadow: '0 30px 70px rgba(0,0,0,0.4)', ...enterStyle(t, phone.at) }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 30, overflow: 'hidden', background: CS.bg, padding: '46px 8px 0', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, fontFamily: sans }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: CS.muted }}>
            <span style={{ color: CS.clay }}>✦</span> 3D cell
          </div>
          <MiniCell scale={0.44} t={t} />
          <div style={{ fontSize: 15, fontWeight: 700, color: CS.primary, border: `1.5px solid ${CS.clay}`, background: 'rgba(217,119,87,0.12)', borderRadius: 999, padding: '5px 14px' }}>Mitochondria</div>
          <div style={{ fontSize: 14, lineHeight: 1.4, color: CS.text, textAlign: 'center', padding: '0 10px' }}>Turns food into energy (ATP). From your Unit 3 notes.</div>
        </div>
      </div>
      <Tap x={phone.x + phone.w / 2} y={phone.y + 175} at={phone.at + 0.9} />

      <Synced at={tab.at + 0.6} x={tab.x + tab.w / 2} y={tab.y + tab.h + 26} />
      <Synced at={lap.at + 0.6} x={lap.x + lap.w / 2} y={lap.y + lap.h + 56} />
      <Synced at={phone.at + 0.6} x={phone.x + phone.w / 2} y={phone.y + phone.h + 26} />

      <Captions
        items={[
          [0.2, 1.65, 'Start on your tablet.'],
          [1.7, 3.15, 'Pick up on your laptop.'],
          [3.2, 4.9, 'Review on your phone.'],
          [4.95, 99, <>Notes, Claude and artifacts. <Hl>All in one place.</Hl></>],
        ]}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 7. outro

export const OUTRO_S = 5;

export const Outro: React.FC = () => {
  const t = useT();
  const { handTitle } = useContext(TitleCtx);
  const pop = springAt(t, 0.15, { damping: 12 });
  const pill = springAt(t, 1.0, { damping: 14 });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, #FFFFFF, ${CS.cream} 55%, #E9E6DC)`, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 330, display: 'flex', alignItems: 'center', gap: 34 }}>
        <Logo size={150} style={{ transform: `scale(${pop})` }} />
        <div style={{ fontFamily: serif, fontWeight: 500, fontSize: 150, letterSpacing: '-0.035em', color: CS.ink, opacity: handTitle ? 0 : 1 }}>
          <MaskUp at={0.3}>Claude Study</MaskUp>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 640, fontFamily: sans, fontWeight: 800, fontSize: 54, letterSpacing: '-0.04em', color: CS.ink }}>
        <MaskUp at={0.7}>Study anywhere. No screenshots, no app switching.</MaskUp>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 750,
          fontFamily: sans,
          fontWeight: 800,
          fontSize: 46,
          letterSpacing: '-0.035em',
          color: 'white',
          background: CS.ink,
          padding: '18px 44px 22px',
          borderRadius: 999,
          opacity: Math.min(1, pill * 1.5),
          transform: `scale(${0.85 + 0.15 * pill})`,
        }}
      >
        Just circle it and <span style={{ color: CS.clay }}>ask Claude.</span>
      </div>
      <div style={{ position: 'absolute', bottom: 46, fontFamily: sans, fontSize: 21, color: CS.muted, opacity: prog(t, 1.5, 0.6) }}>
        A concept built on the Claude API · Not affiliated with or endorsed by Anthropic
      </div>
    </AbsoluteFill>
  );
};

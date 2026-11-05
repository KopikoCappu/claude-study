import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { clamp, ease, prog, sans, springAt, useT } from '../common';
import { MessyPage, PageCrop } from './Messy';
import { CS } from './theme';
import { BAR_H, Backdrop, Captions, Hl, SCREEN_H, SCREEN_W, Stylus, TAB, Tap, typed } from './ui';

/**
 * The old way, on a tablet: a page full of notes, and you want to ask about one shape in it.
 * Screenshot → crop with your finger (never quite right) → app switcher → paste → "which part do you mean?" →
 * describe your own drawing in words.
 */
export const PROBLEM_S = 11;

const SX = TAB.x + TAB.bezel; // screen origin on the stage
const SY = TAB.y + TAB.bezel;

const SHOT_AT = 2.6;
const THUMB_TAP = 3.3;
const EDIT = [3.4, 5.05] as const;
const DONE_TAP = 4.95;
const SWITCH = 5.15;
const CHAT_TAP = 5.95;

// Crop rectangle in screen coordinates: [time, x, y, w, h]. A finger fights it into place.
const CROP: [number, number, number, number, number][] = [
  [3.5, 0, BAR_H, SCREEN_W, SCREEN_H - BAR_H],
  [3.9, 60, 240, 1000, 560],
  [4.2, 120, 420, 640, 360],
  [4.5, 150, 520, 330, 200],
  [4.8, 90, 470, 560, 330],
];
// The picture you end up pasting (sheet coordinates of the final crop).
const PASTED = { x: 90 - 60, y: 470 - BAR_H - 36, w: 560, h: 330 };

function cropAt(t: number) {
  const ts = CROP.map((c) => c[0]);
  return [1, 2, 3, 4].map((i) => interpolate(t, ts, CROP.map((c) => c[i]), { ...clamp, easing: ease.inOut })) as [number, number, number, number];
}

const AppBar: React.FC<{ title: string; sub?: string }> = ({ title, sub }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: BAR_H, background: '#F7F6F2', borderBottom: `1px solid ${CS.border}`, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 14, fontFamily: sans }}>
    <span style={{ fontSize: 22, color: '#2F6FEB' }}>‹ {sub ?? 'Back'}</span>
    <div style={{ flex: 1, textAlign: 'center', fontSize: 22, fontWeight: 600, color: CS.text, marginRight: 90 }}>{title}</div>
  </div>
);

const NotesApp: React.FC<{ pulse?: boolean }> = ({ pulse }) => (
  <div style={{ position: 'absolute', inset: 0, background: '#EDEBE6', overflow: 'hidden' }}>
    <AppBar title="Unit 3 · Cells" sub="Notes" />
    <div style={{ position: 'absolute', top: BAR_H, left: 0, right: 0, bottom: 0 }}>
      <MessyPage pulseAt={pulse ? [1.5, 2.6] : undefined} />
    </div>
  </div>
);

const Bubble: React.FC<{ me?: boolean; at: number; t: number; children: React.ReactNode }> = ({ me, at, t, children }) => {
  const k = springAt(t, at, { damping: 18 });
  if (t < at) return null;
  return (
    <div
      style={{
        alignSelf: me ? 'flex-end' : 'flex-start',
        maxWidth: 820,
        background: me ? '#ECEBE7' : 'transparent',
        padding: me ? '14px 20px' : '2px 0',
        borderRadius: 20,
        fontFamily: sans,
        fontSize: 26,
        lineHeight: 1.45,
        color: CS.text,
        opacity: Math.min(1, k * 1.5),
        transform: `translateY(${(1 - Math.min(1, k)) * 14}px)`,
      }}
    >
      {children}
    </div>
  );
};

const ChatApp: React.FC<{ t: number }> = ({ t }) => {
  const r1 = 'Which part do you mean? I can see a nucleus, the golgi, some arrows and a few labels. Could you describe it?';
  const q2 = 'the little bean shaped thing on the left side of the cell';
  const composing = t >= 8.2 && t < 9.6 ? typed(q2, t, 8.25, 9.45) : '';
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#FFFFFF', overflow: 'hidden' }}>
      <AppBar title="AI chat" sub="Chats" />
      <div style={{ position: 'absolute', top: BAR_H, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', padding: '30px 300px 0' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Bubble me at={6.35} t={t}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
              <PageCrop {...PASTED} scale={0.6} style={{ border: `1px solid ${CS.border}` }} />
              what is this?
            </div>
          </Bubble>
          <Bubble at={6.9} t={t}>{typed(r1, t, 6.9, 7.8)}</Bubble>
          <Bubble me at={9.6} t={t}>{q2}</Bubble>
        </div>
        <div style={{ height: 76, marginBottom: 34, borderRadius: 22, border: `1px solid ${CS.border}`, boxShadow: '0 4px 18px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', padding: '0 26px', fontFamily: sans, fontSize: 25, color: composing ? CS.text : '#A3A19A' }}>
          {composing || 'Message…'}
        </div>
      </div>
    </div>
  );
};

/** Full-screen crop editor over the screenshot. */
const CropEditor: React.FC<{ t: number }> = ({ t }) => {
  const [x, y, w, h] = cropAt(t);
  const shade = 'rgba(0,0,0,0.55)';
  const corner = (cx: number, cy: number, sx: number, sy: number) => (
    <div style={{ position: 'absolute', left: cx - (sx < 0 ? 0 : 30), top: cy - (sy < 0 ? 0 : 30), width: 30, height: 30, borderLeft: sx < 0 ? '6px solid white' : undefined, borderRight: sx > 0 ? '6px solid white' : undefined, borderTop: sy < 0 ? '6px solid white' : undefined, borderBottom: sy > 0 ? '6px solid white' : undefined }} />
  );
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#111' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <NotesApp />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: y, background: shade }} />
      <div style={{ position: 'absolute', left: 0, top: y + h, right: 0, bottom: 0, background: shade }} />
      <div style={{ position: 'absolute', left: 0, top: y, width: x, height: h, background: shade }} />
      <div style={{ position: 'absolute', left: x + w, top: y, right: 0, height: h, background: shade }} />
      <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, border: '2px solid white', boxSizing: 'border-box' }} />
      {corner(x, y, -1, -1)}
      {corner(x + w, y, 1, -1)}
      {corner(x, y + h, -1, 1)}
      {corner(x + w, y + h, 1, 1)}
      <div style={{ position: 'absolute', right: 30, top: 18, padding: '10px 22px', borderRadius: 999, background: '#2F6FEB', color: 'white', fontFamily: sans, fontWeight: 700, fontSize: 22 }}>Done</div>
    </div>
  );
};

/** A fingertip on the glass. */
const Finger: React.FC<{ x: number; y: number; show: number }> = ({ x, y, show }) => (
  <div style={{ position: 'absolute', left: x - 30, top: y - 30, width: 60, height: 60, borderRadius: 30, background: 'rgba(20,20,19,0.25)', border: '3px solid rgba(255,255,255,0.85)', opacity: show, zIndex: 30 }} />
);

export const Problem: React.FC = () => {
  const t = useT();
  const enter = springAt(t, 0, { damping: 20 });

  // Screenshot: white flash, then the shot shrinks to a thumbnail in the corner.
  const flash = interpolate(t, [SHOT_AT, SHOT_AT + 0.05, SHOT_AT + 0.3], [0, 0.9, 0], clamp);
  const shrink = prog(t, SHOT_AT + 0.05, 0.4, ease.out);
  const thumbOn = t >= SHOT_AT && t < EDIT[0];
  const thumbScale = 1 - shrink * 0.82;
  const editing = t >= EDIT[0] && t < EDIT[1];

  // App switcher.
  const a = prog(t, SWITCH, 0.35, ease.inOut);
  const b = prog(t, SWITCH + 0.4, 0.4, ease.inOut);
  const c = prog(t, CHAT_TAP, 0.3, ease.inOut);
  const switching = t >= SWITCH && t < CHAT_TAP + 0.3;
  const inChat = t >= CHAT_TAP + 0.3;

  // Finger: drags the crop corners, swipes up and across in the switcher.
  const [cx, cy, cw, ch] = cropAt(t);
  const cropFinger = t < 4.2 ? [cx, cy] : [cx + cw, cy + ch];
  const cropShow = interpolate(t, [3.45, 3.55, 4.85, 4.9], [0, 1, 1, 0], clamp);
  const swipeShow = interpolate(t, [SWITCH - 0.25, SWITCH - 0.15, SWITCH + 0.3, SWITCH + 0.4, SWITCH + 0.45, SWITCH + 0.5, SWITCH + 0.75, SWITCH + 0.8], [0, 1, 1, 0, 0, 1, 1, 0], clamp);
  const swipeX = t < SWITCH + 0.42 ? SCREEN_W / 2 : interpolate(t, [SWITCH + 0.45, SWITCH + 0.8], [1200, 400], { ...clamp, easing: ease.inOut });
  const swipeY = t < SWITCH + 0.42 ? interpolate(t, [SWITCH - 0.2, SWITCH + 0.3], [SCREEN_H - 20, SCREEN_H - 260], { ...clamp, easing: ease.out }) : SCREEN_H / 2;

  const card = (content: React.ReactNode, cxOff: number, scale: number, label: string, labelOn: number) => (
    <div style={{ position: 'absolute', left: SCREEN_W / 2 + cxOff - SCREEN_W / 2, top: 0, width: SCREEN_W, height: SCREEN_H, transform: `scale(${scale})`, transformOrigin: '50% 50%' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 30 / scale, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.45)' }}>{content}</div>
      <div style={{ position: 'absolute', left: 0, top: -70, fontFamily: sans, fontSize: 40, fontWeight: 700, color: 'white', opacity: labelOn }}>{label}</div>
    </div>
  );

  return (
    <AbsoluteFill>
      <Backdrop blur={22} dim={0.18} />
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${(1 - enter) * 140}px)`, opacity: Math.min(1, enter * 1.5) }}>
        <div style={{ position: 'absolute', left: TAB.x, top: TAB.y, width: TAB.w, height: TAB.h, borderRadius: 46, background: CS.night, padding: TAB.bezel, boxSizing: 'border-box', boxShadow: '0 50px 120px rgba(0,0,0,0.35)' }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 30, overflow: 'hidden', background: '#3A3936' }}>
            {!switching && !inChat && !editing && <NotesApp pulse />}
            {editing && <CropEditor t={t} />}
            {switching && (
              <>
                {card(<NotesApp />, -b * 1150, 1 - a * 0.4, 'Notes', a * (1 - c))}
                {card(<ChatApp t={t} />, (1 - b) * 1150, 0.6 + 0.4 * c, 'AI chat', a * (1 - c))}
              </>
            )}
            {inChat && <ChatApp t={t} />}
            {thumbOn && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: SCREEN_W,
                  height: SCREEN_H,
                  transformOrigin: '40px 820px',
                  transform: `scale(${thumbScale})`,
                  borderRadius: 30,
                  overflow: 'hidden',
                  border: shrink > 0.5 ? '10px solid white' : undefined,
                  boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
                }}
              >
                <NotesApp />
              </div>
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'white', opacity: flash, pointerEvents: 'none' }} />
            <Finger x={cropFinger[0]} y={cropFinger[1]} show={cropShow} />
            <Finger x={swipeX} y={swipeY} show={swipeShow} />
          </div>
        </div>
        <Stylus />
        <Tap x={SX + 40 + 120} y={SY + 820 - 70} at={THUMB_TAP} />
        <Tap x={SX + SCREEN_W - 90} y={SY + 40} at={DONE_TAP} />
        <Tap x={SX + SCREEN_W / 2} y={SY + SCREEN_H / 2} at={CHAT_TAP} />
      </div>
      <Captions
        items={[
          [0.3, 1.4, <>Studying <Hl>on a tablet?</Hl></>],
          [1.45, 2.6, <>You have a question about <Hl>one part.</Hl></>],
          [2.65, 5.1, <>Screenshot it. Crop it <Hl>with your finger.</Hl></>],
          [5.15, 6.3, <>Switch to <Hl>your AI app.</Hl></>],
          [6.35, 8.1, <>Paste. <Hl>“Which part do you mean?”</Hl></>],
          [8.15, 99, <>Now describe <Hl>your own drawing.</Hl></>],
        ]}
      />
    </AbsoluteFill>
  );
};

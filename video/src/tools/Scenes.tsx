import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile } from 'remotion';
import { MaskUp, Paper, Show, Slam, Squid, clamp, ease, hand, prog, sans, springAt, useT } from '../common';
import { S } from './palette';
import { useBrand, useDemo } from './demos';

/* ------------------------------------------------------------------ shared */

/**
 * The photo backdrop (public/bg/nature.jpg, free from Unsplash) with a slow push-in.
 * `dim` darkens it for text; `blur` softens it behind cards.
 */
const Photo: React.FC<{ dim?: number; blur?: number; children?: React.ReactNode }> = ({ dim = 0.25, blur = 0, children }) => {
  const t = useT();
  return (
    <AbsoluteFill style={{ background: S.night, overflow: 'hidden' }}>
      <Img
        src={staticFile('bg/nature.jpg')}
        style={{ position: 'absolute', inset: -40, width: 'calc(100% + 80px)', height: 'calc(100% + 80px)', objectFit: 'cover', transform: `scale(${1.04 + t * 0.012})`, filter: blur ? `blur(${blur}px)` : undefined }}
      />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(11,11,16,${dim * 0.8}) 0%, rgba(11,11,16,${dim}) 60%, rgba(11,11,16,${Math.min(1, dim + 0.25)}) 100%)` }} />
      {children}
    </AbsoluteFill>
  );
};

/**
 * InkBuddy logo lockup: a circle opens and the squid and wordmark land inside it.
 * Brand 'purple': bright purple circle. 'photo': the photo, blurred and darkened, with a lilac squid. 'indigo': deep night-indigo.
 */
const Lockup: React.FC<{ at: number; below: React.ReactNode }> = ({ at, below }) => {
  const t = useT();
  const r = prog(t, at, 0.6, ease.out);
  const pop = springAt(t, at + 0.12, { damping: 10, mass: 0.7 });
  const word = prog(t, at + 0.25, 0.6, ease.out);
  const bob = Math.sin(t * 2.4) * 8;
  const brand = useBrand();
  const gx = 50 + Math.sin(t) * 10;
  const gy = 40 + Math.cos(t) * 8;
  return (
    <AbsoluteFill style={{ clipPath: `circle(${r * 75}% at 50% 50%)`, background: brand === 'purple' ? S.accent : S.night }}>
      {brand === 'purple' && <AbsoluteFill style={{ background: `radial-gradient(circle at ${gx}% ${gy}%, ${S.glow}, ${S.accent} 55%)`, opacity: 0.8 }} />}
      {brand === 'indigo' && (
        <AbsoluteFill style={{ background: `radial-gradient(circle at ${gx}% ${gy}%, rgba(123,97,255,0.45), rgba(123,97,255,0) 55%), linear-gradient(135deg, #100E26 0%, #231F55 55%, #3A2C9E 100%)` }} />
      )}
      {brand === 'photo' && (
        <>
          <Img src={staticFile('bg/nature.jpg')} style={{ position: 'absolute', inset: -60, width: 'calc(100% + 120px)', height: 'calc(100% + 120px)', objectFit: 'cover', filter: 'blur(22px)', transform: `scale(${1.05 + t * 0.01})` }} />
          <AbsoluteFill style={{ background: `radial-gradient(circle at ${gx}% ${gy}%, rgba(91,63,230,0.35), rgba(11,11,16,0.55) 60%)` }} />
        </>
      )}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 34, transform: 'translateY(-70px)' }}>
          <div style={{ transform: `translateY(${bob}px) scale(${pop}) rotate(${(1 - Math.min(pop, 1)) * -60}deg)` }}>
            <Squid size={300} color={brand === 'photo' ? S.glow : S.cream} wiggle={t * 10} />
          </div>
          <div style={{ overflow: 'hidden', padding: '0 10px 20px' }}>
            <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 190, color: S.cream, letterSpacing: '-0.05em', transform: `translateX(${(1 - word) * -110}%)` }}>InkBuddy</div>
          </div>
        </div>
        <div style={{ position: 'absolute', top: 700, width: '100%', display: 'flex', justifyContent: 'center' }}>{below}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ hook */

export const HOOK_S = 3.8;

const Window: React.FC<{ title: string; x: number; y: number; w: number; h: number; z: number; lift: number; children: React.ReactNode }> = ({
  title,
  x,
  y,
  w,
  h,
  z,
  lift,
  children,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      height: h,
      zIndex: z,
      borderRadius: 18,
      overflow: 'hidden',
      background: 'white',
      boxShadow: `0 ${20 + lift * 30}px ${60 + lift * 40}px rgba(0,0,0,${0.35 + lift * 0.25})`,
      transform: `scale(${0.94 + lift * 0.06})`,
      filter: `brightness(${0.6 + lift * 0.4})`,
    }}
  >
    <div style={{ height: 46, background: '#EFE9E0', display: 'flex', alignItems: 'center', gap: 9, padding: '0 16px' }}>
      {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
        <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
      ))}
      <div style={{ marginLeft: 14, fontFamily: sans, fontWeight: 600, fontSize: 20, color: '#5C5248' }}>{title}</div>
    </div>
    <div style={{ position: 'relative', height: h - 46, overflow: 'hidden' }}>{children}</div>
  </div>
);

/** Notes in one window, the practice tool in another, flipping between them — over the photo. */
export const Hook: React.FC = () => {
  const t = useT();
  const D = useDemo();
  const flips = [0.55, 1.0, 1.4, 1.75, 2.05];
  const n = flips.filter((f) => t >= f).length;
  const notesFront = n % 2 === 0;
  const lastFlip = flips[n - 1] ?? 0;
  const k = prog(t, lastFlip, 0.18, ease.out);
  const notesLift = notesFront ? (n === 0 ? 1 : k) : 1 - k;
  const enter = springAt(t, 0, { damping: 18 });
  const away = prog(t, 2.45, 0.35, ease.in);
  const dim = interpolate(t, [2.3, 2.7], [0.25, 0.6], clamp);

  return (
    <Photo dim={dim}>
      <AbsoluteFill style={{ opacity: 1 - away, transform: `scale(${1 - away * 0.08}) translateY(${(1 - enter) * 80}px)` }}>
        <Window title={D.hook.file} x={230} y={230} w={820} h={600} z={notesFront ? 2 : 1} lift={notesLift}>
          <Paper lineGap={70} margin={60} style={{ background: `repeating-linear-gradient(to bottom, transparent 0, transparent 68px, ${S.rule} 68px, ${S.rule} 70px), ${S.paper}` }} />
          <div style={{ position: 'absolute', left: 90, top: 30, fontFamily: hand, fontWeight: 600, fontSize: 50, lineHeight: '70px', color: S.text, whiteSpace: 'nowrap' }}>
            {D.hook.lines.map((l, i) => (
              <div key={i} style={{ color: i === 1 ? '#C8463D' : undefined }}>
                {l}
              </div>
            ))}
          </div>
        </Window>
        <Window title="AI chat · practice tool" x={870} y={300} w={820} h={600} z={notesFront ? 1 : 2} lift={1 - notesLift}>
          <Img src={staticFile(`tools/shots/${D.hook.shot}.png`)} style={{ width: 820, display: 'block' }} />
        </Window>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 70, display: 'flex', justifyContent: 'center', zIndex: 5 }}>
          <MaskUp at={0.1} style={{ fontFamily: sans, fontWeight: 800, fontSize: 64, color: S.cream, letterSpacing: '-0.03em', textShadow: '0 4px 30px rgba(0,0,0,0.5)' }}>
            Notes in one tab. Practice in another.
          </MaskUp>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 70, display: 'flex', justifyContent: 'center', zIndex: 5, opacity: n > 0 ? 1 - prog(t, lastFlip + 0.15, 0.25) : 0 }}>
          <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 40, color: S.night, background: S.cream, padding: '10px 26px', borderRadius: 14 }}>Alt + Tab</div>
        </div>
      </AbsoluteFill>
      <Show from={2.55}>
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Slam text="What if they were one page?" at={2.6} stagger={0.08} accent={[4, 5]} accentColor={S.glow} style={{ fontSize: 130, color: S.cream, textShadow: '0 6px 40px rgba(0,0,0,0.45)' }} />
        </AbsoluteFill>
      </Show>
    </Photo>
  );
};

/* ------------------------------------------------------------------ logo */

export const LOGO_S = 2.6;

export const Logo: React.FC = () => {
  const brand = useBrand();
  return (
  <Photo dim={0.6}>
    <Lockup
      at={0}
      below={
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 58, color: S.cream, display: 'flex', alignItems: 'baseline', gap: 26, letterSpacing: '-0.02em' }}>
          <MaskUp at={0.7}>Your notes.</MaskUp>
          <MaskUp at={0.9}>
            <span style={{ fontFamily: hand, fontSize: 80, color: brand === 'purple' ? '#FFE27A' : S.glow, letterSpacing: 0 }}>Your practice tools.</span>
          </MaskUp>
        </div>
      }
    />
  </Photo>
  );
};

/* ------------------------------------------------------------------ montage */

export const MONTAGE_S = 7.0;

const CARD_W = 520;
const CARD_H = 600;

// Real builds (public/tools/*.json). `frames`: a captured sequence played back and forth.
const CARDS: { label: string; stat: string; shots?: [string, string]; switchAt?: number; tap?: { x: number; y: number }; frames?: string }[] = [
  { label: 'SQL practice', stat: 'built in 31s', shots: ['m-sql-1', 'm-sql-2'], switchAt: 3.1, tap: { x: 292, y: 866 } },
  { label: 'Calculus', stat: 'built in 19s', frames: 'm-calc' },
  { label: '3D models', stat: 'built in 25s', frames: 'm-mol' },
];

const ToolCard: React.FC<{ i: number }> = ({ i }) => {
  const t = useT();
  const c = CARDS[i];
  const k = springAt(t, 0.5 + i * 0.22, { damping: 15 });
  const scale = CARD_W / 1040; // card-size captures: 520×600 at 2×
  let src: string;
  if (c.shots) src = c.shots[t < (c.switchAt ?? 0) ? 0 : 1];
  else {
    const f = Math.floor(t * 14) % 70;
    src = `${c.frames}-${String(f < 36 ? f : 70 - f).padStart(2, '0')}`;
  }
  const tapAt = (c.switchAt ?? 0) - 0.15;
  const tap = c.tap ? interpolate(t, [tapAt - 0.2, tapAt, tapAt + 0.3, tapAt + 0.5], [0, 1, 1, 0], clamp) : 0;

  return (
    <div style={{ width: CARD_W, opacity: Math.min(1, k * 1.5), transform: `translateY(${(1 - k) * 120}px) rotate(${(i - 1) * 1.5 * (1 - k)}deg)` }}>
      <div style={{ position: 'relative', width: CARD_W, height: CARD_H, borderRadius: 20, overflow: 'hidden', background: '#FAFAFA', boxShadow: '0 30px 80px rgba(0,0,0,0.55)' }}>
        <Img src={staticFile(`tools/shots/${src}.png`)} style={{ width: CARD_W, display: 'block' }} />
        {c.tap && (
          <div
            style={{
              position: 'absolute',
              left: c.tap.x * scale - 22,
              top: c.tap.y * scale - 22,
              width: 44,
              height: 44,
              borderRadius: 22,
              background: S.tap,
              border: `3px solid ${S.accent}`,
              opacity: tap,
            }}
          />
        )}
      </div>
      <div style={{ marginTop: 22, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontFamily: sans, textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
        <div style={{ fontWeight: 800, fontSize: 38, color: S.cream, letterSpacing: '-0.02em' }}>{c.label}</div>
        <div style={{ fontWeight: 600, fontSize: 22, color: 'rgba(255,255,255,0.75)' }}>{c.stat}</div>
      </div>
    </div>
  );
};

export const Montage: React.FC = () => (
  <Photo dim={0.55} blur={14}>
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: 60 }}>
      <MaskUp at={0.05} style={{ fontFamily: sans, fontWeight: 900, fontSize: 92, color: S.cream, letterSpacing: '-0.04em', textShadow: '0 4px 30px rgba(0,0,0,0.4)' }}>
        Anything you can <span style={{ color: S.glow }}>describe.</span>
      </MaskUp>
      <div style={{ display: 'flex', gap: 60, marginTop: 50 }}>
        {CARDS.map((_, i) => (
          <ToolCard key={i} i={i} />
        ))}
      </div>
    </AbsoluteFill>
  </Photo>
);

/* ------------------------------------------------------------------ outro */

export const OUTRO_S = 4.4;

export const Outro: React.FC = () => {
  const t = useT();
  return (
    <Photo dim={0.6}>
      <Lockup
        at={0}
        below={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
            <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 54, color: S.cream, letterSpacing: '-0.02em', opacity: prog(t, 0.5, 0.4) }}>Practice beside your notes.</div>
            <div
              style={{
                fontFamily: sans,
                fontWeight: 800,
                fontSize: 50,
                color: S.accent,
                background: S.cream,
                padding: '18px 46px',
                borderRadius: 999,
                transform: `scale(${springAt(t, 0.9, { damping: 11 })})`,
              }}
            >
              inkbuddy.vercel.app
            </div>
          </div>
        }
      />
    </Photo>
  );
};

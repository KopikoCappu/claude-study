import React from 'react';
import { AbsoluteFill } from 'remotion';
import { B, MaskUp, Night, Show, Slam, Squid, ease, hand, prog, sans, springAt, useT } from '../common';

export const LOGO_S = 2.9;
export const OUTRO_S = 5.2;

/** Purple circle bursts open, logo + wordmark land inside it. */
export const Lockup: React.FC<{ at: number; below: React.ReactNode }> = ({ at, below }) => {
  const t = useT();
  const r = prog(t, at, 0.6, ease.out);
  const pop = springAt(t, at + 0.12, { damping: 10, mass: 0.7 });
  const word = prog(t, at + 0.25, 0.6, ease.out);
  const bob = Math.sin(t * 2.4) * 8;
  return (
    <AbsoluteFill style={{ clipPath: `circle(${r * 75}% at 50% 50%)`, background: B.purple }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${50 + Math.sin(t) * 10}% ${40 + Math.cos(t) * 8}%, ${B.lilac}, ${B.purple} 55%)`,
          opacity: 0.8,
        }}
      />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 34, transform: 'translateY(-70px)' }}>
          <div style={{ transform: `translateY(${bob}px) scale(${pop}) rotate(${(1 - Math.min(pop, 1)) * -60}deg)` }}>
            <Squid size={300} color="#FFFFFF" wiggle={t * 10} />
          </div>
          <div style={{ overflow: 'hidden', padding: '0 10px 20px' }}>
            <div
              style={{
                fontFamily: sans,
                fontWeight: 900,
                fontSize: 190,
                color: 'white',
                letterSpacing: '-0.05em',
                transform: `translateX(${(1 - word) * -110}%)`,
              }}
            >
              InkBuddy
            </div>
          </div>
        </div>
        <div style={{ position: 'absolute', top: 700, width: '100%', display: 'flex', justifyContent: 'center' }}>{below}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const LogoReveal: React.FC = () => (
  <Night>
    <Lockup
      at={0}
      below={
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 58, color: 'white', display: 'flex', alignItems: 'baseline', gap: 26, letterSpacing: '-0.02em' }}>
          <MaskUp at={0.75}>Lasso it.</MaskUp>
          <MaskUp at={0.95}>Ask it.</MaskUp>
          <MaskUp at={1.15}>
            <span style={{ fontFamily: hand, fontSize: 80, color: B.yellow, letterSpacing: 0 }}>It writes back.</span>
          </MaskUp>
        </div>
      }
    />
  </Night>
);

export const Outro: React.FC = () => {
  const t = useT();
  return (
    <Night>
      <Show to={2.3}>
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <Slam text="Stop screenshotting." at={0.05} stagger={0.1} out={2.0} style={{ fontSize: 150, color: 'rgba(255,255,255,0.55)' }} />
          <Slam text="Start asking." at={0.9} stagger={0.12} out={2.05} style={{ fontSize: 180, color: 'white' }} accent={[1]} />
        </AbsoluteFill>
      </Show>
      <Show from={2.1}>
        <Lockup
          at={2.1}
          below={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
              <div
                style={{
                  fontFamily: sans,
                  fontWeight: 800,
                  fontSize: 56,
                  color: B.purple,
                  background: 'white',
                  padding: '20px 50px',
                  borderRadius: 999,
                  transform: `scale(${springAt(t, 2.7, { damping: 11 })})`,
                }}
              >
                inkbuddy.vercel.app
              </div>
              <div style={{ fontFamily: sans, fontSize: 32, color: 'rgba(255,255,255,0.8)', fontWeight: 600, letterSpacing: 6, opacity: prog(t, 3.0, 0.4) }}>
                SWAMPHACKS 2026
              </div>
            </div>
          }
        />
      </Show>
    </Night>
  );
};

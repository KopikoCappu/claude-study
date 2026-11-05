import React from 'react';
import { Img, staticFile } from 'remotion';

/** The portfolio hero (portfoliomain/index.html), rebuilt from its own layers so single clouds can change. */
export const PW = 1672;
export const PH = 941;

type Sprite = { f: string; x: number; y: number; w: number; h: number; front?: boolean };

// portfoliomain/clouds/sprites.json — positions in photo pixels
export const SPRITES: Sprite[] = [
  { f: 'c1.webp', x: 499, y: 198, w: 33, h: 14 },
  { f: 'c2.webp', x: 344, y: 205, w: 52, h: 9 },
  { f: 'c3.webp', x: 156, y: 231, w: 163, h: 108 },
  { f: 'c4.webp', x: 481, y: 231, w: 409, h: 29 },
  { f: 'c6a.webp', x: 801, y: 260, w: 620, h: 134 },
  { f: 'c7.webp', x: 530, y: 291, w: 175, h: 12 },
  { f: 'c8.webp', x: 617, y: 315, w: 183, h: 69, front: true },
  { f: 'c9c.webp', x: 25, y: 418, w: 71, h: 34, front: true },
  { f: 'c9b.webp', x: 180, y: 318, w: 419, h: 84 },
  { f: 'c10.webp', x: 1222, y: 335, w: 18, h: 14 },
  { f: 'c11.webp', x: 1256, y: 336, w: 30, h: 17 },
  { f: 'c12.webp', x: 975, y: 388, w: 131, h: 30, front: true },
  { f: 'c13.webp', x: 293, y: 418, w: 54, h: 36 },
  { f: 'c14.webp', x: 1443, y: 422, w: 67, h: 26, front: true },
  { f: 'c15.webp', x: 425, y: 425, w: 45, h: 22 },
  { f: 'c16.webp', x: 136, y: 426, w: 95, h: 35, front: true },
  { f: 'c17.webp', x: 354, y: 429, w: 58, h: 23, front: true },
  { f: 'c18.webp', x: 227, y: 434, w: 50, h: 24, front: true },
  { f: 'c19.webp', x: 97, y: 442, w: 42, h: 15 },
  { f: 'c20.webp', x: 1580, y: 443, w: 37, h: 20 },
];

export const idx = (f: string) => SPRITES.findIndex((s) => s.f === f);

// Same rule as the site (higher clouds move faster, front ones a bit faster), slowed down and without randomness.
const speed = (i: number) => {
  const s = SPRITES[i];
  return (2.2 + 7 * Math.max(0, 1 - s.y / 450) + ((i * 37) % 10) * 0.12) * (s.front ? 1.3 : 1) * 0.6;
};
export const cloudX = (i: number, t: number) => SPRITES[i].x + speed(i) * t;

const full: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' };

export const Hero: React.FC<{
  width: number;
  t: number;
  overlay?: boolean;
  cloudStyle?: (i: number) => React.CSSProperties | undefined;
  /** Drawn on top, in photo pixels. */
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ width, t, overlay = true, cloudStyle, children, style }) => {
  const k = width / PW;
  const clouds = (front: boolean) =>
    SPRITES.map((s, i) =>
      !!s.front === front ? (
        <Img
          key={s.f}
          src={staticFile(`portfolio/clouds/${s.f}`)}
          style={{ position: 'absolute', left: cloudX(i, t), top: s.y, width: s.w, height: s.h, ...cloudStyle?.(i) }}
        />
      ) : null,
    );
  return (
    <div style={{ position: 'relative', width, height: PH * k, overflow: 'hidden', ...style }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: PW, height: PH, transform: `scale(${k})`, transformOrigin: '0 0' }}>
        <Img src={staticFile('portfolio/sky.webp')} style={full} />
        {clouds(false)}
        <Img src={staticFile('portfolio/mountains.webp')} style={full} />
        {clouds(true)}
        <Img src={staticFile('portfolio/fog.webp')} style={{ ...full, opacity: 0.6, transform: `translateX(${Math.sin(t * 0.12) * 10}px)` }} />
        {overlay && <Img src={staticFile('portfolio/overlay.png')} style={full} />}
        {children}
      </div>
    </div>
  );
};

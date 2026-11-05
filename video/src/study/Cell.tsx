import React from 'react';
import { interpolate } from 'remotion';
import { clamp, ease, prog, sans } from '../common';
import { CS } from './theme';

/**
 * The artifact Claude builds: a 3D animal cell you can spin. Organelles sit inside an ellipsoid, rotate around the
 * vertical axis (plus a fixed tilt), and are drawn back to front so the near ones cover the far ones.
 */
export const VIZ = { w: 528, h: 330 };
const C = { x: VIZ.w / 2, y: 168, rx: 210, ry: 138 };
const TILT = 0.32;

// Timing inside the Build scene.
export const DRAG = [6.6, 7.9] as const;
export const PICK_AT = 8.7;

type Org = { kind: 'nucleus' | 'mito' | 'ribo'; x: number; y: number; z: number; rot?: number };

const ORGS: Org[] = [
  { kind: 'nucleus', x: -0.05, y: 0.02, z: 0 },
  { kind: 'mito', x: 0.62, y: -0.34, z: 0.25, rot: 25 },
  { kind: 'mito', x: -0.58, y: 0.42, z: -0.35, rot: -30 },
  { kind: 'mito', x: 0.2, y: 0.58, z: -0.6, rot: 70 },
  { kind: 'mito', x: -0.35, y: -0.5, z: 0.55, rot: -10 },
  { kind: 'mito', x: 0.45, y: 0.3, z: 0.62, rot: 40 },
];
// Ribosomes: small dots scattered with a fixed pseudo-random pattern.
for (let i = 0; i < 34; i++) {
  const a = i * 2.399;
  const r = 0.42 + ((i * 37) % 11) / 30;
  ORGS.push({ kind: 'ribo', x: Math.cos(a) * r, y: Math.sin(a * 1.7) * 0.7, z: Math.sin(a) * r });
}

/** Rotation angle: a slow spin, plus the drag. */
export function angleAt(t: number) {
  return 0.3 * t + interpolate(t, [DRAG[0], DRAG[1]], [0, 1.7], { ...clamp, easing: ease.inOut });
}

function project(o: Org, th: number) {
  const x1 = o.x * Math.cos(th) + o.z * Math.sin(th);
  const z1 = -o.x * Math.sin(th) + o.z * Math.cos(th);
  const y1 = o.y * Math.cos(TILT) - z1 * Math.sin(TILT);
  const z2 = o.y * Math.sin(TILT) + z1 * Math.cos(TILT);
  return { sx: C.x + x1 * C.rx, sy: C.y + y1 * C.ry, z: z2 };
}

/** The mitochondrion nearest the viewer when it's tapped (that's the one the finger lands on). */
const PICKED = (() => {
  const th = angleAt(PICK_AT);
  let best = -1;
  let bestZ = -9;
  ORGS.forEach((o, i) => {
    if (o.kind !== 'mito') return;
    const z = project(o, th).z;
    if (z > bestZ) {
      bestZ = z;
      best = i;
    }
  });
  return best;
})();

/** Where the picked mitochondrion is at tap time, in viz coordinates. */
export function pickedPoint() {
  const p = project(ORGS[PICKED], angleAt(PICK_AT));
  return [p.sx, p.sy] as const;
}

export const CellViz: React.FC<{ t: number }> = ({ t }) => {
  const th = angleAt(t);
  const picked = t >= PICK_AT;
  const pulse = picked ? 1 + 0.12 * Math.sin((t - PICK_AT) * 7) * Math.exp(-(t - PICK_AT) * 1.5) : 1;
  const label = prog(t, PICK_AT + 0.1, 0.4, ease.out);
  const drawn = ORGS.map((o, i) => ({ o, i, ...project(o, th) })).sort((a, b) => a.z - b.z);
  const pp = drawn.find((d) => d.i === PICKED)!;
  return (
    <svg width={VIZ.w} height={VIZ.h} viewBox={`0 0 ${VIZ.w} ${VIZ.h}`} style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="cyto" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FCEFE4" />
          <stop offset="70%" stopColor="#F4D9C3" />
          <stop offset="100%" stopColor="#E8BE9F" />
        </radialGradient>
        <radialGradient id="nuc" cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#B79BD6" />
          <stop offset="100%" stopColor="#6E4C98" />
        </radialGradient>
        <radialGradient id="mito" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#F0A27F" />
          <stop offset="100%" stopColor="#C0583A" />
        </radialGradient>
        <radialGradient id="shine" cx="35%" cy="25%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity={0.55} />
          <stop offset="100%" stopColor="white" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={C.x} cy={C.y + 12} rx={C.rx + 22} ry={C.ry + 22} fill="rgba(60,40,20,0.10)" />
      <ellipse cx={C.x} cy={C.y} rx={C.rx + 22} ry={C.ry + 22} fill="url(#cyto)" stroke="#D99A78" strokeWidth={3} />
      {drawn.map(({ o, i, sx, sy, z }) => {
        const depth = (z + 1) / 2; // 0 far, 1 near
        const s = 0.8 + depth * 0.4;
        const dim = picked && i !== PICKED && o.kind !== 'ribo' ? 0.45 : 1;
        const op = (0.45 + depth * 0.55) * dim;
        if (o.kind === 'ribo') return <circle key={i} cx={sx} cy={sy} r={3.4 * s} fill="#5E4B44" opacity={op * (picked ? 0.5 : 1)} />;
        if (o.kind === 'nucleus')
          return (
            <g key={i} opacity={op}>
              <circle cx={sx} cy={sy} r={66 * s} fill="url(#nuc)" />
              <circle cx={sx + 14 * s} cy={sy + 8 * s} r={18 * s} fill="#4E3270" />
              <circle cx={sx} cy={sy} r={66 * s} fill="url(#shine)" />
            </g>
          );
        const me = i === PICKED && picked;
        const k = me ? s * pulse * 1.15 : s;
        // Mitochondria turn a little as the cell spins, so they read as 3D capsules.
        const rot = (o.rot ?? 0) + th * 25;
        return (
          <g key={i} transform={`translate(${sx} ${sy}) rotate(${rot}) scale(${k})`} opacity={me ? 1 : op}>
            {me && <ellipse rx={50} ry={28} fill="none" stroke={CS.clay} strokeWidth={4} opacity={0.6} />}
            <ellipse rx={38} ry={16} fill="url(#mito)" stroke="#9E4429" strokeWidth={1.5} />
            <path d="M -28 0 q 5 -10 10 0 t 10 0 t 10 0 t 10 0 t 10 0" fill="none" stroke="#FDE7DA" strokeWidth={2.2} strokeLinecap="round" />
          </g>
        );
      })}
      <ellipse cx={C.x} cy={C.y} rx={C.rx + 22} ry={C.ry + 22} fill="url(#shine)" pointerEvents="none" />
      {label > 0 && (
        <g opacity={label}>
          <line x1={pp.sx} y1={pp.sy} x2={VIZ.w - 120} y2={22} stroke={CS.ink} strokeWidth={2} strokeDasharray="5 5" />
          <g transform={`translate(${VIZ.w - 230} ${-6 + (1 - label) * 8})`}>
            <rect width={210} height={44} rx={22} fill={CS.ink} />
            <text x={105} y={29} textAnchor="middle" fill="white" fontSize={20} fontWeight={700} fontFamily={sans}>
              Mitochondria
            </text>
          </g>
        </g>
      )}
    </svg>
  );
};

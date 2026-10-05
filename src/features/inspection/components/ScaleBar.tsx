import React from 'react';
import type { AcceptanceScale, Verdict } from '../spec/inspectionSpecV1';

const TINT: Record<Verdict, string> = { pass: 'var(--pass-tint)', warning: 'var(--warn-tint)', fail: 'var(--fail-tint)' };
const EDGE: Record<Verdict, string> = { pass: 'var(--pass)', warning: 'var(--warn)', fail: 'var(--fail)' };

function niceMax(v: number): number {
  const steps = [20, 40, 60, 80, 100, 150, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000, 3000, 5000];
  return steps.find(s => s >= v) ?? Math.ceil(v / 1000) * 1000;
}

/**
 * 量測尺：0 µm 起的真實比例軸，依允收標準分段著色，量測值以墨線標出。
 * 長度就是量測值——不是示意條。
 */
export const ScaleBar: React.FC<{ scale: AcceptanceScale; verdict: Verdict }> = ({ scale, verdict }) => {
  const limits = scale.bands.map(b => b.to).filter((t): t is number => t !== null);
  const max = niceMax(Math.max(scale.value * 1.15, (limits[limits.length - 1] ?? 0) * 1.5));
  const W = 260;
  const x = (v: number) => (Math.min(v, max) / max) * W;
  const vx = x(scale.value);

  return (
    <svg className="scale-bar" viewBox={`0 0 ${W} 34`} preserveAspectRatio="xMinYMin meet" role="img"
      aria-label={`${scale.measure} ${scale.value} µm；界限 ${limits.join('、')} µm`}>
      {scale.bands.map(b => (
        <rect key={b.from} x={x(b.from)} y={8} width={x(b.to ?? max) - x(b.from)} height={10} fill={TINT[b.verdict]} />
      ))}
      {scale.bands.map(b => (
        <rect key={'e' + b.from} x={x(b.from)} y={17} width={x(b.to ?? max) - x(b.from)} height={1} fill={EDGE[b.verdict]} />
      ))}
      {limits.map(t => (
        <g key={t}>
          <rect x={x(t) - 0.5} y={4} width={1} height={16} fill="var(--ink-3)" />
          <text x={x(t)} y={32} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{t}</text>
        </g>
      ))}
      <text x={0} y={32} style={{ fontSize: 11, fill: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>0</text>
      <rect x={Math.max(0, vx - 1)} y={2} width={2} height={20} fill={EDGE[verdict]} />
      <path d={`M${vx - 4} 0 H${vx + 4} L${vx} 5 Z`} fill={EDGE[verdict]} />
    </svg>
  );
};

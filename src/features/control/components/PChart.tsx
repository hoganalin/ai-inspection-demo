import React, { useEffect, useRef, useState } from 'react';
import type { ControlChart } from '../spc';
import { SIGNAL_LABEL } from '../spc';
import type { ChartLot } from '../types';

interface Props {
  chart: ControlChart;
  lots: ChartLot[];
  selectedLotId: string | null;
  onSelectLot: (lotId: string) => void;
  /** 精簡版（總覽頁縮圖）：較矮、不顯示座標軸標題 */
  compact?: boolean;
}

const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;

function niceMax(v: number): number {
  const steps = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8, 1];
  return steps.find(s => s >= v) ?? 1;
}

const C = {
  ink: 'var(--ink)',
  ink2: 'var(--ink-2)',
  ink3: 'var(--ink-3)',
  rule: 'var(--rule)',
  fail: 'var(--fail)',
  warn: 'var(--warn)',
  accent: 'var(--accent)',
};

/** p 管制圖（手刻 SVG）：中心線、±3σ 管制界限、2σ 參考線、預警／異常標記。 */
export const PChart: React.FC<Props> = ({ chart, lots, selectedLotId, onSelectLot, compact = false }) => {
  // viewBox 跟著實際版面寬度：字級固定，不會隨圖縮小（投影與手機都讀得到）
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pts = chart.points;
  if (pts.length === 0) return null;

  const W = Math.max(320, width || 920);
  const narrow = W < 560;
  const H = compact ? Math.round(Math.min(300, Math.max(220, W * 0.42))) : Math.round(Math.min(400, Math.max(280, W * 0.42)));
  const side = narrow ? { top: 24, right: 40, left: 44 } : compact ? { top: 24, right: 82, left: 56 } : { top: 26, right: 92, left: 70 };
  const PW = W - side.left - side.right;
  const band = PW / pts.length;
  const rotate = band < 36 || pts.some(p => p.lotId.length > 4);
  // 底部留白依最長的 X 標籤計算（旋轉 45° 後的高度），軸標題另外留位置
  const longest = Math.max(...pts.map(p => p.lotId.length));
  const labelRoom = rotate ? Math.ceil(18 + longest * 7.4 * Math.SQRT1_2 + 6) : 30;
  const M = { ...side, bottom: labelRoom + (compact || narrow ? 0 : 22) };
  const PH = H - M.top - M.bottom;

  const yMax = niceMax(Math.max(...pts.map(p => Math.max(p.p, p.ucl))) * 1.08);
  const x = (i: number) => M.left + band * (i + 0.5);
  const y = (v: number) => M.top + PH - (Math.min(v, yMax) / yMax) * PH;
  const tickStep = yMax <= 0.15 ? 0.025 : yMax <= 0.3 ? 0.05 : 0.1;
  const ticks: number[] = [];
  for (let t = 0; t <= yMax + 1e-9; t += tickStep) ticks.push(+t.toFixed(4));

  const stepPath = (f: (i: number) => number) =>
    pts.map((_, i) => `${i === 0 ? 'M' : 'L'}${M.left + band * i},${y(f(i))} L${M.left + band * (i + 1)},${y(f(i))}`).join(' ');

  const cl = chart.centerLine;
  const plus2 = (i: number) => cl + 2 * pts[i].sigma;
  const anyLcl = pts.some(p => p.lcl > 0);
  const phaseIEnd = M.left + band * chart.phaseICount;
  const firstLive = lots.findIndex(l => l.source === 'live');
  // X 標籤貪婪排版：先放訊號批（異常優先）與最後一批，其餘標籤與已放置者至少相距 minGap，絕不重疊
  const minGap = rotate ? 15 : 36;
  const xLabels = new Set<number>();
  const fits = (i: number) => [...xLabels].every(j => Math.abs(x(i) - x(j)) >= minGap);
  const priority = [
    ...pts.map((p, i) => (p.signal === 'outOfControl' ? i : -1)),
    ...pts.map((p, i) => (p.signal === 'warningSignal' ? i : -1)),
    pts.length - 1,
    ...pts.map((_, i) => i),
  ].filter(i => i >= 0);
  for (const i of priority) if (!xLabels.has(i) && fits(i)) xLabels.add(i);
  const lastI = pts.length - 1;
  const fs = { tick: 12, label: 13, small: 12 };

  return (
    <div ref={boxRef}>
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`批不良率 p 管制圖，${pts.length} 批，中心線 ${pct(cl, 1)}`}
      style={{ width: '100%', height: 'auto', display: 'block', fontFamily: 'var(--font-ui)' }}
    >
      {/* Phase I 區 */}
      <rect x={M.left} y={M.top} width={phaseIEnd - M.left} height={PH} fill="var(--ground-2)" />
      <text x={M.left + 8} y={M.top + 16} style={{ fontSize: fs.small, fill: C.ink2 }}>
        {narrow ? `Phase I（前 ${chart.phaseICount} 批）` : `Phase I：前 ${chart.phaseICount} 批估計中心線與界限`}
      </text>
      {firstLive >= 0 && !narrow && (
        <g>
          <line x1={M.left + band * firstLive} x2={M.left + band * firstLive} y1={M.top} y2={M.top + PH} stroke={C.accent} strokeDasharray="3 3" />
          <text x={M.left + band * firstLive + 6} y={M.top + 34} style={{ fontSize: fs.small, fill: C.accent, fontWeight: 600 }}>實測批 →</text>
        </g>
      )}

      {/* Y 格線 */}
      {ticks.map(t => (
        <g key={t}>
          <line x1={M.left} x2={M.left + PW} y1={y(t)} y2={y(t)} stroke={C.rule} />
          <text x={M.left - 8} y={y(t) + 4} textAnchor="end" style={{ fontSize: fs.tick, fill: C.ink3, fontFamily: 'var(--font-mono)' }}>
            {pct(t, tickStep < 0.05 ? 1 : 0)}
          </text>
        </g>
      ))}
      <line x1={M.left} x2={M.left} y1={M.top} y2={M.top + PH} stroke="var(--rule-strong)" />
      <line x1={M.left} x2={M.left + PW} y1={M.top + PH} y2={M.top + PH} stroke="var(--rule-strong)" />

      {/* 界限 */}
      <path d={stepPath(plus2)} fill="none" stroke={C.warn} strokeDasharray="2 4" strokeWidth={1.6} />
      <path d={stepPath(i => pts[i].ucl)} fill="none" stroke={C.fail} strokeDasharray="8 5" strokeWidth={1.6} />
      {anyLcl && <path d={stepPath(i => pts[i].lcl)} fill="none" stroke={C.fail} strokeDasharray="8 5" strokeWidth={1} />}
      <line x1={M.left} x2={M.left + PW} y1={y(cl)} y2={y(cl)} stroke={C.ink2} strokeWidth={1.4} />

      <text x={M.left + PW + 8} y={y(pts[lastI].ucl) + 4} style={{ fontSize: fs.tick, fill: 'var(--fail-ink)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{narrow ? 'UCL' : `UCL ${pct(pts[lastI].ucl, 1)}`}</text>
      <text x={M.left + PW + 8} y={y(plus2(lastI)) + 4} style={{ fontSize: fs.tick, fill: 'var(--warn-ink)', fontFamily: 'var(--font-mono)' }}>+2σ</text>
      <text x={M.left + PW + 8} y={y(cl) + 4} style={{ fontSize: fs.tick, fill: C.ink2, fontFamily: 'var(--font-mono)' }}>{narrow ? 'CL' : `CL ${pct(cl, 1)}`}</text>

      {/* 資料線 */}
      <path d={pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.p)}`).join(' ')} fill="none" stroke={C.ink} strokeWidth={1.6} />

      {/* 點 */}
      {pts.map((p, i) => {
        const color = p.signal === 'outOfControl' ? C.fail : p.signal === 'warningSignal' ? C.warn : C.ink;
        const selected = selectedLotId === p.lotId;
        const live = lots[i]?.source === 'live';
        const r = p.signal ? 6.5 : 4;
        const tip = `${p.lotId}（${live ? '實測' : '模擬'}）\nn=${p.n}，Fail=${p.fail}，p=${pct(p.p, 1)}\nUCL=${pct(p.ucl, 1)}，z=${p.z.toFixed(2)}`
          + (p.signal ? `\n${SIGNAL_LABEL[p.signal]}：${p.rulesFired.join('、')}` : '');
        const cx = x(i);
        const cy = y(p.p);
        return (
          <g
            key={p.lotId + i}
            onClick={() => p.signal && onSelectLot(p.lotId)}
            style={{ cursor: p.signal ? 'pointer' : 'default' }}
          >
            <title>{tip}</title>
            <rect x={cx - band / 2} y={M.top} width={band} height={PH} fill="transparent" />
            {selected && <rect x={cx - r - 5} y={cy - r - 5} width={(r + 5) * 2} height={(r + 5) * 2} fill="none" stroke={C.accent} strokeWidth={2} />}
            {p.signal === 'warningSignal'
              ? <path d={`M${cx} ${cy - r - 1} L${cx + r + 1} ${cy + r} L${cx - r - 1} ${cy + r} Z`} fill={color} stroke="#fff" strokeWidth={1} />
              : live
                ? <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={p.signal ? color : '#fff'} stroke={color} strokeWidth={1.6} />
                : <circle cx={cx} cy={cy} r={r} fill={p.signal ? color : '#fff'} stroke={p.signal ? '#fff' : color} strokeWidth={p.signal ? 1 : 1.6} />}
            {p.signal && pts[i - 1]?.signal !== p.signal && (
              <text x={cx} y={cy - r - 8} textAnchor="middle" style={{ fontSize: fs.label, fill: p.signal === 'outOfControl' ? 'var(--fail-ink)' : 'var(--warn-ink)', fontWeight: 700 }}>
                {SIGNAL_LABEL[p.signal]}
              </text>
            )}
          </g>
        );
      })}

      {/* X 標籤 */}
      {pts.map((p, i) => (!xLabels.has(i) ? null : (
        <text
          key={'x' + i}
          x={x(i)}
          y={M.top + PH + 18}
          textAnchor={rotate ? 'end' : 'middle'}
          transform={rotate ? `rotate(-45 ${x(i)} ${M.top + PH + 18})` : undefined}
          style={{
            fontSize: fs.tick,
            fill: p.signal ? (p.signal === 'outOfControl' ? 'var(--fail-ink)' : 'var(--warn-ink)') : C.ink3,
            fontWeight: p.signal ? 700 : 400,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {p.lotId}
        </text>
      )))}

      {!compact && !narrow && (
        <>
          <text x={M.left + PW / 2} y={H - 8} textAnchor="middle" style={{ fontSize: fs.label, fill: C.ink2 }}>批號（依生產順序）</text>
          <text x={18} y={M.top + PH / 2} textAnchor="middle" transform={`rotate(-90 18 ${M.top + PH / 2})`} style={{ fontSize: fs.label, fill: C.ink2 }}>
            批不良率 p（Fail ÷ n）
          </text>
        </>
      )}
    </svg>
    </div>
  );
};

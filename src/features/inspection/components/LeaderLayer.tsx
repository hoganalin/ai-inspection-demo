import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Verdict } from '../spec/inspectionSpecV1';

/**
 * 引線：從明細列 (`data-anchor`) 畫到圖版上的端點 (`data-anchor`)。
 * 讀取即時版面位置繪製，容器尺寸改變、圖片與字型載入時重算。
 *
 * 先以虛線（AI 回報，暫定）畫出，再轉為判定色實線（規則推導後定稿）。
 */
export interface LeaderPair {
  from: string;
  to: string;
  verdict: Verdict | null;
}

interface Props {
  containerRef: React.RefObject<HTMLElement | null>;
  pairs: LeaderPair[];
  /** pairs 變動時是否播放「回報 → 推導」的兩段轉換 */
  animate?: boolean;
}

interface Segment { key: string; d: string; verdict: Verdict | null; end: { x: number; y: number } }

const COLOR: Record<Verdict, string> = { pass: 'var(--pass)', warning: 'var(--warn)', fail: 'var(--fail)' };

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const LeaderLayer: React.FC<Props> = ({ containerRef, pairs, animate = true }) => {
  const [segments, setSegments] = useState<Segment[]>([]);
  const pairsKey = pairs.map(p => `${p.from}>${p.to}:${p.verdict}`).join('|');
  const [derivedKey, setDerivedKey] = useState<string | null>(null);
  const derived = !animate || prefersReducedMotion() || derivedKey === pairsKey;
  const frame = useRef(0);
  const timer = useRef(0);

  const measure = useCallback(() => {
    const box = containerRef.current;
    if (!box) return;
    const origin = box.getBoundingClientRect();
    const snap = (v: number) => Math.round(v) + 0.5;
    const out: Segment[] = [];
    for (const p of pairs) {
      const a = box.querySelector<HTMLElement>(`[data-anchor="${p.from}"]`);
      const b = box.querySelector<HTMLElement>(`[data-anchor="${p.to}"]`);
      if (!a || !b) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      if (!ra.width || !rb.width) continue;
      const x1 = snap(ra.left - origin.left - 6);
      const y1 = snap(ra.top - origin.top + Math.min(ra.height / 2, 14));
      const x2 = snap(rb.right - origin.left + 2);
      const y2 = snap(rb.top - origin.top + rb.height / 2);
      if (x1 <= x2 + 8) continue; // 版面窄到明細列不在圖版右側時不畫
      const xm = snap(Math.max(x2 + 12, x1 - 28)); // 轉折落在圖版與明細之間的溝槽
      out.push({ key: `${p.from}>${p.to}`, d: `M${x1} ${y1} H${xm} V${y2} H${x2}`, verdict: p.verdict, end: { x: x2, y: y2 } });
    }
    setSegments(out);
  }, [containerRef, pairs]);

  // useEffect（非 layout effect）：父層容器的 ref 在子元件的 layout effect 時還沒掛上
  useEffect(() => {
    const box = containerRef.current;
    if (!box) return;
    // rAF 對齊下一次繪製；計時器補位（背景分頁或無繪製幀的環境不會跑 rAF）
    const schedule = () => {
      cancelAnimationFrame(frame.current);
      window.clearTimeout(timer.current);
      frame.current = requestAnimationFrame(measure);
      timer.current = window.setTimeout(measure, 80);
    };
    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(box);
    const imgs = Array.from(box.querySelectorAll('img'));
    imgs.forEach(img => img.addEventListener('load', schedule));
    window.addEventListener('resize', schedule);
    document.fonts?.ready.then(schedule).catch(() => {});
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      imgs.forEach(img => img.removeEventListener('load', schedule));
      cancelAnimationFrame(frame.current);
      window.clearTimeout(timer.current);
    };
  }, [containerRef, measure]);

  useEffect(() => {
    if (!animate) return;
    const t = window.setTimeout(() => setDerivedKey(pairsKey), 420);
    return () => window.clearTimeout(t);
  }, [pairsKey, animate]);

  if (segments.length === 0) return null;

  return (
    <svg className="leaders" aria-hidden="true">
      {segments.map(s => {
        const solid = derived && s.verdict !== null;
        const color = solid ? COLOR[s.verdict!] : 'var(--ink-3)';
        return (
          <g key={s.key + (derived ? ':d' : ':r')}>
            {/* 白色襯線：引線跨過深色晶粒時仍讀得到 */}
            <path d={s.d} stroke="rgba(255,255,255,0.9)" strokeWidth={4} shapeRendering="crispEdges" />
            <path
              className={derived ? undefined : 'draw'}
              d={s.d}
              stroke={color}
              strokeWidth={solid ? 1.5 : 1}
              strokeDasharray={solid ? undefined : '4 3'}
              shapeRendering="crispEdges"
            />
            <rect x={s.end.x - 1} y={s.end.y - 3} width={4} height={6} fill={color} />
          </g>
        );
      })}
    </svg>
  );
};

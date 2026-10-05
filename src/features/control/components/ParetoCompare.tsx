import React from 'react';
import { DEFECT_CLASS_LABEL } from '../../inspection/spec/inspectionSpecV1';
import type { ParetoComparison } from '../spc';
import { fmtLots } from '../controlView';

interface Props {
  pareto: ParetoComparison;
}

/** 缺陷分類柏拉圖：基準期 vs 近期（每 100 顆的缺陷數，依近期排序＋累積比例）。 */
export const ParetoCompare: React.FC<Props> = ({ pareto }) => {
  const max = Math.max(1, ...pareto.rows.flatMap(r => [r.baselineRate, r.recentRate]));

  return (
    <div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }} className="small">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 8, background: 'var(--si-300)' }} />
          基準期 <span className="mono">{fmtLots(pareto.baselineLots)}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 10, background: 'var(--si-800)' }} />
          近期 <span className="mono">{fmtLots(pareto.recentLots)}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 10, background: 'var(--fail)' }} />
          近期增加
        </span>
        <span className="dim" style={{ marginLeft: 'auto' }}>單位：每 100 顆的缺陷數</span>
      </div>

      <div style={{ borderTop: '1px solid var(--rule-strong)' }}>
        {pareto.rows.map(r => {
          const delta = r.recentRate - r.baselineRate;
          const up = delta > 0.05;
          return (
            <div key={r.code} style={{ display: 'grid', gridTemplateColumns: '108px minmax(0, 1fr) 128px', gap: 14, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--rule)' }}>
              <div>
                <span className="mono" style={{ fontWeight: 600 }}>{r.code}</span>
                <span className="small" style={{ color: 'var(--ink-2)', marginLeft: 6 }}>{DEFECT_CLASS_LABEL[r.code].cn}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ height: 8, width: `${(r.baselineRate / max) * 100}%`, minWidth: 2, background: 'var(--si-300)' }} />
                  <span className="mono tiny dim">{r.baselineRate.toFixed(1)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ height: 12, width: `${(r.recentRate / max) * 100}%`, minWidth: 2, background: up ? 'var(--fail)' : 'var(--si-800)' }} />
                  <span className="mono small" style={{ fontWeight: 600 }}>{r.recentRate.toFixed(1)}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontWeight: 700, color: up ? 'var(--fail-ink)' : 'var(--ink-3)' }}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                </div>
                <div className="mono tiny dim">
                  佔 {(r.recentShare * 100).toFixed(0)}%・累積 {(r.recentCumShare * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {pareto.topShift && (
        <p style={{ marginTop: 12 }}>
          主要貢獻者：<b className="mono">{pareto.topShift.code}</b> {DEFECT_CLASS_LABEL[pareto.topShift.code].cn}，
          近期比基準期增加 <b className="mono" style={{ color: 'var(--fail-ink)' }}>{pareto.topShift.deltaRate.toFixed(1)}</b> 件／100 顆。
        </p>
      )}
    </div>
  );
};

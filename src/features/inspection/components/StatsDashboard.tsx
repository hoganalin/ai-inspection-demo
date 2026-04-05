import React, { useState, useMemo } from 'react';
import type { HistoryItem } from '../types';

interface Props {
  history: HistoryItem[];
}

type TimeRange = '1D' | '7D' | '30D' | 'ALL';

export const StatsDashboard: React.FC<Props> = ({ history }) => {
  const [range, setRange] = useState<TimeRange>('ALL');

  const filteredHistory = useMemo(() => {
    if (range === 'ALL') return history;
    const now = new Date();
    const days = range === '1D' ? 1 : range === '7D' ? 7 : 30;
    const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return history.filter(h => new Date(h.result.analyzedAt) >= threshold);
  }, [history, range]);

  if (history.length === 0) {
    return (
      <div style={{ padding: '64px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.2 }}>📊</div>
        <p style={{ fontSize: 13, color: 'var(--subtext)', fontWeight: 500 }}>尚無統計資料可供分析</p>
      </div>
    );
  }

  const pass = filteredHistory.filter(h => h.result.status === 'pass').length;
  const fail = filteredHistory.filter(h => h.result.status === 'fail').length;
  const warning = filteredHistory.filter(h => h.result.status === 'warning').length;
  const total = filteredHistory.length || 1;
  const passRate = Math.round((pass / total) * 100);
  const avgConf = total > 0 ? Math.round(filteredHistory.reduce((s, h) => s + h.result.confidence, 0) / total) : 0;

  // Donut Config
  const r = 40;
  const circ = 2 * Math.PI * r;
  const arcs = [
    { key: 'pass', val: pass, color: 'var(--success)' },
    { key: 'fail', val: fail, color: 'var(--danger)' },
    { key: 'warn', val: warning, color: 'var(--warning)' }
  ].filter(a => a.val > 0);

  let cumOffset = 0;

  return (
    <div className="anim-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* Header with Toggles */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="section-label">數據時段分析</span>
        <div className="tab-pill-container">
          {(['1D', '7D', '30D', 'ALL'] as TimeRange[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`tab-pill ${range === r ? 'active' : ''}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: 12 }}>
        {/* Pass Rate Donut */}
        <div className="chart-surface" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
            {arcs.map(arc => {
              const dash = (arc.val / total) * circ;
              const offset = -cumOffset;
              cumOffset += dash;
              return (
                <circle
                  key={arc.key} cx="60" cy="60" r={r}
                  fill="none" stroke={arc.color} strokeWidth="12"
                  strokeDasharray={`${dash} ${circ - dash}`}
                  strokeDashoffset={offset}
                  transform="rotate(-90 60 60)"
                  style={{ transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
              );
            })}
            <text x="60" y="58" textAnchor="middle" dominantBaseline="middle" fontSize="22" fontWeight="800" fill="#fff">{passRate}%</text>
            <text x="60" y="76" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--neutral-600)" letterSpacing="0.05em">合格率</text>
          </svg>
        </div>

        {/* Confidence Distribution (Mini Histogram) */}
        <div className="chart-surface" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>判定信心度分佈</span>
            <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 800 }}>AVG {avgConf}%</span>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
            {Array.from({ length: 10 }).map((_, i) => {
              const min = i * 10;
              const max = (i + 1) * 10;
              const count = filteredHistory.filter(h => h.result.confidence >= min && h.result.confidence < max).length;
              const h = (count / total) * 60;
              return (
                <div key={i} className="viz-bar" style={{ height: Math.max(h, 4), opacity: count > 0 ? 1 : 0.2 }} />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--neutral-600)', fontWeight: 700 }}>
            <span>LOW</span>
            <span>HIGH</span>
          </div>
        </div>
      </div>

      {/* Grid Analytics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {[
          { label: '平均判定耗時',  value: '1.24', unit: 'SEC', trend: 'stable' },
          { label: '今日異動',      value: '+14', unit: 'ITEMS', trend: 'up' },
        ].map(item => (
          <div key={item.label} className="chart-surface" style={{ padding: '16px' }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--neutral-600)', marginBottom: 8, textTransform: 'uppercase' }}>{item.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{item.value}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-400)' }}>{item.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 30D Trend Simulation */}
      <div className="chart-surface" style={{ padding: '20px' }}>
         <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 12 }}>30日趨勢模擬</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
          {Array.from({ length: 30 }).map((_, i) => {
            const h = 20 + Math.sin(i * 0.5) * 15;
            return <div key={i} className="viz-bar" style={{ flex: 1, height: h, opacity: 0.7 + (i / 30) * 0.3 }} />;
          })}
        </div>
      </div>

    </div>
  );
};

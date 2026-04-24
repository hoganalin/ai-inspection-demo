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
      <div style={{ padding: '64px 20px', textAlign: 'center', background: 'var(--paper-soft)', border: '1px dashed var(--line)', borderRadius: 'var(--r-md)' }}>
        <div className="label-en" style={{ marginBottom: 8 }}>EMPTY</div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>尚無統計資料可供分析</p>
      </div>
    );
  }

  const pass = filteredHistory.filter(h => h.result.status === 'pass').length;
  const fail = filteredHistory.filter(h => h.result.status === 'fail').length;
  const warning = filteredHistory.filter(h => h.result.status === 'warning').length;
  const total = filteredHistory.length || 1;
  const passRate = Math.round((pass / total) * 100);
  const avgConf = total > 0 ? Math.round(filteredHistory.reduce((s, h) => s + h.result.confidence, 0) / total) : 0;
  const totalDefects = filteredHistory.reduce((s, h) => s + h.result.defects.length, 0);
  const todayItems = filteredHistory.filter(h => new Date(h.result.analyzedAt).toDateString() === new Date().toDateString()).length;

  return (
    <div className="anim-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Range selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="divider" style={{ flex: 1, padding: 0 }}>概況 · OVERVIEW</div>
        <div className="tab-pill-container" style={{ marginLeft: 14 }}>
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

      {/* Overview card */}
      <div style={{ padding: '24px 28px', background: 'var(--paper-soft)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <div className="num-mono" style={{ fontSize: 56, color: 'var(--matcha)', lineHeight: 1, fontWeight: 400 }}>{passRate}</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-mute)' }}>%</div>
          <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--ink-soft)' }}>
            合格率（{range}）
          </div>
        </div>
        <div style={{ height: 1, background: 'var(--line)', margin: '14px 0' }} />

        {/* Proportion bar */}
        <div style={{ display: 'flex', height: 6, borderRadius: 1, overflow: 'hidden', background: 'var(--paper-dim)', marginBottom: 16 }}>
          <div style={{ flex: pass || 0.001, background: 'var(--matcha)' }} />
          <div style={{ flex: warning || 0.001, background: 'var(--mustard)' }} />
          <div style={{ flex: fail || 0.001, background: 'var(--terracotta)' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {[
            { label: '合格',    count: pass,    color: 'var(--matcha)' },
            { label: '留意',    count: warning, color: 'var(--mustard)' },
            { label: '需檢修',  count: fail,    color: 'var(--terracotta)' },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, background: s.color, borderRadius: 1 }} />
                <span className="label-en" style={{ fontSize: 9 }}>{s.label}</span>
              </div>
              <div className="num-mono" style={{ fontSize: 22, color: 'var(--ink)' }}>
                {String(s.count).padStart(2, '0')}
                <span style={{ fontSize: 10, color: 'var(--ink-mute)', marginLeft: 4 }}>件</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mini stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
        {[
          { label: '平均信心度', value: `${avgConf}`, unit: '%' },
          { label: '總瑕疵數',   value: String(totalDefects), unit: '件' },
          { label: '今日檢測',   value: String(todayItems), unit: '件' },
        ].map(item => (
          <div key={item.label} style={{ background: 'var(--paper-soft)', padding: '16px 18px' }}>
            <div className="label-en" style={{ marginBottom: 4 }}>{item.label}</div>
            <div>
              <span className="num-mono" style={{ fontSize: 22, color: 'var(--ink)' }}>{item.value}</span>
              <span className="kpi-unit">{item.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Confidence distribution */}
      <div>
        <div className="divider" style={{ marginBottom: 10 }}>信心度分佈 · CONFIDENCE</div>
        <div style={{ padding: '22px 24px', background: 'var(--paper-soft)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 70 }}>
            {Array.from({ length: 10 }).map((_, i) => {
              const min = i * 10;
              const max = (i + 1) * 10;
              const count = filteredHistory.filter(h => h.result.confidence >= min && h.result.confidence < max).length;
              const maxCount = Math.max(...Array.from({ length: 10 }).map((_, j) =>
                filteredHistory.filter(h => h.result.confidence >= j * 10 && h.result.confidence < (j + 1) * 10).length
              ), 1);
              const h = (count / maxCount) * 60;
              return (
                <div
                  key={i}
                  className="viz-bar"
                  style={{ height: Math.max(h, 4), opacity: count > 0 ? 1 : 0.25, background: 'var(--clay)' }}
                  title={`${min}-${max}%: ${count} 件`}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span className="label-en" style={{ fontSize: 9 }}>LOW</span>
            <span className="label-en" style={{ fontSize: 9 }}>HIGH</span>
          </div>
        </div>
      </div>

      {/* Status breakdown bars */}
      <div>
        <div className="divider" style={{ marginBottom: 10 }}>狀態分佈 · STATUS</div>
        <div style={{ padding: '18px 22px', background: 'var(--paper-soft)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: '合格',   val: pass,    color: 'var(--matcha)' },
            { label: '留意',   val: warning, color: 'var(--mustard)' },
            { label: '需檢修', val: fail,    color: 'var(--terracotta)' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 12, color, width: 56, flexShrink: 0, letterSpacing: '0.1em' }}>{label}</span>
              <div className="progress" style={{ flex: 1 }}>
                <div className="progress-fill" style={{ width: `${total > 0 ? (val / total) * 100 : 0}%`, background: color }} />
              </div>
              <span className="num-mono" style={{ fontSize: 12, color: 'var(--ink)', width: 28, textAlign: 'right', flexShrink: 0 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 30-day trend */}
      <div>
        <div className="divider" style={{ marginBottom: 10 }}>近 30 日趨勢 · 30-DAY TREND</div>
        <div style={{ padding: '22px 24px', background: 'var(--paper-soft)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 70 }}>
            {Array.from({ length: 30 }).map((_, i) => {
              const day = new Date();
              day.setDate(day.getDate() - (29 - i));
              const dayStr = day.toDateString();
              const count = history.filter(h => new Date(h.result.analyzedAt).toDateString() === dayStr).length;
              const maxCount = Math.max(...Array.from({ length: 30 }).map((_, j) => {
                const d = new Date(); d.setDate(d.getDate() - (29 - j));
                return history.filter(h => new Date(h.result.analyzedAt).toDateString() === d.toDateString()).length;
              }), 1);
              return (
                <div
                  key={i}
                  className="viz-bar"
                  style={{ flex: 1, height: Math.max((count / maxCount) * 60, count > 0 ? 6 : 2), opacity: count > 0 ? 1 : 0.2, background: 'var(--matcha)' }}
                  title={`${day.toLocaleDateString('zh-TW')}: ${count} 件`}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span className="label-en" style={{ fontSize: 9 }}>30 天前</span>
            <span className="label-en" style={{ fontSize: 9 }}>今日</span>
          </div>
        </div>
      </div>
    </div>
  );
};

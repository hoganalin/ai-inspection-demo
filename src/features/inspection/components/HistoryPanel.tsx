import React, { useState } from 'react';
import type { HistoryItem } from '../types';
import { InspectionResultPanel } from './InspectionResult';

function exportHistoryCSV(items: HistoryItem[]) {
  const header = '時間,檔名,狀態,信心度(%),瑕疵數';
  const rows = items.map(h => [
    new Date(h.result.analyzedAt).toLocaleString('zh-TW'),
    `"${h.fileName}"`,
    h.result.status,
    h.result.confidence,
    h.result.defects.length,
  ].join(','));
  const csv = '\uFEFF' + [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type DateFilter = 'all' | 'today' | 'week';

interface Props {
  history: HistoryItem[];
  onClear: () => void;
  onSelectItem?: (id: string | null) => void;
}

const STATUS_CFG = {
  pass: { color: 'var(--success)', icon: '✓', label: '合格' },
  fail: { color: 'var(--danger)', icon: '✕', label: '不合格' },
  warning: { color: 'var(--warning)', icon: '!', label: '警告' }
};

interface CardProps {
  item: HistoryItem;
  expandedId: string | null;
  onToggle: (id: string) => void;
}

const HistoryItemCard: React.FC<CardProps> = ({ item, expandedId, onToggle }) => {
  const cfg = STATUS_CFG[item.result.status as keyof typeof STATUS_CFG] ?? { color: 'var(--subtext)', icon: '?', label: item.result.status };
  const isExpanded = expandedId === item.id;
  return (
    <div
      onClick={() => onToggle(item.id)}
      style={{
        padding: '12px 14px',
        background: isExpanded ? 'rgba(79,124,255,0.06)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isExpanded ? 'rgba(79,124,255,0.3)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {item.thumbnail && (
          <img src={item.thumbnail} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.fileName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--neutral-400)', marginTop: 2 }}>
            {new Date(item.result.analyzedAt).toLocaleString('zh-TW')}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
            background: `${cfg.color}20`, color: cfg.color,
          }}>
            {cfg.icon} {cfg.label}
          </span>
          <span style={{ fontSize: 11, color: 'var(--neutral-400)' }}>{item.result.confidence}%</span>
        </div>
        <span style={{ color: 'var(--neutral-400)', fontSize: 12 }}>{isExpanded ? '▾' : '▸'}</span>
      </div>
      {isExpanded && (
        <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
          <InspectionResultPanel result={item.result} />
        </div>
      )}
    </div>
  );
};

export const HistoryPanel: React.FC<Props> = ({ history, onClear, onSelectItem }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const filtered = history.filter(item => {
    if (statusFilter && item.result.status !== statusFilter) return false;
    if (dateFilter !== 'all') {
      const d = new Date(item.result.analyzedAt);
      const now = new Date();
      if (dateFilter === 'today') return d.toDateString() === now.toDateString();
      if (dateFilter === 'week') return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    return true;
  });

  const handleToggle = (id: string) => {
    const nextId = expandedId === id ? null : id;
    setExpandedId(nextId);
    onSelectItem?.(nextId);
  };

  if (history.length === 0) {
    return (
      <div style={{ padding: '64px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.2 }}>📁</div>
        <p style={{ fontSize: 13, color: 'var(--subtext)', fontWeight: 500 }}>目前尚無檢測紀錄</p>
      </div>
    );
  }

  return (
    <div className="anim-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--neutral-400)', fontWeight: 700, letterSpacing: '0.05em' }}>
            TOTAL {history.length} ITEMS
          </span>
          {(statusFilter || dateFilter !== 'all') && (
            <span style={{ fontSize: 10, background: 'var(--primary)', color: '#fff', padding: '1px 6px', borderRadius: 4 }}>
              FILTERED
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => exportHistoryCSV(history)}
            className="btn-ghost"
            style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, color: 'var(--green)' }}
          >
            ↓ CSV
          </button>
          <button onClick={onClear} className="btn-ghost" style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, color: 'var(--danger)' }}>
            CLEAR
          </button>
        </div>
      </div>

      {/* Status Filter Bar */}
      <div style={{ display: 'flex', gap: 6 }}>
        {['', 'pass', 'fail', 'warning'].map(type => (
          <button
            key={type}
            onClick={() => setStatusFilter(type)}
            style={{
              flex: 1, padding: '6px 2px', borderRadius: 6, border: '1px solid var(--border)',
              fontSize: 10, fontWeight: 800, cursor: 'pointer',
              background: statusFilter === type ? 'var(--neutral-800)' : 'transparent',
              color: statusFilter === type ? '#fff' : 'var(--neutral-400)',
              transition: 'all 0.2s'
            }}
          >
            {type === '' ? 'ALL' : type.toUpperCase()}
          </button>
        ))}
      </div>
      {/* Date Filter Bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        {([['all', '全部'], ['today', '今天'], ['week', '本週']] as [DateFilter, string][]).map(([val, label]) => (
          <button key={val} onClick={() => setDateFilter(val)}
            style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 800,
              background: dateFilter === val ? 'var(--neutral-800)' : 'transparent',
              color: dateFilter === val ? '#fff' : 'var(--neutral-400)', transition: 'all 0.2s'
            }}
          >{label}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--subtext)' }}>尚無符合條件的記錄</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(item => (
            <HistoryItemCard key={item.id} item={item} expandedId={expandedId} onToggle={handleToggle} />
          ))}
        </div>
      )}
    </div>
  );
};

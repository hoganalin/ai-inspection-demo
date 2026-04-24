import React, { useState } from 'react';
import type { HistoryItem } from '../types';
import { InspectionResultPanel } from './InspectionResult';
import { Icon, STATUS_MAP } from '../../../components/muji/Icon';

function exportHistoryCSV(items: HistoryItem[]) {
  const header = '時間,檔名,狀態,信心度(%),瑕疵數';
  const rows = items.map(h => [
    new Date(h.result.analyzedAt).toLocaleString('zh-TW'),
    `"${h.fileName}"`,
    h.result.status,
    h.result.confidence,
    h.result.defects.length,
  ].join(','));
  const csv = '﻿' + [header, ...rows].join('\n');
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

const FILTER_LABEL: Record<'' | 'pass' | 'warning' | 'fail', string> = {
  '': '全部',
  pass: '合格',
  warning: '留意',
  fail: '需檢修',
};

interface CardProps {
  item: HistoryItem;
  expandedId: string | null;
  onToggle: (id: string) => void;
}

const HistoryItemCard: React.FC<CardProps> = ({ item, expandedId, onToggle }) => {
  const cfg = STATUS_MAP[item.result.status as keyof typeof STATUS_MAP]
    ?? { color: 'var(--ink-soft)', cn: item.result.status, mark: '?' };
  const isExpanded = expandedId === item.id;
  return (
    <div
      onClick={() => onToggle(item.id)}
      style={{
        padding: '14px 18px',
        background: isExpanded ? 'var(--clay-bg)' : 'var(--paper-soft)',
        border: `1px solid ${isExpanded ? 'var(--clay)' : 'var(--line)'}`,
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto auto', alignItems: 'center', gap: 14 }}>
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 2, border: '1px solid var(--line)' }} />
        ) : (
          <div style={{
            width: 44, height: 44, borderRadius: 2,
            background: 'repeating-linear-gradient(45deg, var(--paper-dim), var(--paper-dim) 4px, var(--paper-deep) 4px, var(--paper-deep) 8px)',
            border: '1px solid var(--line)',
          }} />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.fileName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.result.summary}
          </div>
          <div className="label-en" style={{ fontSize: 9, marginTop: 4 }}>
            {new Date(item.result.analyzedAt).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div className="num-mono" style={{ fontSize: 12, color: 'var(--ink-mute)', minWidth: 36, textAlign: 'right' }}>
          {item.result.confidence}%
        </div>
        <div style={{ textAlign: 'right', minWidth: 64 }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 12, color: cfg.color, letterSpacing: '0.1em' }}>
            <span style={{ marginRight: 4 }}>{cfg.mark}</span>{cfg.cn}
          </span>
        </div>
      </div>
      {isExpanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }} onClick={e => e.stopPropagation()}>
          <InspectionResultPanel result={item.result} />
        </div>
      )}
    </div>
  );
};

export const HistoryPanel: React.FC<Props> = ({ history, onClear, onSelectItem }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | 'pass' | 'warning' | 'fail'>('');
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
      <div style={{ padding: '64px 20px', textAlign: 'center', background: 'var(--paper-soft)', border: '1px dashed var(--line)', borderRadius: 'var(--r-md)' }}>
        <div className="label-en" style={{ marginBottom: 8 }}>EMPTY</div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>目前尚無檢測紀錄</p>
      </div>
    );
  }

  return (
    <div className="anim-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="divider">歷史紀錄 · HISTORY</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--ink)' }}>
          最近 <span className="num-mono" style={{ color: 'var(--clay)' }}>{history.length}</span> 筆檢測紀錄
          {(statusFilter || dateFilter !== 'all') && filtered.length !== history.length && (
            <span className="label-en" style={{ marginLeft: 10, color: 'var(--clay)' }}>篩選後 {filtered.length}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => exportHistoryCSV(history)} className="btn btn-ghost" style={{ fontSize: 12 }}>
            <Icon.Download width={13} height={13} style={{ marginRight: 4, verticalAlign: '-2px' }} />
            CSV
          </button>
          <button onClick={onClear} className="btn btn-ghost" style={{ fontSize: 12 }}>
            <Icon.Trash width={13} height={13} style={{ marginRight: 4, verticalAlign: '-2px' }} />
            清除
          </button>
        </div>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['', 'pass', 'warning', 'fail'] as const).map(type => {
          const active = statusFilter === type;
          return (
            <button
              key={type}
              onClick={() => setStatusFilter(type)}
              style={{
                flex: 1,
                padding: '8px 6px',
                fontFamily: 'var(--font-serif)',
                fontSize: 12,
                letterSpacing: '0.1em',
                border: `1px solid ${active ? 'var(--clay)' : 'var(--line)'}`,
                background: active ? 'var(--clay-bg)' : 'var(--paper-soft)',
                color: active ? 'var(--clay-deep)' : 'var(--ink-soft)',
                borderRadius: 'var(--r-sm)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {FILTER_LABEL[type]}
            </button>
          );
        })}
      </div>

      {/* Date filter */}
      <div style={{ display: 'flex', gap: 6 }}>
        {([['all', '全部'], ['today', '今天'], ['week', '本週']] as [DateFilter, string][]).map(([val, label]) => {
          const active = dateFilter === val;
          return (
            <button
              key={val}
              onClick={() => setDateFilter(val)}
              style={{
                padding: '6px 14px',
                fontFamily: 'var(--font-serif)',
                fontSize: 12,
                letterSpacing: '0.1em',
                border: `1px solid ${active ? 'var(--ink-soft)' : 'transparent'}`,
                background: active ? 'var(--paper-dim)' : 'transparent',
                color: active ? 'var(--ink)' : 'var(--ink-mute)',
                borderRadius: 'var(--r-sm)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--ink-mute)' }}>尚無符合條件的紀錄</p>
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

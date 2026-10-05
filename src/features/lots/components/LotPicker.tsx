import React, { useState } from 'react';
import { summarizeLot } from '../lotStats';
import { suggestNextLotId } from '../hooks/useLots';
import { Icon } from '../../../components/ui/icons';
import type { LotRecord } from '../types';

interface Props {
  lots: LotRecord[];
  currentLot: LotRecord;
  onSelect: (lotId: string) => void;
}

/** 目前批：判定結果都記到這個批 (Lot)。可切換既有批或開新批。 */
export const LotPicker: React.FC<Props> = ({ lots, currentLot, onSelect }) => {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const s = summarizeLot(currentLot);
  const rate = s.n ? `${((s.fail / s.n) * 100).toFixed(1)}%` : '—';

  const ids = Array.from(new Set([...lots.map(l => l.lotId), currentLot.lotId]));

  const submit = () => {
    if (!draft.trim()) return;
    onSelect(draft.trim());
    setCreating(false);
    setDraft('');
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span className="small" style={{ fontWeight: 600, color: 'var(--ink-2)' }}>記入批</span>
      {creating ? (
        <>
          <input
            autoFocus
            className="field mono"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setCreating(false); }}
            placeholder="批號，例：LIVE-02"
            aria-label="新批號"
            style={{ width: 150, padding: '5px 8px' }}
          />
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={!draft.trim()}>建立</button>
          <button className="btn btn-quiet btn-sm" onClick={() => setCreating(false)}>取消</button>
        </>
      ) : (
        <>
          <select
            className="field mono"
            value={currentLot.lotId}
            onChange={e => onSelect(e.target.value)}
            aria-label="選擇目前批"
            style={{ padding: '5px 8px' }}
          >
            {ids.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
          <button className="btn btn-quiet btn-sm" onClick={() => { setDraft(suggestNextLotId(lots)); setCreating(true); }}>
            <Icon.Plus width={14} height={14} />開新批
          </button>
        </>
      )}
      <span className="mono small" style={{ color: 'var(--ink-2)', display: 'inline-flex', gap: 12 }}>
        <span>n={s.n}</span>
        <span style={{ color: s.fail ? 'var(--fail-ink)' : undefined }}>Fail {s.fail}</span>
        <span>批不良率 {rate}</span>
      </span>
    </div>
  );
};

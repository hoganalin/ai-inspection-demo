import React, { useRef, useCallback, useState } from 'react';
import { useBatchInspection } from '../hooks/useBatchInspection';
import type { InspectionResult } from '../types';
import { Icon, STATUS_MAP } from '../../../components/muji/Icon';

interface Props {
  customCriteria?: string;
  threshold?: number;
  onRecordAdded: (result: InspectionResult, thumbnail: string, fileName: string) => void;
}

function exportBatchCSV(items: { fileName: string; result?: InspectionResult }[]) {
  const header = '時間,檔名,狀態,信心度(%),瑕疵數';
  const rows = items
    .filter(it => it.result)
    .map(it => [
      new Date(it.result!.analyzedAt).toLocaleString('zh-TW'),
      `"${it.fileName}"`,
      it.result!.status,
      it.result!.confidence,
      it.result!.defects.length,
    ].join(','));
  const csv = '﻿' + [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `batch-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const ITEM_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: '等待中', color: 'var(--ink-mute)' },
  analyzing: { label: '分析中', color: 'var(--clay)' },
  done:      { label: '已完成', color: 'var(--matcha)' },
  error:     { label: '失敗',   color: 'var(--terracotta)' },
};

export const BatchInspectionPanel: React.FC<Props> = ({ customCriteria, threshold, onRecordAdded }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { items, isRunning, progress, startBatch, reset } = useBatchInspection(onRecordAdded);
  const [filter, setFilter] = useState<string>('all');
  const [sampling, setSampling] = useState<string>('100%');

  const isDone = !isRunning && progress.done === progress.total && progress.total > 0;

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    let processed = arr;
    if (sampling !== '100%') {
      const ratio = parseInt(sampling) / 100;
      processed = arr.sort(() => 0.5 - Math.random()).slice(0, Math.ceil(arr.length * ratio));
    }
    await startBatch(processed, customCriteria, threshold);
  }, [customCriteria, threshold, startBatch, sampling]);

  const filteredItems = items.filter(it => filter === 'all' || it.status === filter);
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  const passCount = items.filter(i => i.result?.status === 'pass').length;
  const warnCount = items.filter(i => i.result?.status === 'warning').length;
  const failCount = items.filter(i => i.result?.status === 'fail').length;

  return (
    <div className="batch-main-layout anim-in">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />

      {/* Overall progress */}
      {items.length > 0 && (
        <div>
          <div className="divider" style={{ marginBottom: 10 }}>批次進度 · BATCH PROGRESS</div>
          <div style={{ padding: '18px 22px', background: 'var(--paper-soft)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <div>
                <div className="label-en">已完成</div>
                <div style={{ marginTop: 2 }}>
                  <span className="num-mono" style={{ fontSize: 28, color: 'var(--ink)' }}>{progress.done}</span>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--ink-mute)', margin: '0 8px' }}>／</span>
                  <span className="num-mono" style={{ fontSize: 16, color: 'var(--ink-soft)' }}>{progress.total}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div className="num-mono" style={{ fontSize: 14, color: 'var(--clay)' }}>{percent}%</div>
                {isDone && (
                  <button onClick={() => exportBatchCSV(items)} className="btn btn-ghost" style={{ fontSize: 11 }}>
                    <Icon.Download width={13} height={13} style={{ marginRight: 4, verticalAlign: '-2px' }} />
                    CSV
                  </button>
                )}
                {!isRunning && items.length > 0 && (
                  <button onClick={reset} className="btn btn-ghost" style={{ fontSize: 11 }}>重置</button>
                )}
              </div>
            </div>
            <div className="progress"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, marginTop: 18, background: 'var(--line)', border: '1px solid var(--line)' }}>
              {[
                { label: '合格', count: passCount, color: 'var(--matcha)' },
                { label: '留意', count: warnCount, color: 'var(--mustard)' },
                { label: '不良', count: failCount, color: 'var(--terracotta)' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'var(--paper-soft)', padding: '12px 14px', textAlign: 'center' }}>
                  <div className="label-en" style={{ fontSize: 9 }}>{s.label}</div>
                  <div className="num-mono" style={{ fontSize: 20, color: s.color, marginTop: 4 }}>{String(s.count).padStart(2, '0')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sampling + filter */}
      <div>
        <div className="divider" style={{ marginBottom: 10 }}>抽樣與篩選 · SAMPLING & FILTER</div>
        <div className="sampling-bar">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="label-ch">抽樣比例</span>
            <div style={{ display: 'flex', gap: 2 }}>
              {['1%', '5%', '10%', '100%'].map(s => {
                const active = sampling === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSampling(s)}
                    style={{
                      padding: '4px 10px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      border: `1px solid ${active ? 'var(--clay)' : 'var(--line)'}`,
                      background: active ? 'var(--clay-bg)' : 'transparent',
                      color: active ? 'var(--clay-deep)' : 'var(--ink-mute)',
                      borderRadius: 'var(--r-xs)',
                      cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-xs)',
              padding: '4px 8px',
              color: 'var(--ink-soft)',
              fontFamily: 'var(--font-serif)',
              fontSize: 12,
              outline: 'none',
            }}
          >
            <option value="all">全部狀態</option>
            <option value="done">已完成</option>
            <option value="analyzing">分析中</option>
            <option value="error">失敗</option>
          </select>
        </div>
      </div>

      {/* Upload zone */}
      <div>
        <div className="divider" style={{ marginBottom: 10 }}>樣本上傳 · UPLOAD</div>
        <div
          onClick={() => !isRunning && inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          className="uploader"
          style={{
            padding: items.length > 0 ? '32px 24px' : '56px 24px',
            opacity: isRunning ? 0.6 : 1,
            cursor: isRunning ? 'not-allowed' : 'pointer',
          }}
        >
          <Icon.Upload width={22} height={22} style={{ margin: '0 auto 12px', display: 'block', color: 'var(--clay)' }} />
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--ink)', letterSpacing: '0.08em', marginBottom: 4 }}>
            {isRunning ? '批次分析進行中' : '批量拖曳樣本圖片'}
          </div>
          <div className="label-en" style={{ fontSize: 9 }}>
            {isRunning ? 'ANALYZING' : 'MULTI-FILE UPLOAD'}
          </div>
        </div>
      </div>

      {/* File list */}
      {items.length > 0 && (
        <div>
          <div className="divider" style={{ marginBottom: 10 }}>檔案清單 · FILE LIST</div>
          <div className="batch-file-list">
            {filteredItems.map(item => {
              const cfg = ITEM_STATUS[item.status];
              const res = item.result;
              const resCfg = res ? STATUS_MAP[res.status as keyof typeof STATUS_MAP] : null;
              return (
                <div key={item.id} className="batch-item-row anim-in">
                  <img src={item.thumbnail} alt="" style={{ width: 36, height: 36, borderRadius: 2, objectFit: 'cover', border: '1px solid var(--line)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.fileName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color }} />
                      <span className="label-en" style={{ fontSize: 9, color: cfg.color }}>{cfg.label}</span>
                      <span className="label-en" style={{ fontSize: 9 }}>
                        · {item.file.size > 1024 * 1024 ? (item.file.size / (1024 * 1024)).toFixed(1) + 'MB' : (item.file.size / 1024).toFixed(0) + 'KB'}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {item.status === 'analyzing' && (
                      <span className="soft-loader"><span/><span/><span/></span>
                    )}
                    {item.status === 'done' && res && resCfg && (
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 12, color: resCfg.color, letterSpacing: '0.1em' }}>
                        <span style={{ marginRight: 4 }}>{resCfg.mark}</span>{res.confidence}%
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="num-mono" style={{ fontSize: 11, color: 'var(--terracotta)' }}>失敗</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useRef, useCallback, useState } from 'react';
import { useBatchInspection } from '../hooks/useBatchInspection';
import type { InspectionResult } from '../types';

interface Props {
  apiKey: string;
  customCriteria?: string;
  threshold?: number;
  onRecordAdded: (result: InspectionResult, thumbnail: string, fileName: string) => void;
}

function exportBatchCSV(items: ReturnType<typeof Array.from>) {
  const header = '時間,檔名,狀態,信心度(%),瑕疵數';
  const rows = (items as { fileName: string; result?: { analyzedAt: string; status: string; confidence: number; defects: unknown[] } }[])
    .filter(it => it.result)
    .map(it => [
      new Date(it.result!.analyzedAt).toLocaleString('zh-TW'),
      `"${it.fileName}"`,
      it.result!.status,
      it.result!.confidence,
      it.result!.defects.length,
    ].join(','));
  const csv = '\uFEFF' + [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `batch-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_MAP = {
  pending: { label: '等待中', color: 'var(--neutral-600)' },
  analyzing: { label: '分析中', color: 'var(--primary)' },
  done: { label: '已完成', color: 'var(--success)' },
  error: { label: '失敗', color: 'var(--danger)' }
};

export const BatchInspectionPanel: React.FC<Props> = ({ apiKey, customCriteria, threshold, onRecordAdded }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { items, isRunning, progress, startBatch, reset } = useBatchInspection(onRecordAdded);
  const [filter, setFilter] = useState<string>('all');
  const [sampling, setSampling] = useState<string>('100%');

  const isDone = !isRunning && progress.done === progress.total && progress.total > 0;

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || !apiKey) return;
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    let processed = arr;
    if (sampling !== '100%') {
      const ratio = parseInt(sampling) / 100;
      processed = arr.sort(() => 0.5 - Math.random()).slice(0, Math.ceil(arr.length * ratio));
    }
    await startBatch(processed, apiKey, customCriteria, threshold);
  }, [apiKey, customCriteria, threshold, startBatch, sampling]);

  const filteredItems = items.filter(it => filter === 'all' || it.status === filter);
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

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
      
      {/* 1. Overall Progress & Actions */}
      {items.length > 0 && (
        <div className="chart-surface" style={{ padding: '16px 20px', marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
             <div>
               <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>進度 {percent}%</div>
               <div style={{ fontSize: 11, color: 'var(--neutral-400)', fontWeight: 700 }}>
                 已處理 {progress.done} / 總計 {progress.total} 件
               </div>
             </div>
             <div style={{ display: 'flex', gap: 8 }}>
               {isDone && (
                 <button onClick={() => exportBatchCSV(items)} className="btn-ghost" style={{ padding: '6px 12px', fontSize: 11, color: 'var(--green)' }}>
                   ↓ CSV
                 </button>
               )}
               {!isRunning && <button onClick={reset} className="btn-ghost" style={{ padding: '6px 12px', fontSize: 11 }}>重置批次</button>}
               <div className="status-badge" style={{ background: isRunning ? 'rgba(79,124,255,0.1)' : 'rgba(255,255,255,0.05)', color: isRunning ? 'var(--primary)' : 'var(--neutral-600)' }}>
                 {isRunning ? '正在進行後端排程' : '批次任務已閒置'}
               </div>
             </div>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${percent}%`, background: 'var(--primary)', transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 0 10px var(--primary)' }} />
          </div>
        </div>
      )}

      {/* 2. Controls & Sampling */}
      <div className="sampling-bar">
         <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--neutral-400)' }}>抽樣比例</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {['1%', '5%', '10%', '100%'].map(s => (
                <button 
                  key={s} onClick={() => setSampling(s)}
                  style={{ 
                    padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                    background: sampling === s ? 'var(--neutral-800)' : 'transparent',
                    color: sampling === s ? '#fff' : 'var(--neutral-600)',
                    border: 'none', cursor: 'pointer'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
         </div>
         <div style={{ display: 'flex', gap: 8 }}>
            <select 
              value={filter} onChange={e => setFilter(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--neutral-400)', fontSize: 11, fontWeight: 700, outline: 'none' }}
            >
               <option value="all" style={{ background: '#000' }}>全部狀態</option>
               <option value="done" style={{ background: '#000' }}>已完成</option>
               <option value="analyzing" style={{ background: '#000' }}>分析中</option>
               <option value="error" style={{ background: '#000' }}>失敗</option>
            </select>
         </div>
      </div>

      {/* 3. Main Split View */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        
        {/* Left: Upload Zone */}
        <div 
          onClick={() => !isRunning && inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          className="upload-box" 
          style={{ height: items.length > 0 ? 300 : 200, opacity: isRunning ? 0.6 : 1, cursor: isRunning ? 'not-allowed' : 'pointer' }}
        >
          <div style={{ fontSize: 24, marginBottom: 12 }}>{isRunning ? '⏳' : '📥'}</div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{isRunning ? '批次分析進行中' : '批量拖放樣本圖'}</p>
          <p style={{ fontSize: 11, color: 'var(--neutral-400)', marginTop: 4 }}>模擬工業相機批量導入</p>
        </div>

        {/* Right: File List */}
        {items.length > 0 && (
          <div className="batch-file-list">
            {filteredItems.map(item => {
              const cfg = STATUS_MAP[item.status];
              return (
                <div key={item.id} className="batch-item-row anim-in">
                  <img src={item.thumbnail} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.fileName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                       <div className="status-dot" style={{ color: cfg.color, background: cfg.color }} />
                       <span style={{ fontSize: 10, fontWeight: 800, color: cfg.color, textTransform: 'uppercase' }}>{cfg.label}</span>
                       <span style={{ fontSize: 10, color: 'var(--neutral-600)' }}>• {item.file.size > 1024*1024 ? (item.file.size/(1024*1024)).toFixed(1)+'MB' : (item.file.size/1024).toFixed(0)+'KB'}</span>
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
                    {item.status === 'analyzing' && <span className="spin" style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--primary)', display: 'inline-block' }} />}
                    {item.status === 'done' && item.result && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color }}>{item.result.confidence}%</span>
                    )}
                    {item.status === 'error' && (
                      <span style={{ fontSize: 10, color: 'var(--danger)' }}>失敗</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

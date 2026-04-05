import React, { useRef, useCallback } from 'react';
import { useComparison } from '../hooks/useComparison';
import type { InspectionResult, ComparisonDefect } from '../types';

interface Props {
  apiKey: string;
  customCriteria?: string;
}

const STATUS_CFG = {
  pass:    { label: 'PASS',    color: 'var(--success)', icon: '✓' },
  fail:    { label: 'FAIL',    color: 'var(--danger)',  icon: '✕' },
  warning: { label: 'WARN',   color: 'var(--warning)', icon: '!' },
};

const SEV_COLOR: Record<string, string> = {
  low: 'var(--warning)', medium: '#f97316', high: 'var(--danger)',
};

const FOUND_IN_CFG = {
  A:    { label: '僅 A', bg: 'rgba(79,124,255,0.15)', color: 'var(--primary)' },
  B:    { label: '僅 B', bg: 'rgba(34,211,238,0.15)', color: 'var(--accent)' },
  both: { label: 'A+B',  bg: 'rgba(245,158,11,0.15)', color: 'var(--warning)' },
};

/* ── Image Drop Zone ── */
const DropZone: React.FC<{
  label: string;
  preview: string | null;
  color: string;
  onFile: (f: File) => void;
  disabled?: boolean;
}> = ({ label, preview, color, onFile, disabled }) => {
  const ref = useRef<HTMLInputElement>(null);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) onFile(f);
  }, [onFile]);

  return (
    <div
      onClick={() => !disabled && ref.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
      style={{
        flex: 1, minWidth: 0,
        border: `2px dashed ${preview ? color : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        background: preview ? 'transparent' : 'rgba(255,255,255,0.02)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        overflow: 'hidden',
        position: 'relative',
        aspectRatio: '4/3',
        transition: 'border-color 0.2s',
      }}
    >
      {preview ? (
        <>
          <img src={preview} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: color, color: '#fff',
            fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
          }}>
            圖片 {label}
          </div>
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 28, opacity: 0.4 }}>🖼</span>
          <span style={{ fontSize: 12, fontWeight: 700, color, opacity: 0.8 }}>圖片 {label}</span>
          <span style={{ fontSize: 10, color: 'var(--subtext)' }}>點擊或拖放</span>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
};

/* ── Mini Result Card ── */
const MiniResult: React.FC<{ label: string; result: InspectionResult; color: string }> = ({ label, result, color }) => {
  const cfg = STATUS_CFG[result.status];
  return (
    <div className="card" style={{ flex: 1, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: '0.05em' }}>圖片 {label}</span>
        <span style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 800,
          color: cfg.color, background: `${cfg.color}18`,
          padding: '2px 8px', borderRadius: 5,
        }}>{cfg.icon} {cfg.label}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>信心度</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color, fontFamily: 'monospace' }}>{result.confidence}%</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>瑕疵數</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: result.defects.length > 0 ? 'var(--danger)' : 'var(--success)', fontFamily: 'monospace' }}>{result.defects.length}</div>
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--subtext)', lineHeight: 1.5 }}>{result.summary}</p>
    </div>
  );
};

/* ── Difference Row ── */
const DiffRow: React.FC<{ diff: ComparisonDefect; index: number }> = ({ diff, index }) => {
  const fi = FOUND_IN_CFG[diff.foundIn];
  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <td style={{ padding: '10px 14px', color: 'var(--subtext)', fontSize: 12, width: 32 }}>
        {String(index + 1).padStart(2, '0')}
      </td>
      <td style={{ padding: '10px 14px' }}>
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 5,
          background: fi.bg, color: fi.color,
        }}>{fi.label}</span>
      </td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: '#fff', fontWeight: 500 }}>{diff.location}</td>
      <td style={{ padding: '10px 14px' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: SEV_COLOR[diff.severity], background: `${SEV_COLOR[diff.severity]}15`, padding: '2px 7px', borderRadius: 4 }}>
          {diff.severity}
        </span>
      </td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--subtext)', lineHeight: 1.4 }}>{diff.description}</td>
    </tr>
  );
};

/* ── Main Component ── */
export const ComparisonPanel: React.FC<Props> = ({ apiKey, customCriteria }) => {
  const { status, result, previewA, previewB, compare, reset } = useComparison();
  const [fileA, setFileA] = React.useState<File | null>(null);
  const [fileB, setFileB] = React.useState<File | null>(null);
  const [loadingDemo, setLoadingDemo] = React.useState(false);

  const canCompare = !!fileA && !!fileB && !!apiKey && status !== 'analyzing';

  const handleCompare = () => {
    if (fileA && fileB && apiKey) compare(fileA, fileB, apiKey, customCriteria);
  };

  const handleReset = () => {
    reset();
    setFileA(null);
    setFileB(null);
  };

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    try {
      const [resA, resB] = await Promise.all([
        fetch('/demo-pass-pcb.jpg'),
        fetch('/demo-fail-pcb.webp'),
      ]);
      const [blobA, blobB] = await Promise.all([resA.blob(), resB.blob()]);
      const fa = new File([blobA], 'demo-pass-pcb.jpg', { type: 'image/jpeg' });
      const fb = new File([blobB], 'demo-fail-pcb.webp', { type: 'image/webp' });
      if (status === 'done') reset();
      setFileA(fa);
      setFileB(fb);
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="anim-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Demo loader */}
      <button
        onClick={handleLoadDemo}
        disabled={loadingDemo || status === 'analyzing'}
        className="btn-ghost"
        style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', opacity: loadingDemo ? 0.5 : 1 }}
      >
        {loadingDemo
          ? <><span className="spin" style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block' }} /> 載入中…</>
          : <>🧪 載入 PCB 示範圖片（Pass vs 鏽蝕）</>
        }
      </button>

      {/* Upload Row */}
      <div style={{ display: 'flex', gap: 12 }}>
        <DropZone label="A" preview={previewA} color="var(--primary)"
          onFile={f => { setFileA(f); if (status === 'done') reset(); }}
          disabled={status === 'analyzing'} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ width: 1, flex: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--subtext)', letterSpacing: '0.05em' }}>VS</span>
          <div style={{ width: 1, flex: 1, background: 'var(--border)' }} />
        </div>
        <DropZone label="B" preview={previewB} color="var(--accent)"
          onFile={f => { setFileB(f); if (status === 'done') reset(); }}
          disabled={status === 'analyzing'} />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleCompare}
          disabled={!canCompare}
          className="btn-primary"
          style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 700, opacity: canCompare ? 1 : 0.4 }}
        >
          {status === 'analyzing' ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span className="spin" style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block' }} />
              Gemini 比對中…
            </span>
          ) : '🔍 開始 A/B 比對'}
        </button>
        {(previewA || previewB) && (
          <button onClick={handleReset} className="btn-ghost" style={{ padding: '10px 16px', fontSize: 12 }}>
            重置
          </button>
        )}
      </div>

      {!apiKey && (
        <p style={{ fontSize: 12, color: 'var(--warning)', textAlign: 'center' }}>⚠ 請先設定 API Key</p>
      )}

      {/* Results */}
      {result && (
        <div className="anim-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Similarity Bar */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>相似度</span>
              <span style={{
                fontSize: 24, fontWeight: 800, fontFamily: 'monospace',
                color: result.similarity >= 70 ? 'var(--success)' : result.similarity >= 40 ? 'var(--warning)' : 'var(--danger)',
              }}>
                {result.similarity}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: result.similarity >= 70 ? 'var(--success)' : result.similarity >= 40 ? 'var(--warning)' : 'var(--danger)',
                width: `${result.similarity}%`,
                transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
              }} />
            </div>
          </div>

          {/* Two mini result cards */}
          <div style={{ display: 'flex', gap: 12 }}>
            <MiniResult label="A" result={result.imageA} color="var(--primary)" />
            <MiniResult label="B" result={result.imageB} color="var(--accent)" />
          </div>

          {/* Differences Table */}
          {result.differences.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="section-label">差異明細</span>
                <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  {result.differences.length}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {['#', '來源', '位置', '嚴重度', '描述'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.differences.map((d, i) => <DiffRow key={i} diff={d} index={i} />)}
                </tbody>
              </table>
            </div>
          )}

          {result.differences.length === 0 && (
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
              <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 700 }}>兩張圖片無明顯差異</p>
            </div>
          )}

          {/* Verdict */}
          <div style={{ padding: '16px 20px', borderRadius: 'var(--radius-lg)', background: 'rgba(79,124,255,0.08)', border: '1px solid rgba(79,124,255,0.2)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              AI 比對結論
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.6 }}>{result.verdict}</p>
          </div>

        </div>
      )}

      {status === 'error' && (
        <div className="card" style={{ padding: '20px', textAlign: 'center', borderColor: 'rgba(239,68,68,0.3)' }}>
          <p style={{ fontSize: 13, color: 'var(--danger)' }}>比對失敗，請確認 API Key 或重試。</p>
        </div>
      )}

    </div>
  );
};

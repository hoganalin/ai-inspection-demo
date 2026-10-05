import React, { useState } from 'react';
import { InspectionResultPanel } from '../../inspection/components/InspectionResult';
import { Icon } from '../../../components/ui/icons';
import { DieMark, VerdictChip } from '../../../components/ui/marks';
import { SAMPLE_BY_ID } from '../../samples/sampleModel';
import { exportDiesCSV, exportLotsCSV, summarizeLot } from '../lotStats';
import type { DieRecord, LotRecord } from '../types';

interface Props {
  lots: LotRecord[];
  currentLotId: string;
  onSelectLot: (lotId: string) => void;
  onDeleteLot: (lotId: string) => void;
  onClearAll: () => void;
  onGoInspect: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const when = (iso: string) => new Date(iso).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

/** 縮圖；localStorage 空間不足而捨棄縮圖時，標準樣本改用樣本縮圖，其餘畫晶粒標誌。 */
const DieThumb: React.FC<{ die: DieRecord }> = ({ die }) => {
  const sid = /^(S\d{2})\.jpg$/.exec(die.fileName)?.[1];
  const src = die.thumbnail || (sid && SAMPLE_BY_ID[sid] ? SAMPLE_BY_ID[sid].thumbUrl : '');
  return src
    ? <img src={src} alt="" style={{ width: 32, height: 32, objectFit: 'cover', display: 'block' }} />
    : <DieMark size={32} />;
};

const DieRows: React.FC<{ dies: DieRecord[] }> = ({ dies }) => {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <table className="tbl" style={{ background: 'var(--ground)' }}>
      <thead>
        <tr>
          <th scope="col" style={{ width: 52 }}>影像</th>
          <th scope="col">檔名</th>
          <th scope="col">時間</th>
          <th scope="col">缺陷</th>
          <th scope="col">判定</th>
          <th scope="col" className="r">明細</th>
        </tr>
      </thead>
      <tbody>
        {[...dies].reverse().map(d => {
          const isOpen = open === d.id;
          return (
            <React.Fragment key={d.id}>
              <tr>
                <td><DieThumb die={d} /></td>
                <td className="mono small">{d.fileName}</td>
                <td className="mono small dim">{when(d.result.analyzedAt)}</td>
                <td className="small">{d.result.defects.length ? d.result.defects.map(j => j.defect.code).join('・') : '無缺陷'}</td>
                <td><VerdictChip verdict={d.result.verdict} withAction /></td>
                <td className="r">
                  <button className="btn btn-quiet btn-sm" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : d.id)}>
                    {isOpen ? '收合' : '展開'}
                  </button>
                </td>
              </tr>
              {isOpen && (
                <tr>
                  <td colSpan={6} style={{ background: 'var(--surface)', padding: '18px 20px' }}>
                    <InspectionResultPanel result={d.result} sourceLabel="AI 回報" />
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
};

/** 批紀錄：每批的 n、Pass／Warning／Fail、批不良率，可展開逐顆判定明細。 */
export const LotRecordPanel: React.FC<Props> = ({ lots, currentLotId, onSelectLot, onDeleteLot, onClearAll, onGoInspect }) => {
  const [openLot, setOpenLot] = useState<string | null>(currentLotId);
  const ordered = [...lots].reverse();

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">批紀錄</h1>
          <p className="page-sub">批不良率＝判定 Fail 的晶粒數 ÷ n。實測批接在模擬批後面畫到管制看板。紀錄只存在這個瀏覽器（localStorage）。</p>
        </div>
        {lots.length > 0 && (
          <div className="page-tools">
            <button onClick={() => exportLotsCSV(lots, `lots-summary-${today()}.csv`)} className="btn btn-sm">
              <Icon.Download width={14} height={14} />批彙總 CSV
            </button>
            <button onClick={() => exportDiesCSV(lots.flatMap(l => l.dies), `dies-all-${today()}.csv`)} className="btn btn-sm">
              <Icon.Download width={14} height={14} />判定明細 CSV
            </button>
            <button
              onClick={() => { if (window.confirm('清除所有批紀錄？此動作無法復原。')) onClearAll(); }}
              className="btn btn-quiet btn-sm"
            >
              <Icon.Trash width={14} height={14} />全部清除
            </button>
          </div>
        )}
      </header>

      {lots.length === 0 ? (
        <div className="note" style={{ padding: '28px 24px', display: 'block' }}>
          <h2 className="block-title">還沒有任何批</h2>
          <p style={{ color: 'var(--ink-2)', maxWidth: '60ch' }}>
            到單張判定或批檢驗判定晶粒（可直接用標準樣本 S01–S40），每一筆判定會記入目前批，這裡就會出現批號、n 與批不良率。
          </p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onGoInspect}>
            用標準樣本開始判定<Icon.Arrow width={16} height={16} />
          </button>
        </div>
      ) : (
        <div className="tbl-frame" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">批號</th>
                <th scope="col">建立時間</th>
                <th scope="col" className="r">n</th>
                <th scope="col" className="r">Pass</th>
                <th scope="col" className="r">Warning</th>
                <th scope="col" className="r">Fail</th>
                <th scope="col" className="r">批不良率</th>
                <th scope="col" className="r">操作</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map(lot => {
                const s = summarizeLot(lot);
                const isOpen = openLot === lot.lotId;
                const isCurrent = lot.lotId === currentLotId;
                return (
                  <React.Fragment key={lot.lotId}>
                    <tr aria-selected={isCurrent}>
                      <td>
                        <button
                          className="btn btn-quiet btn-sm"
                          aria-expanded={isOpen}
                          onClick={() => setOpenLot(isOpen ? null : lot.lotId)}
                          style={{ paddingLeft: 0, fontWeight: 700 }}
                        >
                          <Icon.Chevron width={14} height={14} style={{ transform: isOpen ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }} />
                          <span className="mono">{lot.lotId}</span>
                        </button>
                        {isCurrent && <span className="chip chip-accent" style={{ marginLeft: 6 }}>目前批</span>}
                      </td>
                      <td className="mono small dim">{lot.createdAt ? when(lot.createdAt) : '—'}</td>
                      <td className="r mono">{s.n}</td>
                      <td className="r mono" style={{ color: s.pass ? 'var(--pass-ink)' : 'var(--ink-3)' }}>{s.pass}</td>
                      <td className="r mono" style={{ color: s.warning ? 'var(--warn-ink)' : 'var(--ink-3)' }}>{s.warning}</td>
                      <td className="r mono" style={{ color: s.fail ? 'var(--fail-ink)' : 'var(--ink-3)' }}>{s.fail}</td>
                      <td className="r mono" style={{ fontWeight: 700, color: s.fail ? 'var(--fail-ink)' : undefined }}>
                        {s.n ? `${((s.fail / s.n) * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="r" style={{ whiteSpace: 'nowrap' }}>
                        {!isCurrent && <button className="btn btn-quiet btn-sm" onClick={() => onSelectLot(lot.lotId)}>設為目前批</button>}
                        <button className="btn btn-quiet btn-sm" disabled={lot.dies.length === 0} onClick={() => exportDiesCSV(lot.dies, `lot-${lot.lotId}-${today()}.csv`)}>CSV</button>
                        <button className="btn btn-quiet btn-sm" onClick={() => { if (window.confirm(`刪除批 ${lot.lotId}？`)) onDeleteLot(lot.lotId); }}>刪除</button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={8} style={{ padding: 0, background: 'var(--ground)' }}>
                          {lot.dies.length === 0
                            ? <p className="small dim" style={{ padding: '12px 16px' }}>此批尚無判定。</p>
                            : <div style={{ padding: '4px 0 8px 24px' }}><DieRows dies={lot.dies} /></div>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

import React, { useCallback, useState } from 'react';
import { useBatchInspection } from '../hooks/useBatchInspection';
import type { InspectionResult } from '../types';
import { Icon, VERDICT_STYLE } from '../../../components/ui/icons';
import { VerdictChip } from '../../../components/ui/marks';
import { OFFLINE_EXPLAINER, type ApiStatus } from '../../../hooks/useApiStatus';
import { LotPicker, type LotRecord } from '../../lots';
import { AGREEMENT_LABEL, AgreementChip, SAMPLES, SAMPLE_BY_ID, SampleGrid, compareToReference, fetchSampleFile } from '../../samples';
import { ImageUploader } from './ImageUploader';

interface Props {
  apiStatus: ApiStatus;
  lots: LotRecord[];
  currentLot: LotRecord;
  selectLot: (lotId: string) => void;
  onDieJudged: (result: InspectionResult, thumbnail: string, fileName: string) => void;
}

const PROGRESS_LABEL: Record<string, string> = {
  pending: '等待中',
  analyzing: '判定中',
  done: '已判定',
  error: '失敗',
};

const sampleIdOf = (fileName: string) => /^(S\d{2})\.jpg$/.exec(fileName)?.[1] ?? null;

/** 所選樣本的標準答案與實驗紀錄：不需要 AI 服務也能看出這批會怎麼被判。 */
const PickedPreview: React.FC<{ ids: string[] }> = ({ ids }) => {
  const rows = ids.map(id => SAMPLE_BY_ID[id]);
  const replies = rows.flatMap(s => s.recorded);
  const match = replies.filter(r => r.agreement === 'match').length;
  const miss = replies.filter(r => r.agreement === 'miss').length;
  const refFail = rows.filter(s => s.referenceVerdict === 'fail').length;
  return (
    <section className="section" aria-labelledby="picked-title" style={{ marginTop: 32 }}>
      <div className="section-head">
        <h2 className="section-title" id="picked-title">所選 {rows.length} 張：標準答案與實驗紀錄</h2>
        <span className="section-note">
          標準答案批不良率 <b className="mono">{((refFail / rows.length) * 100).toFixed(1)}%</b>・
          實驗中 3 位 AI 評估者共 {replies.length} 筆：一致 <b className="mono">{match}</b>、漏判 <b className="mono" style={{ color: miss ? 'var(--fail-ink)' : undefined }}>{miss}</b>
        </span>
      </div>
      <div className="tbl-frame">
        <table className="tbl tbl-stack">
          <thead>
            <tr>
              <th scope="col">樣本</th>
              <th scope="col">標準答案</th>
              {rows[0]?.recorded.map(r => <th key={r.appraiser} scope="col">{r.shift}（實驗紀錄）</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id}>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <img src={s.thumbUrl} alt="" style={{ width: 32, height: 32, display: 'block' }} />
                    <span className="mono" style={{ fontWeight: 700 }}>{s.id}</span>
                    <span className="small dim">{s.reference.defects.length ? s.reference.defects.map(j => j.defect.code).join('・') : '良品'}</span>
                  </span>
                </td>
                <td data-label="標準答案"><VerdictChip verdict={s.referenceVerdict} /></td>
                {s.recorded.map(r => (
                  <td key={r.appraiser} data-label={r.shift}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <VerdictChip verdict={r.result.verdict} />
                      {r.agreement !== 'match' && <span className="tiny" style={{ fontWeight: 700, color: r.agreement === 'differs' ? 'var(--warn-ink)' : 'var(--fail-ink)' }}>{AGREEMENT_LABEL[r.agreement]}</span>}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small dim" style={{ marginTop: 10 }}>實驗紀錄：一致性分析改善後（規範 v1）第 1 次的實際 AI 回覆，經同一套規則推導。即時判定的結果會記入目前批。</p>
    </section>
  );
};

/** 批檢驗：一次多張晶粒影像，逐顆判定並記到目前批。 */
export const LotInspectionPanel: React.FC<Props> = ({ apiStatus, lots, currentLot, selectLot, onDieJudged }) => {
  const { items, isRunning, progress, startBatch, retryItem, reset } = useBatchInspection(onDieJudged);
  const [mode, setMode] = useState<'sample' | 'upload'>('sample');
  const [picked, setPicked] = useState<string[]>(['S01', 'S08', 'S16', 'S25', 'S33']);
  const [loadError, setLoadError] = useState<string | null>(null);
  const offline = apiStatus === 'offline';

  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const runSamples = useCallback(async () => {
    setLoadError(null);
    try {
      const files = await Promise.all(picked.map(id => fetchSampleFile(SAMPLE_BY_ID[id])));
      await startBatch(files);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [picked, startBatch]);

  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const count = (v: InspectionResult['verdict']) => items.filter(i => i.result?.verdict === v).length;
  const judged = items.filter(i => i.result).length;
  const fail = count('fail');

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">批檢驗</h1>
          <p className="page-sub">一次判定多顆晶粒，逐顆記入目前批；批不良率＝判定 Fail 的晶粒數 ÷ n。</p>
        </div>
        <div className="page-tools">
          <LotPicker lots={lots} currentLot={currentLot} onSelect={selectLot} />
        </div>
      </header>

      {offline && (
        <div className="note note-sim" style={{ marginBottom: 18 }}>
          <Icon.Plug width={16} height={16} />
          <span>{OFFLINE_EXPLAINER}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="seg" role="group" aria-label="影像來源">
          <button aria-pressed={mode === 'sample'} onClick={() => setMode('sample')}>標準樣本</button>
          <button aria-pressed={mode === 'upload'} onClick={() => setMode('upload')}>上傳影像</button>
        </div>
        {mode === 'sample' && (
          <>
            <span className="small" style={{ color: 'var(--ink-2)' }}>
              已選 <b className="mono">{picked.length}</b> 張
            </span>
            <button className="btn btn-quiet btn-sm" onClick={() => setPicked(SAMPLES.map(s => s.id))} disabled={isRunning}>全選 40</button>
            <button className="btn btn-quiet btn-sm" onClick={() => setPicked([])} disabled={isRunning || picked.length === 0}>清除</button>
            <button
              className="btn btn-primary"
              style={{ marginLeft: 'auto' }}
              onClick={() => { void runSamples(); }}
              disabled={offline || isRunning || picked.length === 0 || apiStatus === 'checking'}
            >
              {isRunning ? <><span className="dots"><i /><i /><i /></span>逐顆判定中</> : <>判定所選 {picked.length} 張，記入 <span className="mono">{currentLot.lotId}</span></>}
            </button>
          </>
        )}
      </div>

      {mode === 'sample' ? (
        <>
          <SampleGrid label="選擇要判定的標準樣本" samples={SAMPLES} selected={picked} onToggle={toggle} disabled={isRunning} multi showReference />
          <p className="small dim" style={{ marginTop: 8 }}>
            格角記號＝標準答案（○ Pass △ Warning ✕ Fail）。即時判定每張約 5–10 秒，依序送出；一次 40 張約需數分鐘，API 費用約 US$0.3。
          </p>
          {items.length === 0 && picked.length > 0 && <PickedPreview ids={picked} />}
        </>
      ) : (
        <ImageUploader
          multiple
          disabled={offline || isRunning}
          onFiles={files => { void startBatch(files); }}
          title={isRunning ? '逐顆判定中…' : <>拖曳多張晶粒影像，判定結果記入批 <span className="mono">{currentLot.lotId}</span></>}
          hint="每顆晶粒一筆判定・依檢驗規範 v1"
        />
      )}

      {loadError && (
        <div className="note note-fail" role="alert" style={{ marginTop: 14 }}>
          <Icon.Alert width={16} height={16} /><span>{loadError}</span>
        </div>
      )}

      {items.length > 0 && (
        <section className="section" aria-labelledby="this-run">
          <div className="section-head">
            <h2 className="section-title" id="this-run">本次判定</h2>
            {!isRunning && <button onClick={reset} className="btn btn-quiet btn-sm">清除清單</button>}
          </div>

          <dl className="readout" style={{ marginBottom: 8 }}>
            <div><dt>已處理</dt><dd className="mono">{progress.done}／{progress.total}</dd></div>
            {(['pass', 'warning', 'fail'] as const).map(v => (
              <div key={v}><dt>{VERDICT_STYLE[v].name}・{VERDICT_STYLE[v].action}</dt><dd className="mono" style={{ color: count(v) ? VERDICT_STYLE[v].ink : undefined }}>{count(v)}</dd></div>
            ))}
            <div><dt>不良率（本次）</dt><dd className="mono">{judged ? `${((fail / judged) * 100).toFixed(1)}%` : '—'}</dd></div>
          </dl>
          <div className="meter" aria-hidden="true"><span style={{ transform: `scaleX(${percent / 100})` }} /></div>

          <div className="tbl-frame" style={{ marginTop: 16, overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col" style={{ width: 52 }}>影像</th>
                  <th scope="col">檔名</th>
                  <th scope="col">狀態</th>
                  <th scope="col">AI 回報</th>
                  <th scope="col">判定</th>
                  <th scope="col">對照標準答案</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const res = item.result;
                  const sid = sampleIdOf(item.fileName);
                  const ref = sid ? SAMPLE_BY_ID[sid] : null;
                  return (
                    <tr key={item.id}>
                      <td>
                        {item.thumbnail
                          ? <img src={item.thumbnail} alt="" style={{ width: 36, height: 36, objectFit: 'cover', display: 'block' }} />
                          : <span style={{ display: 'block', width: 36, height: 36, background: 'var(--ground-2)' }} />}
                      </td>
                      <td className="mono small" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.fileName}</td>
                      <td className="small" style={{ whiteSpace: 'nowrap' }}>
                        {item.progress === 'analyzing' ? <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><span className="dots"><i /><i /><i /></span>判定中</span> : PROGRESS_LABEL[item.progress]}
                      </td>
                      <td className="small">
                        {res ? (res.defects.length ? res.defects.map(j => j.defect.code).join('・') : '無缺陷') : item.error
                          ? <span style={{ color: 'var(--fail-ink)' }}>{item.error}</span>
                          : <span className="dim">—</span>}
                      </td>
                      <td>{res ? <VerdictChip verdict={res.verdict} withAction /> : null}</td>
                      <td>
                        {res && ref ? <AgreementChip agreement={compareToReference(ref.referenceVerdict, res.verdict)} />
                          : item.progress === 'error' && !isRunning
                            ? <button onClick={() => { void retryItem(item.id); }} className="btn btn-sm">重試</button>
                            : <span className="dim small">{res ? '—（非標準樣本）' : ''}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="small dim" style={{ marginTop: 10 }}>整批的 n 與批不良率見「批紀錄」；實測批會接在模擬批後面畫到「管制看板」。</p>
        </section>
      )}
    </div>
  );
};

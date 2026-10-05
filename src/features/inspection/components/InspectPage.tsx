import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Icon } from '../../../components/ui/icons';
import { VerdictChip } from '../../../components/ui/marks';
import { OFFLINE_EXPLAINER, type ApiStatus } from '../../../hooks/useApiStatus';
import { LotPicker } from '../../lots';
import type { LotRecord } from '../../lots';
import {
  AgreementChip,
  RecordedReplies,
  SAMPLES,
  SAMPLE_BY_ID,
  SampleGrid,
  compareToReference,
  fetchSampleFile,
} from '../../samples';
import { createThumbnail } from '../utils/thumbnail';
import type { InspectionResult } from '../types';
import { worstVerdict, type InspectionZone, type Verdict } from '../spec/inspectionSpecV1';
import type { useInspection } from '../hooks/useInspection';
import { DiePlate } from './DiePlate';
import { ImageUploader } from './ImageUploader';
import { DerivationRows, InspectionResultPanel } from './InspectionResult';
import { LeaderLayer, type LeaderPair } from './LeaderLayer';

export type InspectMode = 'sample' | 'upload';

interface Props {
  apiStatus: ApiStatus;
  inspection: ReturnType<typeof useInspection>;
  /** 目前這筆處理中／已完成的判定屬於哪張影像（樣本代碼或 'upload'） */
  owner: string | null;
  setOwner: (owner: string | null) => void;
  mode: InspectMode;
  setMode: (mode: InspectMode) => void;
  sampleId: string;
  setSampleId: (id: string) => void;
  liveResults: Record<string, InspectionResult>;
  onLiveResult: (sampleId: string, result: InspectionResult) => void;
  lots: LotRecord[];
  currentLot: LotRecord;
  selectLot: (lotId: string) => void;
  addDie: (result: InspectionResult, thumbnail: string, fileName: string) => void;
}

export const InspectPage: React.FC<Props> = ({
  apiStatus, inspection, owner, setOwner, mode, setMode, sampleId, setSampleId,
  liveResults, onLiveResult, lots, currentLot, selectLot, addDie,
}) => {
  const workRef = useRef<HTMLDivElement>(null);
  const sample = SAMPLE_BY_ID[sampleId] ?? SAMPLES[0];
  const { progress, result, error, imagePreview, analyze, reanalyze, canReanalyze, reset } = inspection;
  const offline = apiStatus === 'offline';

  const busyHere = progress === 'analyzing' && owner === (mode === 'sample' ? sample.id : 'upload');
  const errorHere = progress === 'error' && owner === (mode === 'sample' ? sample.id : 'upload') ? error : null;
  const live: InspectionResult | null = mode === 'sample'
    ? (owner === sample.id && result) || liveResults[sample.id] || null
    : owner === 'upload' ? result : null;

  /* ── 判定：標準樣本或上傳影像走同一條流程；結果記入目前批 ── */
  const runOn = useCallback(async (file: File, who: string) => {
    setOwner(who);
    const [thumbnail, judged] = await Promise.all([createThumbnail(file), analyze(file)]);
    if (judged) {
      addDie(judged, thumbnail, file.name);
      if (who !== 'upload') onLiveResult(who, judged);
    }
  }, [addDie, analyze, onLiveResult, setOwner]);

  const judgeSample = useCallback(async () => {
    try {
      await runOn(await fetchSampleFile(sample), sample.id);
    } catch (e) {
      console.error(e);
    }
  }, [runOn, sample]);

  const rejudge = useCallback(async () => {
    const r = await reanalyze();
    if (r && owner && owner !== 'upload') onLiveResult(owner, r);
  }, [onLiveResult, owner, reanalyze]);

  /* ── ←／→ 切換樣本 ── */
  useEffect(() => {
    if (mode !== 'sample') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const i = SAMPLES.findIndex(s => s.id === sample.id);
      const next = SAMPLES[(i + (e.key === 'ArrowRight' ? 1 : SAMPLES.length - 1)) % SAMPLES.length];
      setSampleId(next.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, sample.id, setSampleId]);

  const judgedMarks = useMemo(() => Object.fromEntries(
    Object.entries(liveResults).map(([id, r]) => [id, { verdict: r.verdict, agreement: compareToReference(SAMPLE_BY_ID[id].referenceVerdict, r.verdict) }]),
  ), [liveResults]);

  const markers = mode === 'sample'
    ? sample.refDefects.flatMap((d, i) => (d.location ? [{ n: i + 1, x: d.location.x, y: d.location.y, code: d.code, verdict: sample.reference.defects[i]?.verdict }] : []))
    : [];

  const pairs: LeaderPair[] = useMemo(() => {
    const out: LeaderPair[] = [];
    live?.defects.forEach((j, i) => out.push({ from: `live-row-${i}`, to: `insp-zone-${j.defect.zone}`, verdict: j.verdict }));
    if (mode === 'sample') {
      sample.reference.defects.forEach((j, i) => {
        if (sample.refDefects[i]?.location) out.push({ from: `ref-row-${i}`, to: `insp-ref-${i + 1}`, verdict: j.verdict });
      });
    }
    return out;
  }, [live, mode, sample]);

  // 區域標籤顏色：有即時判定時依 AI 回報推導；否則與總覽相同，依標準答案推導
  const zoneVerdicts: Partial<Record<InspectionZone, Verdict>> = {};
  const zoneSource = live?.defects ?? (mode === 'sample' ? sample.reference.defects : []);
  zoneSource.forEach(j => { zoneVerdicts[j.defect.zone] = worstVerdict([zoneVerdicts[j.defect.zone] ?? 'pass', j.verdict]); });
  const plateSrc = mode === 'sample' ? sample.imageUrl : imagePreview;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">單張判定</h1>
          <p className="page-sub">AI 只回報缺陷清單（分類、區域、量測值），判定由檢驗規範 v1 推導；每筆即時判定記入目前批。</p>
        </div>
        <div className="page-tools">
          <LotPicker lots={lots} currentLot={currentLot} onSelect={selectLot} />
        </div>
      </header>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="seg" role="group" aria-label="影像來源">
          <button aria-pressed={mode === 'sample'} onClick={() => setMode('sample')}>標準樣本 S01–S40</button>
          <button aria-pressed={mode === 'upload'} onClick={() => setMode('upload')}>上傳影像</button>
        </div>
        {mode === 'sample' && (
          <span className="small dim">半合成影像，各有已知的標準答案。點選切換，或用 ← → 鍵。格角記號＝本次 AI 判定，紅框＝與標準答案不同。</span>
        )}
      </div>

      {mode === 'sample' && (
        <SampleGrid
          label="標準樣本集"
          samples={SAMPLES}
          selected={[sample.id]}
          onToggle={setSampleId}
          judged={judgedMarks}
        />
      )}

      <div className="work" ref={workRef} style={{ marginTop: 24 }}>
        <LeaderLayer containerRef={workRef} pairs={pairs} />

        {/* ── 圖版 ── */}
        <div className="work-plate">
          {plateSrc ? (
            <figure className="figure">
              <DiePlate
                src={plateSrc}
                alt={mode === 'sample' ? `標準樣本 ${sample.id} 的晶粒影像` : '上傳的晶粒影像'}
                markers={markers}
                zoneVerdicts={zoneVerdicts}
                inset={markers[0] ? { x: markers[0].x, y: markers[0].y } : null}
                busy={busyHere}
                anchorPrefix="insp"
              />
              <figcaption className="figcaption">
                {mode === 'sample' ? (
                  <><b>{sample.id}</b>半合成樣本，5 mm × 5 mm，5 µm/px。虛線菱形＝標準答案的缺陷位置；放大插圖每格為一個影像像素。</>
                ) : (
                  <><b>上傳影像</b>比例尺依規範 v1 假設「晶粒填滿影像、影像寬＝5 mm」。區域標籤亮起＝AI 在該區回報了缺陷（AI 只回報區域，不回報位置）。</>
                )}
              </figcaption>
              {mode === 'upload' && progress !== 'analyzing' && (
                <button className="btn btn-quiet btn-sm" style={{ marginTop: 8 }} onClick={() => { reset(); setOwner(null); }}>
                  <Icon.Close width={14} height={14} />換一張
                </button>
              )}
            </figure>
          ) : (
            <ImageUploader
              onFiles={files => { void runOn(files[0], 'upload'); }}
              disabled={offline}
              title={offline ? '此部署無法上傳判定' : '上傳一張晶粒影像'}
              hint={offline ? 'AI 服務未連線' : <>點擊或拖曳圖片・JPG／PNG／WEBP・結果記入批 <span className="mono">{currentLot.lotId}</span></>}
            />
          )}
        </div>

        {/* ── 明細 ── */}
        <div className="work-detail">
          <section aria-labelledby="live-title">
            <div className="section-head" style={{ marginBottom: 10 }}>
              <h2 className="section-title" id="live-title">AI 即時判定</h2>
              {live && mode === 'sample' && (
                <AgreementChip agreement={compareToReference(sample.referenceVerdict, live.verdict)} />
              )}
            </div>

            {offline && (
              <div className="note note-sim" style={{ marginBottom: 14 }}>
                <Icon.Plug width={16} height={16} />
                <span>{OFFLINE_EXPLAINER}</span>
              </div>
            )}

            {errorHere && (
              <div className="note note-fail" role="alert" style={{ marginBottom: 14 }}>
                <Icon.Alert width={16} height={16} />
                <span><b>未完成判定：</b>{errorHere} 系統不會在失敗時給出判定，也不會記入批。</span>
              </div>
            )}

            {live ? (
              <InspectionResultPanel result={live} anchorPrefix="live" sourceLabel="AI 回報（即時）" />
            ) : mode === 'sample' && !offline ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => { void judgeSample(); }} disabled={progress === 'analyzing' || apiStatus === 'checking'}>
                  {busyHere ? <><span className="dots"><i /><i /><i /></span>判定中</> : <>以 AI 判定 {sample.id}<Icon.Arrow width={16} height={16} /></>}
                </button>
                <span className="small dim">結果記入批 <span className="mono">{currentLot.lotId}</span>，並對照標準答案。</span>
              </div>
            ) : mode === 'upload' && !offline && !busyHere ? (
              <p className="small dim">上傳影像後，AI 回報的缺陷會逐筆列在這裡，連到圖版上的區域。</p>
            ) : null}

            {canReanalyze && live && progress !== 'analyzing' && owner === (mode === 'sample' ? sample.id : 'upload') && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 }}>
                <span className="small dim">重複性確認用，不計入批</span>
                <button className="btn btn-sm" onClick={() => { void rejudge(); }}>
                  <Icon.Refresh width={14} height={14} />再判定一次
                </button>
              </div>
            )}
          </section>

          {mode === 'sample' && (
            <>
              <section aria-labelledby="ref-title" style={{ marginTop: 36 }}>
                <div className="section-head" style={{ marginBottom: 10 }}>
                  <h2 className="section-title" id="ref-title">標準答案 → 規則推導</h2>
                  <VerdictChip verdict={sample.reference.verdict} withAction />
                </div>
                {sample.reference.defects.length > 0 ? (
                  <DerivationRows defects={sample.reference.defects} anchorPrefix="ref" />
                ) : (
                  <p className="small" style={{ color: 'var(--ink-2)' }}>良品：標準答案沒有缺陷 → Pass（§4 合併規則）。</p>
                )}
              </section>

              <section aria-labelledby="rec-title" style={{ marginTop: 36 }}>
                <div className="section-head" style={{ marginBottom: 10 }}>
                  <h2 className="section-title" id="rec-title">實驗紀錄：三位 AI 評估者的實際回覆</h2>
                  <span className="section-note">一致性分析・改善後（規範 v1）第 1 次・{sample.recorded[0]?.model}</span>
                </div>
                <RecordedReplies recorded={sample.recorded} />
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useMemo, useRef } from 'react';
import { Icon, VERDICT_STYLE } from '../../components/ui/icons';
import { VerdictChip, VerdictMark } from '../../components/ui/marks';
import { DiePlate } from '../inspection/components/DiePlate';
import { LeaderLayer } from '../inspection/components/LeaderLayer';
import { ScaleBar } from '../inspection/components/ScaleBar';
import { DEFECT_CLASS_LABEL, VERDICT_LABEL, ZONE_LABEL, acceptanceScale, formatMeasurement } from '../inspection/spec/inspectionSpecV1';
import { AgreementChip, MSA_SUMMARY, SAMPLE_BY_ID } from '../samples';
import { PChart } from '../control/components/PChart';
import { ALLOWANCE, RECHECK_SECONDS, SHIFT_MINUTES, laborReduction, laborScenario } from './laborModel';

/** ECRS 對照：新的檢驗流程相對於人工目檢做了哪些改變。 */
const ECRS = [
  { key: 'E', name: '刪除', how: '規則推導為 Pass 的晶粒直接放行，不再送人工複判；只有 Warning 送人。' },
  { key: 'C', name: '合併', how: '判定與記錄合一：判定結果直接進入批紀錄，可匯出 CSV，不需另行登錄。' },
  { key: 'R', name: '重排', how: '批不良率在判定當下就更新到 p 管制圖，預警從事後彙總提前到即時。' },
  { key: 'S', name: '簡化', how: '口述標準收斂成一份有版本號的條文；異常處置單由 AI 先草擬，人負責審閱與確認。' },
];
import type { ControlView } from '../control';
import type { Page } from '../../components/Layout/AppShell';

interface Props {
  controlView: ControlView;
  onNavigate: (page: Page) => void;
  onTrySample: (sampleId: string) => void;
}

const REPO = 'https://github.com/hoganalin/ai-inspection-demo/blob/main/';
const SHOWCASE = 'S25';

const pct = (v: number | null, d = 1) => (v === null ? '未量測' : `${(v * 100).toFixed(d)}%`);

type Trend = 'worse' | 'better' | 'flat' | 'unmeasured';
const TREND: Record<Trend, { label: string; color: string }> = {
  worse: { label: '變差', color: 'var(--fail-ink)' },
  better: { label: '改善', color: 'var(--pass-ink)' },
  flat: { label: '持平', color: 'var(--ink-3)' },
  unmeasured: { label: '未量測', color: 'var(--ink-3)' },
};

const DocLink: React.FC<{ path: string; children: React.ReactNode }> = ({ path, children }) => (
  <a href={REPO + path} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    {children}<Icon.External width={13} height={13} />
  </a>
);

export const OverviewPage: React.FC<Props> = ({ controlView, onNavigate, onTrySample }) => {
  const plateRef = useRef<HTMLDivElement>(null);
  const sample = SAMPLE_BY_ID[SHOWCASE];
  const refDefect = sample.refDefects[0];
  const judged = sample.reference.defects[0];
  const scale = acceptanceScale(judged.defect);
  const verdict = sample.reference.verdict;
  const b = MSA_SUMMARY.before;
  const a = MSA_SUMMARY.after;
  const rec = MSA_SUMMARY.recognition;
  const labor = RECHECK_SECONDS.map(s => laborScenario(s, b.warningRate, a.warningRate));
  const reduction = laborReduction(b.warningRate, a.warningRate);

  const pairs = useMemo(() => [{ from: 'ov-row-0', to: 'ov-ref-1', verdict: judged.verdict }], [judged.verdict]);

  const msaRows: { label: string; hint: string; before: string; after: string; trend: Trend }[] = [
    { label: '漏判率', hint: '標準答案 Fail → 判 Pass', before: pct(b.missRate), after: pct(a.missRate), trend: 'worse' },
    { label: '人工複判率', hint: `判 Warning 的比例；標準答案為 ${pct(a.referenceWarningRate)}`, before: pct(b.warningRate), after: pct(a.warningRate), trend: 'better' },
    { label: '誤判率', hint: '標準答案 Pass → 判 Fail', before: pct(b.falseCallRate), after: pct(a.falseCallRate), trend: 'worse' },
    { label: '評估者間一致率', hint: '三位評估者判定相同的樣本比例', before: pct(b.betweenAppraisersPerTrial), after: pct(a.betweenAppraisersPerTrial), trend: 'flat' },
    { label: '對標準答案一致率', hint: '逐筆', before: pct(b.accuracy), after: pct(a.accuracy), trend: 'flat' },
    { label: 'Fleiss’ kappa', hint: '三人', before: b.fleissKappa.toFixed(2), after: a.fleissKappa.toFixed(2), trend: 'flat' },
    { label: '重複性', hint: '同一評估者兩次一致', before: pct(b.repeatability), after: pct(a.repeatability), trend: 'unmeasured' },
  ];

  const recognition = (['CHP', 'CRK', 'SCR', 'CON'] as const).map(code => ({ code, ...rec[code] }));

  const firstSignal = controlView.signals.find(s => s.source === 'simulated');

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">晶粒外觀檢查改善專案</h1>
          <p className="page-sub">
            把人工目檢的「判定標準不一」收斂成可追溯的流程：AI 只回報缺陷，判定由有版本號的檢驗規範推導；
            批不良率以 p 管制圖預警，異常處置單由 AI 草擬、經人確認。
          </p>
        </div>
        <div className="page-tools">
          <span className="chip chip-line">檢驗規範 v1</span>
          <span className="chip chip-line">導入階段 ② PoC 驗證</span>
        </div>
      </header>

      {/* ── 第一屏：一顆晶粒怎麼被判定＋量到了什麼 ── */}
      <div className="work" ref={plateRef}>
        <LeaderLayer containerRef={plateRef} pairs={pairs} />
        <figure className="figure work-plate">
          <DiePlate
            src={sample.imageUrl}
            alt="標準樣本 S25：核心區有一道刮傷的晶粒影像"
            markers={refDefect.location ? [{ n: 1, x: refDefect.location.x, y: refDefect.location.y, code: refDefect.code, verdict: judged.verdict }] : []}
            zoneVerdicts={{ [refDefect.zone]: judged.verdict }}
            inset={refDefect.location ?? null}
            anchorPrefix="ov"
          />
          <figcaption className="figcaption">
            <b>圖 1</b>標準樣本 S25（半合成），5 mm × 5 mm，5 µm/px。虛線為 seal ring 與核心區界線；放大插圖每格是一個影像像素。
          </figcaption>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <button className="btn btn-primary" onClick={() => onTrySample(SHOWCASE)}>
              用標準樣本試判定<Icon.Arrow width={16} height={16} />
            </button>
            <button className="btn" onClick={() => onNavigate('control')}>看管制看板</button>
          </div>
        </figure>

        <div className="work-detail">
          <h2 className="section-title" style={{ marginBottom: 4 }}>一顆晶粒怎麼被判定</h2>
          <p className="small" style={{ color: 'var(--ink-2)', marginBottom: 10 }}>
            AI 只回報缺陷清單；判定由規則推導，附條文與規範版本。以 S25 的標準答案為例：
          </p>

          <ol className="chain">
            <li data-anchor="ov-row-0">
              <span className="chain-step">① 缺陷清單</span>
              <span>
                <span className="mono" style={{ fontWeight: 700 }}>{judged.defect.code}</span> {DEFECT_CLASS_LABEL[judged.defect.code].cn}
                ・{ZONE_LABEL[judged.defect.zone]}・<span className="mono" style={{ whiteSpace: 'nowrap' }}>{formatMeasurement(judged.defect)}</span>
                <span className="tiny dim" style={{ display: 'block' }}>實際由 AI 回報：只有分類、區域、量測值，沒有判定與信心度。</span>
              </span>
            </li>
            <li>
              <span className="chain-step">② 允收標準</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span><span className="dim" style={{ marginRight: '0.6em' }}>規範 v1 §3</span>{judged.rule}</span>
                {scale && <ScaleBar scale={scale} verdict={judged.verdict} />}
              </span>
            </li>
            <li style={{ alignItems: 'center' }}>
              <span className="chain-step">③ 判定</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <VerdictMark verdict={verdict} size={26} strokeWidth={2.4} />
                <span className="verdict-word" style={{ fontSize: '2.1333rem', color: VERDICT_STYLE[verdict].ink }}>{VERDICT_LABEL[verdict].name}</span>
                <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>→ {VERDICT_LABEL[verdict].action}</span>
              </span>
            </li>
          </ol>

          <div className="headline">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <h3 className="block-title" style={{ margin: 0 }}>量到了什麼：改善前 → 改善後</h3>
              <a href="#msa-title" className="small" onClick={e => { e.preventDefault(); document.getElementById('msa-title')?.scrollIntoView({ behavior: 'smooth' }); }}>完整一致性分析</a>
            </div>
            <dl className="headline-rows">
              <div>
                <dt>漏判率<span className="tiny dim">標準答案 Fail → 判 Pass</span></dt>
                <dd><span className="mono dim">{pct(b.missRate)} →</span> <b className="headline-num" style={{ color: 'var(--fail-ink)' }}>{pct(a.missRate)}</b> <span className="trend" style={{ color: TREND.worse.color }}>變差</span></dd>
              </div>
              <div>
                <dt>人工複判率<span className="tiny dim">標準答案為 {pct(a.referenceWarningRate)}</span></dt>
                <dd><span className="mono dim">{pct(b.warningRate)} →</span> <b className="headline-num">{pct(a.warningRate)}</b> <span className="trend" style={{ color: TREND.better.color }}>改善</span></dd>
              </div>
              <div>
                <dt>誤判率<span className="tiny dim">標準答案 Pass → 判 Fail</span></dt>
                <dd><span className="mono dim">{pct(b.falseCallRate)} →</span> <b className="headline-num">{pct(a.falseCallRate)}</b> <span className="trend" style={{ color: TREND.worse.color }}>變差</span></dd>
              </div>
            </dl>
            <p className="small" style={{ marginTop: 8 }}>
              <b>不建議進入 ③ 單線試行。</b><span style={{ color: 'var(--ink-2)' }}>AI 看不到大部分崩角、認不出裂紋；規範 v2 先處理影像條件。</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Check：一致性分析 ── */}
      <section className="section" aria-labelledby="msa-title" style={{ marginTop: 64 }}>
        <div className="section-head">
          <h2 className="section-title" id="msa-title">量到了什麼：一致性分析，改善前 vs 改善後</h2>
          <span className="section-note">40 張半合成樣本 × 3 位模擬 AI 評估者，每條件 {a.judgments} 筆判定</span>
        </div>
        <p style={{ maxWidth: '72ch', marginBottom: 18 }}>
          <b>結論先講：改善後沒有明顯優於改善前，漏判率反而變差。</b>
          規範 v1 讓人工複判率回到合理水準，但 AI 在全幅影像上看不到大部分崩角、認不出裂紋，
          看不到的缺陷就直接 Pass 放行。依目前的規範與影像條件，<b>不建議進入 ③ 單線試行</b>。
        </p>

        <div className="overview-msa">
          <div className="tbl-frame" style={{ overflowX: 'auto' }}>
            <table className="tbl tbl-stack">
              <thead>
                <tr>
                  <th scope="col">指標</th>
                  <th scope="col" className="r">改善前<span className="dim">（口述標準）</span></th>
                  <th scope="col" className="r">改善後<span className="dim">（規範 v1）</span></th>
                  <th scope="col">變化</th>
                </tr>
              </thead>
              <tbody>
                {msaRows.map(r => (
                  <tr key={r.label}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.label}</div>
                      <div className="tiny dim">{r.hint}</div>
                    </td>
                    <td className="r mono" data-label="改善前">{r.before}</td>
                    <td className="r mono" data-label="改善後" style={{ fontWeight: 700, color: r.trend === 'worse' ? 'var(--fail-ink)' : undefined }}>{r.after}</td>
                    <td className="small" data-label="變化" style={{ fontWeight: 600, color: TREND[r.trend].color }}>{TREND[r.trend].label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="block-title">漏判的主因是「看不到」</h3>
            <p className="small" style={{ color: 'var(--ink-2)', marginBottom: 12 }}>
              改善後 AI 對各缺陷分類的偵出率（偵出數／標準答案件數）。40 µm 的崩角在 1000 px 全幅影像上只有 8 px 深。
            </p>
            <div style={{ borderTop: '1px solid var(--rule-strong)' }}>
              {recognition.map(r => (
                <div key={r.code} style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr) 92px', gap: 12, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--rule)' }}>
                  <span><span className="mono" style={{ fontWeight: 700 }}>{r.code}</span> <span className="small">{DEFECT_CLASS_LABEL[r.code].cn}</span></span>
                  <span style={{ height: 10, background: 'var(--ground-2)', position: 'relative' }}>
                    <span style={{ position: 'absolute', inset: 0, width: `${(r.recall ?? 0) * 100}%`, background: (r.recall ?? 0) < 0.5 ? 'var(--fail)' : 'var(--si-800)' }} />
                  </span>
                  <span className="mono small r" style={{ textAlign: 'right' }}>
                    <b>{pct(r.recall, 0)}</b> <span className="dim">{r.tp}/{r.refInstances}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="tiny dim" style={{ marginTop: 10 }}>
              樣本少（每類 Fail 只有 2–3 張），比率的信賴區間很寬；評估者是同一模型配不同角色設定，不是真人。
              <DocLink path="experiment/results/msa-summary.md">完整摘要與限制</DocLink>
            </p>

            <h3 className="block-title" style={{ marginTop: 22 }}>以 S25 為例：三位 AI 評估者的實際回報</h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid var(--rule-strong)' }}>
              {sample.recorded.map(r => (
                <li key={r.appraiser} className="small" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid var(--rule)' }}>
                  <span style={{ width: 52 }}>{r.shift}</span>
                  <span className="mono ai-ink" style={{ minWidth: 130 }}>
                    {r.result.defects.length ? r.result.defects.map(j => `${j.defect.code} ${formatMeasurement(j.defect)}`).join('；') : '未回報缺陷'}
                  </span>
                  <VerdictChip verdict={r.result.verdict} />
                  <AgreementChip agreement={r.agreement} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 工時與產能：人工複判率換算 ── */}
      <section className="section" aria-labelledby="labor-title" style={{ marginTop: 56 }}>
        <div className="section-head">
          <h2 className="section-title" id="labor-title">工時與產能：複判工時可省 {pct(reduction, 0)}，前提是漏判先降下來</h2>
          <span className="section-note">單顆複判時間與寬放率為假設值，以三種情境做敏感度分析</span>
        </div>
        <p style={{ maxWidth: '76ch', marginBottom: 14 }}>
          人工複判率從 {pct(b.warningRate)} 降到 {pct(a.warningRate)}，每批 50 顆要送人工複判的晶粒從約 {Math.round(50 * b.warningRate)} 顆降到約 {Math.round(50 * a.warningRate)} 顆。
          換算方式：標準工時＝單顆複判時間 ×（1＋寬放率 {pct(ALLOWANCE, 0)}）；每千顆複判工時＝1,000 × 人工複判率 × 標準工時；每班以 {SHIFT_MINUTES / 60} 小時計。
        </p>

        <div className="overview-msa">
          <div className="tbl-frame" style={{ overflowX: 'auto' }}>
            <table className="tbl tbl-stack">
              <thead>
                <tr>
                  <th scope="col">單顆複判時間（假設）</th>
                  <th scope="col" className="r">每千顆複判工時</th>
                  <th scope="col" className="r">一位複判人員每班可支援</th>
                </tr>
              </thead>
              <tbody>
                {labor.map(s => (
                  <tr key={s.seconds}>
                    <td>
                      <div style={{ fontWeight: 600 }}><span className="mono">{s.seconds}</span> 秒／顆</div>
                      <div className="tiny dim">標準工時 <span className="mono">{s.standardSeconds.toFixed(1)}</span> 秒</div>
                    </td>
                    <td className="r mono" data-label="每千顆複判工時">
                      <span><span className="dim">{s.per1000Minutes.before.toFixed(0)} →</span>{' '}
                      <b>{s.per1000Minutes.after.toFixed(0)}</b> 分鐘</span>
                    </td>
                    <td className="r mono" data-label="一位複判人員每班可支援">
                      <span><span className="dim">{Math.round(s.diesPerShift.before).toLocaleString()} →</span>{' '}
                      <b>{Math.round(s.diesPerShift.after).toLocaleString()}</b> 顆</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div className="note note-warn" style={{ marginBottom: 16 }}>
              <Icon.Alert width={16} height={16} />
              <span>
                <b>這個數字還不能當效益。</b>改善前的人工複判率高，是因為應退件的晶粒多被送去複判；
                改善後複判變少，有一部分是這些晶粒被直接放行（漏判率 {pct(b.missRate)} → {pct(a.missRate)}）。
                漏判率降到 5% 以下之前，省下的工時有一部分是用漏判換來的。
              </span>
            </div>
            <h3 className="block-title">ECRS：新的檢驗流程改了什麼</h3>
            <div style={{ borderTop: '1px solid var(--rule-strong)' }}>
              {ECRS.map(r => (
                <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--rule)' }}>
                  <span style={{ fontWeight: 700 }}><span className="mono">{r.key}</span> {r.name}</span>
                  <span className="small" style={{ color: 'var(--ink-2)' }}>{r.how}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Check：管制圖 ── */}
      <section className="section" aria-labelledby="spc-title" style={{ marginTop: 56 }}>
        <div className="section-head">
          <h2 className="section-title" id="spc-title">管制圖：漏判讓預警晚了 5 批</h2>
          <button className="btn btn-sm" onClick={() => onNavigate('control')}>開啟管制看板<Icon.Arrow width={14} height={14} /></button>
        </div>
        <div className="overview-spc">
          <figure className="figure">
            <div style={{ background: 'var(--surface)', border: '1px solid var(--rule)', padding: '8px 4px 2px' }}>
              <PChart chart={controlView.chart} lots={controlView.lots} selectedLotId={firstSignal?.lotId ?? null} onSelectLot={() => onNavigate('control')} compact />
            </div>
            <figcaption className="figcaption"><b>圖 2</b>25 個統計模擬批的批不良率 p 管制圖（模擬）。點任一訊號批進入管制看板。</figcaption>
          </figure>
          <div>
            <p style={{ marginBottom: 12 }}>
              25 批 × 50 顆依改善後實測的判定誤差抽樣，自第 15 批起注入切割刀磨耗的 CHP 漂移。
            </p>
            <dl className="small" style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '8px 16px' }}>
              <dt className="dim">完美判定</dt><dd style={{ margin: 0 }}>L19 首次異常</dd>
              <dt className="dim">AI＋規則＋人工複判</dt><dd style={{ margin: 0 }}><b>L24</b> 首次預警與異常——晚 5 批</dd>
              <dt className="dim">AI＋規則，無人工複判</dt><dd style={{ margin: 0 }}>漂移完全被 CHP 漏判藏住，沒有訊號</dd>
            </dl>
            <p className="small dim" style={{ marginTop: 12 }}>固定亂數種子的結果照實報告：預警沒有比異常提早。</p>
          </div>
        </div>
      </section>

      {/* ── Act：導入階段 ── */}
      <section className="section" aria-labelledby="phase-title" style={{ marginTop: 56 }}>
        <div className="section-head">
          <h2 className="section-title" id="phase-title">導入階段與下一輪 PDCA</h2>
          <DocLink path="docs/rollout/導入計畫.xlsx">導入計畫（章程、時程、RACI、風險）</DocLink>
        </div>
        <ol className="phases">
          <li className="is-done">
            <span className="phase-head"><b>① 現況 MSA 與規範制定</b><span className="phase-state"><Icon.Check width={14} height={14} />完成</span></span>
            <span className="small">口述標準 → 檢驗規範 v1（4 類缺陷、2 區域、µm 允收標準）</span>
          </li>
          <li className="is-done">
            <span className="phase-head"><b>② PoC 驗證</b><span className="phase-state"><Icon.Check width={14} height={14} />完成</span></span>
            <span className="small">本系統＋一致性分析＋管制圖模擬</span>
          </li>
          <li className="is-hold">
            <span className="phase-head"><b>③ 單線試行</b><span className="phase-state"><Icon.Alert width={14} height={14} />未達門檻</span></span>
            <span className="small">門檻：漏判率 ≤ 5%（目前 {pct(a.missRate)}）、重複性 ≥ 90%（未量測）、人工複判率 ≤ 30%（目前 {pct(a.warningRate)}）</span>
          </li>
          <li>
            <span className="phase-head"><b>④ 擴線與 MES 介接</b><span className="phase-state">規劃</span></span>
            <span className="small">③ 通過後才進行</span>
          </li>
        </ol>

        <div className="overview-next">
          <h3 className="block-title">規範 v2 提案（Act）</h3>
          <ol className="small" style={{ margin: 0, paddingLeft: '1.4em', display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ink-2)' }}>
            <li><b style={{ color: 'var(--ink)' }}>分塊放大判讀：</b>周邊區每邊切 8 段、放大 4 倍再送判，讓 2–8 px 的崩角與裂紋變得看得到。</li>
            <li><b style={{ color: 'var(--ink)' }}>尺寸不讓 AI 估：</b>AI 只回報缺陷代碼與外框座標，尺寸由程式依 5 µm/px 換算。</li>
            <li><b style={{ color: 'var(--ink)' }}>安全偏向的路由：</b>周邊區任何異常至少 Warning；核心區線狀缺陷不分 SCR／CRK 至少 Warning。</li>
            <li><b style={{ color: 'var(--ink)' }}>重跑一致性分析：</b>補量重複性，並完成作者本人兩輪判定作為「人 vs AI」對照。</li>
          </ol>
        </div>
      </section>

      {/* ── PDCA 索引 ── */}
      <section className="section" aria-labelledby="pdca-title" style={{ marginTop: 56 }}>
        <div className="section-head">
          <h2 className="section-title" id="pdca-title">PDCA 對照：每一步在哪裡</h2>
        </div>
        <div className="tbl-frame" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr><th scope="col">階段</th><th scope="col">做了什麼</th><th scope="col">在哪裡</th></tr>
            </thead>
            <tbody>
              <tr><td className="mono" style={{ fontWeight: 700 }}>P</td><td>痛點「判定標準不一」→ 有版本號的檢驗規範 v1</td><td><DocLink path="docs/spec/inspection-spec-v1.md">檢驗規範 v1</DocLink>・<DocLink path="CONTEXT.md">領域詞彙</DocLink></td></tr>
              <tr><td className="mono" style={{ fontWeight: 700 }}>D</td><td>AI 只辨識、規則做判定，每筆判定附條文與版本</td><td><a href="#/inspect" onClick={e => { e.preventDefault(); onNavigate('inspect'); }}>單張判定</a>・<DocLink path="docs/adr/0001-verdict-derived-from-spec-not-ai.md">ADR-0001</DocLink></td></tr>
              <tr><td className="mono" style={{ fontWeight: 700 }}>C</td><td>一致性分析（計數值 MSA）＋ p 管制圖判異</td><td><DocLink path="experiment/results/msa-summary.md">MSA 摘要</DocLink>・<a href="#/control" onClick={e => { e.preventDefault(); onNavigate('control'); }}>管制看板</a></td></tr>
              <tr><td className="mono" style={{ fontWeight: 700 }}>A</td><td>預警／異常 → AI 草擬、人確認的異常處置單；導入計畫與規範 v2 提案</td><td><a href="#/control" onClick={e => { e.preventDefault(); onNavigate('control'); }}>管制看板右欄</a>・<DocLink path="docs/rollout/導入計畫.xlsx">導入計畫</DocLink></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="small dim" style={{ marginTop: 40, maxWidth: '76ch' }}>
        情境與數據皆為模擬：痛點來自作者在元太科技的人工目檢經驗；標準樣本為程序化底圖＋程式注入已知尺寸缺陷的半合成影像；
        管制圖的 25 批為統計模擬；規範中的允收數值為假設值，非業界標準。
      </p>
    </div>
  );
};

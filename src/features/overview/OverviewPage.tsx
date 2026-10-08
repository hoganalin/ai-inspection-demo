import React, { useMemo, useRef } from 'react';
import { Icon, VERDICT_STYLE } from '../../components/ui/icons';
import { VerdictChip, VerdictMark } from '../../components/ui/marks';
import { DiePlate } from '../inspection/components/DiePlate';
import { LeaderLayer } from '../inspection/components/LeaderLayer';
import { ScaleBar } from '../inspection/components/ScaleBar';
import { DEFECT_CLASS_LABEL, VERDICT_LABEL, ZONE_LABEL, acceptanceScale, formatMeasurement } from '../inspection/spec/inspectionSpecV1';
import { AgreementChip, HUMAN_SUMMARY, MSA_SUMMARY, SAMPLE_BY_ID, V2_SUMMARY } from '../samples';
import { PChart } from '../control/components/PChart';
import { ALLOWANCE, RECHECK_SECONDS, SHIFT_MINUTES, laborReduction, laborScenario } from './laborModel';

/** ECRS 對照：新的檢驗流程相對於人工目檢做了哪些改變。 */
const ECRS = [
  { key: 'E', name: '刪除', how: '人不再逐顆判：AI＋規則判每一顆，判 Pass 放行、判 Fail 退件，只有 Warning 送人工複判。' },
  { key: 'C', name: '合併', how: '判定與記錄合一：判定結果直接進入批紀錄，可匯出 CSV，不需另行登錄。' },
  { key: 'R', name: '重排', how: '批不良率在判定當下就更新到 p 管制圖，預警從事後彙總提前到即時。' },
  { key: 'S', name: '簡化', how: '檢驗規範寫成程式可以執行、有版本號的條文；異常處置單由 AI 先草擬，人負責審閱與確認。' },
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

/** 差距小於 5 個百分點視為持平；任一邊沒有兩次判定就是未量測。 */
const repeatabilityTrend = (before: number | null, after: number | null): Trend =>
  before === null || after === null ? 'unmeasured'
    : Math.abs(after - before) < 0.05 ? 'flat'
      : after > before ? 'better' : 'worse';

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
  // 第二輪：檢驗規範 v2（分塊放大判讀＋框選換算尺寸＋安全路由），同條件重跑
  const v2 = V2_SUMMARY;
  // 中間情境改用作者實測的每次判定時間；其餘為假設值
  const measuredSeconds = HUMAN_SUMMARY?.secondsPerDie ?? null;
  const scenarioSeconds = measuredSeconds ? [RECHECK_SECONDS[0], measuredSeconds, RECHECK_SECONDS[2]] : [...RECHECK_SECONDS];
  // 工時：現況人工依規範逐顆判（比例 1）→ AI＋規則判每一顆，人只複判 AI 判 Warning 的晶粒
  const aiShare = v2.trial1.warningRate;
  const labor = scenarioSeconds.map(s => laborScenario(s, 1, aiShare));
  const human = HUMAN_SUMMARY;
  const reduction = laborReduction(1, aiShare);
  const speedup = measuredSeconds ? measuredSeconds / v2.secondsPerDie : null;
  const costPerDie = v2.spendUsd / v2.apiCalls;

  const pairs = useMemo(() => [{ from: 'ov-row-0', to: 'ov-ref-1', verdict: judged.verdict }], [judged.verdict]);

  // trend＝規範 v2 相對 v1 的變化
  const msaRows: { label: string; hint: string; before: string; v1: string; v2: string; trend: Trend }[] = [
    { label: '漏判率', hint: '標準答案 Fail → 判 Pass', before: pct(b.missRate), v1: pct(a.missRate), v2: pct(v2.trial1.missRate), trend: 'better' },
    { label: '重複性', hint: '同一評估者兩次一致', before: pct(b.repeatability), v1: pct(a.repeatability), v2: pct(v2.repeatability), trend: repeatabilityTrend(a.repeatability, v2.repeatability) },
    { label: '人工複判率', hint: `判 Warning 的比例；標準答案為 ${pct(a.referenceWarningRate)}`, before: pct(b.warningRate), v1: pct(a.warningRate), v2: pct(v2.trial1.warningRate), trend: 'flat' },
    { label: '誤判率', hint: '標準答案 Pass → 判 Fail', before: pct(b.falseCallRate), v1: pct(a.falseCallRate), v2: pct(v2.trial1.falseCallRate), trend: 'worse' },
    { label: '評估者間一致率', hint: '三位評估者判定相同的樣本比例', before: pct(b.betweenAppraisersPerTrial), v1: pct(a.betweenAppraisersPerTrial), v2: pct(v2.trial1.betweenAppraisersPerTrial), trend: 'better' },
    { label: '對標準答案一致率', hint: '逐筆', before: pct(b.accuracy), v1: pct(a.accuracy), v2: pct(v2.trial1.accuracy), trend: 'better' },
    { label: 'Fleiss’ kappa', hint: '三人', before: b.fleissKappa.toFixed(2), v1: a.fleissKappa.toFixed(2), v2: v2.trial1.fleissKappa.toFixed(2), trend: 'better' },
  ];

  const recognition = (['CHP', 'CRK', 'SCR', 'CON'] as const).map(code => ({ code, ...rec[code], v2: v2.recognition[code] }));

  const firstSignal = controlView.signals.find(s => s.source === 'simulated');

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">晶粒外觀檢查改善專案</h1>
          <p className="page-sub">
            產線有檢驗規範，但判讀靠人眼，慢、小缺陷也容易漏看。這個專案驗證：AI 只回報缺陷、判定由有版本號的檢驗規範推導，
            能不能比人工更快，而且判得不比人工差；批不良率以 p 管制圖預警，異常處置單由 AI 草擬、經人確認。
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
              <h3 className="block-title" style={{ margin: 0 }}>人眼＋規範 → AI＋規則（規範 v2）</h3>
              <a href="#human-title" className="small" onClick={e => { e.preventDefault(); document.getElementById('human-title')?.scrollIntoView({ behavior: 'smooth' }); }}>完整對照</a>
            </div>
            <dl className="headline-rows">
              <div>
                <dt>每顆判讀時間<span className="tiny dim">AI 為回應時間，不含取像</span></dt>
                <dd><span className="mono dim">{measuredSeconds ?? '—'} 秒 →</span> <b className="headline-num" style={{ color: 'var(--pass-ink)' }}>{v2.secondsPerDie} 秒</b> {speedup && <span className="trend" style={{ color: TREND.better.color }}>快 {speedup.toFixed(1)} 倍</span>}</dd>
              </div>
              <div>
                <dt>漏判率<span className="tiny dim">標準答案 Fail → 判 Pass</span></dt>
                <dd><span className="mono dim">{pct(human?.combined.own.missRate ?? null)} →</span> <b className="headline-num" style={{ color: 'var(--pass-ink)' }}>{pct(v2.trial1.missRate)}</b> <span className="trend" style={{ color: TREND.better.color }}>改善</span></dd>
              </div>
              <div>
                <dt>誤判率<span className="tiny dim">標準答案 Pass → 判 Fail</span></dt>
                <dd><span className="mono dim">{pct(human?.combined.own.falseCallRate ?? null)} →</span> <b className="headline-num" style={{ color: 'var(--fail-ink)' }}>{pct(v2.trial1.falseCallRate)}</b> <span className="trend" style={{ color: TREND.worse.color }}>變差</span></dd>
              </div>
            </dl>
            <p className="small" style={{ marginTop: 8 }}>
              <b>AI 更快、更不會放走壞的，但好晶粒被誤退較多，還不能取代人工；Gate 尚未通過。</b><span style={{ color: 'var(--ink-2)' }}>人工為作者本人照規範判兩輪（真實）；AI 為 3 位模擬評估者。</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── 主要對照：人眼＋規範 vs AI＋規則 ── */}
      {human && (
        <section className="section" aria-labelledby="human-title" style={{ marginTop: 56 }}>
          <div className="section-head">
            <h2 className="section-title" id="human-title">
              人眼＋規範 vs AI＋規則：AI {speedup ? `快 ${speedup.toFixed(1)} 倍、` : ''}漏判更少，但誤判較多
            </h2>
            <span className="section-note">同樣 40 張樣本；人工為作者本人依規範判兩輪，共 {human.combined.own.n} 次（真實判定），AI 為 3 位模擬評估者</span>
          </div>
          <p style={{ maxWidth: '76ch', marginBottom: 14 }}>
            <b>這個專案要回答的問題：導入 AI 之後，質檢能不能更快，而且答對率、漏判率不比人工差。</b>
            作者照規範逐顆判，每顆 {measuredSeconds} 秒；AI 只回報缺陷、判定由規則推導（規範 v2），每顆 {v2.secondsPerDie} 秒。
            AI 的漏判、答對率與重複性都比人好，但好晶粒被誤退 {pct(v2.trial1.falseCallRate)}（人工 {pct(human.combined.own.falseCallRate)}），所以還不能取代人工。
          </p>

          <div className="overview-msa">
            <div className="tbl-frame" style={{ overflowX: 'auto' }}>
              <table className="tbl tbl-stack">
                <thead>
                  <tr>
                    <th scope="col">判定方式</th>
                    <th scope="col" className="r">每顆判讀</th>
                    <th scope="col" className="r">對標準答案一致率</th>
                    <th scope="col" className="r">漏判率</th>
                    <th scope="col" className="r">誤判率</th>
                    <th scope="col" className="r">重複性</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><div style={{ fontWeight: 700 }}>人眼＋規範（作者）</div><div className="tiny dim">人看缺陷、人對條文判定：現況</div></td>
                    <td className="r mono" data-label="每顆判讀" style={{ whiteSpace: 'nowrap' }}>{measuredSeconds} 秒</td>
                    <td className="r mono" data-label="對標準答案一致率">{pct(human.combined.own.accuracy)}</td>
                    <td className="r mono" data-label="漏判率" style={{ color: 'var(--fail-ink)' }}>{pct(human.combined.own.missRate)}</td>
                    <td className="r mono" data-label="誤判率">{pct(human.combined.own.falseCallRate)}</td>
                    <td className="r mono" data-label="重複性">{pct(human.repeatability.own)}</td>
                  </tr>
                  <tr aria-selected="true">
                    <td><div style={{ fontWeight: 700 }}>AI＋規則（規範 v2）</div><div className="tiny dim">分塊放大判讀、尺寸由程式換算，3 位模擬評估者</div></td>
                    <td className="r mono" data-label="每顆判讀" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{v2.secondsPerDie} 秒</td>
                    <td className="r mono" data-label="對標準答案一致率" style={{ fontWeight: 700 }}>{pct(v2.trial1.accuracy)}</td>
                    <td className="r mono" data-label="漏判率" style={{ fontWeight: 700 }}>{pct(v2.trial1.missRate)}</td>
                    <td className="r mono" data-label="誤判率" style={{ color: 'var(--fail-ink)' }}>{pct(v2.trial1.falseCallRate)}</td>
                    <td className="r mono" data-label="重複性" style={{ fontWeight: 700 }}>{pct(v2.repeatability)}</td>
                  </tr>
                  <tr>
                    <td><div style={{ fontWeight: 600 }}>AI＋規則（規範 v1）</div><div className="tiny dim">第一輪：全幅影像判讀，3 位模擬評估者</div></td>
                    <td className="r mono dim" data-label="每顆判讀">—</td>
                    <td className="r mono" data-label="對標準答案一致率">{pct(a.accuracy)}</td>
                    <td className="r mono" data-label="漏判率" style={{ color: 'var(--fail-ink)' }}>{pct(a.missRate)}</td>
                    <td className="r mono" data-label="誤判率">{pct(a.falseCallRate)}</td>
                    <td className="r mono" data-label="重複性">{pct(a.repeatability)}</td>
                  </tr>
                  <tr>
                    <td><div style={{ fontWeight: 600 }}>人眼回報＋規則推導（作者）</div><div className="tiny dim">同一份人工缺陷回報，改由規則判定</div></td>
                    <td className="r mono dim" data-label="每顆判讀">—</td>
                    <td className="r mono" data-label="對標準答案一致率">{pct(human.combined.rules.accuracy)}</td>
                    <td className="r mono" data-label="漏判率">{pct(human.combined.rules.missRate)}</td>
                    <td className="r mono" data-label="誤判率">{pct(human.combined.rules.falseCallRate)}</td>
                    <td className="r mono" data-label="重複性">{pct(human.repeatability.rules)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="block-title">讀這張表要注意</h3>
              <ul className="small" style={{ margin: 0, paddingLeft: '1.2em', listStyle: 'disc', display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--ink-2)' }}>
                <li>秒數的範圍不同：作者的 {measuredSeconds} 秒含找缺陷、量測與填表；AI 的 {v2.secondsPerDie} 秒是回應時間，不含取像，可多顆並行，每顆約 US${costPerDie.toFixed(2)}。</li>
                <li>人工的漏判 4 次全是同兩張、兩輪都「沒看到」：周邊區的裂紋（S16）、經過 pad 的刮傷（S39）。v2 的 AI 把邊緣放大判讀後，漏判降到 {pct(v2.trial1.missRate)}。</li>
                <li>AI 的誤判來自框選過鬆、尺寸被高估：5 次誤判全來自兩張好晶粒（S24 的 8 µm 崩角被算成 56 µm）。</li>
                <li>規則對人也有幫助：同一份人工回報交給規則判，答對率 {pct(human.combined.own.accuracy)} → {pct(human.combined.rules.accuracy)}（修正 {human.combined.fixedByRules} 次、改錯 {human.combined.brokenByRules} 次）。</li>
              </ul>
              <p className="tiny dim" style={{ marginTop: 12 }}>
                限制：人工組只有作者一人，且作者就是規範撰寫者。{human.note}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Check：一致性分析 ── */}
      <section className="section" aria-labelledby="msa-title" style={{ marginTop: 64 }}>
        <div className="section-head">
          <h2 className="section-title" id="msa-title">AI 怎麼追上來：一致性分析，口述標準 → 規範 v1 → 規範 v2</h2>
          <span className="section-note">40 張半合成樣本 × 3 位模擬 AI 評估者，每條件 {a.judgments} 筆判定（第 1 次）</span>
        </div>
        <p style={{ maxWidth: '72ch', marginBottom: 18 }}>
          「口述標準」是只給 AI 三句口頭標準、讓它直接判，用來看 AI 沒有規則時會怎樣：三位評估者判得一樣的只有 {pct(b.betweenAppraisersPerTrial)}，所以 AI 一定要搭配規則。
          <b>規範 v1 讓漏判率變差（{pct(b.missRate)} → {pct(a.missRate)}）；改成規範 v2 後漏判率降到 {pct(v2.trial1.missRate)}、重複性 {pct(v2.repeatability)}。</b>
          v1 的問題是 AI 在全幅影像上看不到小缺陷、尺寸量不準；v2 改成分塊放大判讀，尺寸由程式依框選範圍換算。
          剩下的問題是框選過鬆造成誤判率上升，評估者間一致率也還沒到 90%，所以 <b>Gate ②→③ 尚未通過</b>。
        </p>

        <div className="overview-msa">
          <div className="tbl-frame" style={{ overflowX: 'auto' }}>
            <table className="tbl tbl-stack">
              <thead>
                <tr>
                  <th scope="col">指標</th>
                  <th scope="col" className="r">口述標準</th>
                  <th scope="col" className="r">規範 v1</th>
                  <th scope="col" className="r">規範 v2</th>
                  <th scope="col">v2 比 v1</th>
                </tr>
              </thead>
              <tbody>
                {msaRows.map(r => (
                  <tr key={r.label}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.label}</div>
                      <div className="tiny dim">{r.hint}</div>
                    </td>
                    <td className="r mono" data-label="口述標準">{r.before}</td>
                    <td className="r mono" data-label="規範 v1">{r.v1}</td>
                    <td className="r mono" data-label="規範 v2" style={{ fontWeight: 700, color: r.trend === 'worse' ? 'var(--fail-ink)' : undefined }}>{r.v2}</td>
                    <td className="small" data-label="v2 比 v1" style={{ fontWeight: 600, color: TREND[r.trend].color }}>{TREND[r.trend].label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="block-title">規範 v2 把「看不到」補起來</h3>
            <p className="small" style={{ color: 'var(--ink-2)', marginBottom: 12 }}>
              各缺陷分類的偵出率（偵出數／標準答案件數）。v1 在 1000 px 全幅影像上判讀，40 µm 的崩角只有 8 px 深；v2 把邊緣放大 4 倍、核心放大 2 倍再判讀。
            </p>
            <div style={{ borderTop: '1px solid var(--rule-strong)' }}>
              {recognition.map(r => (
                <div key={r.code} style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr) 120px', gap: 12, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--rule)' }}>
                  <span><span className="mono" style={{ fontWeight: 700 }}>{r.code}</span> <span className="small">{DEFECT_CLASS_LABEL[r.code].cn}</span></span>
                  <span style={{ height: 10, background: 'var(--ground-2)', position: 'relative' }}>
                    <span style={{ position: 'absolute', inset: 0, width: `${(r.v2.recall ?? 0) * 100}%`, background: 'var(--si-800)' }} />
                    <span style={{ position: 'absolute', top: -3, bottom: -3, left: `${(r.recall ?? 0) * 100}%`, width: 2, background: 'var(--fail)' }} />
                  </span>
                  <span className="mono small r" style={{ textAlign: 'right' }}>
                    <span className="dim">{pct(r.recall, 0)} →</span> <b>{pct(r.v2.recall, 0)}</b>
                  </span>
                </div>
              ))}
            </div>
            <p className="tiny dim" style={{ marginTop: 10 }}>
              深色條＝v2 偵出率，紅色刻度＝v1。框選過鬆讓 v2 的尺寸偏大（崩角平均 +{pct(v2.recognition.CHP.measRelBias, 0)}）；
              樣本少（每類 Fail 只有 2–3 張），比率的信賴區間很寬；評估者是同一模型配不同角色設定，不是真人。
              <DocLink path="experiment/results/msa-summary.md">完整摘要與限制</DocLink>
            </p>

            <h3 className="block-title" style={{ marginTop: 22 }}>以 S25 為例：三位 AI 評估者的實際回報（規範 v1）</h3>
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
          <h2 className="section-title" id="labor-title">工時與產能：AI 先判、人只複判 Warning，人工判讀可省 {pct(reduction, 0)}</h2>
          <span className="section-note">{measuredSeconds ? `${measuredSeconds} 秒為作者實測，其餘情境與寬放率為假設值` : '單顆判讀時間與寬放率為假設值，以三種情境做敏感度分析'}</span>
        </div>
        <p style={{ maxWidth: '76ch', marginBottom: 14 }}>
          現況是檢驗員依規範逐顆判；導入後 AI＋規則判每一顆，人只複判 AI 判 Warning 的 {pct(aiShare)}，每批 50 顆要人看的晶粒從 50 顆降到約 {Math.round(50 * aiShare)} 顆。
          換算方式：標準工時＝單顆判讀時間 ×（1＋寬放率 {pct(ALLOWANCE, 0)}）；每千顆人工判讀工時＝1,000 × 人工判讀比例 × 標準工時；每班以 {SHIFT_MINUTES / 60} 小時計。
        </p>

        <div className="overview-msa">
          <div className="tbl-frame" style={{ overflowX: 'auto' }}>
            <table className="tbl tbl-stack">
              <thead>
                <tr>
                  <th scope="col">單顆判讀時間</th>
                  <th scope="col" className="r">每千顆人工判讀工時</th>
                  <th scope="col" className="r">一位檢驗員每班可涵蓋</th>
                </tr>
              </thead>
              <tbody>
                {labor.map(s => (
                  <tr key={s.seconds}>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        <span className="mono">{s.seconds}</span> 秒／顆
                        {s.seconds === measuredSeconds
                          ? <span className="chip chip-accent" style={{ marginLeft: 8 }}>作者實測</span>
                          : <span className="tiny dim" style={{ marginLeft: 8 }}>假設</span>}
                      </div>
                      <div className="tiny dim">標準工時 <span className="mono">{s.standardSeconds.toFixed(1)}</span> 秒</div>
                    </td>
                    <td className="r mono" data-label="每千顆人工判讀工時">
                      <span><span className="dim">{s.per1000Minutes.before.toFixed(0)} →</span>{' '}
                      <b>{s.per1000Minutes.after.toFixed(0)}</b> 分鐘</span>
                    </td>
                    <td className="r mono" data-label="一位檢驗員每班可涵蓋">
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
                <b>這個數字還不能當效益。</b>好晶粒被誤退 {pct(v2.trial1.falseCallRate)} 的成本還沒算；
                「複判一顆和全判一顆一樣久」是假設；AI 每顆 {v2.secondsPerDie} 秒是機器時間，不含取像，每顆約 US${costPerDie.toFixed(2)}。
                第一輪 v1 的漏判率 {pct(a.missRate)}，那時省下的人力有一部分是用漏判換來的；v2 漏判 {pct(v2.trial1.missRate)}，這次不是。
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
              25 批 × 50 顆依規範 v1 實測的判定誤差抽樣，自第 15 批起注入切割刀磨耗的 CHP 漂移。規範 v2 的判定誤差尚未重跑這組模擬。
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
            <span className="small">產線規範 → 程式可執行的檢驗規範 v1（4 類缺陷、2 區域、µm 允收標準）</span>
          </li>
          <li className="is-done">
            <span className="phase-head"><b>② PoC 驗證</b><span className="phase-state"><Icon.Check width={14} height={14} />完成</span></span>
            <span className="small">規範 v1 未通過 → 規範 v2 重跑一致性分析（2026-10-07）</span>
          </li>
          <li className="is-hold">
            <span className="phase-head"><b>③ 單線試行</b><span className="phase-state"><Icon.Alert width={14} height={14} />Gate 未通過</span></span>
            <span className="small">規範 v2 達標：漏判率 ≤ 5%（{pct(v2.trial1.missRate)}）、重複性 ≥ 90%（{pct(v2.repeatability)}）、人工複判率 ≤ 30%（{pct(v2.trial1.warningRate)}）。未達：評估者間一致率 ≥ 90%（{pct(v2.trial1.betweenAppraisersPerTrial)}）；誤判率 {pct(v2.trial1.falseCallRate)} 高於目標 3%；預警提早批數待以 v2 重新驗證。</span>
          </li>
          <li>
            <span className="phase-head"><b>④ 擴線與 MES 介接</b><span className="phase-state">規劃</span></span>
            <span className="small">③ 通過後才進行</span>
          </li>
        </ol>

        <div className="overview-next">
          <h3 className="block-title">規範 v2 已執行（Act）；下一輪 v2.1 提案</h3>
          <p className="small" style={{ color: 'var(--ink-2)', margin: '0 0 8px' }}>
            v2 做了三件事：邊緣每邊切 8 段放大 4 倍、核心 4 個象限放大 2 倍；AI 只框選，尺寸與區域由程式依 5 µm/px 換算；周邊區與核心區線狀缺陷改走安全路由。
            同條件重跑 240 筆判定，花費 US${v2.spendUsd.toFixed(2)}。v2 目前只在實驗流程實作，網站上的單張判定仍用規範 v1。<DocLink path="docs/spec/inspection-spec-v2.md">檢驗規範 v2</DocLink>
          </p>
          <ol className="small" style={{ margin: 0, paddingLeft: '1.4em', listStyle: 'decimal', display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ink-2)' }}>
            <li><b style={{ color: 'var(--ink)' }}>框內找實際邊緣：</b>框選後由程式依影像對比找出缺陷邊緣再量測，處理框選過鬆造成的尺寸高估。</li>
            <li><b style={{ color: 'var(--ink)' }}>門檻附近送人工：</b>量測值落在允收門檻 ±10% 內者判 Warning，不直接 Fail。</li>
            <li><b style={{ color: 'var(--ink)' }}>重新驗證預警：</b>用 v2 實測的判定誤差重跑管制圖模擬，確認預警能否提早。</li>
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
              <tr><td className="mono" style={{ fontWeight: 700 }}>P</td><td>痛點「有規範但判讀靠人眼：慢、會漏看」→ 程式可執行、有版本號的檢驗規範 v1，依一致性分析修訂為 v2</td><td><DocLink path="docs/spec/inspection-spec-v1.md">規範 v1</DocLink>・<DocLink path="docs/spec/inspection-spec-v2.md">規範 v2</DocLink>・<DocLink path="CONTEXT.md">領域詞彙</DocLink></td></tr>
              <tr><td className="mono" style={{ fontWeight: 700 }}>D</td><td>AI 只辨識、規則做判定，每筆判定附條文與版本</td><td><a href="#/inspect" onClick={e => { e.preventDefault(); onNavigate('inspect'); }}>單張判定</a>・<DocLink path="docs/adr/0001-verdict-derived-from-spec-not-ai.md">ADR-0001</DocLink></td></tr>
              <tr><td className="mono" style={{ fontWeight: 700 }}>C</td><td>人眼＋規範 vs AI＋規則對照、一致性分析（計數值 MSA，v1 與 v2 各兩次判定）＋ p 管制圖判異</td><td><DocLink path="experiment/results/msa-summary.md">MSA 摘要</DocLink>・<a href="#/control" onClick={e => { e.preventDefault(); onNavigate('control'); }}>管制看板</a></td></tr>
              <tr><td className="mono" style={{ fontWeight: 700 }}>A</td><td>預警／異常 → AI 草擬、人確認的異常處置單；依數據修訂規範 v2 並重跑，提出 v2.1</td><td><a href="#/control" onClick={e => { e.preventDefault(); onNavigate('control'); }}>管制看板右欄</a>・<DocLink path="docs/rollout/導入計畫.xlsx">導入計畫</DocLink></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="small dim" style={{ marginTop: 40, maxWidth: '76ch' }}>
        情境與數據皆為模擬：痛點來自作者過去的目檢經驗；人工對照組為作者本人的真實判定；標準樣本為程序化底圖＋程式注入已知尺寸缺陷的半合成影像；
        管制圖的 25 批為統計模擬；規範中的允收數值為假設值，非業界標準。
      </p>
    </div>
  );
};

import React, { useMemo, useRef } from 'react';
import { Icon, VERDICT_STYLE } from '../../components/ui/icons';
import { VerdictChip, VerdictMark } from '../../components/ui/marks';
import { DiePlate } from '../inspection/components/DiePlate';
import { LeaderLayer } from '../inspection/components/LeaderLayer';
import { ScaleBar } from '../inspection/components/ScaleBar';
import { DEFECT_CLASS_LABEL, VERDICT_LABEL, ZONE_LABEL, acceptanceScale, formatMeasurement } from '../inspection/spec/inspectionSpecV1';
import { AgreementChip, BLIND_SUMMARY, HUMAN_SUMMARY, MSA_SUMMARY, SAMPLE_BY_ID, V2_SUMMARY } from '../samples';
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
  // 第三輪：v2.1 凍結後，在盲測集（凍結後才產生的 40 張新樣本）上的 AI 與作者本人；主要對照用這一輪
  const bl = BLIND_SUMMARY;
  const ai = bl.ai;
  const bh = bl.human;
  // 中間情境用作者盲測實測的每顆判讀時間；其餘為假設值
  const measuredSeconds = bh.secondsPerDie;
  const scenarioSeconds = [RECHECK_SECONDS[0], measuredSeconds, RECHECK_SECONDS[2]];
  // 工時：現況人工依規範逐顆判（比例 1）→ AI＋規則判每一顆，人只複判 AI 判 Warning 的晶粒
  const aiShare = ai.trial1.warningRate;
  const labor = scenarioSeconds.map(s => laborScenario(s, 1, aiShare));
  // 開發集（設計時用過的舊 40 張）上的作者兩輪：同日進行，留作歷程
  const human = HUMAN_SUMMARY;
  const reduction = laborReduction(1, aiShare);
  const speedup = measuredSeconds / ai.secondsPerDie;
  const costPerDie = ai.spendUsd / ai.apiCalls;
  const frac = (c: [number, number]) => `${c[0]}/${c[1]}`;

  const pairs = useMemo(() => [{ from: 'ov-row-0', to: 'ov-ref-1', verdict: judged.verdict }], [judged.verdict]);

  // trend＝規範 v2.1（盲測集）相對 v2 的變化；gate＝v2.1 是否達 Gate ②→③ 標準
  const msaRows: { label: string; hint: string; before: string; v1: string; v2: string; v21: string; trend: Trend; gate?: string }[] = [
    { label: '漏判率', hint: '標準答案 Fail → 判 Pass', before: pct(b.missRate), v1: pct(a.missRate), v2: pct(v2.trial1.missRate), v21: pct(ai.trial1.missRate), trend: 'flat', gate: '≤ 5%' },
    { label: '重複性', hint: '同一評估者兩次一致', before: pct(b.repeatability), v1: pct(a.repeatability), v2: pct(v2.repeatability), v21: pct(ai.repeatability), trend: repeatabilityTrend(v2.repeatability, ai.repeatability), gate: '≥ 90%' },
    { label: '人工複判率', hint: `判 Warning 的比例；標準答案約 ${pct(a.referenceWarningRate)}`, before: pct(b.warningRate), v1: pct(a.warningRate), v2: pct(v2.trial1.warningRate), v21: pct(ai.trial1.warningRate), trend: 'flat', gate: '≤ 30%' },
    { label: '誤判率', hint: '標準答案 Pass → 判 Fail', before: pct(b.falseCallRate), v1: pct(a.falseCallRate), v2: pct(v2.trial1.falseCallRate), v21: pct(ai.trial1.falseCallRate), trend: 'better', gate: '≤ 3%' },
    { label: '評估者間一致率', hint: '三位評估者判定相同的樣本比例', before: pct(b.betweenAppraisersPerTrial), v1: pct(a.betweenAppraisersPerTrial), v2: pct(v2.trial1.betweenAppraisersPerTrial), v21: pct(ai.trial1.betweenAppraisersPerTrial), trend: 'better', gate: '≥ 90%' },
    { label: '對標準答案一致率', hint: '逐筆', before: pct(b.accuracy), v1: pct(a.accuracy), v2: pct(v2.trial1.accuracy), v21: pct(ai.trial1.accuracy), trend: 'better', gate: '≥ 90%' },
    { label: 'Fleiss’ kappa', hint: '三人', before: b.fleissKappa.toFixed(2), v1: a.fleissKappa.toFixed(2), v2: v2.trial1.fleissKappa.toFixed(2), v21: ai.trial1.fleissKappa.toFixed(2), trend: 'better' },
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
          <span className="chip chip-line">實驗：規範 v2.1 盲測</span>
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
              <h3 className="block-title" style={{ margin: 0 }}>盲測：人眼＋規範 → AI＋規則（規範 v2.1）</h3>
              <a href="#human-title" className="small" onClick={e => { e.preventDefault(); document.getElementById('human-title')?.scrollIntoView({ behavior: 'smooth' }); }}>完整對照</a>
            </div>
            <dl className="headline-rows">
              <div>
                <dt>每顆判讀時間<span className="tiny dim">AI 為回應時間，不含取像</span></dt>
                <dd><span className="mono dim">{measuredSeconds} 秒 →</span> <b className="headline-num" style={{ color: 'var(--pass-ink)' }}>{ai.secondsPerDie} 秒</b> <span className="trend" style={{ color: TREND.better.color }}>快 {speedup.toFixed(1)} 倍</span></dd>
              </div>
              <div>
                <dt>漏判率<span className="tiny dim">標準答案 Fail → 判 Pass</span></dt>
                <dd><span className="mono dim">{pct(bh.own.missRate)} →</span> <b className="headline-num" style={{ color: 'var(--pass-ink)' }}>{pct(ai.trial1.missRate)}</b> <span className="trend" style={{ color: TREND.better.color }}>改善</span></dd>
              </div>
              <div>
                <dt>誤判率<span className="tiny dim">標準答案 Pass → 判 Fail</span></dt>
                <dd><span className="mono dim">{pct(bh.own.falseCallRate)} →</span> <b className="headline-num" style={{ color: 'var(--pass-ink)' }}>{pct(ai.trial1.falseCallRate)}</b> <span className="trend" style={{ color: TREND.better.color }}>改善</span></dd>
              </div>
            </dl>
            <p className="small" style={{ marginTop: 8 }}>
              <b>在規則凍結後才產生的 40 張新樣本上，AI 更快、漏判與誤判都比人少；但三位 AI 評估者一致率 {pct(ai.trial1.betweenAppraisersPerTrial)} 未達 90%，Gate 仍差一項。</b><span style={{ color: 'var(--ink-2)' }}>人工為作者本人隔天判兩輪（真實）；AI 為 3 位模擬評估者。</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── 主要對照：人眼＋規範 vs AI＋規則 ── */}
      <section className="section" aria-labelledby="human-title" style={{ marginTop: 56 }}>
        <div className="section-head">
          <h2 className="section-title" id="human-title">
            盲測：人眼＋規範 vs AI＋規則 v2.1，AI 快 {speedup.toFixed(1)} 倍，漏判與誤判都比人少
          </h2>
          <span className="section-note">盲測集 40 張：規則凍結後才產生；人工為作者本人隔天判兩輪，共 {bh.own.n} 次（真實判定），AI 為 3 位模擬評估者</span>
        </div>
        <p style={{ maxWidth: '76ch', marginBottom: 14 }}>
          <b>這個專案要回答的問題：導入 AI 之後，質檢能不能更快，而且答對率、漏判率不比人工差。</b>
          v2.1 的規則在 git tag <span className="mono">{bl.frozenTag}</span>（commit <span className="mono">{bl.frozenCommit.slice(0, 7)}</span>）凍結後，才用那個 commit 的雜湊當亂數種子產生盲測集，設計時沒看過這批樣本。
          作者照規範逐顆判，每顆 {measuredSeconds} 秒；AI 只回報缺陷、尺寸由程式和良品比對量出、判定由規則推導，每顆 {ai.secondsPerDie} 秒。
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
                  <th scope="col" className="r">送人工</th>
                  <th scope="col" className="r">重複性</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><div style={{ fontWeight: 700 }}>人眼＋規範</div><div className="tiny dim">作者本人；人看缺陷、人對條文判定（現況），兩輪分在不同天</div></td>
                  <td className="r mono" data-label="每顆判讀" style={{ whiteSpace: 'nowrap' }}>{measuredSeconds} 秒</td>
                  <td className="r mono" data-label="對標準答案一致率">{pct(bh.own.accuracy)}</td>
                  <td className="r mono" data-label="漏判率" style={{ color: 'var(--fail-ink)' }}>{pct(bh.own.missRate)}<span className="tiny dim"> {frac(bh.counts.miss)}</span></td>
                  <td className="r mono" data-label="誤判率">{pct(bh.own.falseCallRate)}<span className="tiny dim"> {frac(bh.counts.falseCall)}</span></td>
                  <td className="r mono" data-label="送人工">{pct(bh.own.warningRate)}</td>
                  <td className="r mono" data-label="重複性" style={{ color: 'var(--fail-ink)' }}>{pct(bh.repeatability)}</td>
                </tr>
                <tr aria-selected="true">
                  <td><div style={{ fontWeight: 700 }}>AI＋規則 v2.1</div><div className="tiny dim">AI 框出位置、程式和良品比對量尺寸；3 位模擬評估者</div></td>
                  <td className="r mono" data-label="每顆判讀" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{ai.secondsPerDie} 秒</td>
                  <td className="r mono" data-label="對標準答案一致率" style={{ fontWeight: 700 }}>{pct(ai.trial1.accuracy)}</td>
                  <td className="r mono" data-label="漏判率" style={{ fontWeight: 700 }}>{pct(ai.trial1.missRate)}<span className="tiny dim"> {frac(ai.counts.miss)}</span></td>
                  <td className="r mono" data-label="誤判率" style={{ fontWeight: 700 }}>{pct(ai.trial1.falseCallRate)}<span className="tiny dim"> {frac(ai.counts.falseCall)}</span></td>
                  <td className="r mono" data-label="送人工">{pct(ai.trial1.warningRate)}</td>
                  <td className="r mono" data-label="重複性" style={{ fontWeight: 700 }}>{pct(ai.repeatability)}</td>
                </tr>
                <tr>
                  <td colSpan={7} className="tiny dim" style={{ paddingTop: 14 }}>以上為盲測集。以下為歷程：開發集（設計時用過的舊 40 張，結果只供參考）</td>
                </tr>
                {human && (
                  <tr>
                    <td><div style={{ fontWeight: 600 }}>人眼＋規範</div><div className="tiny dim">作者本人；兩輪同一天、間隔不到一小時</div></td>
                    <td className="r mono" data-label="每顆判讀" style={{ whiteSpace: 'nowrap' }}>{human.secondsPerDie} 秒</td>
                    <td className="r mono" data-label="對標準答案一致率">{pct(human.combined.own.accuracy)}</td>
                    <td className="r mono" data-label="漏判率">{pct(human.combined.own.missRate)}</td>
                    <td className="r mono" data-label="誤判率">{pct(human.combined.own.falseCallRate)}</td>
                    <td className="r mono" data-label="送人工">{pct(human.combined.own.warningRate)}</td>
                    <td className="r mono" data-label="重複性">{pct(human.repeatability.own)}</td>
                  </tr>
                )}
                <tr>
                  <td><div style={{ fontWeight: 600 }}>AI＋規則 v2</div><div className="tiny dim">分塊放大判讀、尺寸依 AI 框選換算</div></td>
                  <td className="r mono" data-label="每顆判讀" style={{ whiteSpace: 'nowrap' }}>{v2.secondsPerDie} 秒</td>
                  <td className="r mono" data-label="對標準答案一致率">{pct(v2.trial1.accuracy)}</td>
                  <td className="r mono" data-label="漏判率">{pct(v2.trial1.missRate)}</td>
                  <td className="r mono" data-label="誤判率" style={{ color: 'var(--fail-ink)' }}>{pct(v2.trial1.falseCallRate)}</td>
                  <td className="r mono" data-label="送人工">{pct(v2.trial1.warningRate)}</td>
                  <td className="r mono" data-label="重複性">{pct(v2.repeatability)}</td>
                </tr>
                <tr>
                  <td><div style={{ fontWeight: 600 }}>AI＋規則 v1</div><div className="tiny dim">第一輪：全幅影像判讀</div></td>
                  <td className="r mono" data-label="每顆判讀" style={{ whiteSpace: 'nowrap' }}>
                    {MSA_SUMMARY.afterTiming ? `${MSA_SUMMARY.afterTiming.secondsPerDie.toFixed(1)} 秒` : '—'}
                  </td>
                  <td className="r mono" data-label="對標準答案一致率">{pct(a.accuracy)}</td>
                  <td className="r mono" data-label="漏判率" style={{ color: 'var(--fail-ink)' }}>{pct(a.missRate)}</td>
                  <td className="r mono" data-label="誤判率">{pct(a.falseCallRate)}</td>
                  <td className="r mono" data-label="送人工">{pct(a.warningRate)}</td>
                  <td className="r mono" data-label="重複性">{pct(a.repeatability)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="block-title">讀這張表要注意</h3>
            <ul className="small" style={{ margin: 0, paddingLeft: '1.2em', listStyle: 'disc', display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--ink-2)' }}>
              <li>秒數的範圍不同：作者的 {measuredSeconds} 秒含找缺陷、量測與填表；AI 的 {ai.secondsPerDie} 秒是回應時間，不含取像，可多顆並行，每顆約 US${costPerDie.toFixed(2)}。</li>
              <li>人工的錯多半是「沒看到」：漏判 {frac(bh.counts.miss)}，多是裂紋；另有 {frac(bh.counts.warningToPass)} 張該送人工的被直接放行，多是小崩角。</li>
              <li>AI 還沒過的一項：三位評估者一致 {frac(ai.counts.betweenAgree)}（{pct(ai.trial1.betweenAppraisersPerTrial)}），不一致的都是「有人送人工」，沒有一張一人放行、一人退件；另有 {frac(ai.counts.warningToPass)} 筆該送人工的被放行。</li>
              <li>進步來自量測修正：同一批 AI 回覆改用 v2 的框選量測，答對率只有 {pct(bl.aiWithV2Measure.accuracy)}。</li>
              <li>作者的重複性：開發集同日兩輪 {human ? pct(human.repeatability.own) : '—'}，盲測隔天兩輪 {pct(bh.repeatability)}；第一次的人工基準有記憶效應，所以第二次刻意分兩天。</li>
            </ul>
            <p className="tiny dim" style={{ marginTop: 12 }}>
              限制：人工組只有作者一人，且作者就是規範撰寫者；盲測集同為半合成影像，每張底圖相同，和良品比對在這裡會比真實產線準。
              <DocLink path="docs/spec/inspection-spec-v2.1.md">檢驗規範 v2.1</DocLink>
            </p>
          </div>
        </div>
      </section>

      {/* ── Check：一致性分析 ── */}
      <section className="section" aria-labelledby="msa-title" style={{ marginTop: 64 }}>
        <div className="section-head">
          <h2 className="section-title" id="msa-title">AI 怎麼追上來：一致性分析，口述標準 → 規範 v1 → v2 → v2.1（盲測）</h2>
          <span className="section-note">3 位模擬 AI 評估者，每條件 {a.judgments} 筆判定（第 1 次）；前三欄為開發集 40 張，v2.1 為盲測集 40 張</span>
        </div>
        <p style={{ maxWidth: '72ch', marginBottom: 18 }}>
          「口述標準」是只給 AI 三句口頭標準、讓它直接判，用來看 AI 沒有規則時會怎樣：三位評估者判得一樣的只有 {pct(b.betweenAppraisersPerTrial)}，所以 AI 一定要搭配規則。
          規範 v1 讓漏判率變差（{pct(b.missRate)} → {pct(a.missRate)}），因為 AI 在全幅影像上看不到小缺陷、尺寸量不準；v2 改成分塊放大判讀，漏判降到 {pct(v2.trial1.missRate)}，但框選過鬆讓誤判升到 {pct(v2.trial1.falseCallRate)}。
          <b>v2.1 只改量測：AI 的框只決定在哪裡找，尺寸由程式和良品比對量出；凍結後在盲測集上誤判降到 {pct(ai.trial1.falseCallRate)}、答對率 {pct(ai.trial1.accuracy)}。</b>
          評估者間一致率 {pct(ai.trial1.betweenAppraisersPerTrial)} 還差 90% 一點，所以 <b>Gate ②→③ 仍未通過</b>。
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
                  <th scope="col" className="r">v2.1 盲測</th>
                  <th scope="col">v2.1 比 v2</th>
                  <th scope="col" className="r">Gate</th>
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
                    <td className="r mono" data-label="規範 v2">{r.v2}</td>
                    <td className="r mono" data-label="v2.1 盲測" style={{ fontWeight: 700 }}>{r.v21}</td>
                    <td className="small" data-label="v2.1 比 v2" style={{ fontWeight: 600, color: TREND[r.trend].color }}>{TREND[r.trend].label}</td>
                    <td className="r mono tiny" data-label="Gate" style={{ whiteSpace: 'nowrap' }}>{r.gate ?? '—'}</td>
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
              深色條＝v2 偵出率，紅色刻度＝v1（開發集；v2.1 的 AI 端與 v2 相同）。框選過鬆讓 v2 的尺寸偏大（崩角平均 +{pct(v2.recognition.CHP.measRelBias, 0)}），這正是 v2.1 改量測的原因；
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
          <span className="section-note">{measuredSeconds} 秒為作者盲測實測，其餘情境與寬放率為假設值</span>
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
                          ? <span className="chip chip-accent" style={{ marginLeft: 8 }}>作者盲測實測</span>
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
                <b>這個數字還不能當效益。</b>盲測只有 40 張半合成樣本，誤判 {pct(ai.trial1.falseCallRate)} 只代表這一批；
                「複判一顆和全判一顆一樣久」是假設；AI 每顆 {ai.secondsPerDie} 秒是機器時間，不含取像，每顆約 US${costPerDie.toFixed(2)}；
                三位 AI 評估者一致率還沒過 90%，Gate 未通過前不會進產線。
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
              25 批 × 50 顆依規範 v1 實測的判定誤差抽樣，自第 15 批起注入切割刀磨耗的 CHP 漂移。v2、v2.1 的判定誤差尚未重跑這組模擬；不過即使判定完美，也要到 L19 才首次異常，要提早預警得改管制圖規則或抽樣，不是改判定。
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
            <span className="small">規範 v1 未通過 → v2 重跑（2026-10-07）→ v2.1 凍結後盲測（2026-10-13）</span>
          </li>
          <li className="is-hold">
            <span className="phase-head"><b>③ 單線試行</b><span className="phase-state"><Icon.Alert width={14} height={14} />Gate 差一項</span></span>
            <span className="small">v2.1 盲測達標：漏判率 ≤ 5%（{pct(ai.trial1.missRate)}）、誤判率 ≤ 3%（{pct(ai.trial1.falseCallRate)}）、對標準答案一致率 ≥ 90%（{pct(ai.trial1.accuracy)}）、重複性 ≥ 90%（{pct(ai.repeatability)}）、人工複判率 ≤ 30%（{pct(ai.trial1.warningRate)}）。未達：評估者間一致率 ≥ 90%（{pct(ai.trial1.betweenAppraisersPerTrial)}）；預警提早批數待重新驗證。</span>
          </li>
          <li>
            <span className="phase-head"><b>④ 擴線與 MES 介接</b><span className="phase-state">規劃</span></span>
            <span className="small">③ 通過後才進行</span>
          </li>
        </ol>

        <div className="overview-next">
          <h3 className="block-title">規範 v2.1 已執行並盲測（Act）；下一步</h3>
          <p className="small" style={{ color: 'var(--ink-2)', margin: '0 0 8px' }}>
            v2.1 只改量測：AI 的框只決定在哪裡找，程式在框附近和良品標準晶粒比對量出實際範圍；量不到或落在門檻 ±10% 內送人工；尺寸確認後取消 v2 的一律 Warning 路由。
            在開發集調整後凍結，再在盲測集重跑 {ai.apiCalls} 筆判定，花費 US${ai.spendUsd.toFixed(2)}。v2、v2.1 只在實驗流程實作，網站上的單張判定仍用規範 v1。<DocLink path="docs/spec/inspection-spec-v2.1.md">檢驗規範 v2.1</DocLink>
          </p>
          <ol className="small" style={{ margin: 0, paddingLeft: '1.4em', listStyle: 'decimal', display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ink-2)' }}>
            <li><b style={{ color: 'var(--ink)' }}>補「看得到」：</b>三位評估者不一致的多是有人看到、有人沒看到；改善偵出後要用另一組新的盲測集再驗，不能回頭用這 40 張。</li>
            <li><b style={{ color: 'var(--ink)' }}>重新驗證預警：</b>改管制圖規則或抽樣，確認預警能否比異常提早。</li>
            <li><b style={{ color: 'var(--ink)' }}>真實檢驗員：</b>3 位檢驗員 × 2 輪（隔天）重做人工基準，取代作者一人的對照。</li>
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
              <tr><td className="mono" style={{ fontWeight: 700 }}>P</td><td>痛點「有規範但判讀靠人眼：慢、會漏看」→ 程式可執行、有版本號的檢驗規範 v1，依一致性分析修訂為 v2、v2.1</td><td><DocLink path="docs/spec/inspection-spec-v1.md">規範 v1</DocLink>・<DocLink path="docs/spec/inspection-spec-v2.md">v2</DocLink>・<DocLink path="docs/spec/inspection-spec-v2.1.md">v2.1</DocLink>・<DocLink path="CONTEXT.md">領域詞彙</DocLink></td></tr>
              <tr><td className="mono" style={{ fontWeight: 700 }}>D</td><td>AI 只辨識、規則做判定，每筆判定附條文與版本</td><td><a href="#/inspect" onClick={e => { e.preventDefault(); onNavigate('inspect'); }}>單張判定</a>・<DocLink path="docs/adr/0001-verdict-derived-from-spec-not-ai.md">ADR-0001</DocLink></td></tr>
              <tr><td className="mono" style={{ fontWeight: 700 }}>C</td><td>人眼＋規範 vs AI＋規則對照、一致性分析（計數值 MSA；v1、v2 在開發集，v2.1 凍結後在盲測集，各兩次判定）＋ p 管制圖判異</td><td><DocLink path="experiment/results/msa-summary.md">MSA 摘要</DocLink>・<a href="#/control" onClick={e => { e.preventDefault(); onNavigate('control'); }}>管制看板</a></td></tr>
              <tr><td className="mono" style={{ fontWeight: 700 }}>A</td><td>預警／異常 → AI 草擬、人確認的異常處置單；依數據修訂 v2 → v2.1，凍結後才用新樣本盲測</td><td><a href="#/control" onClick={e => { e.preventDefault(); onNavigate('control'); }}>管制看板右欄</a>・<DocLink path="docs/rollout/導入計畫.xlsx">導入計畫</DocLink></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="small dim" style={{ marginTop: 40, maxWidth: '76ch' }}>
        情境與數據皆為模擬：痛點來自作者過去在產線看到的狀況；人工對照組為作者本人的真實判定；標準樣本（開發集與盲測集）為程序化底圖＋程式注入已知尺寸缺陷的半合成影像；
        管制圖的 25 批為統計模擬；規範中的允收數值為假設值，非業界標準。
      </p>
    </div>
  );
};

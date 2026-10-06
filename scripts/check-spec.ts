/**
 * Self-check for the spec-v1 rule engine and the p-chart signal rules.
 * No test framework — run with: npm run check:spec
 * (uses Node's built-in TypeScript type stripping)
 */
import {
  acceptanceScale,
  judgeDefect,
  judgeDie,
  parseDefectList,
  unparseableResult,
  type Defect,
  type Verdict,
} from '../src/features/inspection/spec/inspectionSpecV1.ts';
import { computeControlChart, type LotSummary } from '../src/features/control/spc.ts';
import { REFERENCE_SAMPLES, MSA_SUMMARY, HUMAN_SUMMARY, HUMAN_REPLIES } from '../src/features/samples/referenceData.ts';
import { laborReduction, laborScenario } from '../src/features/overview/laborModel.ts';

let failed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  → got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
}
const v = (...defects: Defect[]): Verdict => judgeDie(defects).verdict;

// §3 CHP 周邊區 + 邊界值（10 → Warning、25 → Warning、25.1 → Fail）
check('CHP peri 9.9 → pass', v({ code: 'CHP', zone: 'peripheral', depthUm: 9.9 }), 'pass');
check('CHP peri 10 → warning', v({ code: 'CHP', zone: 'peripheral', depthUm: 10 }), 'warning');
check('CHP peri 25 → warning', v({ code: 'CHP', zone: 'peripheral', depthUm: 25 }), 'warning');
check('CHP peri 25.1 → fail', v({ code: 'CHP', zone: 'peripheral', depthUm: 25.1 }), 'fail');
check('CHP peri touches seal ring → fail', v({ code: 'CHP', zone: 'peripheral', depthUm: 5, touchesSealRing: true }), 'fail');
check('CHP core → fail', v({ code: 'CHP', zone: 'core', depthUm: 5 }), 'fail');
check('CHP missing depth → warning', v({ code: 'CHP', zone: 'peripheral' }), 'warning');
// CRK
check('CRK peri → fail', v({ code: 'CRK', zone: 'peripheral' }), 'fail');
// SCR
check('SCR peri 299 → pass', v({ code: 'SCR', zone: 'peripheral', lengthUm: 299 }), 'pass');
check('SCR peri 300 → warning', v({ code: 'SCR', zone: 'peripheral', lengthUm: 300 }), 'warning');
check('SCR core 99 → pass', v({ code: 'SCR', zone: 'core', lengthUm: 99 }), 'pass');
check('SCR core 100 → warning', v({ code: 'SCR', zone: 'core', lengthUm: 100 }), 'warning');
check('SCR core 300 → warning', v({ code: 'SCR', zone: 'core', lengthUm: 300 }), 'warning');
check('SCR core 301 → fail', v({ code: 'SCR', zone: 'core', lengthUm: 301 }), 'fail');
check('SCR core crosses pad → fail', v({ code: 'SCR', zone: 'core', lengthUm: 50, crossesPad: true }), 'fail');
// CON
check('CON peri 49 → pass (不計)', v({ code: 'CON', zone: 'peripheral', diameterUm: 49 }), 'pass');
check('CON peri 50 → warning', v({ code: 'CON', zone: 'peripheral', diameterUm: 50 }), 'warning');
check('CON core 19 → pass (不計)', v({ code: 'CON', zone: 'core', diameterUm: 19 }), 'pass');
check('CON core 20 → warning (1 點)', v({ code: 'CON', zone: 'core', diameterUm: 20 }), 'warning');
check('CON core 50 → warning', v({ code: 'CON', zone: 'core', diameterUm: 50 }), 'warning');
check('CON core 51 → fail', v({ code: 'CON', zone: 'core', diameterUm: 51 }), 'fail');
const con = (d: number): Defect => ({ code: 'CON', zone: 'core', diameterUm: d });
check('CON core 2 點 → warning', v(con(25), con(30)), 'warning');
check('CON core 3 點 → fail', v(con(25), con(30), con(22)), 'fail');
check('CON core 2 點 + 1 不計 → warning', v(con(25), con(30), con(10)), 'warning');
// §4 合併
check('no defects → pass', v(), 'pass');
check('worst wins', v({ code: 'SCR', zone: 'peripheral', lengthUm: 10 }, { code: 'CHP', zone: 'peripheral', depthUm: 12 }), 'warning');
check('per-defect verdicts kept', judgeDie([{ code: 'SCR', zone: 'peripheral', lengthUm: 10 }, { code: 'CRK', zone: 'core' }]).defects.map(d => d.verdict), ['pass', 'fail']);
check('specVersion', judgeDie([]).specVersion, 'v1');
// parsing
check('parse {defects:[]}', parseDefectList({ defects: [] }), []);
check('parse bare array', parseDefectList([{ code: 'CRK', zone: 'core' }])?.length, 1);
check('parse bad code → null', parseDefectList({ defects: [{ code: 'XXX', zone: 'core' }] }), null);
check('parse bad zone → null', parseDefectList({ defects: [{ code: 'CRK', zone: 'edge' }] }), null);
check('parse negative → null', parseDefectList({ defects: [{ code: 'CHP', zone: 'peripheral', depthUm: -1 }] }), null);
check('parse string number → null', parseDefectList({ defects: [{ code: 'CHP', zone: 'peripheral', depthUm: '12' }] }), null);
check('unparseable → warning, no confidence', [unparseableResult().verdict, unparseableResult().reason, 'confidence' in unparseableResult()], ['warning', 'AI 回覆無法解析，送人工複判', false]);

// p chart
const lot = (i: number, fail: number, n = 50): LotSummary => ({
  lotId: `L${i}`, n, pass: n - fail, warning: 0, fail, defectCounts: { CHP: 0, CRK: 0, SCR: 0, CON: 0 },
});
const base = [2, 1, 3, 2, 2, 1, 2, 3, 2, 1, 2, 2, 3, 2];
const mk = (tail: number[]) => [...base, ...tail].map((f, i) => lot(i + 1, f));
let c = computeControlChart(mk([]));
check('p̄ = 28/700', c.centerLine, 0.04);
check('phase I has no signals', c.points.filter(p => p.signal).length, 0);
c = computeControlChart(mk([7]));
check('7/50 > UCL → 異常', c.points[14].signal, 'outOfControl');
c = computeControlChart(mk([5, 5]));
check('2 of 3 beyond 2σ → 預警', [c.points[14].signal, c.points[15].signal], [null, 'warningSignal']);
c = computeControlChart([...[2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], 0, 1, 2, 3, 4, 5, 6].map((f, i) => lot(i + 1, f, 200)));
check('7 consecutive rising → 預警', c.points[20].rulesFired.includes('連續 7 點上升'), true);
check('6 rising is not enough', c.points[19].rulesFired.includes('連續 7 點上升'), false);

// 允收標準刻度（顯示用）必須與 judgeDefect 一致：每段區間內的值判定為該段的判定
const scaled: Defect[] = [
  { code: 'CHP', zone: 'peripheral', depthUm: 0 },
  { code: 'SCR', zone: 'core', lengthUm: 0 },
  { code: 'SCR', zone: 'peripheral', lengthUm: 0 },
  { code: 'CON', zone: 'core', diameterUm: 0 },
  { code: 'CON', zone: 'peripheral', diameterUm: 0 },
];
for (const d of scaled) {
  for (const band of acceptanceScale({ ...d, depthUm: d.depthUm !== undefined ? 1 : undefined, lengthUm: d.lengthUm !== undefined ? 1 : undefined, diameterUm: d.diameterUm !== undefined ? 1 : undefined })!.bands) {
    const probes = [band.from + 0.01, band.to === null ? band.from + 1000 : band.to - 0.01];
    for (const value of probes) {
      const key = d.code === 'CHP' ? 'depthUm' : d.code === 'SCR' ? 'lengthUm' : 'diameterUm';
      check(`scale ${d.code} ${d.zone} ${value.toFixed(2)} µm → ${band.verdict}`, judgeDefect({ ...d, [key]: value }).verdict, band.verdict);
    }
  }
}
check('scale null for CHP core', acceptanceScale({ code: 'CHP', zone: 'core', depthUm: 5 }), null);
check('scale null for SCR crossing pad', acceptanceScale({ code: 'SCR', zone: 'core', lengthUm: 50, crossesPad: true }), null);
check('scale null for CRK', acceptanceScale({ code: 'CRK', zone: 'peripheral' }), null);

// 標準樣本集：標準答案缺陷經規則引擎推導，應得 reference.json 的標準答案判定
const strip = (d: Defect & { location?: unknown }): Defect => {
  const copy = { ...d };
  delete copy.location;
  return copy;
};
const refMismatch = REFERENCE_SAMPLES.filter(s => judgeDie(s.defects.map(strip)).verdict !== s.referenceVerdict).map(s => s.id);
check('40 reference samples derive their reference verdict', [REFERENCE_SAMPLES.length, refMismatch], [40, []]);

// 錄下的 AI 回覆：前端規則引擎 (TS) 與實驗用 spec_v1.py 推導的判定一致
const tsVerdict = (defects: unknown[] | null): Verdict => {
  const parsed = defects === null ? null : parseDefectList(defects);
  return parsed ? judgeDie(parsed).verdict : 'warning';
};
const replies = REFERENCE_SAMPLES.flatMap(s => s.recorded.map(r => ({ s, r, ts: tsVerdict(r.defects) })));
const engineMismatch = replies.filter(x => x.r.pyVerdict !== null && x.r.pyVerdict !== x.ts).map(x => `${x.s.id}/${x.r.appraiser}: ts=${x.ts} py=${x.r.pyVerdict}`);
check('120 recorded replies: TS engine agrees with spec_v1.py', [replies.length, engineMismatch], [120, []]);

// 總覽頁引用的改善後漏判率，可由錄下的回覆重算
const refFail = replies.filter(x => x.s.referenceVerdict === 'fail');
const missed = refFail.filter(x => x.ts === 'pass').length;
check('after-condition miss rate recomputes from recorded replies', missed / refFail.length, MSA_SUMMARY.after.missRate);

// 作者本人兩輪判定：前端規則引擎對人工回報的推導，與 spec_v1.py 一致；總覽引用的數字可重算
if (HUMAN_SUMMARY) {
  const engineMismatchHuman = HUMAN_REPLIES
    .filter(h => judgeDie(h.defects).verdict !== h.pyRuleVerdict)
    .map(h => `${h.sample}/R${h.round}: ts=${judgeDie(h.defects).verdict} py=${h.pyRuleVerdict}`);
  check('human replies: TS engine agrees with spec_v1.py', engineMismatchHuman, []);
  const refOf = Object.fromEntries(REFERENCE_SAMPLES.map(s => [s.id, s.referenceVerdict]));
  const hit = (v: (h: (typeof HUMAN_REPLIES)[number]) => Verdict) => HUMAN_REPLIES.filter(h => v(h) === refOf[h.sample]).length / HUMAN_REPLIES.length;
  const r1 = (x: number) => Math.round(x * 1000) / 1000;
  check('human combined accuracy (own, eye+rules) recomputes', [r1(hit(h => h.ownVerdict)), r1(hit(h => judgeDie(h.defects).verdict))],
    [r1(HUMAN_SUMMARY.combined.own.accuracy), r1(HUMAN_SUMMARY.combined.rules.accuracy)]);
  check('human seconds per die = total minutes ÷ judgments', Math.round(HUMAN_SUMMARY.roundMinutes.reduce((a, b) => a + b, 0) * 600 / HUMAN_REPLIES.length) / 10, HUMAN_SUMMARY.secondsPerDie);
}

// 工時／產能換算（總覽頁與簡報共用的數字）
{
  const before = MSA_SUMMARY.before.warningRate;
  const after = MSA_SUMMARY.after.warningRate;
  const s30 = laborScenario(30, before, after);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  check('labor: standard time 30 s × 1.15 = 34.5 s', s30.standardSeconds, 34.5);
  check('labor: per-1000 re-judgment minutes at 30 s (before → after)', [r1(s30.per1000Minutes.before), r1(s30.per1000Minutes.after)], [244.4, 134.2]);
  check('labor: dies per 8 h shift at 30 s (before → after)', [Math.round(s30.diesPerShift.before), Math.round(s30.diesPerShift.after)], [1964, 3578]);
  check('labor: reduction is independent of seconds', r1(laborReduction(before, after) * 100), r1((1 - laborScenario(15, before, after).per1000Minutes.after / laborScenario(15, before, after).per1000Minutes.before) * 100));
  check('labor: per-lot re-judged dies (50 per lot) 21 → 12', [Math.round(50 * before), Math.round(50 * after)], [21, 12]);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
if (failed) process.exitCode = 1;

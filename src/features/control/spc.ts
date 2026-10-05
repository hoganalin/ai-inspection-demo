/**
 * p 管制圖與判異規則（數據化管理與預警）。純函式、無相依，方便自我檢查。
 *
 * - 中心線 p̄ 與 ±3σ 管制界限由第一階段（Phase I，預設前 14 批）估計。
 * - 每批依自己的 n 計算界限：σᵢ = √(p̄(1−p̄)/nᵢ)。
 * - 異常 (Out of Control)：pᵢ > UCLᵢ。
 * - 預警 (Warning Signal)：未超出 UCL，但符合
 *     ① 連續 7 點上升，或
 *     ② 3 點中 2 點落在同側 2σ 以外。
 */

export type DefectClassKey = 'CHP' | 'CRK' | 'SCR' | 'CON';
export type DefectCounts = Record<DefectClassKey, number>;
export const DEFECT_KEYS: readonly DefectClassKey[] = ['CHP', 'CRK', 'SCR', 'CON'];

/** 一批的彙總（lots.json 的一列；批紀錄也轉成同一形狀）。 */
export interface LotSummary {
  lotId: string;
  n: number;
  pass: number;
  warning: number;
  fail: number;
  defectCounts: DefectCounts;
}

export type LotSignal = 'outOfControl' | 'warningSignal';

export interface ChartPoint {
  index: number;
  lotId: string;
  n: number;
  fail: number;
  /** 批不良率 = fail / n */
  p: number;
  ucl: number;
  lcl: number;
  sigma: number;
  /** (p − p̄) / σᵢ */
  z: number;
  phase: 'I' | 'II';
  signal: LotSignal | null;
  rulesFired: string[];
}

export interface ControlChart {
  centerLine: number;
  phaseICount: number;
  points: ChartPoint[];
}

export const RULE_TEXT = {
  aboveUcl: '超出管制上限 UCL',
  sevenUp: '連續 7 點上升',
  twoOfThree: '3 點中 2 點超過 2σ（同側）',
} as const;

export const SIGNAL_LABEL: Record<LotSignal, string> = {
  outOfControl: '異常',
  warningSignal: '預警',
};

export function lotDefectRate(lot: Pick<LotSummary, 'n' | 'fail'>): number {
  return lot.n > 0 ? lot.fail / lot.n : 0;
}

export function computeControlChart(lots: LotSummary[], phaseICount = 14): ControlChart {
  const valid = lots.filter(l => l.n > 0);
  const phaseI = valid.slice(0, Math.min(phaseICount, valid.length));
  const sumN = phaseI.reduce((s, l) => s + l.n, 0);
  const sumFail = phaseI.reduce((s, l) => s + l.fail, 0);
  const pBar = sumN > 0 ? sumFail / sumN : 0;

  const points: ChartPoint[] = valid.map((l, index) => {
    const p = lotDefectRate(l);
    const sigma = Math.sqrt((pBar * (1 - pBar)) / l.n);
    const z = sigma > 0 ? (p - pBar) / sigma : 0;
    return {
      index,
      lotId: l.lotId,
      n: l.n,
      fail: l.fail,
      p,
      ucl: Math.min(1, pBar + 3 * sigma),
      lcl: Math.max(0, pBar - 3 * sigma),
      sigma,
      z,
      phase: index < phaseI.length ? 'I' : 'II',
      signal: null,
      rulesFired: [],
    };
  });

  points.forEach((pt, i) => {
    const rules: string[] = [];
    if (pt.p > pt.ucl) rules.push(RULE_TEXT.aboveUcl);

    if (i >= 6) {
      let rising = true;
      for (let k = i - 5; k <= i; k++) {
        if (!(points[k].p > points[k - 1].p)) { rising = false; break; }
      }
      if (rising) rules.push(RULE_TEXT.sevenUp);
    }

    if (i >= 2) {
      const win = points.slice(i - 2, i + 1);
      const above = win.filter(w => w.z > 2).length;
      const below = win.filter(w => w.z < -2).length;
      if ((pt.z > 2 && above >= 2) || (pt.z < -2 && below >= 2)) rules.push(RULE_TEXT.twoOfThree);
    }

    pt.rulesFired = rules;
    pt.signal = rules.includes(RULE_TEXT.aboveUcl)
      ? 'outOfControl'
      : rules.length > 0
        ? 'warningSignal'
        : null;
  });

  return { centerLine: pBar, phaseICount: phaseI.length, points };
}

/* ─── 柏拉圖：基準期 vs 近期 ───────────────────── */

export interface ParetoRow {
  code: DefectClassKey;
  baselineCount: number;
  recentCount: number;
  /** 每 100 顆的缺陷數（兩個窗口批數不同，用率比較） */
  baselineRate: number;
  recentRate: number;
  /** 近期該類佔全部缺陷的比例 */
  recentShare: number;
  /** 近期依 recentRate 排序後的累積比例 */
  recentCumShare: number;
}

export interface ParetoComparison {
  baselineLots: string[];
  recentLots: string[];
  rows: ParetoRow[];
  /** 近期比基準期增加最多的缺陷分類 */
  topShift: { code: DefectClassKey; deltaRate: number } | null;
}

function sumCounts(lots: LotSummary[]): { counts: DefectCounts; n: number } {
  const counts: DefectCounts = { CHP: 0, CRK: 0, SCR: 0, CON: 0 };
  let n = 0;
  for (const l of lots) {
    n += l.n;
    for (const k of DEFECT_KEYS) counts[k] += l.defectCounts[k] ?? 0;
  }
  return { counts, n };
}

export function compareParetos(baseline: LotSummary[], recent: LotSummary[]): ParetoComparison {
  const b = sumCounts(baseline);
  const r = sumCounts(recent);
  const recentTotal = DEFECT_KEYS.reduce((s, k) => s + r.counts[k], 0);

  const rows = DEFECT_KEYS.map<ParetoRow>(code => ({
    code,
    baselineCount: b.counts[code],
    recentCount: r.counts[code],
    baselineRate: b.n > 0 ? (b.counts[code] / b.n) * 100 : 0,
    recentRate: r.n > 0 ? (r.counts[code] / r.n) * 100 : 0,
    recentShare: recentTotal > 0 ? r.counts[code] / recentTotal : 0,
    recentCumShare: 0,
  })).sort((x, y) => y.recentRate - x.recentRate || y.baselineRate - x.baselineRate);

  let cum = 0;
  for (const row of rows) {
    cum += row.recentShare;
    row.recentCumShare = cum;
  }

  const shifts = rows
    .map(row => ({ code: row.code, deltaRate: row.recentRate - row.baselineRate }))
    .sort((x, y) => y.deltaRate - x.deltaRate);
  const topShift = shifts[0] && shifts[0].deltaRate > 0 ? shifts[0] : null;

  return {
    baselineLots: baseline.map(l => l.lotId),
    recentLots: recent.map(l => l.lotId),
    rows,
    topShift,
  };
}

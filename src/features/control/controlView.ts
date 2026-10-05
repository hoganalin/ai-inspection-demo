import { compareParetos, computeControlChart, SIGNAL_LABEL } from './spc';
import type { ControlChart, ParetoComparison, LotSummary } from './spc';
import type { ChartLot, LotSignalContext, LotsDataset } from './types';

export const PHASE_I_LOTS = 14;
export const RECENT_WINDOW = 5;

export interface ControlView {
  lots: ChartLot[];
  chart: ControlChart;
  /** 基準期（Phase I）vs 最近 RECENT_WINDOW 批 */
  pareto: ParetoComparison;
  /** 有預警或異常的批（依批序） */
  signals: LotSignalContext[];
}

function paretoFor(lots: ChartLot[], phaseICount: number, endIndex: number): ParetoComparison {
  const baseline = lots.slice(0, phaseICount);
  const recent = lots.slice(Math.max(phaseICount, endIndex - RECENT_WINDOW + 1), endIndex + 1);
  return compareParetos(baseline, recent.length ? recent : lots.slice(-RECENT_WINDOW));
}

const fmtLots = (ids: string[]) => (ids.length > 1 ? `${ids[0]}–${ids[ids.length - 1]}` : ids[0] ?? '—');

/** 模擬批（lots.json）＋批紀錄的實測批 → 管制圖、柏拉圖與訊號清單。 */
export function buildControlView(dataset: LotsDataset, liveLots: LotSummary[]): ControlView {
  const lots: ChartLot[] = [
    ...dataset.lots.map(l => ({ ...l, source: 'simulated' as const })),
    ...liveLots.filter(l => l.n > 0).map(l => ({ ...l, source: 'live' as const })),
  ];
  const chart = computeControlChart(lots, PHASE_I_LOTS);
  const pareto = paretoFor(lots, chart.phaseICount, lots.length - 1);

  const signals: LotSignalContext[] = chart.points
    .filter(pt => pt.signal)
    .map(pt => {
      const pz = paretoFor(lots, chart.phaseICount, pt.index);
      return {
        lotId: pt.lotId,
        source: lots[pt.index].source,
        signal: pt.signal!,
        signalLabel: SIGNAL_LABEL[pt.signal!],
        rulesFired: pt.rulesFired,
        n: pt.n,
        fail: pt.fail,
        p: pt.p,
        centerLine: chart.centerLine,
        ucl: pt.ucl,
        lcl: pt.lcl,
        recentTrend: chart.points
          .slice(Math.max(0, pt.index - 6), pt.index + 1)
          .map(q => ({ lotId: q.lotId, p: q.p })),
        pareto: {
          baselineLots: fmtLots(pz.baselineLots),
          recentLots: fmtLots(pz.recentLots),
          rows: pz.rows.map(r => ({ code: r.code, baselineRate: r.baselineRate, recentRate: r.recentRate })),
          topShift: pz.topShift,
        },
      };
    });

  return { lots, chart, pareto, signals };
}

export { fmtLots };

import type { LotSummary } from './spc';

/** public/data/lots.json 的 schema（統計模擬批）。 */
export interface LotsDataset {
  specVersion: string;
  scenario: string;
  simulated: boolean;
  judgementErrorRates: { miss: number; falseCall: number };
  lots: LotSummary[];
}

/** 管制圖上的一批：模擬批（lots.json）或批紀錄中的實測批。 */
export interface ChartLot extends LotSummary {
  source: 'simulated' | 'live';
}

/** 送去草擬異常處置單的批脈絡。 */
export interface LotSignalContext {
  lotId: string;
  source: 'simulated' | 'live';
  signal: 'outOfControl' | 'warningSignal';
  signalLabel: string;
  rulesFired: string[];
  n: number;
  fail: number;
  p: number;
  centerLine: number;
  ucl: number;
  lcl: number;
  /** 近幾批的 p 值走勢（含本批），例：[{lotId:'L18', p:0.08}, ...] */
  recentTrend: { lotId: string; p: number }[];
  pareto: {
    baselineLots: string;
    recentLots: string;
    rows: { code: string; baselineRate: number; recentRate: number }[];
    topShift: { code: string; deltaRate: number } | null;
  };
}

import type { LotsDataset } from '../types';

/**
 * 內建備援資料集（模擬）——僅在 public/data/lots.json 不存在或格式不符時使用。
 *
 * 與 lots.json 同 schema：25 批 × 50 顆。L01–L14 為穩定期（Phase I，批不良率約 4%），
 * 自 L15 起注入漂移情境：CHP 崩角逐批上升（模擬切割刀磨耗）。
 * 數字為手工設定的示意值，漏判／誤判率為假設值，非一致性分析量測結果。
 */

// index 0 = L01
const FAIL = [2, 1, 3, 2, 2, 1, 2, 3, 2, 1, 2, 2, 3, 2, /* drift → */ 2, 3, 4, 4, 5, 5, 6, 7, 8, 8, 9];
const WARN = [2, 3, 2, 2, 1, 3, 2, 2, 3, 2, 2, 3, 2, 2, /* drift → */ 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6];
const CHP = [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, /* drift → */ 2, 3, 4, 5, 6, 6, 8, 9, 10, 11, 12];
const CRK = [0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, /* drift → */ 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0];
const SCR = [2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 1, 2, 1, 2, /* drift → */ 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1];
const CON = [1, 2, 1, 2, 1, 1, 2, 1, 2, 1, 2, 2, 2, 1, /* drift → */ 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2];

const N = 50;

export const FALLBACK_LOTS: LotsDataset = {
  specVersion: 'v1',
  scenario: '內建備援資料（模擬）：L01–L14 穩定期；自 L15 起 CHP 崩角逐批上升，模擬切割刀磨耗。',
  simulated: true,
  judgementErrorRates: { miss: 0.02, falseCall: 0.03 },
  lots: FAIL.map((fail, i) => ({
    lotId: `L${String(i + 1).padStart(2, '0')}`,
    n: N,
    pass: N - fail - WARN[i],
    warning: WARN[i],
    fail,
    defectCounts: { CHP: CHP[i], CRK: CRK[i], SCR: SCR[i], CON: CON[i] },
  })),
};

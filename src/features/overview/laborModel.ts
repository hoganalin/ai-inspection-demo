/**
 * 複判工時與檢驗站產能換算（純函式、無相依，供總覽頁與 scripts/check-spec.ts 共用）。
 *
 * 標準工時＝單顆複判時間 ×（1＋寬放率）
 * 每千顆複判工時＝1,000 × 人工複判率 × 標準工時
 * 一位複判人員每班可支援晶粒數＝每班秒數 ÷（人工複判率 × 標準工時）
 *
 * 單顆複判時間與寬放率沒有實測紀錄，皆為假設值，以多個情境做敏感度分析。
 */

/** 單顆複判時間情境（秒，假設值）。 */
export const RECHECK_SECONDS = [15, 30, 60] as const;

/** 寬放率（假設值）：疲勞、私事與作業延遲的時間寬放。 */
export const ALLOWANCE = 0.15;

/** 每班工作時間（分鐘）。 */
export const SHIFT_MINUTES = 480;

export interface LaborScenario {
  /** 單顆複判時間（秒） */
  seconds: number;
  /** 標準工時（秒）＝單顆複判時間 ×（1＋寬放率） */
  standardSeconds: number;
  /** 每千顆晶粒的複判工時（分鐘） */
  per1000Minutes: { before: number; after: number };
  /** 一位複判人員每班可支援的晶粒數 */
  diesPerShift: { before: number; after: number };
}

/** 依改善前後的人工複判率，換算一個單顆複判時間情境。 */
export function laborScenario(
  seconds: number,
  warningRateBefore: number,
  warningRateAfter: number,
  allowance = ALLOWANCE,
  shiftMinutes = SHIFT_MINUTES,
): LaborScenario {
  const standardSeconds = seconds * (1 + allowance);
  const per1000 = (rate: number) => (1000 * rate * standardSeconds) / 60;
  const perShift = (rate: number) => (shiftMinutes * 60) / (rate * standardSeconds);
  return {
    seconds,
    standardSeconds,
    per1000Minutes: { before: per1000(warningRateBefore), after: per1000(warningRateAfter) },
    diesPerShift: { before: perShift(warningRateBefore), after: perShift(warningRateAfter) },
  };
}

/** 複判工時的相對降幅（與單顆複判時間無關）。 */
export const laborReduction = (warningRateBefore: number, warningRateAfter: number) =>
  1 - warningRateAfter / warningRateBefore;

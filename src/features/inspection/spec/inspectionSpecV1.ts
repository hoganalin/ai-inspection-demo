/**
 * 檢驗規範 v1（Inspection Spec v1）— spec as code.
 *
 * Source of truth: docs/spec/inspection-spec-v1.md
 * Decision: docs/adr/0001-verdict-derived-from-spec-not-ai.md
 *   AI 只回報缺陷清單；判定 (Verdict) 由本檔依允收標準推導。
 *
 * This module is imported by BOTH the browser bundle (src/) and the serverless
 * function (api/inspect.ts). Keep it dependency-free: no relative imports, no
 * DOM / Node APIs, no enums (erasableSyntaxOnly).
 */

export const SPEC_VERSION = 'v1' as const;
export type SpecVersion = typeof SPEC_VERSION;

/* ─── 晶粒幾何（§1）──────────────────────────── */
export const DIE_GEOMETRY = {
  dieSizeUm: 5000,
  imagePx: 1000,
  umPerPx: 5,
  /** 周邊區：晶粒邊緣至 seal ring 外緣 */
  peripheralMaxUm: 100,
  /** seal ring：距邊緣 100–120 µm */
  sealRingFromUm: 100,
  sealRingToUm: 120,
  /** pad：80 × 80 µm，距邊緣 200 µm */
  padSizeUm: 80,
  padFromEdgeUm: 200,
} as const;

/* ─── 領域型別 ─────────────────────────────── */
export type Verdict = 'pass' | 'warning' | 'fail';
export type DefectClass = 'CHP' | 'CRK' | 'SCR' | 'CON';
export type InspectionZone = 'core' | 'peripheral';

export const DEFECT_CLASSES: readonly DefectClass[] = ['CHP', 'CRK', 'SCR', 'CON'];
export const INSPECTION_ZONES: readonly InspectionZone[] = ['core', 'peripheral'];

/** AI 回報的一筆缺陷（只有分類、區域與量測，不含判定）。 */
export interface Defect {
  code: DefectClass;
  zone: InspectionZone;
  /** CHP：自晶粒邊緣向內的最大深度 */
  depthUm?: number;
  /** SCR：長度 */
  lengthUm?: number;
  /** CON：單點直徑 */
  diameterUm?: number;
  /** SCR：是否經過 pad */
  crossesPad?: boolean;
  /** CHP：是否觸及 seal ring */
  touchesSealRing?: boolean;
}

/** 單一缺陷依允收標準推導出的判定與依據。 */
export interface DefectJudgement {
  defect: Defect;
  verdict: Verdict;
  /** 觸發的允收標準條文（人讀得懂的推導依據） */
  rule: string;
}

/** 一顆晶粒的判定結果（/api/inspect 的回應主體）。 */
export interface InspectionResult {
  verdict: Verdict;
  /** 整體判定的依據（取最嚴重者的條文，或解析失敗原因） */
  reason: string;
  defects: DefectJudgement[];
  specVersion: SpecVersion;
  analyzedAt: string;
  /** AI 回覆無法解析時為 true（判定固定為 Warning，送人工複判） */
  unparseable?: boolean;
}

/* ─── 顯示用標籤 ───────────────────────────── */
export const DEFECT_CLASS_LABEL: Record<DefectClass, { cn: string; en: string }> = {
  CHP: { cn: '崩角', en: 'Edge chipping' },
  CRK: { cn: '裂紋', en: 'Crack' },
  SCR: { cn: '刮傷', en: 'Scratch' },
  CON: { cn: '污染／異物', en: 'Contamination' },
};

export const ZONE_LABEL: Record<InspectionZone, string> = {
  core: '核心區',
  peripheral: '周邊區',
};

export const VERDICT_LABEL: Record<Verdict, { name: string; meaning: string; action: string }> = {
  pass: { name: 'Pass', meaning: '符合允收標準', action: '放行' },
  warning: { name: 'Warning', meaning: '落在灰色地帶', action: '送人工複判' },
  fail: { name: 'Fail', meaning: '不符允收標準', action: '退件' },
};

const SEVERITY: Record<Verdict, number> = { pass: 0, warning: 1, fail: 2 };

export function worstVerdict(verdicts: Verdict[]): Verdict {
  return verdicts.reduce<Verdict>((w, v) => (SEVERITY[v] > SEVERITY[w] ? v : w), 'pass');
}

export const UNPARSEABLE_REASON = 'AI 回覆無法解析，送人工複判';
export const NO_DEFECT_REASON = '無缺陷 → Pass（§4 合併規則）';

/* ─── 允收標準（§3）────────────────────────── */
// 邊界值歸屬依規範 §3 例示：區間下限含；上限值本身仍屬該區間
// （CHP 周邊區 10 µm → Warning、25 µm → Warning、25.1 µm → Fail）。

const MISSING = (what: string) => `${what}缺少量測值，無法套用允收標準 → Warning（送人工複判）`;

function judgeCHP(d: Defect): { verdict: Verdict; rule: string } {
  if (d.zone === 'core') return { verdict: 'fail', rule: 'CHP 核心區：延伸進核心區 → Fail' };
  if (d.touchesSealRing) return { verdict: 'fail', rule: 'CHP 周邊區：觸及 seal ring → Fail' };
  const v = d.depthUm;
  if (v === undefined) return { verdict: 'warning', rule: MISSING('CHP 深度') };
  if (v < 10) return { verdict: 'pass', rule: 'CHP 周邊區：深度 < 10 µm → Pass' };
  if (v <= 25) return { verdict: 'warning', rule: 'CHP 周邊區：深度 10–25 µm → Warning' };
  return { verdict: 'fail', rule: 'CHP 周邊區：深度 > 25 µm → Fail' };
}

function judgeCRK(d: Defect): { verdict: Verdict; rule: string } {
  return { verdict: 'fail', rule: `CRK ${ZONE_LABEL[d.zone]}：任何裂紋 → Fail` };
}

function judgeSCR(d: Defect): { verdict: Verdict; rule: string } {
  const v = d.lengthUm;
  if (d.zone === 'peripheral') {
    if (v === undefined) return { verdict: 'warning', rule: MISSING('SCR 長度') };
    if (v < 300) return { verdict: 'pass', rule: 'SCR 周邊區：長度 < 300 µm → Pass' };
    return { verdict: 'warning', rule: 'SCR 周邊區：長度 ≥ 300 µm → Warning' };
  }
  if (d.crossesPad) return { verdict: 'fail', rule: 'SCR 核心區：經過 pad → Fail' };
  if (v === undefined) return { verdict: 'warning', rule: MISSING('SCR 長度') };
  if (v < 100) return { verdict: 'pass', rule: 'SCR 核心區：長度 < 100 µm → Pass' };
  if (v <= 300) return { verdict: 'warning', rule: 'SCR 核心區：長度 100–300 µm → Warning' };
  return { verdict: 'fail', rule: 'SCR 核心區：長度 > 300 µm → Fail' };
}

/** CON 單點判定（核心區點數合併規則在 judgeDie 處理）。 */
function judgeCONPoint(d: Defect): { verdict: Verdict; rule: string; countsAsCorePoint: boolean } {
  const v = d.diameterUm;
  if (v === undefined) return { verdict: 'warning', rule: MISSING('CON 直徑'), countsAsCorePoint: false };
  if (d.zone === 'peripheral') {
    if (v < 50) return { verdict: 'pass', rule: 'CON 周邊區：單點 < 50 µm → 不計', countsAsCorePoint: false };
    return { verdict: 'warning', rule: 'CON 周邊區：單點 ≥ 50 µm → Warning', countsAsCorePoint: false };
  }
  if (v < 20) return { verdict: 'pass', rule: 'CON 核心區：單點 < 20 µm → 不計', countsAsCorePoint: false };
  if (v > 50) return { verdict: 'fail', rule: 'CON 核心區：單點 > 50 µm → Fail', countsAsCorePoint: true };
  return { verdict: 'warning', rule: 'CON 核心區：單點 ≥ 20 µm 計 1 點（1–2 點 → Warning）', countsAsCorePoint: true };
}

export function judgeDefect(d: Defect): { verdict: Verdict; rule: string } {
  switch (d.code) {
    case 'CHP': return judgeCHP(d);
    case 'CRK': return judgeCRK(d);
    case 'SCR': return judgeSCR(d);
    case 'CON': {
      const { verdict, rule } = judgeCONPoint(d);
      return { verdict, rule };
    }
  }
}

/* ─── 允收標準的量測刻度（顯示用）──────────────── */

/** 一段量測區間對應的單點判定；`to` 為 null 表示無上限。 */
export interface AcceptanceBand {
  from: number;
  to: number | null;
  verdict: Verdict;
}

/** 依真實比例畫出量測值與允收界限用。判定仍以 judgeDefect／judgeDie 為準。 */
export interface AcceptanceScale {
  measure: '深度' | '長度' | '直徑';
  value: number;
  bands: AcceptanceBand[];
}

/**
 * 缺陷的量測刻度（§3 的數值界限）。條件型條文（CHP 進入核心區、觸及 seal ring、
 * SCR 經過 pad、任何 CRK）或缺少量測值時回傳 null。
 * 與 judgeDefect 的一致性由 scripts/check-spec.ts 驗證。
 */
export function acceptanceScale(d: Defect): AcceptanceScale | null {
  switch (d.code) {
    case 'CHP':
      if (d.zone === 'core' || d.touchesSealRing || d.depthUm === undefined) return null;
      return {
        measure: '深度', value: d.depthUm,
        bands: [{ from: 0, to: 10, verdict: 'pass' }, { from: 10, to: 25, verdict: 'warning' }, { from: 25, to: null, verdict: 'fail' }],
      };
    case 'SCR':
      if (d.lengthUm === undefined) return null;
      if (d.zone === 'peripheral') {
        return { measure: '長度', value: d.lengthUm, bands: [{ from: 0, to: 300, verdict: 'pass' }, { from: 300, to: null, verdict: 'warning' }] };
      }
      if (d.crossesPad) return null;
      return {
        measure: '長度', value: d.lengthUm,
        bands: [{ from: 0, to: 100, verdict: 'pass' }, { from: 100, to: 300, verdict: 'warning' }, { from: 300, to: null, verdict: 'fail' }],
      };
    case 'CON':
      if (d.diameterUm === undefined) return null;
      if (d.zone === 'peripheral') {
        return { measure: '直徑', value: d.diameterUm, bands: [{ from: 0, to: 50, verdict: 'pass' }, { from: 50, to: null, verdict: 'warning' }] };
      }
      return {
        measure: '直徑', value: d.diameterUm,
        bands: [{ from: 0, to: 20, verdict: 'pass' }, { from: 20, to: 50, verdict: 'warning' }, { from: 50, to: null, verdict: 'fail' }],
      };
    case 'CRK':
      return null;
  }
}

/** 依規範 v1 推導一顆晶粒的判定：逐缺陷判定 → 核心區 CON 點數合併 → 取最嚴重者。 */
export function judgeDie(defects: Defect[], analyzedAt = new Date().toISOString()): InspectionResult {
  const judgements: DefectJudgement[] = [];
  const corePointIdx: number[] = [];

  defects.forEach((defect, i) => {
    if (defect.code === 'CON') {
      const r = judgeCONPoint(defect);
      if (r.countsAsCorePoint) corePointIdx.push(i);
      judgements.push({ defect, verdict: r.verdict, rule: r.rule });
    } else {
      judgements.push({ defect, ...judgeDefect(defect) });
    }
  });

  // 核心區 CON：≥ 3 點 → Fail（套用到每一個被計點的缺陷）
  if (corePointIdx.length >= 3) {
    for (const i of corePointIdx) {
      const j = judgements[i];
      if (j.verdict !== 'fail') {
        judgements[i] = {
          ...j,
          verdict: 'fail',
          rule: `CON 核心區：計 ${corePointIdx.length} 點（≥ 3 點 → Fail）`,
        };
      }
    }
  }

  if (judgements.length === 0) {
    return { verdict: 'pass', reason: NO_DEFECT_REASON, defects: [], specVersion: SPEC_VERSION, analyzedAt };
  }

  const verdict = worstVerdict(judgements.map(j => j.verdict));
  const fired = Array.from(new Set(judgements.filter(j => j.verdict === verdict).map(j => j.rule)));
  return {
    verdict,
    reason: `取最嚴重者（§4）：${fired.join('；')}`,
    defects: judgements,
    specVersion: SPEC_VERSION,
    analyzedAt,
  };
}

/** AI 回覆無法解析時的判定：Warning，送人工複判。不捏造任何量測或信心度。 */
export function unparseableResult(analyzedAt = new Date().toISOString()): InspectionResult {
  return {
    verdict: 'warning',
    reason: UNPARSEABLE_REASON,
    defects: [],
    specVersion: SPEC_VERSION,
    analyzedAt,
    unparseable: true,
  };
}

/* ─── AI 回覆驗證 ─────────────────────────── */

function optNumber(v: unknown): number | undefined | 'invalid' {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return 'invalid';
  return v;
}

function optBool(v: unknown): boolean | undefined | 'invalid' {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'boolean') return 'invalid';
  return v;
}

/**
 * 驗證 AI 回傳的缺陷清單。接受 `{ "defects": [...] }` 或直接一個陣列。
 * 任何一筆不符合 schema 就整份視為無法解析（寧可送人工複判，也不猜）。
 */
export function parseDefectList(raw: unknown): Defect[] | null {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { defects?: unknown }).defects)
      ? (raw as { defects: unknown[] }).defects
      : null;
  if (!list) return null;

  const out: Defect[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') return null;
    const o = item as Record<string, unknown>;
    if (!DEFECT_CLASSES.includes(o.code as DefectClass)) return null;
    if (!INSPECTION_ZONES.includes(o.zone as InspectionZone)) return null;
    const depthUm = optNumber(o.depthUm);
    const lengthUm = optNumber(o.lengthUm);
    const diameterUm = optNumber(o.diameterUm);
    const crossesPad = optBool(o.crossesPad);
    const touchesSealRing = optBool(o.touchesSealRing);
    if ([depthUm, lengthUm, diameterUm, crossesPad, touchesSealRing].includes('invalid')) return null;

    const d: Defect = { code: o.code as DefectClass, zone: o.zone as InspectionZone };
    if (depthUm !== undefined) d.depthUm = depthUm as number;
    if (lengthUm !== undefined) d.lengthUm = lengthUm as number;
    if (diameterUm !== undefined) d.diameterUm = diameterUm as number;
    if (crossesPad !== undefined) d.crossesPad = crossesPad as boolean;
    if (touchesSealRing !== undefined) d.touchesSealRing = touchesSealRing as boolean;
    out.push(d);
  }
  return out;
}

/** 量測值的人讀格式，例：「深度 12 µm・觸及 seal ring」。 */
export function formatMeasurement(d: Defect): string {
  const parts: string[] = [];
  if (d.code === 'CRK') parts.push('有裂紋');
  if (d.depthUm !== undefined) parts.push(`深度 ${d.depthUm} µm`);
  if (d.lengthUm !== undefined) parts.push(`長度 ${d.lengthUm} µm`);
  if (d.diameterUm !== undefined) parts.push(`直徑 ${d.diameterUm} µm`);
  if (d.touchesSealRing) parts.push('觸及 seal ring');
  if (d.crossesPad) parts.push('經過 pad');
  return parts.length ? parts.join('・') : '—';
}

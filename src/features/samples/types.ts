import type { Defect, InspectionResult, Verdict } from '../inspection/spec/inspectionSpecV1';

/** 標準答案中的一筆缺陷：比 AI 回報多了影像上的位置（px，1000 px 影像）。 */
export interface RawRefDefect extends Defect {
  location?: { x: number; y: number };
}

/** 一致性分析（改善後、第 1 次）中，一位模擬 AI 評估者對一張樣本的實際回覆。 */
export interface RawRecordedReply {
  appraiser: '甲' | '乙' | '丙';
  shift: string;
  model: string;
  /** 回覆中最後一個缺陷清單；null＝回覆無法解析 */
  defects: unknown[] | null;
  /** experiment/spec_v1.py 推導的判定（供 check:spec 比對） */
  pyVerdict: Verdict | null;
}

export interface RawReferenceSample {
  id: string;
  group: 'good' | 'defective';
  note: string;
  referenceVerdict: Verdict;
  defects: RawRefDefect[];
  recorded: RawRecordedReply[];
}

interface MsaCondition {
  repeatability: number | null;
  repeatabilityN: number;
  betweenAppraisersPerTrial: number;
  allVsStandard: number;
  accuracy: number;
  missRate: number;
  falseCallRate: number;
  warningRate: number;
  referenceWarningRate: number;
  fleissKappa: number;
  judgments: number;
}

export interface RawMsaSummary {
  before: MsaCondition;
  after: MsaCondition;
  recognition: Record<'CHP' | 'CRK' | 'SCR' | 'CON', {
    refInstances: number;
    tp: number;
    fn: number;
    recall: number | null;
    measBiasUm: number | null;
  }>;
}

interface HumanRates {
  n: number;
  accuracy: number;
  missRate: number;
  falseCallRate: number;
  warningRate: number;
}

/** 作者本人兩輪判定：「自己判」vs「人眼回報缺陷＋規則推導」。 */
export interface RawHumanSummary {
  appraiser: string;
  date: string;
  note: string;
  roundMinutes: number[];
  /** 實測每次判定平均秒數（含找缺陷、量測、填表） */
  secondsPerDie: number;
  rounds: { round: number; own: HumanRates; rules: HumanRates; fixedByRules: string[]; brokenByRules: string[] }[];
  combined: { own: HumanRates; rules: HumanRates; fixedByRules: number; brokenByRules: number };
  repeatability: { n: number; own: number; rules: number };
}

interface V2Rates {
  judgments: number;
  accuracy: number;
  missRate: number;
  falseCallRate: number;
  warningRate: number;
}

/** 第二輪一致性分析（檢驗規範 v2：分塊放大判讀＋框選換算尺寸＋安全路由），指標定義同第一輪。 */
export interface RawV2Summary {
  /** 第 1 次判定（3 評估者 × 40 張 = 120 筆） */
  trial1: V2Rates & { betweenAppraisersPerTrial: number; fleissKappa: number };
  /** 第 1、2 次判定配對 */
  repeatability: number | null;
  repeatabilityN: number;
  /** 兩次合計 */
  pooled: V2Rates | null;
  recognition: Record<'CHP' | 'CRK' | 'SCR' | 'CON', {
    refInstances: number;
    tp: number;
    recall: number | null;
    recallRelevant: number | null;
    measBiasUm: number | null;
    measRelBias: number | null;
  }>;
  /** 第 1 次判定的誤判（樣本/評估者） */
  falseCallsTrial1: string[];
  spendUsd: number;
  apiCalls: number;
  /** AI 每顆晶粒的平均判讀秒數（API 回應時間，不含取像） */
  secondsPerDie: number;
}

/** 作者本人一次判定的回報（供 check:spec 比對 TS 與 Python 規則引擎）。 */
export interface RawHumanReply {
  sample: string;
  round: number;
  defects: Defect[];
  ownVerdict: Verdict;
  pyRuleVerdict: Verdict;
}

/** 判定與標準答案的比對結果（用詞依 CONTEXT.md：漏判＝應 Fail 卻放行；誤判＝應 Pass 卻退件）。 */
export type Agreement = 'match' | 'miss' | 'falseCall' | 'differs';

export interface RecordedJudgement {
  appraiser: RawRecordedReply['appraiser'];
  shift: string;
  model: string;
  result: InspectionResult;
  agreement: Agreement;
}

export interface ReferenceSample {
  id: string;
  group: 'good' | 'defective';
  referenceVerdict: Verdict;
  /** 標準答案缺陷（含位置）。 */
  refDefects: RawRefDefect[];
  /** 標準答案缺陷經同一套規則引擎推導出的判定明細。 */
  reference: InspectionResult;
  recorded: RecordedJudgement[];
  imageUrl: string;
  thumbUrl: string;
}

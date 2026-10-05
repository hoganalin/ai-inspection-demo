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

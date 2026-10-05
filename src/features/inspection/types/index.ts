export type {
  Verdict,
  DefectClass,
  InspectionZone,
  Defect,
  DefectJudgement,
  InspectionResult,
  SpecVersion,
} from '../spec/inspectionSpecV1';

/**
 * 處理進度（不是領域用語）：與判定 (Verdict) 分開。
 * 判定只有 Pass / Warning / Fail，放在 InspectionResult.verdict。
 */
export type InspectionProgress = 'idle' | 'analyzing' | 'done' | 'error';

import {
  judgeDie,
  parseDefectList,
  unparseableResult,
  type Defect,
  type InspectionResult,
  type Verdict,
} from '../inspection/spec/inspectionSpecV1';
import { REFERENCE_SAMPLES, MSA_SUMMARY } from './referenceData';
import type { Agreement, RawRefDefect, RawRecordedReply, ReferenceSample } from './types';

/** 實驗日期（experiment/raw/after.jsonl 的執行日）。 */
const RECORDED_AT = '2026-10-05T00:00:00.000Z';

const stripLocation = (d: RawRefDefect): Defect => {
  const { location: _location, ...rest } = d;
  void _location;
  return rest;
};

/** 判定與標準答案比對。漏判＝標準答案 Fail 卻判 Pass；誤判＝標準答案 Pass 卻判 Fail。 */
export function compareToReference(reference: Verdict, got: Verdict): Agreement {
  if (reference === got) return 'match';
  if (reference === 'fail' && got === 'pass') return 'miss';
  if (reference === 'pass' && got === 'fail') return 'falseCall';
  return 'differs';
}

export const AGREEMENT_LABEL: Record<Agreement, string> = {
  match: '與標準答案一致',
  miss: '漏判',
  falseCall: '誤判',
  differs: '與標準答案不同',
};

/** 錄下的 AI 回覆 → 依前端同一套規則推導判定（無法解析時固定 Warning）。 */
export function judgeRecordedReply(reply: RawRecordedReply): InspectionResult {
  if (reply.defects === null) return unparseableResult(RECORDED_AT);
  const defects = parseDefectList(reply.defects);
  return defects ? judgeDie(defects, RECORDED_AT) : unparseableResult(RECORDED_AT);
}

const base = import.meta.env?.BASE_URL ?? '/';

export const SAMPLES: ReferenceSample[] = REFERENCE_SAMPLES.map(s => {
  const reference = judgeDie(s.defects.map(stripLocation), RECORDED_AT);
  return {
    id: s.id,
    group: s.group,
    referenceVerdict: s.referenceVerdict,
    refDefects: s.defects,
    reference,
    recorded: s.recorded.map(r => {
      const result = judgeRecordedReply(r);
      return {
        appraiser: r.appraiser,
        shift: r.shift,
        model: r.model,
        result,
        agreement: compareToReference(s.referenceVerdict, result.verdict),
      };
    }),
    imageUrl: `${base}samples/${s.id}.jpg`,
    thumbUrl: `${base}samples/thumbs/${s.id}.jpg`,
  };
});

export const SAMPLE_BY_ID: Record<string, ReferenceSample> = Object.fromEntries(SAMPLES.map(s => [s.id, s]));

export { MSA_SUMMARY };

/** 取得一張標準樣本影像作為 File，交給與上傳相同的判定流程。 */
export async function fetchSampleFile(sample: ReferenceSample): Promise<File> {
  const res = await fetch(sample.imageUrl);
  if (!res.ok) throw new Error(`無法載入標準樣本 ${sample.id}（HTTP ${res.status}）`);
  const blob = await res.blob();
  return new File([blob], `${sample.id}.jpg`, { type: blob.type || 'image/jpeg' });
}

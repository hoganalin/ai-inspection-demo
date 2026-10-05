import React from 'react';
import { DEFECT_CLASS_LABEL, ZONE_LABEL, formatMeasurement } from '../../inspection/spec/inspectionSpecV1';
import { Icon } from '../../../components/ui/icons';
import { VerdictChip } from '../../../components/ui/marks';
import { AGREEMENT_LABEL } from '../sampleModel';
import type { Agreement, RecordedJudgement } from '../types';

const AGREEMENT_CHIP: Record<Agreement, string> = {
  match: 'chip-line',
  miss: 'chip-fail',
  falseCall: 'chip-fail',
  differs: 'chip-warn',
};

/** 判定與標準答案的比對標記。 */
export const AgreementChip: React.FC<{ agreement: Agreement }> = ({ agreement }) => (
  <span className={`chip ${AGREEMENT_CHIP[agreement]}`}>
    {agreement === 'match' ? <Icon.Check width={13} height={13} /> : <Icon.Alert width={13} height={13} />}
    {AGREEMENT_LABEL[agreement]}
  </span>
);

/** 一致性分析（改善後、第 1 次）中三位模擬 AI 評估者對這張樣本的實際回覆。 */
export const RecordedReplies: React.FC<{ recorded: RecordedJudgement[] }> = ({ recorded }) => (
  <div className="tbl-frame" style={{ overflowX: 'auto' }}>
    <table className="tbl tbl-stack">
      <thead>
        <tr>
          <th scope="col">評估者</th>
          <th scope="col">AI 回報的缺陷清單</th>
          <th scope="col">規則推導</th>
          <th scope="col">對照標準答案</th>
        </tr>
      </thead>
      <tbody>
        {recorded.map(r => (
          <tr key={r.appraiser}>
            <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{r.appraiser}・{r.shift}</td>
            <td className="small ai-cell" data-label="AI 回報">
              {r.result.unparseable
                ? <span className="dim">回覆無法解析</span>
                : r.result.defects.length === 0
                  ? <span className="dim">無缺陷</span>
                  : r.result.defects.map((j, i) => (
                      <div key={i}>
                        <span className="mono ai-ink" style={{ fontWeight: 600 }}>{j.defect.code}</span>{' '}
                        {DEFECT_CLASS_LABEL[j.defect.code].cn}・{ZONE_LABEL[j.defect.zone]}・<span className="mono" style={{ whiteSpace: 'nowrap' }}>{formatMeasurement(j.defect)}</span>
                      </div>
                    ))}
            </td>
            <td data-label="規則推導"><VerdictChip verdict={r.result.verdict} /></td>
            <td data-label="對照標準答案"><AgreementChip agreement={r.agreement} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

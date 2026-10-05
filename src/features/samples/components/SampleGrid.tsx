import React from 'react';
import type { Verdict } from '../../inspection/spec/inspectionSpecV1';
import { VerdictMark } from '../../../components/ui/marks';
import { Icon } from '../../../components/ui/icons';
import type { Agreement, ReferenceSample } from '../types';

interface Props {
  samples: ReferenceSample[];
  selected: string[];
  onToggle: (id: string) => void;
  /** 本次工作階段中已由 AI 即時判定的樣本 */
  judged?: Record<string, { verdict: Verdict; agreement: Agreement }>;
  disabled?: boolean;
  /** 多選模式：選取的格子加上勾選標記 */
  multi?: boolean;
  /** 在格子右下角標出標準答案的判定記號 */
  showReference?: boolean;
  label: string;
}

/** 標準樣本集 S01–S40：整格排開，一格一張，代碼標在左下。 */
export const SampleGrid: React.FC<Props> = ({ samples, selected, onToggle, judged = {}, disabled, multi, showReference, label }) => (
  <div className="sample-grid" role="group" aria-label={label}>
    {samples.map(s => {
      const j = judged[s.id];
      const on = selected.includes(s.id);
      return (
        <button
          key={s.id}
          type="button"
          className="sample-cell"
          aria-pressed={on}
          disabled={disabled}
          onClick={() => onToggle(s.id)}
          title={j ? `${s.id}：AI 判定 ${j.verdict}${j.agreement === 'match' ? '（與標準答案一致）' : j.agreement === 'miss' ? '（漏判）' : j.agreement === 'falseCall' ? '（誤判）' : '（與標準答案不同）'}` : s.id}
        >
          <img src={s.thumbUrl} alt="" loading="lazy" />
          <span className="sample-id">{s.id}</span>
          {multi && on && <span className="sample-pick" aria-hidden="true"><Icon.Check width={13} height={13} /></span>}
          {showReference && (
            <span className="sample-ref" aria-hidden="true">
              <VerdictMark verdict={s.referenceVerdict} size={10} strokeWidth={2.8} />
            </span>
          )}
          {j && (
            <span
              className="sample-mark"
              style={{
                background: '#fff',
                boxShadow: j.agreement === 'match' ? undefined : 'inset 0 0 0 2px var(--fail)',
              }}
            >
              <VerdictMark verdict={j.verdict} size={11} strokeWidth={2.6} />
            </span>
          )}
        </button>
      );
    })}
  </div>
);

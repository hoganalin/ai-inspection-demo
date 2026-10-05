import React, { useState } from 'react';
import type { InspectionResult as IResult, DefectJudgement } from '../types';
import {
  DEFECT_CLASS_LABEL,
  VERDICT_LABEL,
  ZONE_LABEL,
  acceptanceScale,
  formatMeasurement,
} from '../spec/inspectionSpecV1';
import { Icon, VERDICT_STYLE } from '../../../components/ui/icons';
import { VerdictChip, VerdictMark } from '../../../components/ui/marks';
import { ScaleBar } from './ScaleBar';

interface Props {
  result: IResult;
  /** 明細列的 data-anchor 前綴（引線用）。 */
  anchorPrefix?: string;
  /** 缺陷清單的來源說明，例如「AI 回報（即時）」「標準答案」。 */
  sourceLabel?: string;
  /** 精簡版：不顯示複製按鈕與時刻。 */
  compact?: boolean;
}

/** 缺陷序號：與圖版上的標記同一種方框數字。 */
const RowNo: React.FC<{ n: number }> = ({ n }) => (
  <span className="row-no" aria-label={`第 ${n} 筆`}>{n}</span>
);

/* ─── 整體判定 ─── */
export const VerdictHeader: React.FC<{ result: IResult; time?: string }> = ({ result, time }) => {
  const s = VERDICT_STYLE[result.verdict];
  const label = VERDICT_LABEL[result.verdict];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 18px', alignItems: 'center' }}>
      <VerdictMark verdict={result.verdict} size={46} strokeWidth={2.4} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <span className="verdict-word" style={{ color: s.ink }}>{label.name}</span>
        <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>→ {label.action}</span>
      </div>
      <div />
      <div className="small" style={{ color: 'var(--ink-2)' }}>
        {result.reason}
        <span className="dim"> ・檢驗規範 {result.specVersion}{time ? `・${time}` : ''}</span>
      </div>
    </div>
  );
};

/* ─── 推導明細（逐缺陷） ─── */
export const DerivationRows: React.FC<{ defects: DefectJudgement[]; anchorPrefix?: string }> = ({ defects, anchorPrefix }) => (
  <ol style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid var(--rule-strong)' }}>
    {defects.map((j, i) => {
      const cls = DEFECT_CLASS_LABEL[j.defect.code];
      const scale = acceptanceScale(j.defect);
      return (
        <li
          key={i}
          data-anchor={anchorPrefix ? `${anchorPrefix}-row-${i}` : undefined}
          style={{
            display: 'grid',
            gridTemplateColumns: '28px minmax(0, 1fr) auto',
            gap: '4px 12px',
            padding: '12px 0',
            borderBottom: '1px solid var(--rule)',
            alignItems: 'start',
          }}
        >
          <RowNo n={i + 1} />
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontWeight: 600 }}>{j.defect.code}</span>
              <span style={{ fontWeight: 600 }}>{cls.cn}</span>
              <span className="chip chip-line">{ZONE_LABEL[j.defect.zone]}</span>
              <span className="mono small" style={{ color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{formatMeasurement(j.defect)}</span>
            </div>
            {scale && <ScaleBar scale={scale} verdict={j.verdict} />}
            <div className="small" style={{ color: 'var(--ink-2)' }}>
              <span className="dim" style={{ marginRight: '0.6em' }}>允收標準</span>{j.rule}
            </div>
          </div>
          <VerdictChip verdict={j.verdict} />
        </li>
      );
    })}
  </ol>
);

/* ─── 判定明細 ─── */
export const InspectionResultPanel: React.FC<Props> = ({ result, anchorPrefix, sourceLabel, compact }) => {
  const [copied, setCopied] = useState(false);
  const time = new Date(result.analyzedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const handleCopy = () => {
    const v = VERDICT_LABEL[result.verdict];
    const lines = [
      `晶粒外觀檢查 判定明細（檢驗規範 ${result.specVersion}）`,
      `判定：${v.name} → ${v.action}`,
      `依據：${result.reason}`,
      ...(result.defects.length > 0
        ? ['', '缺陷：', ...result.defects.map(j =>
            `・${j.defect.code} ${DEFECT_CLASS_LABEL[j.defect.code].cn}／${ZONE_LABEL[j.defect.zone]}／${formatMeasurement(j.defect)} — ${j.rule}`)]
        : []),
    ];
    navigator.clipboard?.writeText(lines.join('\n')).catch(() => { /* clipboard blocked */ });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <VerdictHeader result={result} time={compact ? undefined : time} />

      {result.defects.length > 0 ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 12 }}>
            <span className="block-title" style={{ margin: 0 }}>推導明細</span>
            <span className="small dim">{sourceLabel ?? '缺陷清單'}・{result.defects.length} 件 → 規範 v1 條文 → 判定</span>
          </div>
          <DerivationRows defects={result.defects} anchorPrefix={anchorPrefix} />
        </div>
      ) : !result.unparseable ? (
        <p className="small" style={{ color: 'var(--ink-2)' }}>{sourceLabel ?? '缺陷清單'}為空：沒有回報任何缺陷 → Pass（§4 合併規則）。</p>
      ) : null}

      {result.unparseable && (
        <div className="note note-warn">
          <Icon.Alert width={16} height={16} />
          <span>AI 的回覆不符合規範 v1 的缺陷清單格式。系統不猜測判定，固定為 Warning、送人工複判。</span>
        </div>
      )}

      {!compact && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleCopy} className="btn btn-quiet btn-sm">
            {copied ? <Icon.Check width={15} height={15} /> : <Icon.Copy width={15} height={15} />}
            {copied ? '已複製' : '複製判定明細'}
          </button>
        </div>
      )}
    </div>
  );
};

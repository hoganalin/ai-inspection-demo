import React from 'react';
import type { Verdict } from '../../features/inspection/spec/inspectionSpecV1';
import { VERDICT_STYLE } from './icons';

/** 產品標誌：一顆晶粒的平面圖——外框、seal ring、pad 列。 */
export const DieMark: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect x="0.5" y="0.5" width="33" height="33" fill="#283057" stroke="#A3ABD3" />
    <rect x="3.5" y="3.5" width="27" height="27" fill="none" stroke="#6C76A8" />
    {[8, 13, 18, 23].map(v => (
      <g key={v} fill="#E6E9F7">
        <rect x={v} y="6" width="3" height="3" />
        <rect x={v} y="25" width="3" height="3" />
        <rect x="6" y={v} width="3" height="3" />
        <rect x="25" y={v} width="3" height="3" />
      </g>
    ))}
    <rect x="12" y="12" width="10" height="10" fill="#3552D6" />
  </svg>
);

/** 判定記號：○ Pass、△ Warning、✕ Fail（品管慣用記號，畫成 SVG，不依賴顏色辨識）。 */
export const VerdictMark: React.FC<{ verdict: Verdict; size?: number; color?: string; strokeWidth?: number }> = ({
  verdict, size = 16, color, strokeWidth = 2,
}) => {
  const c = color ?? VERDICT_STYLE[verdict].color;
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" style={{ flexShrink: 0 }}>
      {verdict === 'pass' && <circle cx="10" cy="10" r="7.5" fill="none" stroke={c} strokeWidth={strokeWidth} />}
      {verdict === 'warning' && <path d="M10 2.5L18 17H2z" fill="none" stroke={c} strokeWidth={strokeWidth} strokeLinejoin="miter" />}
      {verdict === 'fail' && <path d="M4 4l12 12M16 4L4 16" fill="none" stroke={c} strokeWidth={strokeWidth} strokeLinecap="square" />}
    </svg>
  );
};

/** 判定小標：記號＋名稱（＋處置）。 */
export const VerdictChip: React.FC<{ verdict: Verdict; withAction?: boolean }> = ({ verdict, withAction }) => {
  const s = VERDICT_STYLE[verdict];
  return (
    <span className={`chip ${s.chip}`}>
      <VerdictMark verdict={verdict} size={12} color="currentColor" />
      {s.name}{withAction ? `・${s.action}` : ''}
    </span>
  );
};

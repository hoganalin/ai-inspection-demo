import type React from 'react';

type P = React.SVGProps<SVGSVGElement>;

const base = (props: P) => ({
  'aria-hidden': true as const,
  ...props,
  className: ['line-icon', props.className].filter(Boolean).join(' '),
  viewBox: '0 0 24 24',
  width: props.width ?? 18,
  height: props.height ?? 18,
});

/** 線條圖示：1.6 stroke、方角端點，與圖版的直角語彙一致。 */
export const Icon = {
  Overview: (p: P) => <svg {...base(p)}><path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" /></svg>,
  Search:   (p: P) => <svg {...base(p)}><path d="M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z" /><path d="M15.5 15.5L20 20" /></svg>,
  Layers:   (p: P) => <svg {...base(p)}><path d="M12 4l8 4.5-8 4.5-8-4.5z" /><path d="M4 12.5l8 4.5 8-4.5" /><path d="M4 16.5l8 4.5 8-4.5" /></svg>,
  Records:  (p: P) => <svg {...base(p)}><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>,
  Chart:    (p: P) => <svg {...base(p)}><path d="M4 4v16h16" /><path d="M7 15l4-5 3 3 5-7" /></svg>,
  Upload:   (p: P) => <svg {...base(p)}><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 20h16" /></svg>,
  Close:    (p: P) => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  Plus:     (p: P) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>,
  Check:    (p: P) => <svg {...base(p)}><path d="M5 12.5l4.5 4.5L19 7" /></svg>,
  Copy:     (p: P) => <svg {...base(p)}><path d="M9 9h11v11H9z" /><path d="M15 9V4H4v11h5" /></svg>,
  Refresh:  (p: P) => <svg {...base(p)}><path d="M4 12a8 8 0 0 1 14-5.3L20 9" /><path d="M20 4v5h-5" /><path d="M20 12a8 8 0 0 1-14 5.3L4 15" /><path d="M4 20v-5h5" /></svg>,
  Download: (p: P) => <svg {...base(p)}><path d="M12 4v12" /><path d="M7 11l5 5 5-5" /><path d="M4 20h16" /></svg>,
  Trash:    (p: P) => <svg {...base(p)}><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></svg>,
  Alert:    (p: P) => <svg {...base(p)}><path d="M12 3l10 18H2z" /><path d="M12 10v5" /><path d="M12 17.5v1" /></svg>,
  Info:     (p: P) => <svg {...base(p)}><path d="M4 4h16v16H4z" /><path d="M12 11v6" /><path d="M12 7.5v1" /></svg>,
  Doc:      (p: P) => <svg {...base(p)}><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M9 13h7M9 17h5" /></svg>,
  Arrow:    (p: P) => <svg {...base(p)}><path d="M4 12h15" /><path d="M14 7l5 5-5 5" /></svg>,
  ArrowL:   (p: P) => <svg {...base(p)}><path d="M20 12H5" /><path d="M10 7l-5 5 5 5" /></svg>,
  Chevron:  (p: P) => <svg {...base(p)}><path d="M9 6l6 6-6 6" /></svg>,
  External: (p: P) => <svg {...base(p)}><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v6H4V6h6" /></svg>,
  Plug:     (p: P) => <svg {...base(p)}><path d="M9 3v5M15 3v5" /><path d="M6 8h12v4a6 6 0 0 1-12 0z" /><path d="M12 18v3" /></svg>,
  Sample:   (p: P) => <svg {...base(p)}><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></svg>,
};

/** 判定 (Verdict) 的視覺樣式。名稱依規範：Pass／Warning／Fail；處置：放行／送人工複判／退件。 */
export const VERDICT_STYLE = {
  pass:    { name: 'Pass',    action: '放行',       color: 'var(--pass)', ink: 'var(--pass-ink)', tint: 'var(--pass-tint)', chip: 'chip-pass' },
  warning: { name: 'Warning', action: '送人工複判', color: 'var(--warn)', ink: 'var(--warn-ink)', tint: 'var(--warn-tint)', chip: 'chip-warn' },
  fail:    { name: 'Fail',    action: '退件',       color: 'var(--fail)', ink: 'var(--fail-ink)', tint: 'var(--fail-tint)', chip: 'chip-fail' },
} as const;

/** 批層級訊號的視覺樣式（與判定 Warning 不同義）。 */
export const SIGNAL_STYLE = {
  outOfControl:  { label: '異常', color: 'var(--fail)', ink: 'var(--fail-ink)', tint: 'var(--fail-tint)', chip: 'chip-out' },
  warningSignal: { label: '預警', color: 'var(--warn)', ink: 'var(--warn-ink)', tint: 'var(--warn-tint)', chip: 'chip-sig' },
} as const;


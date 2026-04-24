import React from 'react';

type P = React.SVGProps<SVGSVGElement>;

const base = (props: P) => ({
  ...props,
  className: ['line-icon', props.className].filter(Boolean).join(' '),
  viewBox: '0 0 24 24',
  width: props.width ?? 18,
  height: props.height ?? 18,
});

export const Icon = {
  Search:   (p: P) => <svg {...base(p)}><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></svg>,
  Layers:   (p: P) => <svg {...base(p)}><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 18l9 5 9-5"/></svg>,
  Compare:  (p: P) => <svg {...base(p)}><rect x="3" y="5" width="8" height="14" rx="1"/><rect x="13" y="5" width="8" height="14" rx="1"/></svg>,
  History:  (p: P) => <svg {...base(p)}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>,
  Chart:    (p: P) => <svg {...base(p)}><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>,
  Chat:     (p: P) => <svg {...base(p)}><path d="M4 5h16v11H9l-5 4V5z"/></svg>,
  Upload:   (p: P) => <svg {...base(p)}><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/></svg>,
  Close:    (p: P) => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18"/></svg>,
  Send:     (p: P) => <svg {...base(p)}><path d="M4 12L20 4l-5 16-3-7-8-1z"/></svg>,
  Plus:     (p: P) => <svg {...base(p)}><path d="M12 4v16M4 12h16"/></svg>,
  Check:    (p: P) => <svg {...base(p)}><path d="M4 12l5 5L20 6"/></svg>,
  Copy:     (p: P) => <svg {...base(p)}><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>,
  Refresh:  (p: P) => <svg {...base(p)}><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>,
  Download: (p: P) => <svg {...base(p)}><path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/></svg>,
  Trash:    (p: P) => <svg {...base(p)}><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>,
  Image:    (p: P) => <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="1"/><circle cx="9" cy="10" r="1.5"/><path d="M4 18l5-5 4 4 3-3 4 4"/></svg>,
};

export const STATUS_MAP = {
  pass:    { cn: '合格',   en: 'PASSED',  color: 'var(--matcha)',     bg: 'var(--matcha-bg)',     mark: '○' },
  warning: { cn: '留意',   en: 'WARNING', color: 'var(--mustard)',    bg: 'var(--mustard-bg)',    mark: '△' },
  fail:    { cn: '需檢修', en: 'FAILED',  color: 'var(--terracotta)', bg: 'var(--terracotta-bg)', mark: '✕' },
} as const;

export const SEV_MAP = {
  low:    { cn: '輕微', en: 'LOW',    color: 'var(--mustard)' },
  medium: { cn: '中等', en: 'MEDIUM', color: 'var(--clay)' },
  high:   { cn: '嚴重', en: 'HIGH',   color: 'var(--terracotta)' },
} as const;

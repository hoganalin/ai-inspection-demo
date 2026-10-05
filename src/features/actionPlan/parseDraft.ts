import { NOTIFY_UNITS } from './types';
import type { ActionPlanSections, NotifyUnit } from './types';

const HEADINGS = {
  description: '異常描述',
  causes: '可能原因',
  checks: '確認項目',
  containment: '暫時對策',
  notify: '通知單位',
  followUp: '建議追蹤日',
} as const;

type Key = keyof typeof HEADINGS;

/** 把 AI 草稿（## 標題分段）拆成處置單欄位；缺的欄位留空讓人補。 */
export function parseDraft(text: string, fallbackDate: string): {
  sections: ActionPlanSections;
  notifyUnits: NotifyUnit[];
  followUpDate: string;
  complete: boolean;
} {
  const found: Partial<Record<Key, string>> = {};
  const keys = Object.keys(HEADINGS) as Key[];
  const pattern = new RegExp(`^#{1,4}[ \\t]*(${keys.map(k => HEADINGS[k]).join('|')})[ \\t\\r]*$`, 'gm');
  const marks: { key: Key; start: number; bodyStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const key = keys.find(k => HEADINGS[k] === m![1])!;
    marks.push({ key, start: m.index, bodyStart: m.index + m[0].length });
  }
  marks.forEach((mk, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].start : text.length;
    found[mk.key] = text.slice(mk.bodyStart, end).trim();
  });

  const notifyText = found.notify ?? '';
  const notifyUnits = NOTIFY_UNITS.filter(u => notifyText.includes(u));
  const date = /\d{4}-\d{2}-\d{2}/.exec(found.followUp ?? '')?.[0] ?? fallbackDate;

  return {
    sections: {
      description: found.description ?? (marks.length === 0 ? text.trim() : ''),
      causes: found.causes ?? '',
      checks: found.checks ?? '',
      containment: found.containment ?? '',
    },
    notifyUnits,
    followUpDate: date,
    complete: keys.every(k => found[k] !== undefined),
  };
}

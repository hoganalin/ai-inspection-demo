import { DEFECT_CLASS_LABEL, VERDICT_LABEL, ZONE_LABEL, formatMeasurement } from '../inspection/spec/inspectionSpecV1';
import type { LotSummary } from '../control/spc';
import type { DieRecord, LotRecord } from './types';

/** 批紀錄 → 批彙總（n、Pass/Warning/Fail、各缺陷分類計數）。 */
export function summarizeLot(lot: LotRecord): LotSummary {
  const s: LotSummary = {
    lotId: lot.lotId,
    n: lot.dies.length,
    pass: 0,
    warning: 0,
    fail: 0,
    defectCounts: { CHP: 0, CRK: 0, SCR: 0, CON: 0 },
  };
  for (const d of lot.dies) {
    s[d.result.verdict] += 1;
    // 只計入未放行的缺陷，與模擬批 defectCounts 的意義一致
    for (const j of d.result.defects) if (j.verdict !== 'pass') s.defectCounts[j.defect.code] += 1;
  }
  return s;
}

/* ─── CSV ─────────────────────────────────── */

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function download(filename: string, rows: (string | number)[][]) {
  const csv = '﻿' + rows.map(r => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function defectDetail(d: DieRecord): string {
  return d.result.defects
    .map(j => `${j.defect.code} ${DEFECT_CLASS_LABEL[j.defect.code].cn}/${ZONE_LABEL[j.defect.zone]}/${formatMeasurement(j.defect)} → ${VERDICT_LABEL[j.verdict].name}`)
    .join('; ');
}

/** 逐顆判定明細 CSV。 */
export function exportDiesCSV(dies: DieRecord[], filename: string) {
  const header = ['批號', '時間', '檔名', '判定', '處置', '規範版本', '缺陷數', '缺陷明細', '判定依據'];
  const rows = dies.map(d => [
    d.lotId,
    new Date(d.result.analyzedAt).toLocaleString('zh-TW'),
    d.fileName,
    VERDICT_LABEL[d.result.verdict].name,
    VERDICT_LABEL[d.result.verdict].action,
    d.result.specVersion,
    d.result.defects.length,
    defectDetail(d),
    d.result.reason,
  ]);
  download(filename, [header, ...rows]);
}

/** 批彙總 CSV（批號、n、Pass/Warning/Fail、批不良率、各缺陷分類計數）。 */
export function exportLotsCSV(lots: LotRecord[], filename: string) {
  const header = ['批號', '建立時間', 'n', 'Pass', 'Warning', 'Fail', '批不良率', 'CHP', 'CRK', 'SCR', 'CON'];
  const rows = lots.map(l => {
    const s = summarizeLot(l);
    return [
      l.lotId,
      new Date(l.createdAt).toLocaleString('zh-TW'),
      s.n, s.pass, s.warning, s.fail,
      s.n ? (s.fail / s.n).toFixed(4) : '',
      s.defectCounts.CHP, s.defectCounts.CRK, s.defectCounts.SCR, s.defectCounts.CON,
    ];
  });
  download(filename, [header, ...rows]);
}

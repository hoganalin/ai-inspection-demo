import { useEffect, useState } from 'react';
import { FALLBACK_LOTS } from '../data/fallbackLots';
import { DEFECT_KEYS } from '../spc';
import type { LotsDataset } from '../types';

export type DatasetSource = 'file' | 'fallback';

function isNonNegInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function validate(raw: unknown): LotsDataset | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<LotsDataset>;
  if (!Array.isArray(d.lots) || d.lots.length === 0) return null;
  for (const l of d.lots) {
    if (!l || typeof l.lotId !== 'string') return null;
    if (![l.n, l.pass, l.warning, l.fail].every(isNonNegInt) || l.n === 0) return null;
    if (!l.defectCounts || !DEFECT_KEYS.every(k => isNonNegInt(l.defectCounts[k] ?? 0))) return null;
  }
  return {
    specVersion: String(d.specVersion ?? 'v1'),
    scenario: String(d.scenario ?? ''),
    simulated: d.simulated !== false,
    judgementErrorRates: {
      miss: Number(d.judgementErrorRates?.miss ?? 0),
      falseCall: Number(d.judgementErrorRates?.falseCall ?? 0),
    },
    lots: d.lots.map(l => ({
      ...l,
      defectCounts: {
        CHP: l.defectCounts.CHP ?? 0,
        CRK: l.defectCounts.CRK ?? 0,
        SCR: l.defectCounts.SCR ?? 0,
        CON: l.defectCounts.CON ?? 0,
      },
    })),
  };
}

/** 載入 public/data/lots.json；不存在或格式不符時改用內建備援資料。 */
export function useLotsDataset(): { dataset: LotsDataset; source: DatasetSource; loading: boolean } {
  const [state, setState] = useState<{ dataset: LotsDataset; source: DatasetSource; loading: boolean }>({
    dataset: FALLBACK_LOTS,
    source: 'fallback',
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/lots.json`, { cache: 'no-cache' })
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled) return;
        const valid = validate(json);
        setState(valid
          ? { dataset: valid, source: 'file', loading: false }
          : { dataset: FALLBACK_LOTS, source: 'fallback', loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ dataset: FALLBACK_LOTS, source: 'fallback', loading: false });
      });
    return () => { cancelled = true; };
  }, []);

  return state;
}

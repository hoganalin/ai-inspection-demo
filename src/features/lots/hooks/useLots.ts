import { useCallback, useState } from 'react';
import type { InspectionResult } from '../../inspection/spec/inspectionSpecV1';
import type { LotRecord } from '../types';

const STORAGE_KEY = 'die_inspection_lots_v1';
export const DEFAULT_LOT_ID = 'LIVE-01';

interface Store {
  currentLotId: string;
  lots: LotRecord[];
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      if (s && Array.isArray(s.lots) && typeof s.currentLotId === 'string') return s;
    }
  } catch { /* storage unavailable or corrupt — start empty */ }
  return { currentLotId: DEFAULT_LOT_ID, lots: [] };
}

function save(store: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // 空間不足：捨棄縮圖再試一次（判定紀錄比縮圖重要）
    try {
      const slim: Store = {
        ...store,
        lots: store.lots.map(l => ({ ...l, dies: l.dies.map(d => ({ ...d, thumbnail: '' })) })),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    } catch { /* storage unavailable — keep in-memory only */ }
  }
}

/** 下一個建議批號：LIVE-01 → LIVE-02。 */
export function suggestNextLotId(lots: LotRecord[]): string {
  const nums = lots
    .map(l => /^LIVE-(\d+)$/.exec(l.lotId)?.[1])
    .filter((x): x is string => !!x)
    .map(Number);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `LIVE-${String(next).padStart(2, '0')}`;
}

export function useLots() {
  const [store, setStore] = useState<Store>(load);

  const update = useCallback((fn: (s: Store) => Store) => {
    setStore(prev => {
      const next = fn(prev);
      save(next);
      return next;
    });
  }, []);

  /** 切換目前批；批號不存在時建立新批。 */
  const selectLot = useCallback((lotId: string) => {
    const id = lotId.trim();
    if (!id) return;
    update(s => ({
      currentLotId: id,
      lots: s.lots.some(l => l.lotId === id)
        ? s.lots
        : [...s.lots, { lotId: id, createdAt: new Date().toISOString(), dies: [] }],
    }));
  }, [update]);

  /** 把一顆晶粒的判定記到目前批。 */
  const addDie = useCallback((result: InspectionResult, thumbnail: string, fileName: string) => {
    update(s => {
      const lotId = s.currentLotId;
      const die = { id: crypto.randomUUID(), lotId, fileName, thumbnail, result };
      const exists = s.lots.some(l => l.lotId === lotId);
      const lots = exists
        ? s.lots.map(l => (l.lotId === lotId ? { ...l, dies: [...l.dies, die] } : l))
        : [...s.lots, { lotId, createdAt: new Date().toISOString(), dies: [die] }];
      return { ...s, lots };
    });
  }, [update]);

  const deleteLot = useCallback((lotId: string) => {
    update(s => ({ ...s, lots: s.lots.filter(l => l.lotId !== lotId) }));
  }, [update]);

  const clearAll = useCallback(() => {
    update(() => ({ currentLotId: DEFAULT_LOT_ID, lots: [] }));
  }, [update]);

  const currentLot = store.lots.find(l => l.lotId === store.currentLotId)
    ?? { lotId: store.currentLotId, createdAt: '', dies: [] };

  return {
    lots: store.lots,
    currentLotId: store.currentLotId,
    currentLot,
    selectLot,
    addDie,
    deleteLot,
    clearAll,
  };
}

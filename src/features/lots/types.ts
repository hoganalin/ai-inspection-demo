import type { InspectionResult } from '../inspection/spec/inspectionSpecV1';

/** 批中的一顆晶粒的判定紀錄。 */
export interface DieRecord {
  id: string;
  lotId: string;
  fileName: string;
  /** 縮圖（data URL）；localStorage 空間不足時會被捨棄 */
  thumbnail: string;
  result: InspectionResult;
}

/** 一個批 (Lot)：一起生產、一起統計的一組晶粒。 */
export interface LotRecord {
  lotId: string;
  createdAt: string;
  dies: DieRecord[];
}

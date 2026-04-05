export type InspectionStatus = 'idle' | 'analyzing' | 'pass' | 'fail' | 'warning';

export interface DefectItem {
  location: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface InspectionResult {
  status: 'pass' | 'fail' | 'warning';
  confidence: number;       // 0-100
  summary: string;
  defects: DefectItem[];
  recommendation: string;
  analyzedAt: string;
}

export interface HistoryItem {
  id: string;
  result: InspectionResult;
  thumbnail: string;
  fileName: string;
}

export interface ComparisonDefect {
  location: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  foundIn: 'A' | 'B' | 'both';
}

export interface ComparisonResult {
  imageA: InspectionResult;
  imageB: InspectionResult;
  differences: ComparisonDefect[];
  similarity: number;   // 0-100
  verdict: string;
  analyzedAt: string;
}

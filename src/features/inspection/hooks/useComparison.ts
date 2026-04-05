import { useState, useCallback } from 'react';
import { compareImages } from '../api/inspectionApi';
import { fileToBase64 } from '../utils/thumbnail';
import type { ComparisonResult } from '../types';

type CompareStatus = 'idle' | 'analyzing' | 'done' | 'error';

interface UseComparisonReturn {
  status: CompareStatus;
  result: ComparisonResult | null;
  previewA: string | null;
  previewB: string | null;
  compare: (fileA: File, fileB: File, apiKey: string, customCriteria?: string) => Promise<void>;
  reset: () => void;
}

export function useComparison(): UseComparisonReturn {
  const [status, setStatus] = useState<CompareStatus>('idle');
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [previewA, setPreviewA] = useState<string | null>(null);
  const [previewB, setPreviewB] = useState<string | null>(null);

  const compare = useCallback(async (
    fileA: File, fileB: File, apiKey: string, customCriteria?: string
  ) => {
    setStatus('analyzing');
    setResult(null);
    setPreviewA(URL.createObjectURL(fileA));
    setPreviewB(URL.createObjectURL(fileB));

    try {
      const [base64A, base64B] = await Promise.all([
        fileToBase64(fileA),
        fileToBase64(fileB),
      ]);
      const data = await compareImages(apiKey, base64A, base64B, fileA.type, fileB.type, customCriteria);
      setResult(data);
      setStatus('done');
    } catch (err) {
      console.error('Comparison failed:', err);
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setPreviewA(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    setPreviewB(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  }, []);

  return { status, result, previewA, previewB, compare, reset };
}

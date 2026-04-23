import { useState, useCallback } from 'react';
import { compareImages } from '../api/inspectionApi';
import { prepareImageForUpload } from '../utils/thumbnail';
import type { ComparisonResult } from '../types';

type CompareStatus = 'idle' | 'analyzing' | 'done' | 'error';

interface UseComparisonReturn {
  status: CompareStatus;
  result: ComparisonResult | null;
  previewA: string | null;
  previewB: string | null;
  compare: (fileA: File, fileB: File, customCriteria?: string) => Promise<void>;
  reset: () => void;
}

export function useComparison(): UseComparisonReturn {
  const [status, setStatus] = useState<CompareStatus>('idle');
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [previewA, setPreviewA] = useState<string | null>(null);
  const [previewB, setPreviewB] = useState<string | null>(null);

  const compare = useCallback(async (
    fileA: File, fileB: File, customCriteria?: string
  ) => {
    setStatus('analyzing');
    setResult(null);
    setPreviewA(URL.createObjectURL(fileA));
    setPreviewB(URL.createObjectURL(fileB));

    try {
      const [a, b] = await Promise.all([
        prepareImageForUpload(fileA),
        prepareImageForUpload(fileB),
      ]);
      const data = await compareImages(a.base64, b.base64, a.mimeType, b.mimeType, customCriteria);
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

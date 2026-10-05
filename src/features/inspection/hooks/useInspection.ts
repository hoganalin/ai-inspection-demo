import { useState, useCallback, useRef } from 'react';
import { inspectDie } from '../api/inspectionApi';
import { prepareImageForUpload } from '../utils/thumbnail';
import { describeInspectionError } from '../utils/errors';
import type { InspectionResult, InspectionProgress } from '../types';

interface UseInspectionReturn {
  progress: InspectionProgress;
  result: InspectionResult | null;
  error: string | null;
  imagePreview: string | null;
  analyze: (file: File) => Promise<InspectionResult | null>;
  reanalyze: () => Promise<InspectionResult | null>;
  canReanalyze: boolean;
  reset: () => void;
}

export function useInspection(): UseInspectionReturn {
  const [progress, setProgress] = useState<InspectionProgress>('idle');
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);

  const run = useCallback(async (file: File): Promise<InspectionResult | null> => {
    setProgress('analyzing');
    setResult(null);
    setError(null);
    try {
      const { base64, mimeType } = await prepareImageForUpload(file);
      const data = await inspectDie(base64, mimeType);
      setResult(data);
      setProgress('done');
      return data;
    } catch (err) {
      console.error('Inspection failed:', err);
      setError(describeInspectionError(err));
      setProgress('error');
      return null;
    }
  }, []);

  const analyze = useCallback(async (file: File) => {
    fileRef.current = file;
    setImagePreview(URL.createObjectURL(file));
    return run(file);
  }, [run]);

  const reanalyze = useCallback(async () => {
    if (!fileRef.current) return null;
    return run(fileRef.current);
  }, [run]);

  const reset = useCallback(() => {
    setProgress('idle');
    setResult(null);
    setError(null);
    setImagePreview(null);
    fileRef.current = null;
  }, []);

  return { progress, result, error, imagePreview, analyze, reanalyze, canReanalyze: !!imagePreview, reset };
}

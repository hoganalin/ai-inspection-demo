import { useState, useCallback, useRef } from 'react';
import { analyzeImage } from '../api/inspectionApi';
import { prepareImageForUpload } from '../utils/thumbnail';
import type { InspectionResult, InspectionStatus } from '../types';

interface UseInspectionReturn {
  status: InspectionStatus;
  result: InspectionResult | null;
  imagePreview: string | null;
  analyze: (file: File, customCriteria?: string, threshold?: number) => Promise<InspectionResult | null>;
  reanalyze: ((customCriteria?: string, threshold?: number) => Promise<InspectionResult | null>) | null;
  reset: () => void;
}

function buildErrorResult(err: unknown): InspectionResult {
  const msg = err instanceof Error ? err.message : String(err);
  let summary = '分析失敗，請稍後再試。';
  let recommendation = '請檢查網路連線或稍後重試。';

  if (/429|rate|quota|overload/i.test(msg)) {
    summary = '請求太頻繁或服務暫時忙線中。';
    recommendation = '請稍候片刻後再試。';
  } else if (/401|403|api[_ ]?key|authentication|permission/i.test(msg)) {
    summary = '伺服器端 API Key 未設定或無效。';
    recommendation = '請至 Vercel 專案的 Environment Variables 確認 ANTHROPIC_API_KEY 已正確設定。';
  } else if (/4\d\d|5\d\d/.test(msg)) {
    summary = `伺服器回傳錯誤：${msg}`;
  }

  return {
    status: 'fail',
    confidence: 0,
    summary,
    defects: [],
    recommendation,
    analyzedAt: new Date().toISOString(),
  };
}

export function useInspection(): UseInspectionReturn {
  const [status, setStatus] = useState<InspectionStatus>('idle');
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);

  const runAnalysis = useCallback(async (file: File, customCriteria?: string, threshold = 0): Promise<InspectionResult | null> => {
    setStatus('analyzing');
    setResult(null);
    try {
      const { base64, mimeType } = await prepareImageForUpload(file);
      const data = await analyzeImage(base64, mimeType, customCriteria);
      const finalData = threshold > 0 && data.confidence < threshold && data.status !== 'fail'
        ? { ...data, status: 'fail' as const }
        : data;
      setResult(finalData);
      setStatus(finalData.status);
      return finalData;
    } catch (err) {
      console.error('Inspection failed:', err);
      const errResult = buildErrorResult(err);
      setResult(errResult);
      setStatus('fail');
      return errResult;
    }
  }, []);

  const analyze = useCallback(async (file: File, customCriteria?: string, threshold?: number): Promise<InspectionResult | null> => {
    fileRef.current = file;
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    return runAnalysis(file, customCriteria, threshold);
  }, [runAnalysis]);

  const reanalyze = useCallback(async (customCriteria?: string, threshold?: number): Promise<InspectionResult | null> => {
    if (!fileRef.current) return null;
    return runAnalysis(fileRef.current, customCriteria, threshold);
  }, [runAnalysis]);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setImagePreview(null);
    fileRef.current = null;
  }, []);

  return { status, result, imagePreview, analyze, reanalyze, reset };
}

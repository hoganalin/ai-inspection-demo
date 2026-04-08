import { useState, useCallback, useRef } from 'react';
import { analyzeImage } from '../api/inspectionApi';
import { fileToBase64 } from '../utils/thumbnail';
import type { InspectionResult, InspectionStatus } from '../types';

interface UseInspectionReturn {
  status: InspectionStatus;
  result: InspectionResult | null;
  imagePreview: string | null;
  analyze: (file: File, apiKey: string, customCriteria?: string, threshold?: number) => Promise<InspectionResult | null>;
  reanalyze: ((apiKey: string, customCriteria?: string, threshold?: number) => Promise<InspectionResult | null>) | null;
  reset: () => void;
}

export function useInspection(): UseInspectionReturn {
  const [status, setStatus] = useState<InspectionStatus>('idle');
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);

  const runAnalysis = useCallback(async (file: File, apiKey: string, customCriteria?: string, threshold = 0): Promise<InspectionResult | null> => {
    setStatus('analyzing');
    setResult(null);
    try {
      const base64 = await fileToBase64(file);
      const data = await analyzeImage(apiKey, base64, file.type, customCriteria);
      const finalData = threshold > 0 && data.confidence < threshold && data.status !== 'fail'
        ? { ...data, status: 'fail' as const }
        : data;
      setResult(finalData);
      setStatus(finalData.status);
      return finalData;
    } catch (err) {
      console.error('Inspection failed:', err);
      const errMsg = String(err);
      let summary = '分析失敗，請確認 API Key 是否正確。';
      let recommendation = '請重試或檢查網路連線。';

      if (errMsg.includes('429') || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate')) {
        summary = '請求太頻繁，API 速率限制中。';
        recommendation = '免費版每分鐘限 15 次請求，請等待約 1 分鐘後再試。';
      } else if (errMsg.includes('403') || errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('api key')) {
        summary = 'API Key 無效或已被停用。';
        recommendation = '請至 Google AI Studio 確認金鑰狀態，或重新申請一把新的 API Key。';
      } else if (errMsg.includes('404') || errMsg.toLowerCase().includes('not found')) {
        summary = '模型不存在或不支援。';
        recommendation = '請確認您的 API Key 是否有權限使用 Gemini 2.0 Flash 模型。';
      }

      const errResult: InspectionResult = {
        status: 'fail',
        confidence: 0,
        summary,
        defects: [],
        recommendation,
        analyzedAt: new Date().toISOString(),
      };
      setResult(errResult);
      setStatus('fail');
      return errResult;
    }
  }, []);

  const analyze = useCallback(async (file: File, apiKey: string, customCriteria?: string, threshold?: number): Promise<InspectionResult | null> => {
    fileRef.current = file;
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    return runAnalysis(file, apiKey, customCriteria, threshold);
  }, [runAnalysis]);

  const reanalyze = useCallback(async (apiKey: string, customCriteria?: string, threshold?: number): Promise<InspectionResult | null> => {
    if (!fileRef.current) return null;
    return runAnalysis(fileRef.current, apiKey, customCriteria, threshold);
  }, [runAnalysis]);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setImagePreview(null);
    fileRef.current = null;
  }, []);

  return { status, result, imagePreview, analyze, reanalyze, reset };
}

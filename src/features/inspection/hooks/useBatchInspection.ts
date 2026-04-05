import { useState, useCallback } from 'react';
import { analyzeImage } from '../api/inspectionApi';
import { createThumbnail, fileToBase64 } from '../utils/thumbnail';
import type { InspectionResult } from '../types';

export interface BatchItem {
  id: string;
  file: File;
  fileName: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  result?: InspectionResult;
  thumbnail: string;
}

export function useBatchInspection(
  onItemComplete?: (result: InspectionResult, thumbnail: string, fileName: string) => void
) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const processItem = useCallback(async (item: BatchItem, apiKey: string, criteria?: string, threshold = 0) => {
    setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'analyzing' } : it));
    try {
      const base64 = await fileToBase64(item.file);
      const res = await analyzeImage(apiKey, base64, item.file.type, criteria);
      const finalRes = threshold > 0 && res.confidence < threshold && res.status !== 'fail'
        ? { ...res, status: 'fail' as const }
        : res;
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'done', result: finalRes } : it));
      onItemComplete?.(finalRes, item.thumbnail, item.fileName);
      return finalRes;
    } catch (e) {
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'error' } : it));
      return null;
    }
  }, [onItemComplete]);

  const startBatch = useCallback(async (files: File[], apiKey: string, criteria?: string, threshold?: number) => {
    if (isRunning) return;
    const initial: BatchItem[] = await Promise.all(
      files.map(async file => ({
        id: Math.random().toString(36).slice(2, 11),
        file,
        fileName: file.name,
        status: 'pending' as const,
        thumbnail: await createThumbnail(file, 80),
      }))
    );
    setItems(initial);
    setIsRunning(true);
    for (const item of initial) {
      await processItem(item, apiKey, criteria, threshold);
    }
    setIsRunning(false);
  }, [isRunning, processItem]);

  const retryItem = useCallback(async (id: string, apiKey: string, criteria?: string, threshold?: number) => {
    const item = items.find(it => it.id === id);
    if (!item || item.status === 'analyzing') return null;
    return processItem(item, apiKey, criteria, threshold ?? 0);
  }, [items, processItem]);

  const clearItems = useCallback(() => setItems([]), []);

  return { items, isRunning, startBatch, retryItem, clearItems };
}

import { useState, useCallback } from 'react';
import { inspectDie } from '../api/inspectionApi';
import { createThumbnail, prepareImageForUpload } from '../utils/thumbnail';
import { describeInspectionError } from '../utils/errors';
import type { InspectionResult, InspectionProgress } from '../types';

/** 批次上傳（操作）中的一張影像；判定完成後記到目前的批 (Lot)。 */
export interface UploadItem {
  id: string;
  file: File;
  fileName: string;
  progress: InspectionProgress | 'pending';
  result?: InspectionResult;
  error?: string;
  thumbnail: string;
}

export function useBatchInspection(
  onItemComplete?: (result: InspectionResult, thumbnail: string, fileName: string) => void,
) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const processItem = useCallback(async (item: UploadItem) => {
    setItems(prev => prev.map(it => (it.id === item.id ? { ...it, progress: 'analyzing', error: undefined } : it)));
    try {
      const { base64, mimeType } = await prepareImageForUpload(item.file);
      const res = await inspectDie(base64, mimeType);
      setItems(prev => prev.map(it => (it.id === item.id ? { ...it, progress: 'done', result: res } : it)));
      onItemComplete?.(res, item.thumbnail, item.fileName);
      return res;
    } catch (err) {
      const error = describeInspectionError(err);
      setItems(prev => prev.map(it => (it.id === item.id ? { ...it, progress: 'error', error } : it)));
      return null;
    }
  }, [onItemComplete]);

  const startBatch = useCallback(async (files: File[]) => {
    if (isRunning || files.length === 0) return;
    const initial: UploadItem[] = await Promise.all(
      files.map(async file => ({
        id: crypto.randomUUID(),
        file,
        fileName: file.name,
        progress: 'pending' as const,
        thumbnail: await createThumbnail(file, 80),
      })),
    );
    setItems(initial);
    setIsRunning(true);
    for (const item of initial) {
      await processItem(item);
    }
    setIsRunning(false);
  }, [isRunning, processItem]);

  const retryItem = useCallback(async (id: string) => {
    const item = items.find(it => it.id === id);
    if (!item || item.progress === 'analyzing' || isRunning) return null;
    return processItem(item);
  }, [items, isRunning, processItem]);

  const reset = useCallback(() => setItems([]), []);

  const progress = {
    done: items.filter(it => it.progress === 'done' || it.progress === 'error').length,
    total: items.length,
  };

  return { items, isRunning, progress, startBatch, retryItem, reset };
}

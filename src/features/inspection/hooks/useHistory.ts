import { useState, useCallback } from 'react';
import type { HistoryItem, InspectionResult } from '../types';

const STORAGE_KEY = 'inspection_history';
const MAX_ITEMS = 30;

function load(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>(load);

  const addRecord = useCallback((result: InspectionResult, thumbnail: string, fileName: string) => {
    setHistory(prev => {
      const mockLines = ['LINE-A', 'LINE-B', 'LINE-C'];
      const next: HistoryItem[] = [
        { 
          id: crypto.randomUUID(), 
          result, 
          thumbnail, 
          fileName,
          line: mockLines[Math.floor(Math.random() * mockLines.length)],
          batch: `B${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`
        },
        ...prev,
      ].slice(0, MAX_ITEMS);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return { history, addRecord, clearHistory };
}

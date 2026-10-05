import { useEffect, useState } from 'react';

/**
 * AI 服務是否可用。
 * - online：serverless functions 存在（Vercel 部署或 vercel dev）
 * - offline：靜態部署（GitHub Pages）或純 Vite 開發模式，/api/* 不存在
 *
 * 探測方式：對 /api/inspect 送空 body。函式存在時會在呼叫 Anthropic 之前就回 400 JSON，
 * 不產生任何 AI 費用；不存在時回 404／405 的 HTML 或連線失敗。
 */
export type ApiStatus = 'checking' | 'online' | 'offline';

let cached: Promise<ApiStatus> | null = null;

function probe(): Promise<ApiStatus> {
  cached ??= fetch('/api/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
    .then(res => ((res.headers.get('content-type') ?? '').includes('application/json') ? 'online' : 'offline') as ApiStatus)
    .catch(() => 'offline' as ApiStatus);
  return cached;
}

export function useApiStatus(): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>('checking');
  useEffect(() => {
    let alive = true;
    probe().then(s => { if (alive) setStatus(s); });
    return () => { alive = false; };
  }, []);
  return status;
}

export const OFFLINE_EXPLAINER =
  '此部署沒有 AI 服務（靜態版或純 Vite 開發模式）。標準樣本的標準答案、實驗中錄下的 AI 回覆、批紀錄與管制看板都能瀏覽；即時 AI 判定與處置單草擬需要 Vercel 部署或 vercel dev。';

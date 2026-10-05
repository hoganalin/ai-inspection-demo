import type { LotSignalContext } from '../../control/types';

/** 把批脈絡送到 /api/chat，逐段串流回 AI 草稿（純文字 chunk，無 SSE 框架）。 */
export async function streamActionPlanDraft(
  signal: LotSignalContext,
  today: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signal, today }),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = String(j.error);
    } catch { /* fall through to default message */ }
    throw new Error(msg);
  }
  if (!res.body) throw new Error('Response has no body — streaming unsupported in this environment.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value && value.byteLength > 0) onChunk(decoder.decode(value, { stream: true }));
  }
  const tail = decoder.decode();
  if (tail) onChunk(tail);
}

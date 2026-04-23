import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL, errorMessage, getClient, httpStatusFor } from './_lib.js';

const SYSTEM_BASE = `你是一個工廠產線 AI 助理，專門回答關於品質管控、設備維護、製程優化的問題。
規則：
- 用繁體中文回答，語氣專業簡潔
- 直接進入正題，不要每次都打招呼或問候
- 回答要針對問題，條列清楚`;

interface ClientMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  history: ClientMessage[];
  message: string;
  inspectionSummary?: string;
}

function buildSystem(inspectionSummary?: string): string {
  if (!inspectionSummary) return SYSTEM_BASE;
  return `${SYSTEM_BASE}
- 已載入最新檢測結果，回答時要結合該結果

最新檢測結果：${inspectionSummary}`;
}

function sanitizeHistory(history: ClientMessage[]): Anthropic.MessageParam[] {
  return history
    .filter(m => typeof m.content === 'string' && m.content.trim().length > 0)
    .map(m => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { history = [], message, inspectionSummary } = (req.body ?? {}) as RequestBody;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Missing message' });
  }

  const messages: Anthropic.MessageParam[] = [
    ...sanitizeHistory(history),
    { role: 'user', content: message },
  ];

  // Stream as plain chunked text — frontend reads via fetch + getReader().
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const client = getClient();
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 2048,
      system: buildSystem(inspectionSummary),
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(event.delta.text);
      }
    }
    res.end();
  } catch (err) {
    console.error('[/api/chat] error:', err);
    if (!res.headersSent) {
      res.status(httpStatusFor(err)).json({ error: errorMessage(err) });
    } else {
      // Already streaming — append a marker the frontend can surface.
      res.write(`\n\n[stream-error] ${errorMessage(err)}`);
      res.end();
    }
  }
}

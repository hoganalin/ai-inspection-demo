import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ChatMessage, ChatContext } from '../types';

function buildSystemContext(ctx?: ChatContext): string {
  const base = `你是一個工廠產線 AI 助理，專門回答關於品質管控、設備維護、製程優化的問題。
規則：
- 用繁體中文回答，語氣專業簡潔
- 直接進入正題，不要每次都打招呼或問候
- 回答要針對問題，條列清楚`;

  if (!ctx?.inspectionSummary) return base;

  return `${base}
- 已載入最新檢測結果，回答時要結合該結果

最新檢測結果：${ctx.inspectionSummary}`;
}

export async function streamChatMessage(
  apiKey: string,
  messages: ChatMessage[],
  newMessage: string,
  context: ChatContext | undefined,
  onChunk: (chunk: string) => void
): Promise<void> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const systemCtx = buildSystemContext(context);

  // Build history (exclude streaming messages)
  const userHistory = messages
    .filter((m) => !m.streaming)
    .map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: m.content }],
    }));

  // Prepend system context as a synthetic user+model exchange
  // This is the most reliable way to set system context across SDK versions
  const history = [
    { role: 'user' as const, parts: [{ text: systemCtx }] },
    { role: 'model' as const, parts: [{ text: '已理解。我會根據以上指示，用繁體中文專業地回答您的問題。' }] },
    ...userHistory,
  ];

  const chat = model.startChat({
    history,
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  });

  const result = await chat.sendMessageStream(newMessage);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) onChunk(text);
  }
}

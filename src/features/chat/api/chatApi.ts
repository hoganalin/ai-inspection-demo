import type { ChatMessage, ChatContext } from '../types';

export async function streamChatMessage(
  messages: ChatMessage[],
  newMessage: string,
  context: ChatContext | undefined,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const history = messages
    .filter(m => !m.streaming)
    .map(m => ({ role: m.role, content: m.content }));

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      history,
      message: newMessage,
      inspectionSummary: context?.inspectionSummary,
    }),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = String(j.error);
    } catch { /* fall through to default message */ }
    throw new Error(msg);
  }

  if (!res.body) {
    throw new Error('Response has no body — streaming unsupported in this environment.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value && value.byteLength > 0) {
      onChunk(decoder.decode(value, { stream: true }));
    }
  }

  const tail = decoder.decode();
  if (tail) onChunk(tail);
}

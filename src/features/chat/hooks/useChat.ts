import { useState, useCallback, useRef } from 'react';
import { streamChatMessage } from '../api/chatApi';
import type { ChatMessage, ChatContext } from '../types';

interface UseChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  sendMessage: (text: string, apiKey: string, context?: ChatContext) => Promise<void>;
  clearMessages: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Use refs to avoid stale closures and prevent duplicate sends
  const isStreamingRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const abortRef = useRef(false);

  // Keep messagesRef in sync with state
  const updateMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      messagesRef.current = next;
      return next;
    });
  }, []);

  const sendMessage = useCallback(
    async (text: string, apiKey: string, context?: ChatContext) => {
      // Use ref to prevent duplicate sends (avoids stale closure issue)
      if (isStreamingRef.current) return;
      isStreamingRef.current = true;
      setIsStreaming(true);
      abortRef.current = false;

      // Snapshot current messages before adding new ones (for API history)
      const previousMessages = messagesRef.current.filter((m) => !m.streaming);

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      };

      const assistantMsgId = `a-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        streaming: true,
      };

      updateMessages((prev) => [...prev, userMsg, assistantMsg]);

      try {
        await streamChatMessage(
          apiKey,
          previousMessages,
          text,
          context,
          (chunk) => {
            if (abortRef.current) return;
            updateMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: m.content + chunk }
                  : m
              )
            );
          }
        );
      } catch (err) {
        console.error('Chat error:', err);
        updateMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: `抱歉，發生錯誤：${err instanceof Error ? err.message : '未知錯誤'}。請重試。`,
                  streaming: false,
                }
              : m
          )
        );
      } finally {
        updateMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, streaming: false } : m
          )
        );
        isStreamingRef.current = false;
        setIsStreaming(false);
      }
    },
    [updateMessages]
  );

  const clearMessages = useCallback(() => {
    abortRef.current = true;
    messagesRef.current = [];
    setMessages([]);
    setIsStreaming(false);
    isStreamingRef.current = false;
  }, []);

  return { messages, isStreaming, sendMessage, clearMessages };
}

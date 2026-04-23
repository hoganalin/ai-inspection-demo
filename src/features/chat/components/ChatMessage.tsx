import React from 'react';
import type { ChatMessage as IChatMessage } from '../types';

interface Props {
  message: IChatMessage;
}

export const ChatMessageBubble: React.FC<Props> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`msg-enter flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5"
        style={{
          background: isUser
            ? 'rgba(0,212,255,0.15)'
            : 'rgba(99,102,241,0.15)',
          border: `1px solid ${isUser ? 'rgba(0,212,255,0.3)' : 'rgba(99,102,241,0.3)'}`,
          color: isUser ? 'var(--factory-accent)' : '#818cf8',
        }}
      >
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Bubble */}
      <div
        className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
        style={{
          background: isUser
            ? 'rgba(0,212,255,0.1)'
            : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isUser ? 'rgba(0,212,255,0.2)' : 'var(--factory-border)'}`,
          color: 'var(--factory-text)',
        }}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        
        {message.imageUrl && (
          <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
            <img src={message.imageUrl} alt="AI Generated" style={{ width: '100%' }} />
          </div>
        )}

        {message.isImageLoading && (
          <div className="mt-3 p-4 bg-white/5 rounded-lg text-xs text-blue-400 animate-pulse">
            ✨ 正在使用 Claude 生成模擬圖...
          </div>
        )}

        {message.streaming && (
          <span
            className="inline-block w-0.5 h-4 bg-[var(--factory-accent)] cursor-blink ml-0.5 align-middle"
          />
        )}
      </div>
    </div>
  );
};

export default ChatMessageBubble;

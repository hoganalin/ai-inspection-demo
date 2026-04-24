import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '../hooks/useChat';
import type { ChatContext, ChatMessage } from '../types';
import { Icon } from '../../../components/muji/Icon';

interface Props {
  context?: ChatContext;
}

export const ChatPanel: React.FC<Props> = ({ context }) => {
  const { messages, isStreaming, sendMessage, clearMessages } = useChat();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const linked = !!context?.inspectionSummary;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    setInput('');
    await sendMessage(text.trim(), context);
  }, [isStreaming, context, sendMessage]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  }, [input, send]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--paper-soft)' }}>
      {/* ─── 諮詢服務台 header ─── */}
      <div style={{
        padding: '20px 28px',
        borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
        background: 'var(--paper-soft)',
      }}>
        <div className="ai-avatar" style={{ width: 40, height: 40, fontSize: 18 }}>語</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--ink)', letterSpacing: '0.1em' }}>
            諮詢服務台
          </div>
          <div className="label-en" style={{ fontSize: 9, marginTop: 2 }}>
            AI ASSISTANT · {linked ? 'CONTEXT LINKED' : 'READY'}
          </div>
        </div>
        {linked && (
          <div style={{
            padding: '4px 10px',
            background: 'var(--clay-bg)',
            border: '1px solid var(--clay)',
            borderRadius: 2,
            fontFamily: 'var(--font-serif)',
            fontSize: 11, color: 'var(--clay-deep)',
            letterSpacing: '0.1em',
          }}>
            已連動
          </div>
        )}
        {messages.length > 0 && (
          <button onClick={clearMessages} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}>
            清空
          </button>
        )}
      </div>

      {/* ─── Messages ─── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 ? (
          <EmptyState linked={linked} onQuick={send} disabled={isStreaming} />
        ) : (
          messages.map((m) => <Bubble key={m.id} message={m} />)
        )}
        {isStreaming && messages[messages.length - 1]?.role === 'user' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className="label-en" style={{ fontSize: 9, marginBottom: 4, padding: '0 6px' }}>AI</div>
            <div className="bubble ai"><span className="soft-loader"><span/><span/><span/></span></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ─── Input ─── */}
      <div style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--line)', background: 'var(--paper-soft)' }}>
        <div className="input-bar">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isStreaming}
            placeholder={linked ? '針對此檢測結果詢問…' : '請問想了解什麼？'}
            rows={1}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || isStreaming}
            style={{
              width: 36, height: 36,
              border: '1px solid ' + (input.trim() ? 'var(--clay)' : 'var(--line)'),
              background: input.trim() ? 'var(--clay)' : 'transparent',
              color: input.trim() ? 'var(--paper-soft)' : 'var(--ink-mute)',
              borderRadius: 2,
              cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            <Icon.Send width={14} height={14} />
          </button>
        </div>
        <div className="label-en" style={{ fontSize: 9, marginTop: 8, textAlign: 'center' }}>
          Enter 送出 · Shift + Enter 換行
        </div>
      </div>
    </div>
  );
};

/* ─── Empty state (諮詢 seal + 問題卡) ─── */
const EmptyState: React.FC<{ linked: boolean; onQuick: (q: string) => void; disabled: boolean }> = ({ linked, onQuick, disabled }) => {
  const questions = linked
    ? [
        { cn: '此瑕疵的可能成因？',    en: 'ROOT CAUSE ANALYSIS' },
        { cn: '產線該如何處置此批？',  en: 'BATCH HANDLING' },
        { cn: '預防方案與 SOP 調整',   en: 'PREVENTION & SOP' },
        { cn: '針對同類瑕疵的趨勢',    en: 'DEFECT TRENDS' },
      ]
    : [
        { cn: '請問怎麼開始檢測？',    en: 'HOW TO START' },
        { cn: '支援哪些圖片格式？',    en: 'SUPPORTED FORMATS' },
        { cn: '信心度閾值如何設定？',  en: 'CONFIDENCE TUNING' },
        { cn: '批次模式能處理多少張？', en: 'BATCH LIMIT' },
      ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 28 }}>
      {/* 雙圓印 */}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        border: '1px solid var(--clay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--paper-soft)',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          border: '1px solid var(--clay-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-serif)',
          fontSize: 22, color: 'var(--clay-deep)',
          letterSpacing: '0.05em',
        }}>
          諮詢
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', letterSpacing: '0.15em', marginBottom: 6 }}>
          歡迎隨時提問
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.9, maxWidth: 280 }}>
          {linked
            ? '您可以針對目前的檢測報告提出任何問題'
            : '歡迎詢問關於品質檢測的任何事項'}
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {questions.map((q, i) => (
          <button
            key={i}
            className="cta-card"
            onClick={() => !disabled && onQuick(q.cn)}
            disabled={disabled}
            style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
          >
            <div className="cta-num">{String(i + 1).padStart(2, '0')}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--ink)', marginBottom: 2 }}>
                {q.cn}
              </div>
              <div className="label-en" style={{ fontSize: 9 }}>{q.en}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

/* ─── Bubble ─── */
const Bubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <div className="anim-in" style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <div className="label-en" style={{ fontSize: 9, marginBottom: 4, padding: '0 6px' }}>
        {isUser ? '使用者' : 'AI'}
      </div>
      <div className={`bubble ${isUser ? 'user' : 'ai'}`}>
        {message.content}
      </div>
    </div>
  );
};

export default ChatPanel;

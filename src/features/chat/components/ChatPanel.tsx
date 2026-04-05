import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '../hooks/useChat';
import type { ChatContext, ChatMessage } from '../types';

interface Props {
  apiKey: string;
  context?: ChatContext;
}


export const ChatPanel: React.FC<Props> = ({ apiKey, context }) => {
  const { messages, isStreaming, sendMessage, clearMessages } = useChat();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming || !apiKey) return;
    setInput('');
    await sendMessage(text.trim(), apiKey, context);
  }, [isStreaming, apiKey, context, sendMessage]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  }, [input, send]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(0,0,0,0.1)' }}>

      {/* Panel header */}
      <div className="glass-panel" style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <div className="ai-avatar" style={{ width: 32, height: 32, borderRadius: 8, fontSize: 14 }}>🤖</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>視覺分析助手</div>
          <div className="ai-status" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
            {context?.inspectionSummary ? 'CONTEXT LINKED' : 'READY TO ANALYZE'}
          </div>
        </div>
        {context?.inspectionSummary && (
          <div className="status-badge" style={{ padding: '3px 8px', fontSize: 10, background: 'rgba(79,124,255,0.15)', color: 'var(--primary)' }}>
            LIQUID
          </div>
        )}
        {messages.length > 0 && (
          <button onClick={clearMessages} className="btn-ghost" style={{ padding: '4px 10px', fontSize: 10, borderRadius: 6 }}>
            清空
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 ? (
          <EmptyState context={context} onQuick={q => send(q)} disabled={!apiKey || isStreaming} />
        ) : (
          messages.map(m => <Bubble key={m.id} message={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'rgba(11, 15, 26, 0.4)' }}>
        {!apiKey && (
          <div style={{
            fontSize: 11, color: 'var(--warning)', textAlign: 'center',
            marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <span>⚠</span><span>請先設定 API Key 以啟用 AI 助理</span>
          </div>
        )}
        <div className="input-bar" style={{
          display: 'flex', gap: 12, alignItems: 'center',
          padding: '0 10px 0 18px',
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={!apiKey || isStreaming}
            placeholder={apiKey ? '詢問關於此項目的分析建議...' : '請先設定 API Key'}
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              resize: 'none', fontSize: 13, color: '#fff', lineHeight: 1.6,
              minHeight: 24, maxHeight: 120, overflowY: 'auto',
            }}
            onInput={e => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || !apiKey || isStreaming}
            style={{
              width: 36, height: 36, borderRadius: 10, border: 'none', flexShrink: 0,
              background: input.trim() && apiKey && !isStreaming ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
              color: '#fff', cursor: input.trim() && apiKey && !isStreaming ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              boxShadow: input.trim() && apiKey && !isStreaming ? '0 4px 12px rgba(79,124,255,0.3)' : 'none',
            }}
          >
            {isStreaming ? (
              <span className="spin" style={{ display: 'block', width: 14, height: 14, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent' }} />
            ) : (
              <svg width={18} height={18} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ context?: ChatContext; onQuick: (q: string) => void; disabled: boolean }> = ({ context, onQuick, disabled }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '40px 0' }}>
    <div className="ai-avatar" style={{ width: 64, height: 64, borderRadius: 16, fontSize: 32 }}>🤖</div>
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>分析助理就緒</p>
      <p style={{ fontSize: 13, color: 'var(--neutral-400)', lineHeight: 1.6, maxWidth: 240, margin: '0 auto' }}>
        {context?.inspectionSummary 
          ? '您可以針對目前的檢測報告詢問細節或優化建議'
          : '請依照以下流程啟動智慧檢測分析'}
      </p>
    </div>

    {!context?.inspectionSummary && (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 280 }}>
        {[
          { icon: '📸', title: '1. 上傳樣本', desc: '拖放或點擊左側區域上傳' },
          { icon: '🧠', title: '2. AI 自動分析', desc: 'Gemini 3.1 深度視覺掃描' },
          { icon: '📊', title: '3. 獲取洞察', desc: '查看瑕疵分佈與修復建議' }
        ].map((step, idx) => (
          <div key={idx} className="guide-step">
            <div className="guide-idx">{idx + 1}</div>
            <div style={{ fontSize: 20 }}>{step.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{step.title}</div>
              <div style={{ fontSize: 11, color: 'var(--neutral-400)' }}>{step.desc}</div>
            </div>
          </div>
        ))}
      </div>
    )}

    {context?.inspectionSummary && (
      <div className="assistant-cta-grid" style={{ width: '100%', maxWidth: 360 }}>
        {[
          { type: 'AI ANALYZE', title: '核心缺陷深度分析', meta: '摘要報告 • ~5s', q: '請詳細分析此項目的核心缺陷原因' },
          { type: 'OPTIMIZE', title: '預防與流程優化', meta: 'SOP 建議 • ~8s', q: '針對此瑕疵提供生產流程改進建議' },
          { type: 'ACTION', title: '產線處置方案', meta: '處置指南 • ~3s', q: '此項目目前的狀態應如何進行產線處置？' }
        ].map(cta => (
          <div
            key={cta.title}
            onClick={() => !disabled && onQuick(cta.q)}
            className="assistant-cta anim-in"
            style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
          >
            <div className="assistant-cta-type">{cta.type}</div>
            <div className="assistant-cta-title">{cta.title}</div>
            <div className="assistant-cta-meta">{cta.meta}</div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const Bubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <div className="anim-in" style={{
      display: 'flex', gap: 12,
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        background: isUser ? 'linear-gradient(135deg, var(--primary), var(--accent))' : 'rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: '#fff',
        boxShadow: isUser ? '0 4px 10px rgba(79,124,255,0.3)' : 'none',
      }}>
        {isUser ? 'U' : 'AI'}
      </div>
      <div style={{
        maxWidth: '85%',
        background: isUser ? 'rgba(79,124,255,0.1)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isUser ? 'rgba(79,124,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        padding: '12px 16px',
        fontSize: 13, color: isUser ? '#fff' : 'rgba(255,255,255,0.9)', lineHeight: 1.6,
      }}>
        <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</p>
      </div>
    </div>
  );
};

export default ChatPanel;

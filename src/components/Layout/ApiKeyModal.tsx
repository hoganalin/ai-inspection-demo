import React, { useState } from 'react';

interface Props {
  onSave: (key: string) => void;
}

export const ApiKeyModal: React.FC<Props> = ({ onSave }) => {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSave(value.trim());
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div className="glass-panel" style={{
        width: '100%', maxWidth: 440,
        padding: '40px 32px',
        borderRadius: '24px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
        textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'linear-gradient(135deg, var(--primary), var(--accent))',
          margin: '0 auto 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32,
          boxShadow: '0 8px 16px rgba(79,124,255,0.4)',
        }}>🔑</div>

        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 12, letterSpacing: '-0.02em' }}>
          歡迎使用 QualityAI
        </h2>
        <p style={{ fontSize: 14, color: 'var(--subtext)', lineHeight: 1.6, marginBottom: 32 }}>
          本展示專案需要 Gemini API 才能運作。<br />
          請填入您的 API Key 開始體驗智慧檢測。
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              placeholder="貼上您的 Gemini API Key..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '16px 20px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: 15,
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{
              padding: '16px',
              fontSize: 16,
              fontWeight: 700,
              borderRadius: 14,
              cursor: 'pointer',
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              boxShadow: '0 8px 16px rgba(79,124,255,0.3)',
            }}
          >
            啟動人工智慧檢測
          </button>
        </form>

        <div style={{ marginTop: 24 }}>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
          >
            如何取得免費的 API Key? ↗
          </a>
        </div>
      </div>
    </div>
  );
};

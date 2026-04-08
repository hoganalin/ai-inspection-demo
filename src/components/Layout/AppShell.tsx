import React from 'react';

interface Props {
  children: React.ReactNode;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export const AppShell: React.FC<Props> = ({ children, apiKey, onApiKeyChange }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>
      <Header apiKey={apiKey} onApiKeyChange={onApiKeyChange} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
};

const Header: React.FC<{ apiKey: string; onApiKeyChange: (key: string) => void }> = ({ apiKey, onApiKeyChange }) => {
  const [showInput, setShowInput] = React.useState(!apiKey);
  const apiKeySet = !!apiKey;

  return (
    <header className="glass-panel app-header" style={{
      height: 64,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 100,
      flexShrink: 0,
      borderTop: 'none',
      borderLeft: 'none',
      borderRight: 'none',
      padding: '0 20px',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, var(--primary), var(--accent))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: '#fff', fontWeight: 800,
          boxShadow: '0 4px 12px rgba(79,124,255,0.3)',
          flexShrink: 0,
        }}>Q</div>
        <div className="header-logo-text">
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            QualityAI
          </div>
          <div className="header-subtitle" style={{ fontSize: 10, color: 'var(--subtext)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Vision Platform
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* API Key Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {showInput ? (
            <input
              type="password"
              placeholder="輸入 Gemini API Key..."
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              onBlur={() => apiKey && setShowInput(false)}
              className="glass-panel"
              style={{
                fontSize: 12,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'rgba(0,0,0,0.3)',
                color: '#fff',
                width: 180,
                outline: 'none',
              }}
            />
          ) : (
            <div
              onClick={() => setShowInput(true)}
              className={apiKeySet ? 'status-badge' : ''}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: apiKeySet ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: apiKeySet ? '#22C55E' : 'var(--danger)',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 14 }}>{apiKeySet ? '🟢' : '🔴'}</span>
              <span className="api-status-text">{apiKeySet ? 'API 已連線' : 'API 未設定 (點擊填寫)'}</span>
            </div>
          )}
        </div>

        <div className="header-divider" style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />

        {/* System Status — hidden on mobile via CSS */}
        <div className="header-system-status" style={{ gap: 14 }}>
          <SystemStatus label="Gemini 2.5 Flash" active={apiKeySet} />
        </div>
      </div>
    </header>
  );
};

const SystemStatus: React.FC<{ label: string; active: boolean }> = ({ label, active }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <div
      style={{
        width: 8, height: 8, borderRadius: '50%',
        background: active ? 'var(--success)' : 'rgba(255,255,255,0.2)',
        boxShadow: active ? '0 0 10px rgba(34,197,94,0.5)' : 'none',
      }}
    />
    <span style={{ fontSize: 12, color: 'var(--subtext)', fontWeight: 500 }}>{label}</span>
  </div>
);

export default AppShell;

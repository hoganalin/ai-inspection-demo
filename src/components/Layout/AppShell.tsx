import React from 'react';

interface Props {
  children: React.ReactNode;
  apiKeySet: boolean;
}

export const AppShell: React.FC<Props> = ({ children, apiKeySet }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>
      <Header apiKeySet={apiKeySet} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
};

const Header: React.FC<{ apiKeySet: boolean }> = ({ apiKeySet }) => (
  <header className="glass-panel" style={{
    height: 64,
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
    flexShrink: 0,
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
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
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          QualityAI
        </div>
        <div className="header-subtitle" style={{ fontSize: 10, color: 'var(--subtext)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Vision Platform
        </div>
      </div>
    </div>

    {/* Right Actions */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      {/* System Status — hidden on tablet/mobile via CSS */}
      <div className="header-system-status" style={{ display: 'flex', gap: 14 }}>
        <SystemStatus label="Gemini 3.1" active={apiKeySet} />
        <SystemStatus label="Vision AI" active={apiKeySet} />
      </div>

      <div className="header-divider" style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />

      {/* API Status Badge */}
      <div
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
        }}
      >
        <span style={{ fontSize: 14 }}>{apiKeySet ? '🟢' : '🔴'}</span>
        <span className="header-subtitle">{apiKeySet ? 'API 已連線' : 'API 未設定'}</span>
      </div>
    </div>
  </header>
);

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

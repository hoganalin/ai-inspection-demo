import React from 'react';

interface Props {
  children: React.ReactNode;
}

export const AppShell: React.FC<Props> = ({ children }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>
      <Header />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
};

const Header: React.FC = () => {
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
        <div className="status-badge" style={{
          padding: '6px 12px',
          borderRadius: 999,
          background: 'rgba(34,197,94,0.15)',
          color: '#22C55E',
          fontSize: 12,
          fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 14 }}>🟢</span>
          <span className="api-status-text">伺服器 API 已連線</span>
        </div>

        <div className="header-divider" style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />

        {/* System Status — hidden on mobile via CSS */}
        <div className="header-system-status" style={{ gap: 14 }}>
          <SystemStatus label="Claude Sonnet 4.6" />
        </div>
      </div>
    </header>
  );
};

const SystemStatus: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <div
      style={{
        width: 8, height: 8, borderRadius: '50%',
        background: 'var(--success)',
        boxShadow: '0 0 10px rgba(34,197,94,0.5)',
      }}
    />
    <span style={{ fontSize: 12, color: 'var(--subtext)', fontWeight: 500 }}>{label}</span>
  </div>
);

export default AppShell;

import React, { useEffect, useState } from 'react';

interface Props {
  children: React.ReactNode;
}

export const AppShell: React.FC<Props> = ({ children }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--paper)' }}>
      <Header />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
};

const useClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
};

const Header: React.FC = () => {
  const now = useClock();
  const dateStr = now.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <header className="app-header">
      {/* 書法印章「檢」字 */}
      <div className="seal" title="品質檢查">檢</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: '0.18em',
          color: 'var(--ink)',
          lineHeight: 1.2,
        }}>
          品質視覺檢查
        </div>
        <div className="label-en header-subtitle" style={{ letterSpacing: '0.3em' }}>
          VISUAL QUALITY INSPECTION · Vol.04
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        {/* 日期 + 時間 */}
        <div style={{ textAlign: 'right' }} className="header-system-status">
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 12, color: 'var(--ink-soft)', letterSpacing: '0.1em' }}>
            {dateStr}
          </div>
          <div className="label-en" style={{ fontSize: 9, marginTop: 2 }}>
            {timeStr}
          </div>
        </div>

        <div className="header-divider" style={{ width: 1, height: 28, background: 'var(--line)' }} />

        {/* Claude 運作中 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="breathe" style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--matcha)',
          }} />
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 12, color: 'var(--ink)', letterSpacing: '0.05em' }}>
              Claude 4.6
            </div>
            <div className="label-en api-status-text" style={{ fontSize: 9, marginTop: 1 }}>
              運作中 · ONLINE
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppShell;

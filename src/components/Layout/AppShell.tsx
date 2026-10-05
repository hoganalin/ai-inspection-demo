import React from 'react';
import { Icon } from '../ui/icons';
import { DieMark } from '../ui/marks';
import type { ApiStatus } from '../../hooks/useApiStatus';

export type Page = 'overview' | 'inspect' | 'lot' | 'records' | 'control';

interface NavItem {
  key: Page;
  label: string;
  IconCmp: React.FC<React.SVGProps<SVGSVGElement>>;
}

const NAV: NavItem[] = [
  { key: 'overview', label: '專案總覽', IconCmp: Icon.Overview },
  { key: 'inspect',  label: '單張判定', IconCmp: Icon.Search },
  { key: 'lot',      label: '批檢驗',   IconCmp: Icon.Layers },
  { key: 'records',  label: '批紀錄',   IconCmp: Icon.Records },
  { key: 'control',  label: '管制看板', IconCmp: Icon.Chart },
];

interface Props {
  page: Page;
  onNavigate: (page: Page) => void;
  apiStatus: ApiStatus;
  lotCount: number;
  outOfControlCount: number;
  warningSignalCount: number;
  children: React.ReactNode;
}

const API_LABEL: Record<ApiStatus, string> = {
  checking: '確認中…',
  online: '已連線',
  offline: '未連線：沒有 /api',
};

export const AppShell: React.FC<Props> = ({
  page, onNavigate, apiStatus, lotCount, outOfControlCount, warningSignalCount, children,
}) => {
  const signalCount = outOfControlCount + warningSignalCount;
  return (
    <div className="shell">
      <aside className="rail" aria-label="主選單">
        <a
          className="rail-mark"
          href="#/overview"
          onClick={e => { e.preventDefault(); onNavigate('overview'); }}
        >
          <DieMark />
          <span>
            <span className="rail-mark-name" style={{ display: 'block' }}>晶粒外觀檢查改善</span>
            <span className="rail-mark-sub" style={{ display: 'block' }}>PDCA · 檢驗規範 v1</span>
          </span>
        </a>

        <nav className="rail-nav">
          {NAV.map(item => {
            const count = item.key === 'records' ? lotCount : item.key === 'control' ? signalCount : 0;
            const countClass = item.key === 'control' && count > 0
              ? (outOfControlCount > 0 ? ' is-out' : ' is-warn')
              : '';
            return (
              <a
                key={item.key}
                href={`#/${item.key}`}
                className="rail-link"
                aria-current={page === item.key ? 'page' : undefined}
                onClick={e => { e.preventDefault(); onNavigate(item.key); }}
              >
                <item.IconCmp width={18} height={18} />
                {item.label}
                {count > 0 && (
                  <span
                    className={'rail-count' + countClass}
                    title={item.key === 'control' ? `異常 ${outOfControlCount} 批・預警 ${warningSignalCount} 批` : `${count} 個批`}
                  >
                    {count}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        <p className="rail-mobile-note">情境與數據皆為模擬・允收數值為假設值</p>

        <dl className="rail-foot">
          <div>
            <dt>判定依據</dt>
            <dd>檢驗規範 v1・5 µm/px</dd>
          </div>
          <div>
            <dt>AI 服務</dt>
            <dd>
              <span className={`rail-status is-${apiStatus}`}>{API_LABEL[apiStatus]}</span>
            </dd>
          </div>
          <div className="rail-disclosure">
            <strong>情境與數據皆為模擬。</strong>樣本為半合成影像，允收數值為假設值，非業界標準。
          </div>
        </dl>
      </aside>

      <main className="main" id="main">
        {children}
      </main>
    </div>
  );
};

export default AppShell;

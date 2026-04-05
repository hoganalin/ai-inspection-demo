import React, { useState, useCallback, useMemo, useEffect } from "react";
import { AppShell } from "./components/Layout/AppShell";
import {
  ImageUploader,
  InspectionResultPanel,
  HistoryPanel,
  StatsDashboard,
  BatchInspectionPanel,
  ComparisonPanel,
  useInspection,
  useHistory,
} from "./features/inspection";
import { createThumbnail } from "./features/inspection/utils/thumbnail";
import { ChatPanel } from "./features/chat";

type Tab = "inspect" | "batch" | "compare" | "history" | "stats";

const TABS: { key: Tab; label: string }[] = [
  { key: "inspect", label: "單張" },
  { key: "batch",   label: "批次" },
  { key: "compare", label: "A/B" },
  { key: "history", label: "歷史" },
  { key: "stats",   label: "統計" },
];

const App: React.FC = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;
  const [activeTab, setActiveTab] = useState<Tab>("inspect");
  const [mobilePanel, setMobilePanel] = useState<'inspect' | 'chat'>('inspect');
  const [customPrompt, setCustomPrompt] = useState(
    () => localStorage.getItem('inspection_custom_prompt') || ''
  );
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(
    () => Number(localStorage.getItem('inspection_confidence_threshold') ?? 0)
  );

  useEffect(() => {
    localStorage.setItem('inspection_custom_prompt', customPrompt);
  }, [customPrompt]);

  useEffect(() => {
    localStorage.setItem('inspection_confidence_threshold', String(confidenceThreshold));
  }, [confidenceThreshold]);

  const { status, result, imagePreview, analyze, reanalyze, reset } =
    useInspection();
  const { history, addRecord, clearHistory } = useHistory();
  const [focusedHistoryId, setFocusedHistoryId] = useState<string | null>(null);

  const focusedItem = useMemo(() => {
    if (activeTab === 'history' && focusedHistoryId) {
      return history.find(h => h.id === focusedHistoryId);
    }
    return null;
  }, [activeTab, focusedHistoryId, history]);

  const customCriteria = customPrompt.trim() || undefined;

  const handleFileSelect = useCallback(
    async (file: File) => {
      const [thumbnail, analysisResult] = await Promise.all([
        createThumbnail(file),
        analyze(file, apiKey, customCriteria, confidenceThreshold),
      ]);
      if (analysisResult) addRecord(analysisResult, thumbnail, file.name);
    },
    [apiKey, analyze, addRecord, customCriteria],
  );

  const handleReanalyze = useCallback(async () => {
    if (!reanalyze || !imagePreview) return;
    const analysisResult = await reanalyze(apiKey, customCriteria, confidenceThreshold);
    if (analysisResult) {
      const thumbnail = imagePreview;
      addRecord(analysisResult, thumbnail, "reanalyzed");
    }
  }, [reanalyze, apiKey, customCriteria, imagePreview, addRecord]);

  const chatContext = useMemo(() => {
    // 優先使用選中的歷史紀錄上下文
    if (activeTab === 'history' && focusedItem) {
      return {
        inspectionSummary: `這是來自歷史紀錄的資料：\n- 狀態：${focusedItem.result.status}\n- 信心度：${focusedItem.result.confidence}%\n- 統計摘要：${focusedItem.result.summary}`,
      };
    }
    // 其次使用當前檢測結果
    if (result) {
      return {
        inspectionSummary: `這是目前即時檢測的資料：\n- 狀態：${result.status}\n- 信心度：${result.confidence}%\n- 統計摘要：${result.summary}`,
      };
    }
    return undefined;
  }, [result, focusedItem, activeTab]);

  // Derived stats for the inspect tab header
  const todayCount = history.filter((h) => {
    const d = new Date(h.result.analyzedAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;
  const totalPass = history.filter((h) => h.result.status === "pass").length;
  const overallPassRate =
    history.length > 0 ? Math.round((totalPass / history.length) * 100) : null;

  return (
    <AppShell apiKeySet={!!apiKey}>

      {/* Main Layout */}
      <div className="app-layout">
        {/* Left — Inspection */}
        <div className={`panel-left${activeTab === 'batch' || activeTab === 'compare' ? ' panel-left--wide' : ''}${mobilePanel !== 'inspect' ? ' panel-hidden' : ''}`}>
          {/* Panel header */}
          <div
            style={{
              padding: "24px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexShrink: 0,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div className="feature-icon" style={{ width: 44, height: 44, borderRadius: 12, fontSize: 18 }}>🔍</div>
            <div style={{ flex: 1 }}>
              <div className="ai-model" style={{ fontWeight: 700, color: "#fff", letterSpacing: '-0.02em', lineHeight: 1 }}>
                品質視覺分析
              </div>
              <div className="ai-status" style={{ fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="spin" style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid currentColor', borderTopColor: 'transparent' }}></span>
                GEMINI 3.1 FLASH ACTIVE
              </div>
            </div>
            {status !== "idle" && <StatusBadge status={status} />}
          </div>

          {/* Tab bar */}
          <div className="glass-panel"
            style={{
              display: "flex",
              gap: 4,
              padding: "12px",
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
            }}
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    borderRadius: "10px",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    background: active ? 'rgba(79,124,255,0.15)' : 'transparent',
                    color: active ? 'var(--primary)' : 'var(--subtext)',
                    boxShadow: active ? 'inset 0 0 0 1px rgba(79,124,255,0.2)' : 'none',
                    position: "relative",
                  }}
                >
                  {tab.label}
                  {tab.key === "history" && history.length > 0 && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        background: active ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                        color: "#fff",
                        borderRadius: 10,
                        padding: "0 5px",
                        verticalAlign: 'text-bottom',
                      }}
                    >
                      {history.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Panel body */}
          <div
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* ── 單張檢測 tab ── */}
            {activeTab === "inspect" && (
              <>
                {/* Mini stats */}
                 <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4,1fr)",
                    gap: 10,
                  }}
                >
                  <StatCard
                    label="今日檢測"
                    value={String(todayCount)}
                    unit={<span style={{ color: 'var(--neutral-400)' }}>ITEMS</span>}
                  />
                  <StatCard
                    label="通過率"
                    value={overallPassRate !== null ? `${overallPassRate}` : "0"}
                    unit={<span style={{ color: 'var(--success)' }}>↗ 2.4%</span>}
                  />
                  <StatCard
                    label="不良件數"
                    value={String(history.filter(h => h.result.status === 'fail').length)}
                    unit={<span style={{ color: 'var(--danger)' }}>件</span>}
                    sparkData={[10, 50, 20, 80, 40]}
                  />
                  <StatCard 
                    label="系統狀態" 
                    value="ACTIVE" 
                    unit={
                      <div className="spin" style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--success)', borderTopColor: 'transparent' }} />
                    } 
                  />
                </div>

                {/* Custom criteria toggle */}
                <div>
                  <button
                    onClick={() => setShowCustomPrompt((p) => !p)}
                    className="btn-ghost"
                    style={{
                      fontSize: 11,
                      padding: "4px 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 13 }}>
                      {showCustomPrompt ? "▾" : "▸"}
                    </span>
                    自訂檢測標準
                    {customCriteria && (
                      <span style={{ color: "var(--blue)", marginLeft: 4 }}>
                        ●
                      </span>
                    )}
                  </button>
                  {showCustomPrompt && (
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="例：重點檢查焊點品質、錫球大小是否均勻..."
                      rows={3}
                      style={{
                        width: "100%",
                        marginTop: 8,
                        padding: "8px 10px",
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        color: "var(--text)",
                        fontSize: 12,
                        resize: "vertical",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  )}
                </div>

                {/* Confidence Threshold */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="section-label" style={{ flexShrink: 0 }}>信心度閾值</span>
                  <input
                    type="range" min={0} max={95} step={5}
                    value={confidenceThreshold}
                    onChange={e => setConfidenceThreshold(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--blue)' }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600, color: confidenceThreshold > 0 ? 'var(--amber)' : 'var(--text-muted)', minWidth: 40, textAlign: 'right' }}>
                    {confidenceThreshold > 0 ? `< ${confidenceThreshold}%` : '關閉'}
                  </span>
                </div>

                {/* Uploader */}
                <div>
                  <p className="section-label" style={{ marginBottom: 8 }}>
                    上傳待測圖片
                  </p>
                  <ImageUploader
                    imagePreview={imagePreview}
                    status={status}
                    onFileSelect={handleFileSelect}
                    onReset={reset}
                  />
                </div>

                {/* Reanalyze button */}
                {result && reanalyze && (
                  <button
                    onClick={handleReanalyze}
                    disabled={status === "analyzing"}
                    className="btn-ghost"
                    style={{
                      fontSize: 12,
                      padding: "6px 12px",
                      alignSelf: "flex-start",
                    }}
                  >
                    🔄 重新分析
                  </button>
                )}

                {/* Result */}
                {result && (
                  <div>
                    <p className="section-label" style={{ marginBottom: 8 }}>
                      檢測報告
                    </p>
                    <InspectionResultPanel result={result} />
                  </div>
                )}

                {/* Placeholder when idle */}
                {status === "idle" && !result && (
                  <div
                    style={{
                      padding: "20px",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-dim)",
                      background: "var(--bg-elevated)",
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        lineHeight: 1.6,
                      }}
                    >
                      上傳圖片後，AI 將自動分析並生成
                      <br />
                      詳細的品質檢測報告
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ── 批次 tab ── */}
            {activeTab === "batch" && (
              <BatchInspectionPanel
                apiKey={apiKey}
                customCriteria={customCriteria}
                threshold={confidenceThreshold}
                onRecordAdded={(result, thumbnail, fileName) =>
                  addRecord(result, thumbnail, fileName)
                }
              />
            )}

            {/* ── A/B 比對 tab ── */}
            {activeTab === "compare" && (
              <ComparisonPanel apiKey={apiKey} customCriteria={customCriteria} />
            )}

            {/* ── 歷史 tab ── */}
            {activeTab === "history" && (
              <HistoryPanel 
                history={history} 
                onClear={clearHistory} 
                onSelectItem={(id) => setFocusedHistoryId(id)}
              />
            )}

            {/* ── 統計 tab ── */}
            {activeTab === "stats" && <StatsDashboard history={history} />}
          </div>
        </div>

        {/* Right — Chat */}
        <div className={`panel-right${mobilePanel !== 'chat' ? ' panel-hidden' : ''}`}>
          <ChatPanel apiKey={apiKey} context={chatContext} />
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        <button
          className={`mobile-nav-btn${mobilePanel === 'inspect' ? ' active' : ''}`}
          onClick={() => setMobilePanel('inspect')}
        >
          <span className="nav-icon">🔍</span>
          檢測
        </button>
        <button
          className={`mobile-nav-btn${mobilePanel === 'chat' ? ' active' : ''}`}
          onClick={() => setMobilePanel('chat')}
        >
          <span className="nav-icon">💬</span>
          對話
        </button>
      </nav>
    </AppShell>
  );
};

/* ── Stat Card ───────────────────────────────────────── */
interface StatCardProps {
  label: string;
  value: string;
  unit: React.ReactNode;
  sparkData?: number[];
}

const StatCard: React.FC<StatCardProps> = ({ label, value, unit, sparkData }) => (
  <div className="kpi-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div className="section-label">{label}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>{value}</span>
      <span style={{ fontSize: 11 }}>{unit}</span>
    </div>
    {sparkData && (
      <div className="sparkline-container">
        {sparkData.map((v, i) => (
          <div key={i} className="spark-bar" style={{ height: `${(v / Math.max(...sparkData)) * 100}%` }} />
        ))}
      </div>
    )}
  </div>
);

/* ── Status Badge ────────────────────────────────────── */
const STATUS_COLOR: Record<string, string> = {
  pass: 'var(--success)', fail: 'var(--danger)', warning: 'var(--warning)', analyzing: 'var(--blue)', idle: 'var(--subtext)',
};
const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span style={{
    fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
    background: `${STATUS_COLOR[status] ?? 'var(--subtext)'}20`,
    color: STATUS_COLOR[status] ?? 'var(--subtext)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  }}>
    {status}
  </span>
);

export default App;

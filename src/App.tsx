import React, { useState, useCallback, useMemo, useEffect } from "react";
import { AppShell } from "./components/Layout/AppShell";
import { Icon } from "./components/muji/Icon";
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

interface TabDef {
  key: Tab;
  cn: string;
  en: string;
  IconCmp: React.FC<React.SVGProps<SVGSVGElement>>;
}

const TABS: TabDef[] = [
  { key: "inspect", cn: "單 張", en: "SINGLE",  IconCmp: Icon.Search },
  { key: "batch",   cn: "批 次", en: "BATCH",   IconCmp: Icon.Layers },
  { key: "compare", cn: "比 對", en: "A/B",     IconCmp: Icon.Compare },
  { key: "history", cn: "歷 史", en: "HISTORY", IconCmp: Icon.History },
  { key: "stats",   cn: "統 計", en: "STATS",   IconCmp: Icon.Chart },
];

const App: React.FC = () => {
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
        analyze(file, customCriteria, confidenceThreshold),
      ]);
      if (analysisResult) addRecord(analysisResult, thumbnail, file.name);
    },
    [analyze, addRecord, customCriteria, confidenceThreshold],
  );

  const handleReanalyze = useCallback(async () => {
    if (!reanalyze || !imagePreview) return;
    const analysisResult = await reanalyze(customCriteria, confidenceThreshold);
    if (analysisResult) {
      const thumbnail = imagePreview;
      addRecord(analysisResult, thumbnail, "reanalyzed");
    }
  }, [reanalyze, customCriteria, confidenceThreshold, imagePreview, addRecord]);

  const chatContext = useMemo(() => {
    if (activeTab === 'history' && focusedItem) {
      return {
        inspectionSummary: `這是來自歷史紀錄的資料：\n- 狀態：${focusedItem.result.status}\n- 信心度：${focusedItem.result.confidence}%\n- 統計摘要：${focusedItem.result.summary}`,
      };
    }
    if (result) {
      return {
        inspectionSummary: `這是目前即時檢測的資料：\n- 狀態：${result.status}\n- 信心度：${result.confidence}%\n- 統計摘要：${result.summary}`,
      };
    }
    return undefined;
  }, [result, focusedItem, activeTab]);

  const todayCount = history.filter((h) => {
    const d = new Date(h.result.analyzedAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;
  const totalPass = history.filter((h) => h.result.status === "pass").length;
  const failCount = history.filter((h) => h.result.status === "fail").length;
  const overallPassRate =
    history.length > 0 ? Math.round((totalPass / history.length) * 100) : 0;

  return (
    <AppShell>
      <div className="app-layout">
        {/* ── Left : Inspection ── */}
        <div className={`panel-left${mobilePanel !== 'inspect' ? ' panel-hidden' : ''}`}>
          {/* MUJI tab bar */}
          <div className="tabbar">
            {TABS.map((t) => {
              const active = activeTab === t.key;
              const count = t.key === 'history' ? history.length : 0;
              return (
                <button
                  key={t.key}
                  className={'tab' + (active ? ' active' : '')}
                  onClick={() => setActiveTab(t.key)}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <t.IconCmp width={14} height={14} />
                    {t.cn}
                    {count > 0 && <span className="tab-count num-mono">{count}</span>}
                  </span>
                  <span className="tab-en">{t.en}</span>
                </button>
              );
            })}
          </div>

          <div style={{ padding: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>

            {/* ── 單張檢測 ── */}
            {activeTab === "inspect" && (
              <>
                {/* KPI */}
                <div>
                  <div className="divider" style={{ marginBottom: 10 }}>本日 · TODAY</div>
                  <div className="kpi-row">
                    <KPI label="檢測數"  value={String(todayCount).padStart(2, '0')} unit="件" />
                    <KPI label="合格率"  value={String(overallPassRate)} unit="%" color="var(--matcha)" />
                    <KPI label="不良件數" value={String(failCount).padStart(2, '0')} unit="件" color={failCount ? 'var(--terracotta)' : 'var(--ink)'} />
                    <KPIStatus label="狀態" />
                  </div>
                </div>

                {/* 設定 */}
                <div>
                  <div className="divider" style={{ marginBottom: 10 }}>檢測設定 · SETTINGS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button
                      onClick={() => setShowCustomPrompt((p) => !p)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 14px',
                        background: 'var(--paper-soft)',
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--r-sm)',
                        fontFamily: 'var(--font-serif)',
                        fontSize: 13, color: 'var(--ink)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ color: 'var(--clay)', fontSize: 13 }}>{showCustomPrompt ? '−' : '＋'}</span>
                      <span>自訂檢測標準</span>
                      {customCriteria && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--clay)' }}>● 已設定</span>}
                    </button>
                    {showCustomPrompt && (
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="例：重點檢查焊點品質、錫球大小是否均勻..."
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          background: 'var(--paper-soft)',
                          border: '1px solid var(--line)',
                          borderRadius: 'var(--r-sm)',
                          fontFamily: 'var(--font-serif)',
                          fontSize: 13, color: 'var(--ink)', lineHeight: 1.7,
                          resize: 'vertical', outline: 'none',
                        }}
                      />
                    )}

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '120px 1fr 70px',
                      alignItems: 'center', gap: 12,
                      padding: '12px 14px',
                      background: 'var(--paper-soft)',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--r-sm)',
                    }}>
                      <div className="label-ch">信心度閾值</div>
                      <input
                        type="range" min={0} max={95} step={5}
                        value={confidenceThreshold}
                        onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                      />
                      <div className="num-mono" style={{ fontSize: 12, textAlign: 'right', color: confidenceThreshold ? 'var(--clay)' : 'var(--ink-mute)' }}>
                        {confidenceThreshold ? `＜ ${confidenceThreshold}%` : '未設'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 樣本 */}
                <div>
                  <div className="divider" style={{ marginBottom: 10 }}>樣本 · SAMPLE</div>
                  <ImageUploader
                    imagePreview={imagePreview}
                    status={status}
                    onFileSelect={handleFileSelect}
                    onReset={reset}
                  />
                </div>

                {/* 結果 */}
                {result && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="divider">檢測報告 · REPORT</div>
                    <InspectionResultPanel result={result} />

                    {reanalyze && (
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button
                          onClick={handleReanalyze}
                          disabled={status === 'analyzing'}
                          className="btn btn-ghost"
                        >
                          <Icon.Refresh width={14} height={14} style={{ marginRight: 6, verticalAlign: '-3px' }} />
                          再分析
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {status === "idle" && !result && (
                  <div style={{
                    padding: '32px 20px',
                    textAlign: 'center',
                    color: 'var(--ink-soft)',
                    fontSize: 13,
                    lineHeight: 1.9,
                    background: 'var(--paper-soft)',
                    border: '1px dashed var(--line)',
                    borderRadius: 'var(--r-md)',
                  }}>
                    上傳圖片後，AI 將自動分析並生成<br />
                    詳細的品質檢測報告
                  </div>
                )}
              </>
            )}

            {activeTab === "batch" && (
              <BatchInspectionPanel
                customCriteria={customCriteria}
                threshold={confidenceThreshold}
                onRecordAdded={(r, thumb, fn) => addRecord(r, thumb, fn)}
              />
            )}

            {activeTab === "compare" && (
              <ComparisonPanel customCriteria={customCriteria} />
            )}

            {activeTab === "history" && (
              <HistoryPanel
                history={history}
                onClear={clearHistory}
                onSelectItem={(id) => setFocusedHistoryId(id)}
              />
            )}

            {activeTab === "stats" && <StatsDashboard history={history} />}
          </div>
        </div>

        {/* ── Right : Chat ── */}
        <div className={`panel-right${mobilePanel !== 'chat' ? ' panel-hidden' : ''}`}>
          <ChatPanel context={chatContext} />
        </div>
      </div>

      <nav className="mobile-nav">
        <button
          className={`mobile-nav-btn${mobilePanel === 'inspect' ? ' active' : ''}`}
          onClick={() => setMobilePanel('inspect')}
        >
          <Icon.Search width={16} height={16} />
          檢測
        </button>
        <button
          className={`mobile-nav-btn${mobilePanel === 'chat' ? ' active' : ''}`}
          onClick={() => setMobilePanel('chat')}
        >
          <Icon.Chat width={16} height={16} />
          對話
        </button>
      </nav>
    </AppShell>
  );
};

/* ── KPI cells ───────────────────────── */
const KPI: React.FC<{ label: string; value: string; unit?: string; color?: string }> = ({ label, value, unit, color }) => (
  <div className="kpi">
    <div className="kpi-label">{label}</div>
    <div>
      <span className="kpi-value num-mono" style={color ? { color } : undefined}>{value}</span>
      {unit && <span className="kpi-unit">{unit}</span>}
    </div>
  </div>
);

const KPIStatus: React.FC<{ label: string }> = ({ label }) => (
  <div className="kpi">
    <div className="kpi-label">{label}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
      <span className="breathe" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--matcha)' }} />
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--ink)', letterSpacing: '0.1em' }}>運作中</span>
    </div>
  </div>
);

export default App;

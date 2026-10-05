import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell, type Page } from './components/Layout/AppShell';
import { useApiStatus } from './hooks/useApiStatus';
import { InspectPage, LotInspectionPanel, useInspection, type InspectionResult } from './features/inspection';
import type { InspectMode } from './features/inspection';
import { LotRecordPanel, useLots, summarizeLot } from './features/lots';
import { ControlDashboard, useLotsDataset, buildControlView } from './features/control';
import { ActionPlanPanel, useActionPlans } from './features/actionPlan';
import { OverviewPage } from './features/overview/OverviewPage';

const PAGES: Page[] = ['overview', 'inspect', 'lot', 'records', 'control'];
const TITLES: Record<Page, string> = {
  overview: '專案總覽', inspect: '單張判定', lot: '批檢驗', records: '批紀錄', control: '管制看板',
};

const pageFromHash = (): Page => {
  const key = window.location.hash.replace(/^#\/?/, '') as Page;
  return PAGES.includes(key) ? key : 'overview';
};

const App: React.FC = () => {
  const [page, setPage] = useState<Page>(pageFromHash);
  const apiStatus = useApiStatus();

  /* ── 頁面＝網址 hash（可直接分享 #/control 之類的連結） ── */
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    document.title = `${TITLES[page]}｜晶粒外觀檢查改善專案`;
  }, [page]);
  const navigate = useCallback((next: Page) => {
    if (window.location.hash !== `#/${next}`) window.location.hash = `/${next}`;
    setPage(next);
    window.scrollTo({ top: 0 });
  }, []);

  /* ── 判定與批 ── */
  const inspection = useInspection();
  const { lots, currentLot, selectLot, addDie, deleteLot, clearAll } = useLots();
  const [owner, setOwner] = useState<string | null>(null);
  const [inspectMode, setInspectMode] = useState<InspectMode>('sample');
  const [sampleId, setSampleId] = useState('S25');
  const [liveResults, setLiveResults] = useState<Record<string, InspectionResult>>({});
  const onLiveResult = useCallback((id: string, r: InspectionResult) => setLiveResults(m => ({ ...m, [id]: r })), []);

  /* ── 管制看板：模擬批（lots.json／備援）＋批紀錄的實測批 ── */
  const { dataset, source } = useLotsDataset();
  const liveSummaries = useMemo(() => lots.map(summarizeLot), [lots]);
  const controlView = useMemo(() => buildControlView(dataset, liveSummaries), [dataset, liveSummaries]);
  const [selectedSignalLot, setSelectedSignalLot] = useState<string | null>(null);
  const effectiveSignalLot = useMemo(() => {
    if (selectedSignalLot && controlView.signals.some(s => s.lotId === selectedSignalLot)) return selectedSignalLot;
    return controlView.signals[controlView.signals.length - 1]?.lotId ?? null;
  }, [selectedSignalLot, controlView.signals]);

  const { plans, saveConfirmed, remove } = useActionPlans();
  const confirmedByLot = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of plans) m[p.lotId] = (m[p.lotId] ?? 0) + 1;
    return m;
  }, [plans]);

  const nOut = controlView.signals.filter(s => s.signal === 'outOfControl').length;
  const nWarn = controlView.signals.length - nOut;

  return (
    <AppShell
      page={page}
      onNavigate={navigate}
      apiStatus={apiStatus}
      lotCount={lots.length}
      outOfControlCount={nOut}
      warningSignalCount={nWarn}
    >
      {page === 'overview' && (
        <OverviewPage
          controlView={controlView}
          onNavigate={navigate}
          onTrySample={id => { setSampleId(id); setInspectMode('sample'); navigate('inspect'); }}
        />
      )}

      {page === 'inspect' && (
        <InspectPage
          apiStatus={apiStatus}
          inspection={inspection}
          owner={owner}
          setOwner={setOwner}
          mode={inspectMode}
          setMode={setInspectMode}
          sampleId={sampleId}
          setSampleId={setSampleId}
          liveResults={liveResults}
          onLiveResult={onLiveResult}
          lots={lots}
          currentLot={currentLot}
          selectLot={selectLot}
          addDie={addDie}
        />
      )}

      {page === 'lot' && (
        <LotInspectionPanel
          apiStatus={apiStatus}
          lots={lots}
          currentLot={currentLot}
          selectLot={selectLot}
          onDieJudged={addDie}
        />
      )}

      {page === 'records' && (
        <LotRecordPanel
          lots={lots}
          currentLotId={currentLot.lotId}
          onSelectLot={selectLot}
          onDeleteLot={deleteLot}
          onClearAll={clearAll}
          onGoInspect={() => navigate('inspect')}
        />
      )}

      {page === 'control' && (
        <ControlDashboard
          view={controlView}
          dataset={dataset}
          source={source}
          selectedLotId={effectiveSignalLot}
          onSelectLot={setSelectedSignalLot}
          confirmedByLot={confirmedByLot}
          actionPlan={
            <ActionPlanPanel
              apiStatus={apiStatus}
              signals={controlView.signals}
              selectedLotId={effectiveSignalLot}
              onSelectLot={setSelectedSignalLot}
              plans={plans}
              onConfirmed={saveConfirmed}
              onRemove={remove}
            />
          }
        />
      )}
    </AppShell>
  );
};

export default App;

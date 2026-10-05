import React from 'react';
import { PChart } from './PChart';
import { ParetoCompare } from './ParetoCompare';
import { Icon, SIGNAL_STYLE } from '../../../components/ui/icons';
import { RULE_TEXT } from '../spc';
import type { ControlView } from '../controlView';
import type { LotsDataset } from '../types';
import type { DatasetSource } from '../hooks/useLotsDataset';

interface Props {
  view: ControlView;
  dataset: LotsDataset;
  source: DatasetSource;
  selectedLotId: string | null;
  onSelectLot: (lotId: string) => void;
  /** 每個批已確認的處置單張數 */
  confirmedByLot: Record<string, number>;
  /** 右欄：異常處置單 */
  actionPlan: React.ReactNode;
}

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

/** 管制看板：批不良率 p 管制圖＋判異（預警／異常）＋缺陷分類柏拉圖＋異常處置單。 */
export const ControlDashboard: React.FC<Props> = ({ view, dataset, source, selectedLotId, onSelectLot, confirmedByLot, actionPlan }) => {
  const { chart, signals, lots } = view;
  const nOut = signals.filter(s => s.signal === 'outOfControl').length;
  const nWarn = signals.filter(s => s.signal === 'warningSignal').length;
  const liveCount = lots.filter(l => l.source === 'live').length;
  const typicalN = lots[0]?.n ?? 0;
  const typicalUcl = chart.points[0]?.ucl ?? 0;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">管制看板</h1>
          <p className="page-sub">
            批不良率 p 管制圖：超出 UCL＝<b>異常</b>；{RULE_TEXT.sevenUp}或{RULE_TEXT.twoOfThree}＝<b>預警</b>。
            點預警／異常批，在右欄草擬異常處置單。
          </p>
        </div>
      </header>

      <div className="note note-sim" role="note" style={{ marginBottom: 18 }}>
        <Icon.Info width={16} height={16} />
        <span>
          <b>數據為模擬。</b>
          {source === 'file' ? `${dataset.lots.length} 個統計模擬批（public/data/lots.json）` : '內建備援資料集（lots.json 尚未產生）'}
          ，依一致性分析量到的判定誤差抽樣（漏判率 {pct(dataset.judgementErrorRates.miss)}、誤判率 {pct(dataset.judgementErrorRates.falseCall)}）
          {dataset.scenario ? `，並注入漂移情境：${dataset.scenario}` : ''}。
          {liveCount > 0 && ` 另接 ${liveCount} 個實測批（方點）。`}
        </span>
      </div>

      {chart.centerLine === 0 && (
        <div className="note note-fail" role="alert" style={{ marginBottom: 18 }}>
          <Icon.Alert width={16} height={16} />
          <span>Phase I（前 {chart.phaseICount} 批）沒有任何判定 Fail，中心線為 0，無法估計 p 管制界限；此時任何一顆 Fail 都會被標為異常。請檢查資料集或延長 Phase I。</span>
        </div>
      )}

      <dl className="readout">
        <div><dt>中心線 CL</dt><dd className="mono">{pct(chart.centerLine)}</dd></div>
        <div><dt>UCL（n={typicalN}）</dt><dd className="mono" style={{ color: 'var(--fail-ink)' }}>{pct(typicalUcl)}</dd></div>
        <div><dt>異常批</dt><dd className="mono" style={{ color: nOut ? 'var(--fail-ink)' : undefined }}>{nOut}</dd></div>
        <div><dt>預警批</dt><dd className="mono" style={{ color: nWarn ? 'var(--warn-ink)' : undefined }}>{nWarn}</dd></div>
        <div><dt>批數</dt><dd className="mono">{lots.length}</dd></div>
      </dl>

      <figure className="figure" style={{ marginTop: 20 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--rule)', padding: '12px 8px 4px' }}>
          <PChart chart={chart} lots={lots} selectedLotId={selectedLotId} onSelectLot={onSelectLot} />
        </div>
        <figcaption className="figcaption" style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <span><b>圖 1</b>批不良率 p 管制圖，各批依自己的 n 計算界限</span>
          <span><svg width="22" height="8" aria-hidden="true"><line x1="0" x2="22" y1="4" y2="4" stroke="var(--ink-2)" strokeWidth="1.6" /></svg> CL</span>
          <span><svg width="22" height="8" aria-hidden="true"><line x1="0" x2="22" y1="4" y2="4" stroke="var(--fail)" strokeWidth="1.6" strokeDasharray="6 4" /></svg> UCL＝CL＋3σ</span>
          <span><svg width="22" height="8" aria-hidden="true"><line x1="0" x2="22" y1="4" y2="4" stroke="var(--warn)" strokeWidth="1.6" strokeDasharray="2 3" /></svg> CL＋2σ</span>
          <span><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="var(--fail)" /></svg> 異常</span>
          <span><svg width="12" height="12" aria-hidden="true"><path d="M6 1 L11 11 L1 11 Z" fill="var(--warn)" /></svg> 預警</span>
          <span><svg width="12" height="12" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" fill="#fff" stroke="var(--ink)" strokeWidth="1.5" /></svg> 實測批</span>
        </figcaption>
      </figure>

      <div className="control-split" style={{ marginTop: 32 }}>
        <div style={{ minWidth: 0 }}>
          <section aria-labelledby="sig-title">
            <div className="section-head">
              <h2 className="section-title" id="sig-title">判異清單</h2>
              <span className="section-note">點一列，在右欄處理該批</span>
            </div>
            {signals.length === 0 ? (
              <p className="small" style={{ color: 'var(--ink-2)' }}>目前沒有預警或異常批。</p>
            ) : (
              <div className="tbl-frame" style={{ overflowX: 'auto' }}>
                <table className="tbl tbl-stack">
                  <thead>
                    <tr>
                      <th scope="col">訊號</th>
                      <th scope="col">批號</th>
                      <th scope="col" className="r">p（Fail/n）</th>
                      <th scope="col" className="r">UCL</th>
                      <th scope="col">觸發規則</th>
                      <th scope="col">處置單</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map(s => {
                      const st = SIGNAL_STYLE[s.signal];
                      const confirmed = confirmedByLot[s.lotId] ?? 0;
                      return (
                        <tr
                          key={s.lotId}
                          className="tbl-row-btn"
                          aria-selected={s.lotId === selectedLotId}
                          tabIndex={0}
                          onClick={() => onSelectLot(s.lotId)}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectLot(s.lotId); } }}
                        >
                          <td><span className={`chip ${st.chip}`}>{st.label}</span></td>
                          <td className="mono" data-label="批號" style={{ fontWeight: 600 }}><span>{s.lotId}{s.source === 'live' && <span className="tiny dim">・實測</span>}</span></td>
                          <td className="r mono" data-label="p（Fail/n）"><span>{pct(s.p)}<span className="tiny dim">（{s.fail}/{s.n}）</span></span></td>
                          <td className="r mono" data-label="UCL">{pct(s.ucl)}</td>
                          <td className="small" data-label="觸發規則">{s.rulesFired.join('、')}</td>
                          <td className="small" data-label="處置單" style={{ whiteSpace: 'nowrap' }}>
                            {confirmed > 0
                              ? <span style={{ color: 'var(--pass-ink)', display: 'inline-flex', gap: 4, alignItems: 'center' }}><Icon.Check width={14} height={14} />已確認 {confirmed}</span>
                              : <span className="dim">未處置</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="section" aria-labelledby="pareto-title" style={{ marginTop: 40 }}>
            <div className="section-head">
              <h2 className="section-title" id="pareto-title">缺陷分類柏拉圖：基準期 vs 近期</h2>
            </div>
            <ParetoCompare pareto={view.pareto} />
          </section>
        </div>

        <aside className="control-plan" aria-label="異常處置單">
          {actionPlan}
        </aside>
      </div>
    </div>
  );
};

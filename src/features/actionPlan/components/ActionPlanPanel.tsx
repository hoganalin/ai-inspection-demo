import React, { useCallback, useState } from 'react';
import { Icon, SIGNAL_STYLE } from '../../../components/ui/icons';
import { OFFLINE_EXPLAINER, type ApiStatus } from '../../../hooks/useApiStatus';
import { DEFECT_CLASS_LABEL } from '../../inspection/spec/inspectionSpecV1';
import type { DefectClass } from '../../inspection/spec/inspectionSpecV1';
import type { LotSignalContext } from '../../control/types';
import { describeApiError } from '../../inspection/utils/errors';
import { streamActionPlanDraft } from '../api/actionPlanApi';
import { parseDraft } from '../parseDraft';
import { NOTIFY_UNITS } from '../types';
import type { ActionPlan, ActionPlanSections, NotifyUnit } from '../types';

interface Props {
  apiStatus: ApiStatus;
  signals: LotSignalContext[];
  selectedLotId: string | null;
  onSelectLot: (lotId: string) => void;
  plans: ActionPlan[];
  onConfirmed: (plan: ActionPlan) => void;
  onRemove: (id: string) => void;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (n: number) => isoDate(new Date(Date.now() + n * 86_400_000));
const stamp = (iso: string) => new Date(iso).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

const SECTION_FIELDS: { key: keyof ActionPlanSections; label: string; rows: number }[] = [
  { key: 'description', label: '異常描述', rows: 3 },
  { key: 'causes', label: '可能原因', rows: 4 },
  { key: 'checks', label: '確認項目', rows: 5 },
  { key: 'containment', label: '暫時對策', rows: 4 },
];

const EMPTY_SECTIONS: ActionPlanSections = { description: '', causes: '', checks: '', containment: '' };
const NOT_EDITED: Record<keyof ActionPlanSections, boolean> = { description: false, causes: false, checks: false, containment: false };

/** 暫定墨標記：AI 草稿 → 已修改。 */
const InkTag: React.FC<{ edited: boolean }> = ({ edited }) => (
  <span className={'ink-tag' + (edited ? ' is-edited' : '')}>{edited ? '已修改' : 'AI 草稿'}</span>
);

/* ─── 單一批的草擬／確認流程 ─── */
const SignalDraft: React.FC<{ signal: LotSignalContext; apiStatus: ApiStatus; onConfirmed: (p: ActionPlan) => void }> = ({ signal, apiStatus, onConfirmed }) => {
  const [phase, setPhase] = useState<'idle' | 'streaming' | 'editing' | 'confirmed' | 'error'>('idle');
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<ActionPlanSections>(EMPTY_SECTIONS);
  const [edited, setEdited] = useState(NOT_EDITED);
  const [units, setUnits] = useState<NotifyUnit[]>([]);
  const [followUp, setFollowUp] = useState(plusDays(7));
  const [confirmer, setConfirmer] = useState('');
  const [incomplete, setIncomplete] = useState(false);
  const [confirmedPlan, setConfirmedPlan] = useState<ActionPlan | null>(null);
  const offline = apiStatus === 'offline';

  const draft = useCallback(async () => {
    setPhase('streaming');
    setRaw('');
    setError(null);
    let text = '';
    try {
      await streamActionPlanDraft(signal, isoDate(new Date()), chunk => {
        text += chunk;
        setRaw(text);
      });
      const errIdx = text.indexOf('[stream-error]');
      if (errIdx >= 0) throw new Error(text.slice(errIdx + 14).trim());
      const parsed = parseDraft(text, plusDays(7));
      setSections(parsed.sections);
      setEdited(NOT_EDITED);
      setUnits(parsed.notifyUnits);
      setFollowUp(parsed.followUpDate);
      setIncomplete(!parsed.complete);
      setPhase('editing');
    } catch (err) {
      setError(`草擬失敗：${describeApiError(err, '/api/chat')}`);
      setPhase('error');
    }
  }, [signal]);

  const confirm = () => {
    const now = new Date().toISOString();
    const plan: ActionPlan = {
      id: crypto.randomUUID(),
      lotId: signal.lotId,
      signal: signal.signal,
      rulesFired: signal.rulesFired,
      sections,
      notifyUnits: units,
      followUpDate: followUp,
      status: 'confirmed',
      createdAt: now,
      confirmedAt: now,
      confirmedBy: confirmer.trim(),
    };
    onConfirmed(plan);
    setConfirmedPlan(plan);
    setPhase('confirmed');
  };

  if (phase === 'idle' || phase === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {offline ? (
          <div className="note note-sim"><Icon.Plug width={16} height={16} /><span>{OFFLINE_EXPLAINER}</span></div>
        ) : (
          <>
            <button className="btn btn-primary" onClick={() => { void draft(); }} disabled={apiStatus === 'checking'} style={{ alignSelf: 'flex-start' }}>
              <Icon.Doc width={16} height={16} />草擬異常處置單
            </button>
            <p className="small dim">會把批號、訊號類型、觸發規則、p 值與管制界限、柏拉圖變化送給 AI 草擬。草稿須逐欄審閱、由具名的人確認。</p>
          </>
        )}
        {error && (
          <div className="note note-fail" role="alert"><Icon.Alert width={16} height={16} /><span>{error}</span></div>
        )}
      </div>
    );
  }

  if (phase === 'streaming') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="small">
          <InkTag edited={false} />
          <span className="dots" style={{ color: 'var(--si-600)' }}><i /><i /><i /></span>
          AI 草擬中，完成後會拆成可編輯的欄位
        </div>
        <pre className="tentative small" style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-ui)', lineHeight: 1.75, padding: '12px 14px', margin: 0, minHeight: 140 }}>
          {raw}
        </pre>
      </div>
    );
  }

  if (phase === 'confirmed' && confirmedPlan) {
    return (
      <div style={{ borderTop: '2px solid var(--si-800)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
          <Icon.Check width={18} height={18} style={{ color: 'var(--pass)' }} />已確認，存於本機紀錄
        </div>
        <p className="small" style={{ color: 'var(--ink-2)' }}>
          確認人 <b style={{ color: 'var(--ink)' }}>{confirmedPlan.confirmedBy}</b>・{stamp(confirmedPlan.confirmedAt!)}・通知 {confirmedPlan.notifyUnits.join('、')}・追蹤 {confirmedPlan.followUpDate}
        </p>
        <p className="small dim">示範用：不會實際發送通知。</p>
        <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => { setPhase('idle'); setConfirmer(''); setConfirmedPlan(null); }}>
          再開一張
        </button>
      </div>
    );
  }

  // editing
  const blockers = [
    !sections.description.trim() && '異常描述',
    units.length === 0 && '通知單位',
    !confirmer.trim() && '確認人',
  ].filter(Boolean) as string[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p className="small" style={{ color: 'var(--ink-2)' }}>
        虛線框＝AI 草稿，尚未有人負責。逐欄審閱、修改，由確認人送出後才定稿。
      </p>
      {incomplete && (
        <div className="note note-warn"><Icon.Alert width={16} height={16} /><span>AI 草稿缺少部分欄位，請手動補齊。</span></div>
      )}
      {SECTION_FIELDS.map(f => (
        <label key={f.key} style={{ display: 'block' }}>
          <span className="field-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {f.label}<InkTag edited={edited[f.key]} />
          </span>
          <textarea
            className={'field' + (edited[f.key] ? '' : ' tentative')}
            rows={f.rows}
            value={sections[f.key]}
            onChange={e => {
              const value = e.target.value;
              setSections(s => ({ ...s, [f.key]: value }));
              setEdited(s => ({ ...s, [f.key]: true }));
            }}
            style={{ resize: 'vertical' }}
          />
        </label>
      ))}

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field-label">通知單位</legend>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {NOTIFY_UNITS.map(u => (
            <label key={u} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={units.includes(u)}
                onChange={e => setUnits(prev => (e.target.checked ? [...prev, u] : prev.filter(x => x !== u)))}
              />
              {u}
            </label>
          ))}
        </div>
      </fieldset>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
        <label>
          <span className="field-label">建議追蹤日</span>
          <input type="date" className="field mono" value={followUp} onChange={e => setFollowUp(e.target.value)} />
        </label>
        <label>
          <span className="field-label">確認人（必填）</span>
          <input className="field" value={confirmer} onChange={e => setConfirmer(e.target.value)} placeholder="姓名／工號" />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--rule)', paddingTop: 14 }}>
        <button className="btn btn-quiet btn-sm" onClick={() => { void draft(); }}>
          <Icon.Refresh width={14} height={14} />重新草擬
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {blockers.length > 0 && <span className="small dim">尚缺：{blockers.join('、')}</span>}
          <button className="btn btn-primary" onClick={confirm} disabled={blockers.length > 0}>
            <Icon.Check width={16} height={16} />確認送出
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── 已確認的處置單（定稿墨） ─── */
const ConfirmedPlan: React.FC<{ plan: ActionPlan; onRemove: () => void }> = ({ plan, onRemove }) => {
  const [open, setOpen] = useState(false);
  const st = SIGNAL_STYLE[plan.signal];
  return (
    <div style={{ borderBottom: '1px solid var(--rule)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="btn btn-quiet"
        style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 0', height: 'auto', fontWeight: 500, whiteSpace: 'normal', textAlign: 'left' }}
      >
        <Icon.Chevron width={14} height={14} style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }} />
        <span className={`chip ${st.chip}`}>{st.label}</span>
        <span className="mono" style={{ fontWeight: 700 }}>{plan.lotId}</span>
        <span className="small" style={{ color: 'var(--ink-2)' }}>
          {plan.confirmedBy}・{stamp(plan.confirmedAt ?? plan.createdAt)}
        </span>
      </button>
      {open && (
        <div className="small" style={{ padding: '0 0 14px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SECTION_FIELDS.map(f => (
            <div key={f.key}>
              <div style={{ fontWeight: 700 }}>{f.label}</div>
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--ink-2)' }}>{plan.sections[f.key] || '—'}</div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '0.6em', flexWrap: 'wrap' }}><b>通知單位</b><span>{plan.notifyUnits.join('、')}</span><b style={{ marginLeft: '1em' }}>追蹤日</b><span className="mono">{plan.followUpDate}</span></div>
          <button className="btn btn-quiet btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onRemove}>
            <Icon.Trash width={14} height={14} />刪除紀錄
          </button>
        </div>
      )}
    </div>
  );
};

/** 異常處置單（預警／異常觸發，AI 草擬、人確認）。 */
export const ActionPlanPanel: React.FC<Props> = ({ apiStatus, signals, selectedLotId, onSelectLot, plans, onConfirmed, onRemove }) => {
  const selected = signals.find(s => s.lotId === selectedLotId) ?? null;
  const lotPlans = selected ? plans.filter(p => p.lotId === selected.lotId) : plans;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px 20px 14px', background: 'var(--si-800)', color: '#fff' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>異常處置單</h2>
        <p className="small" style={{ color: 'var(--si-200)', marginTop: 2 }}>AI 草擬、經人確認；只存在本機，不會真的發送。</p>
      </div>

      <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {signals.length === 0 ? (
          <p className="small" style={{ color: 'var(--ink-2)' }}>
            管制看板目前沒有預警或異常批。批不良率出現預警或異常時，可在這裡草擬異常處置單。
          </p>
        ) : (
          <div>
            <label className="field-label" htmlFor="plan-lot">處理的批</label>
            <select id="plan-lot" className="field mono" value={selected?.lotId ?? ''} onChange={e => onSelectLot(e.target.value)} style={{ width: '100%' }}>
              {!selected && <option value="">選一個預警／異常批</option>}
              {signals.map(s => (
                <option key={s.lotId} value={s.lotId}>{s.lotId}・{s.signalLabel}{s.source === 'live' ? '・實測' : ''}</option>
              ))}
            </select>
          </div>
        )}

        {selected && (
          <>
            <dl className="small" style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '6px 14px', borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)', padding: '12px 0' }}>
              <dt className="dim">訊號</dt>
              <dd style={{ margin: 0 }}>
                <span className={`chip ${SIGNAL_STYLE[selected.signal].chip}`}>{selected.signalLabel}</span>{' '}
                <span className="mono" style={{ fontWeight: 700 }}>{selected.lotId}</span>
                <span className="dim">・{selected.source === 'live' ? '實測批' : '模擬批'}</span>
              </dd>
              <dt className="dim">觸發規則</dt>
              <dd style={{ margin: 0 }}>{selected.rulesFired.join('、')}</dd>
              <dt className="dim">批不良率</dt>
              <dd className="mono" style={{ margin: 0 }}>p {pct(selected.p)}（{selected.fail}/{selected.n}）・CL {pct(selected.centerLine)}・UCL {pct(selected.ucl)}</dd>
              {selected.pareto.topShift && (
                <>
                  <dt className="dim">柏拉圖變化</dt>
                  <dd style={{ margin: 0 }}>
                    <span className="mono">{selected.pareto.topShift.code}</span> {DEFECT_CLASS_LABEL[selected.pareto.topShift.code as DefectClass]?.cn}
                    {' '}<b className="mono" style={{ color: 'var(--fail-ink)' }}>+{selected.pareto.topShift.deltaRate.toFixed(1)}</b> 件／100 顆
                    <span className="dim">（{selected.pareto.baselineLots} → {selected.pareto.recentLots}）</span>
                  </dd>
                </>
              )}
            </dl>

            <SignalDraft key={selected.lotId} signal={selected} apiStatus={apiStatus} onConfirmed={onConfirmed} />
          </>
        )}

        {lotPlans.length > 0 && (
          <div>
            <h3 className="block-title" style={{ marginBottom: 4 }}>
              已確認處置單{selected ? `（${selected.lotId}）` : ''}
            </h3>
            <div style={{ borderTop: '1px solid var(--rule-strong)' }}>
              {lotPlans.map(p => <ConfirmedPlan key={p.id} plan={p} onRemove={() => onRemove(p.id)} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionPlanPanel;

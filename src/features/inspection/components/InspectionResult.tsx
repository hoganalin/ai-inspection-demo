import React, { useState } from "react";
import type { InspectionResult as IResult, DefectItem } from "../types";
import { Icon, STATUS_MAP, SEV_MAP } from "../../../components/muji/Icon";

interface Props {
  result: IResult;
}

type Severity = "low" | "medium" | "high";
const ALL_SEV: Severity[] = ["low", "medium", "high"];

/* ─── 狀態印章區塊 ─── */
const StatusBlock: React.FC<{ status: IResult['status']; confidence: number; summary: string; time: string }> = ({
  status, confidence, summary, time,
}) => {
  const cfg = STATUS_MAP[status];
  return (
    <div className="anim-in" style={{
      padding: '24px 28px',
      background: cfg.bg,
      border: `1px solid ${cfg.color}33`,
      borderRadius: 'var(--r-md)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
        {/* 狀態印章 — 傾斜 2° 模擬手押章 */}
        <div style={{
          width: 64, height: 64,
          border: `1.5px solid ${cfg.color}`,
          borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-serif)',
          fontSize: 32,
          color: cfg.color,
          background: 'var(--paper-soft)',
          transform: 'rotate(-2deg)',
          flexShrink: 0,
        }}>
          {cfg.mark}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="label-en" style={{ marginBottom: 4 }}>檢測結果 · RESULT</div>
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: '0.15em',
            color: cfg.color,
            marginBottom: 10,
          }}>
            {cfg.cn}
          </div>
          <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.8 }}>
            {summary}
          </p>
          <div style={{ display: 'flex', gap: 32, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${cfg.color}22` }}>
            <div>
              <div className="label-en" style={{ fontSize: 9 }}>信心度</div>
              <div className="num-mono" style={{ fontSize: 20, color: cfg.color, fontWeight: 500, marginTop: 2 }}>
                {confidence}<span style={{ fontSize: 11, color: 'var(--ink-mute)', marginLeft: 2 }}>%</span>
              </div>
            </div>
            <div>
              <div className="label-en" style={{ fontSize: 9 }}>時刻</div>
              <div className="num-mono" style={{ fontSize: 14, color: 'var(--ink)', marginTop: 4 }}>
                {time}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── 瑕疵明細 ─── */
const DefectList: React.FC<{ defects: DefectItem[]; filterSet: Set<Severity>; toggleSev: (s: Severity) => void }> = ({ defects, filterSet, toggleSev }) => {
  const filtered = defects.filter((d) => filterSet.has(d.severity as Severity));

  return (
    <div style={{ background: 'var(--paper-soft)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 0 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="label-en">瑕疵明細 · DEFECT LIST</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {ALL_SEV.map((s) => {
            const active = filterSet.has(s);
            const cfg = SEV_MAP[s];
            return (
              <button
                key={s}
                onClick={() => toggleSev(s)}
                style={{
                  padding: '3px 10px',
                  fontFamily: 'var(--font-serif)',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  border: `1px solid ${active ? cfg.color : 'var(--line)'}`,
                  background: active ? `${cfg.color}15` : 'transparent',
                  color: active ? cfg.color : 'var(--ink-mute)',
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {cfg.cn}
              </button>
            );
          })}
        </div>
        <div className="num-mono" style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
          {String(filtered.length).padStart(2, '0')} 件
        </div>
      </div>
      {filtered.map((d, i) => {
        const sev = SEV_MAP[d.severity as Severity];
        return (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 80px',
            gap: 16,
            padding: '14px 20px',
            borderBottom: i < filtered.length - 1 ? '1px solid var(--line-soft)' : 'none',
            alignItems: 'start',
          }}>
            <div className="num-mono" style={{ fontSize: 12, color: 'var(--ink-mute)', paddingTop: 2 }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 3 }}>
                {d.location}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
                {d.description}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 12,
                color: sev.color,
                padding: '3px 10px',
                border: `1px solid ${sev.color}66`,
                borderRadius: 2,
                letterSpacing: '0.1em',
                background: 'var(--paper-soft)',
              }}>
                {sev.cn}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ─── 改善建議 ─── */
const Recommendation: React.FC<{ text: string }> = ({ text }) => (
  <div style={{
    padding: '18px 22px',
    background: 'var(--clay-bg)',
    border: '1px solid rgba(184, 144, 122, 0.3)',
    borderRadius: 'var(--r-md)',
    position: 'relative',
  }}>
    <div className="label-en" style={{ color: 'var(--clay-deep)', marginBottom: 8 }}>
      改善建議 · RECOMMENDATION
    </div>
    <p style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--ink)', lineHeight: 1.9 }}>
      {text}
    </p>
  </div>
);

/* ─── Main ─── */
export const InspectionResultPanel: React.FC<Props> = ({ result }) => {
  const [sevFilter, setSevFilter] = useState<Set<Severity>>(new Set(ALL_SEV));
  const [copied, setCopied] = useState(false);

  const time = new Date(result.analyzedAt).toLocaleTimeString("zh-TW", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const toggleSev = (s: Severity) => {
    setSevFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next.size === 0 ? new Set(ALL_SEV) : next;
    });
  };

  const handleCopy = () => {
    const lines = [
      "品質檢測報告",
      `狀態：${STATUS_MAP[result.status].cn} | 信心度：${result.confidence}%`,
      result.summary,
      ...(result.defects.length > 0
        ? ["", "瑕疵項目：", ...result.defects.map(d => `・[${SEV_MAP[d.severity as Severity].cn}] ${d.location} — ${d.description}`)]
        : []),
      ...(result.recommendation ? ["", `建議：${result.recommendation}`] : []),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="anim-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <StatusBlock
        status={result.status}
        confidence={result.confidence}
        summary={result.summary}
        time={time}
      />

      {result.defects.length > 0 && (
        <DefectList defects={result.defects} filterSet={sevFilter} toggleSev={toggleSev} />
      )}

      {result.recommendation && <Recommendation text={result.recommendation} />}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={handleCopy} className="btn btn-ghost">
          <Icon.Copy width={14} height={14} style={{ marginRight: 6, verticalAlign: '-3px' }} />
          {copied ? '已複製' : '複製報告'}
        </button>
      </div>
    </div>
  );
};

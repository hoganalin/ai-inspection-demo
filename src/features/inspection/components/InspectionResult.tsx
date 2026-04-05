import React, { useState } from "react";
import type { InspectionResult as IResult, DefectItem } from "../types";

interface Props {
  result: IResult;
}

const STATUS = {
  pass: {
    label: "PASSED",
    color: "var(--green)",
    dim: "var(--green-dim)",
    border: "var(--green-border)",
    icon: "✓",
  },
  fail: {
    label: "FAILED",
    color: "var(--red)",
    dim: "var(--red-dim)",
    border: "var(--red-border)",
    icon: "✕",
  },
  warning: {
    label: "WARNING",
    color: "var(--amber)",
    dim: "var(--amber-dim)",
    border: "var(--amber-border)",
    icon: "!",
  },
};

const SEV_COLOR: Record<string, string> = {
  low: "var(--amber)",
  medium: "#f97316",
  high: "var(--red)",
};

/* ── Donut Chart ─────────────────────────────────────── */
const DonutChart: React.FC<{ value: number; color: string }> = ({
  value,
  color,
}) => {
  const R = 40;
  const circ = 2 * Math.PI * R;
  const dash = (value / 100) * circ;

  return (
    <svg width={100} height={100} viewBox="0 0 100 100">
      <circle cx={50} cy={50} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={10} />
      <circle
        cx={50} cy={50} r={R} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 50 50)"
        style={{ transition: "stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)" }}
      />
      <text x={50} y={50} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={18} fontWeight={800} style={{ textShadow: '0 0 10px rgba(0,0,0,0.5)' }}>
        {value}%
      </text>
    </svg>
  );
};

/* ── Defect Row ──────────────────────────────────────── */
const DefectRow: React.FC<{ defect: DefectItem; index: number }> = ({
  defect,
  index,
}) => (
  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
    <td style={{ padding: "12px 16px", color: "var(--subtext)", fontSize: 13, width: 40 }}>
      {String(index + 1).padStart(2, "0")}
    </td>
    <td style={{ padding: "12px 16px", color: "#fff", fontSize: 13, fontWeight: 500 }}>
      {defect.location}
    </td>
    <td style={{ padding: "12px 16px" }}>
      <span style={{
          padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.04em",
          color: SEV_COLOR[defect.severity], background: `${SEV_COLOR[defect.severity]}15`
      }}>
        {defect.severity}
      </span>
    </td>
    <td style={{ padding: "12px 16px", color: "var(--subtext)", fontSize: 13, lineHeight: 1.4 }}>
      {defect.description}
    </td>
  </tr>
);

type Severity = "low" | "medium" | "high";
const ALL_SEV: Severity[] = ["low", "medium", "high"];
const SEV_LABEL: Record<Severity, string> = { low: "低", medium: "中", high: "高" };

/* ── Main Component ──────────────────────────────────── */
export const InspectionResultPanel: React.FC<Props> = ({ result }) => {
  const cfg = STATUS[result.status];
  const [sevFilter, setSevFilter] = useState<Set<Severity>>(new Set(ALL_SEV));
  const [copied, setCopied] = useState(false);

  const time = new Date(result.analyzedAt).toLocaleTimeString("zh-TW", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const toggleSev = (s: Severity) => {
    setSevFilter((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next.size === 0 ? new Set(ALL_SEV) : next;
    });
  };

  const filteredDefects = result.defects.filter((d) => sevFilter.has(d.severity as Severity));

  const handleCopy = () => {
    const lines = [
      "品質檢測報告",
      `狀態：${result.status.toUpperCase()} | 信心度：${result.confidence}%`,
      result.summary,
      ...(result.defects.length > 0 ? ["", "瑕疵項目：", ...result.defects.map(d => `・[${d.severity}] ${d.location} — ${d.description}`)] : []),
      "", `建議：${result.recommendation}`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="anim-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Status Card ── */}
      <div className="kpi-card" style={{
        background: `linear-gradient(135deg, ${cfg.color}15, rgba(255,255,255,0.02))`,
        border: `1px solid ${cfg.color}30`,
        padding: '24px',
        display: 'flex', alignItems: 'center', gap: 24,
      }}>
        <div style={{ flexShrink: 0 }}>
          <DonutChart value={result.confidence} color={cfg.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div className="status-badge" style={{ background: cfg.color, color: '#fff', boxShadow: `0 0 20px ${cfg.color}40`, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {cfg.icon}
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: cfg.color, letterSpacing: '-0.02em', textShadow: `0 0 12px ${cfg.color}30` }}>
              {cfg.label}
            </span>
          </div>
          <p style={{ fontSize: 14, color: '#fff', fontWeight: 500, lineHeight: 1.5, marginBottom: 12 }}>{result.summary}</p>
          <div style={{ display: 'flex', gap: 24 }}>
            <Stat label="信心度" value={`${result.confidence}%`} color={cfg.color} />
            <Stat label="瑕疵數" value={`${result.defects.length}`} color={result.defects.length > 0 ? 'var(--danger)' : 'var(--success)'} />
            <Stat label="分析時間" value={time} />
          </div>
        </div>
      </div>

      {/* ── Defects Table ── */}
      {result.defects.length > 0 && (
        <div className="card" style={{ overflow: "hidden", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ padding: "16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
            <span className="section-label">瑕疵明細清單</span>
            <span className="status-badge" style={{ fontSize: 10, padding: "2px 8px" }}>
              {filteredDefects.length} {filteredDefects.length !== result.defects.length ? ` / ${result.defects.length}` : ""}
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {ALL_SEV.map((s) => (
                <button key={s} onClick={() => toggleSev(s)} style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                  color: sevFilter.has(s) ? SEV_COLOR[s] : "var(--subtext)",
                  background: sevFilter.has(s) ? `${SEV_COLOR[s]}15` : "rgba(255,255,255,0.05)",
                  border: `1px solid ${sevFilter.has(s) ? `${SEV_COLOR[s]}40` : "transparent"}`
                }}>
                  {SEV_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["#", "位置", "嚴重度", "描述"].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDefects.map((d, i) => <DefectRow key={i} defect={d} index={i} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Recommendation ── */}
      <div style={{ padding: '16px 20px', borderRadius: 'var(--radius-lg)', background: 'rgba(79,124,255,0.08)', border: '1px solid rgba(79,124,255,0.2)' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>建議措施</div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.6 }}>{result.recommendation}</p>
      </div>

      {/* ── Copy Button ── */}
      <button onClick={handleCopy} className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px', alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 6 }}>
        {copied ? '✓ 已複製' : '📋 複製報告'}
      </button>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div>
    <div style={{ fontSize: 10, color: 'var(--subtext)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 800, color: color ?? '#fff' }}>{value}</div>
  </div>
);

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MODEL, errorMessage, getClient, httpStatusFor } from './_lib.js';

/**
 * 異常處置單 (Action Plan) 草擬。
 * 輸入：一個出現「預警」或「異常」的批的脈絡（p 值、管制界限、判異規則、柏拉圖變化）。
 * 輸出：text/plain chunked streaming 的草稿；前端解析成欄位、由人確認後才算送出。
 */
const SYSTEM = `你是封裝段「晶粒外觀檢查」站的品質工程助理，負責草擬「異常處置單」。草稿一定會由人審閱、修改、確認後才生效。

規則：
- 一律用繁體中文，語氣專業、具體、可執行，避免空話。
- 只依據提供的批數據推論；不知道的不要編造（例如不要捏造機台編號、人名）。
- 「預警」是趨勢訊號（尚未超出 UCL），「異常」是超出 UCL；用詞要和輸入一致，不要把兩者混用，也不要單說 warning。
- 晶粒的「判定 Warning」是單顆晶粒送人工複判，和批層級的「預警」不同。
- 可能原因請對應柏拉圖中增加最多的缺陷分類（例：CHP 崩角上升 → 切割刀磨耗、切割參數、膠膜張力；CRK → 取放／頂針應力；SCR → 搬運治具；CON → 清洗或環境潔淨度）。
- 數據為模擬情境，草稿中不需要聲明。

輸出格式（嚴格遵守，六個段落、標題一字不差、依此順序，不要其他前言或結語）：
## 異常描述
（1–3 句：批號、訊號類型、觸發的判異規則、p 值與中心線／UCL 的比較、柏拉圖的主要變化）
## 可能原因
- （條列 2–4 點，最可能的放第一）
## 確認項目
- （條列 3–5 點，具體到要看什麼、量什麼）
## 暫時對策
- （條列 2–4 點，例：本批隔離、加嚴抽檢、更換刀具後首件確認）
## 通知單位
（從「生產、製程、設備、QA」中選，以頓號分隔）
## 建議追蹤日
（YYYY-MM-DD，一個日期）`;

interface LotSignalBody {
  lotId: string;
  source?: string;
  signal: 'outOfControl' | 'warningSignal';
  signalLabel?: string;
  rulesFired: string[];
  n: number;
  fail: number;
  p: number;
  centerLine: number;
  ucl: number;
  lcl?: number;
  recentTrend?: { lotId: string; p: number }[];
  pareto?: {
    baselineLots: string;
    recentLots: string;
    rows: { code: string; baselineRate: number; recentRate: number }[];
    topShift: { code: string; deltaRate: number } | null;
  };
}

interface RequestBody {
  signal: LotSignalBody;
  today?: string;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function isValid(s: unknown): s is LotSignalBody {
  if (!s || typeof s !== 'object') return false;
  const o = s as LotSignalBody;
  return typeof o.lotId === 'string'
    && (o.signal === 'outOfControl' || o.signal === 'warningSignal')
    && Array.isArray(o.rulesFired)
    && [o.n, o.fail, o.p, o.centerLine, o.ucl].every(v => typeof v === 'number' && Number.isFinite(v));
}

function buildUserMessage(s: LotSignalBody, today: string): string {
  const label = s.signal === 'outOfControl' ? '異常（超出 UCL）' : '預警（未超出 UCL，但符合判異準則）';
  const lines = [
    `今天日期：${today}`,
    `批號：${s.lotId}（${s.source === 'live' ? '實測批' : '模擬批'}）`,
    `訊號：${label}`,
    `觸發規則：${s.rulesFired.join('、') || '—'}`,
    `本批：n=${s.n}，判定 Fail=${s.fail}，批不良率 p=${pct(s.p)}`,
    `管制界限（Phase I 估計）：中心線 p̄=${pct(s.centerLine)}，UCL=${pct(s.ucl)}${s.lcl !== undefined ? `，LCL=${pct(s.lcl)}` : ''}`,
  ];
  if (s.recentTrend?.length) {
    lines.push(`近期走勢：${s.recentTrend.map(t => `${t.lotId} ${pct(t.p)}`).join(' → ')}`);
  }
  if (s.pareto) {
    lines.push(`缺陷分類柏拉圖（每 100 顆缺陷數，基準期 ${s.pareto.baselineLots} → 近期 ${s.pareto.recentLots}）：`);
    for (const r of s.pareto.rows) {
      lines.push(`- ${r.code}：${r.baselineRate.toFixed(1)} → ${r.recentRate.toFixed(1)}`);
    }
    if (s.pareto.topShift) {
      lines.push(`增加最多：${s.pareto.topShift.code}（+${s.pareto.topShift.deltaRate.toFixed(1)} 件／100 顆）`);
    }
  }
  lines.push('', '請依格式草擬這張異常處置單。');
  return lines.join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { signal, today } = (req.body ?? {}) as RequestBody;
  if (!isValid(signal)) {
    return res.status(400).json({ error: 'Missing or invalid lot signal context' });
  }
  const day = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)
    ? today
    : new Date().toISOString().slice(0, 10);

  // Stream as plain chunked text — frontend reads via fetch + getReader().
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const client = getClient();
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: 'user', content: buildUserMessage(signal, day) }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(event.delta.text);
      }
    }
    res.end();
  } catch (err) {
    console.error('[/api/chat] error:', err);
    if (!res.headersSent) {
      res.status(httpStatusFor(err)).json({ error: errorMessage(err) });
    } else {
      // Already streaming — append a marker the frontend can surface.
      res.write(`\n\n[stream-error] ${errorMessage(err)}`);
      res.end();
    }
  }
}

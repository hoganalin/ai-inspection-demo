import type { InspectionResult } from '../types';

async function postJson<TResp>(url: string, body: unknown): Promise<TResp> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = String(j.error);
    } catch { /* swallow JSON parse error — fall back to status text */ }
    throw new Error(msg);
  }
  return res.json() as Promise<TResp>;
}

/** 上傳晶粒影像；伺服器回傳 AI 缺陷清單＋依規範推導的判定。 */
export async function inspectDie(imageBase64: string, mimeType: string): Promise<InspectionResult> {
  const { result } = await postJson<{ result: InspectionResult }>('/api/inspect', { imageBase64, mimeType });
  return result;
}

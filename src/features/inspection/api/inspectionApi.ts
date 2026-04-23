import type { InspectionResult, ComparisonResult } from '../types';

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

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  customCriteria?: string,
): Promise<InspectionResult> {
  const { result } = await postJson<{ result: InspectionResult }>('/api/inspect', {
    imageBase64,
    mimeType,
    customCriteria,
  });
  return result;
}

export async function compareImages(
  imageABase64: string,
  imageBBase64: string,
  mimeTypeA: string,
  mimeTypeB: string,
  customCriteria?: string,
): Promise<ComparisonResult> {
  const { result } = await postJson<{ result: ComparisonResult }>('/api/compare', {
    imageABase64,
    imageBBase64,
    mimeTypeA,
    mimeTypeB,
    customCriteria,
  });
  return result;
}

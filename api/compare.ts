import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  MODEL,
  errorMessage,
  extractText,
  getClient,
  httpStatusFor,
  normalizeMediaType,
  stripJsonFences,
} from './_lib.js';

const SYSTEM = `你是工廠品質對比分析 AI。請比較兩張圖片（圖片A 和 圖片B），分析它們在品質瑕疵上的差異。

請只回覆 JSON 格式（不要加任何 markdown 代碼塊，也不要有任何前後說明文字）。格式如下：
{
  "imageA": { "status": "pass"|"fail"|"warning", "confidence": 0-100, "summary": "...", "defects": [], "recommendation": "..." },
  "imageB": { "status": "pass"|"fail"|"warning", "confidence": 0-100, "summary": "...", "defects": [], "recommendation": "..." },
  "similarity": 0-100,
  "differences": [
    { "location": "...", "severity": "low"|"medium"|"high", "description": "...", "foundIn": "A"|"B"|"both" }
  ],
  "verdict": "整體比較結論"
}`;

interface RequestBody {
  imageABase64: string;
  imageBBase64: string;
  mimeTypeA: string;
  mimeTypeB: string;
  customCriteria?: string;
}

interface InspectionResult {
  status: 'pass' | 'fail' | 'warning';
  confidence: number;
  summary: string;
  defects: { location: string; severity: 'low' | 'medium' | 'high'; description: string }[];
  recommendation: string;
  analyzedAt: string;
}

interface ComparisonResult {
  imageA: InspectionResult;
  imageB: InspectionResult;
  similarity: number;
  differences: { location: string; severity: 'low' | 'medium' | 'high'; description: string; foundIn: 'A' | 'B' | 'both' }[];
  verdict: string;
  analyzedAt: string;
}

function parseComparisonResult(text: string): ComparisonResult {
  const cleaned = stripJsonFences(text);
  const analyzedAt = new Date().toISOString();
  try {
    const json = JSON.parse(cleaned);
    return {
      ...json,
      imageA: { ...json.imageA, analyzedAt },
      imageB: { ...json.imageB, analyzedAt },
      analyzedAt,
    } as ComparisonResult;
  } catch {
    const empty: InspectionResult = {
      status: 'warning',
      confidence: 0,
      summary: '解析失敗',
      defects: [],
      recommendation: '',
      analyzedAt,
    };
    return {
      imageA: empty,
      imageB: empty,
      similarity: 0,
      differences: [],
      verdict: '比對失敗，請重試。',
      analyzedAt,
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageABase64, imageBBase64, mimeTypeA, mimeTypeB, customCriteria } =
      (req.body ?? {}) as RequestBody;
    if (!imageABase64 || !imageBBase64 || !mimeTypeA || !mimeTypeB) {
      return res.status(400).json({ error: 'Missing image data or mime types' });
    }

    const mediaA = normalizeMediaType(mimeTypeA);
    const mediaB = normalizeMediaType(mimeTypeB);
    const client = getClient();

    const userText = customCriteria
      ? `比對以上兩張圖片並回傳 JSON 結果。\n\n【自訂檢測標準】\n${customCriteria}`
      : '比對以上兩張圖片並回傳 JSON 結果。';

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: '以下是圖片 A：' },
            { type: 'image', source: { type: 'base64', media_type: mediaA, data: imageABase64 } },
            { type: 'text', text: '以下是圖片 B：' },
            { type: 'image', source: { type: 'base64', media_type: mediaB, data: imageBBase64 } },
            { type: 'text', text: userText },
          ],
        },
      ],
    });

    const text = extractText(response);
    const result = parseComparisonResult(text);
    return res.status(200).json({ result });
  } catch (err) {
    console.error('[/api/compare] error:', err);
    return res.status(httpStatusFor(err)).json({ error: errorMessage(err) });
  }
}

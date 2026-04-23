import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  MODEL,
  errorMessage,
  extractText,
  getClient,
  httpStatusFor,
  normalizeMediaType,
  stripJsonFences,
} from './_lib';

const SYSTEM = `你是一個工廠產線品質檢測 AI。分析使用者上傳的圖片，判斷產品是否有瑕疵。

請只回覆 JSON 格式（不要加任何 markdown 代碼塊，也不要有任何前後說明文字）。格式如下：
{
  "status": "pass" | "fail" | "warning",
  "confidence": 0-100 的整數,
  "summary": "一句話總結",
  "defects": [
    {
      "location": "位置描述",
      "severity": "low" | "medium" | "high",
      "description": "瑕疵描述"
    }
  ],
  "recommendation": "處理建議"
}

判斷標準：
- pass：無明顯瑕疵，品質合格
- warning：有輕微問題，需注意
- fail：有明顯瑕疵，建議退件

如果圖片不是產品圖，請盡可能分析圖片內容並給出合理判斷。`;

interface RequestBody {
  imageBase64: string;
  mimeType: string;
  customCriteria?: string;
}

interface DefectItem {
  location: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

interface InspectionResult {
  status: 'pass' | 'fail' | 'warning';
  confidence: number;
  summary: string;
  defects: DefectItem[];
  recommendation: string;
  analyzedAt: string;
}

function parseInspectionResult(text: string): InspectionResult {
  const cleaned = stripJsonFences(text);
  const analyzedAt = new Date().toISOString();
  try {
    const json = JSON.parse(cleaned);
    return { ...json, analyzedAt } as InspectionResult;
  } catch {
    return {
      status: 'warning',
      confidence: 60,
      summary: cleaned.slice(0, 100) || '無法解析模型回覆',
      defects: [],
      recommendation: '請人工複核結果。',
      analyzedAt,
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mimeType, customCriteria } = (req.body ?? {}) as RequestBody;
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'Missing imageBase64 or mimeType' });
    }

    const mediaType = normalizeMediaType(mimeType);
    const client = getClient();

    const userText = customCriteria
      ? `分析這張圖片並回傳 JSON 結果。\n\n【自訂檢測標準】\n${customCriteria}`
      : '分析這張圖片並回傳 JSON 結果。';

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: userText },
          ],
        },
      ],
    });

    const text = extractText(response);
    const result = parseInspectionResult(text);
    return res.status(200).json({ result });
  } catch (err) {
    console.error('[/api/inspect] error:', err);
    return res.status(httpStatusFor(err)).json({ error: errorMessage(err) });
  }
}

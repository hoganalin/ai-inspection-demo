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
import {
  judgeDie,
  parseDefectList,
  unparseableResult,
  type InspectionResult,
} from '../src/features/inspection/spec/inspectionSpecV1.js';

/**
 * 檢驗規範 v1 的 AI 指示。AI 只回報缺陷清單（分類、區域、量測），
 * 不做判定——判定由 judgeDie() 依允收標準推導（ADR-0001）。
 */
const SYSTEM = `你是封裝段「晶粒外觀檢查」的缺陷辨識員，依《檢驗規範 v1》回報缺陷。你只回報看到的缺陷，不做 Pass / Warning / Fail 判定。

【晶粒幾何與量測換算】
- 晶粒 5 mm × 5 mm，填滿整張影像。以「影像寬度 = 5000 µm」換算（1000 px 影像時為 5 µm/px）。
- Seal ring：距晶粒邊緣 100–120 µm 的環。
- 周邊區 (peripheral)：晶粒邊緣至 seal ring 外緣（0–100 µm）。
- 核心區 (core)：seal ring 內緣以內（> 120 µm），含 pad。
- Pad：核心區內沿四邊排列的方形銲墊，各 80 × 80 µm，距邊緣 200 µm。
- 缺陷所在區域以「缺陷最深入晶粒的點」判定。

【缺陷分類代碼與量測】
- CHP 崩角：depthUm = 自晶粒邊緣向內的最大深度；touchesSealRing = 是否觸及 seal ring。
- CRK 裂紋：有就回報（不需量測值）。
- SCR 刮傷：lengthUm = 長度；crossesPad = 是否經過 pad。
- CON 污染／異物：diameterUm = 單點直徑；每一點各回報一筆。

【輸出格式】只輸出一個 JSON 物件，不要 markdown 代碼塊、不要任何說明文字：
{"defects":[{"code":"CHP"|"CRK"|"SCR"|"CON","zone":"core"|"peripheral","depthUm":number?,"lengthUm":number?,"diameterUm":number?,"crossesPad":boolean?,"touchesSealRing":boolean?}]}
- 量測值一律為 µm 的數字；不適用的欄位省略。
- 沒有缺陷就回 {"defects":[]}。
- 不要回報信心度、嚴重度、判定或自由文字描述。`;

interface RequestBody {
  imageBase64: string;
  mimeType: string;
}

function deriveResult(text: string): InspectionResult {
  const analyzedAt = new Date().toISOString();
  let raw: unknown;
  try {
    raw = JSON.parse(stripJsonFences(text));
  } catch {
    return unparseableResult(analyzedAt);
  }
  const defects = parseDefectList(raw);
  if (!defects) return unparseableResult(analyzedAt);
  return judgeDie(defects, analyzedAt);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mimeType } = (req.body ?? {}) as RequestBody;
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'Missing imageBase64 or mimeType' });
    }

    const mediaType = normalizeMediaType(mimeType);
    const client = getClient();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: '依《檢驗規範 v1》回報這顆晶粒的缺陷清單 JSON。' },
          ],
        },
      ],
    });

    const result = deriveResult(extractText(response));
    return res.status(200).json({ result });
  } catch (err) {
    console.error('[/api/inspect] error:', err);
    return res.status(httpStatusFor(err)).json({ error: errorMessage(err) });
  }
}

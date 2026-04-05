import { GoogleGenerativeAI } from '@google/generative-ai';
import type { InspectionResult, ComparisonResult } from '../types';

const PROMPT = `你是一個工廠產線品質檢測 AI。請分析這張圖片，判斷產品是否有瑕疵。

請以 JSON 格式回傳分析結果（不要加 markdown 代碼塊），格式如下：
{
  "status": "pass" | "fail" | "warning",
  "confidence": 0-100,
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

export async function analyzeImage(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  customCriteria?: string
): Promise<InspectionResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = customCriteria
    ? `${PROMPT}\n\n【自訂檢測標準】\n${customCriteria}`
    : PROMPT;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
      },
    },
  ]);

  const text = result.response.text().trim();

  try {
    const json = JSON.parse(text);
    return {
      ...json,
      analyzedAt: new Date().toISOString(),
    } as InspectionResult;
  } catch {
    // Fallback if JSON parsing fails
    return {
      status: 'warning',
      confidence: 60,
      summary: text.slice(0, 100),
      defects: [],
      recommendation: '請人工複核結果。',
      analyzedAt: new Date().toISOString(),
    };
  }
}

const COMPARISON_PROMPT = `你是工廠品質對比分析 AI。請比較兩張圖片（圖片A 和 圖片B），分析它們在品質瑕疵上的差異。

請以 JSON 格式回傳（不要加 markdown 代碼塊）：
{
  "imageA": { "status": "pass"|"fail"|"warning", "confidence": 0-100, "summary": "...", "defects": [], "recommendation": "...", "analyzedAt": "..." },
  "imageB": { "status": "pass"|"fail"|"warning", "confidence": 0-100, "summary": "...", "defects": [], "recommendation": "...", "analyzedAt": "..." },
  "similarity": 0-100,
  "differences": [
    { "location": "...", "severity": "low"|"medium"|"high", "description": "...", "foundIn": "A"|"B"|"both" }
  ],
  "verdict": "整體比較結論"
}`;

export async function compareImages(
  apiKey: string,
  imageABase64: string,
  imageBBase64: string,
  mimeTypeA: string,
  mimeTypeB: string,
  customCriteria?: string
): Promise<ComparisonResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = customCriteria
    ? `${COMPARISON_PROMPT}\n\n【自訂檢測標準】\n${customCriteria}`
    : COMPARISON_PROMPT;

  const result = await model.generateContent([
    '以下是圖片A：',
    { inlineData: { data: imageABase64, mimeType: mimeTypeA as 'image/jpeg' | 'image/png' | 'image/webp' } },
    '以下是圖片B：',
    { inlineData: { data: imageBBase64, mimeType: mimeTypeB as 'image/jpeg' | 'image/png' | 'image/webp' } },
    prompt,
  ]);

  const text = result.response.text().trim();
  try {
    return JSON.parse(text) as ComparisonResult;
  } catch {
    return {
      imageA: { status: 'warning', confidence: 0, summary: '解析失敗', defects: [], recommendation: '', analyzedAt: new Date().toISOString() },
      imageB: { status: 'warning', confidence: 0, summary: '解析失敗', defects: [], recommendation: '', analyzedAt: new Date().toISOString() },
      similarity: 0,
      differences: [],
      verdict: '比對失敗，請重試。',
    };
  }
}

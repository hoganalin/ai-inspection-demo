/** 從錯誤訊息裡取出 Anthropic 回傳的那句話（訊息可能是「400 {"type":"error","error":{...}}」）。 */
function innerMessage(msg: string): string {
  const m = /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(msg);
  return m ? m[1].replace(/\\"/g, '"') : msg;
}

/**
 * 把 /api/* 的錯誤轉成給操作者看的一句話（不捏造判定、不貼原始 JSON）。
 * `endpoint` 只影響 404 時的說明。
 */
export function describeApiError(err: unknown, endpoint: '/api/inspect' | '/api/chat'): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/credit balance|billing|purchase credits/i.test(msg)) {
    return 'Anthropic API 額度不足：帳戶餘額已用完，AI 服務暫停。請到 Anthropic Console 的 Plans & Billing 加值後再試。';
  }
  if (/429|rate.?limit|overload/i.test(msg)) return '請求太頻繁或服務暫時忙線中，請稍候再試。';
  if (/401|403|api[_ ]?key|authentication|permission/i.test(msg)) {
    return '伺服器端 API Key 未設定或無效（請確認 Vercel 的 ANTHROPIC_API_KEY）。';
  }
  if (/404/.test(msg)) return `找不到 ${endpoint}（純 Vite 開發模式沒有 serverless functions，請改用 vercel dev 或部署版）。`;
  if (/\b[45]\d\d\b/.test(msg)) return `伺服器回傳錯誤：${innerMessage(msg)}`;
  return innerMessage(msg);
}

/** 單張／批檢驗的判定錯誤（頁面上已有「未完成判定」的前綴）。 */
export function describeInspectionError(err: unknown): string {
  return describeApiError(err, '/api/inspect');
}

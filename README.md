# QualityAI Vision Platform

> **下一代工廠智慧監控解決方案**
> 由 Anthropic Claude Sonnet 4.6 驅動的多模態視覺品質檢測系統。

[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev)
[![Claude](https://img.shields.io/badge/Claude-Sonnet_4.6-d97757?logo=anthropic&logoColor=white)](https://www.anthropic.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vitejs.dev)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)

---

## 架構概覽 | Architecture

```
Browser  ──fetch──▶  /api/inspect      ┐
                     /api/compare      ├── Vercel Serverless Functions
                     /api/chat (SSE)   ┘    └─ Anthropic SDK ─▶ Claude Sonnet 4.6
```

**API Key 完全保留在伺服器端**：`ANTHROPIC_API_KEY` 透過 Vercel Environment Variables 注入到 serverless functions，不會出現在前端 bundle 中。

---

## 核心功能 | Features

| 模式 | 重點功能 | 說明 |
| :--- | :--- | :--- |
| **單張檢測** | 智慧判定與重析 | 自動判斷 `Pass` / `Warning` / `Fail`；支援一鍵原圖重析與信心度閾值過濾。 |
| **批次檢測** | 高產能流線分析 | 支援多圖拖放與佇列處理，抽樣比例可調；逐項重試 / 刪除；完成後可即時匯出 `CSV` 報告。 |
| **A/B 比對** | 差異化診斷 | 同時分析兩組樣品，精準對比瑕疵差異、位置與相似度評估。 |
| **圖表看板** | 數據視覺化 | 內建 SVG 動態甜甜圈圖與趨勢長條圖，即時監控通過率與 AI 信心度。 |
| **檢測歷史** | 紀錄追蹤 | 最多保留 30 筆歷史；縮圖預覽 + 展開查看；點選歷史自動同步至 AI 助理上下文。 |
| **AI 助理** | 脈絡化諮詢 | 串流式多輪對話，自動帶入檢測報告或選取的歷史紀錄作為上下文，提供修復建議。 |

### 進階操作

- **自訂檢測標準** — 可於單張 / 批次模式輸入自訂 prompt，覆蓋預設的品質判斷條件。
- **嚴重度篩選** — 結果面板中可按低 / 中 / 高嚴重度切換瑕疵清單。
- **複製摘要** — 一鍵複製檢測結論，複製後顯示 2 秒視覺回饋「✓ 已複製！」。
- **重新分析** — 保留原始圖檔，不需重新上傳即可以相同或更新的標準再次分析。
- **下載 JSON** — 將完整的 `InspectionResult` 物件匯出為 JSON 檔備存。

---

## 技術架構 | Project Layout

```text
api/                        # Vercel Serverless Functions（持有 ANTHROPIC_API_KEY）
├── _lib.ts                 # Anthropic client、media-type、JSON 解析共用工具
├── inspect.ts              # 單張視覺檢測
├── compare.ts              # A/B 比對
└── chat.ts                 # 串流多輪對話（chunked response）

src/
├── features/
│   ├── inspection/
│   │   ├── api/            # /api/* 的 fetch 包裝
│   │   ├── components/     # ImageUploader、InspectionResult、StatsDashboard
│   │   │                   # HistoryPanel、BatchInspectionPanel、ComparisonPanel
│   │   ├── hooks/          # useInspection / useHistory / useBatchInspection / useComparison
│   │   └── utils/          # Canvas 縮圖生成、base64 轉換
│   └── chat/               # AI 對話：fetch + ReadableStream + TextDecoder
└── components/
    └── Layout/             # AppShell（Header 顯示伺服器連線狀態）
```

---

## 部署到 Vercel | Deployment

1. **Push 至 GitHub repository**，於 Vercel 連結該 repo。
2. **設定 Environment Variables**（Project Settings → Environment Variables）：

   | 變數名稱 | 值 | 必須？ |
   | :--- | :--- | :--- |
   | `ANTHROPIC_API_KEY` | 由 [Anthropic Console](https://console.anthropic.com/settings/keys) 申請 | 必填 |
   | `CLAUDE_MODEL` | 預設 `claude-sonnet-4-6`；想更高品質可改 `claude-opus-4-7`，想更便宜可改 `claude-haiku-4-5` | 選填 |

3. **部署**——Vercel 自動偵測 Vite 並打包前端，同時將 `api/*.ts` 編譯為 serverless functions。

> **安全提醒**：`ANTHROPIC_API_KEY` **絕對不要**加上 `VITE_` 前綴，否則會被打包進前端 bundle 而外洩。本專案的所有 AI 呼叫都透過 `/api/*` 由 serverless functions 代理執行。

---

## 本地開發 | Local Setup

```bash
git clone https://github.com/hoganalin/ai-inspection-demo.git
cd ai-inspection-demo
npm install
```

### 純 UI 開發

```bash
npm run dev
```

只起 Vite 前端，瀏覽器開 `http://localhost:5173/ai-inspection-demo/`。**`/api/*` 呼叫會 404，AI 功能不會動**——適合純做版面 / 樣式調整。

### 完整堆疊本地測試（含 AI 功能）

要測 chat / inspect / compare 必須用 `vercel dev`，它會同時起 Vite + 把 `api/*.ts` 編譯成本地 serverless functions。

```bash
# 一次性準備
npm i -g vercel        # Vercel CLI
npm i -g yarn          # 目前 Vercel project 設定指定 yarn，本機需要它
vercel link            # 第一次連到雲端 project（互動式）

# 把 ANTHROPIC_API_KEY 加到 Vercel Development 環境
vercel env add ANTHROPIC_API_KEY development
# 然後拉下來成 .env.local
vercel env pull .env.local

# 啟動
vercel dev
```

開瀏覽器到 **`http://localhost:3000`**（不是 5173）。

> **若仍出現 `ANTHROPIC_API_KEY environment variable is not set`**：`vercel dev` 有時不會把 `.env.local` 注入到 function runtime。最直接的解法是在 shell 先設好再啟動：
> ```bash
> export ANTHROPIC_API_KEY="sk-ant-..."   # macOS/Linux/Git Bash
> vercel dev
> ```

### 常用指令

```bash
npm run build    # 型別檢查 + 正式版打包（tsc -b && vite build）
npm run lint     # ESLint
npm run preview  # 本地預覽正式版前端
```

---

## 錯誤診斷 | Troubleshooting

| 錯誤訊息 | 原因 | 解決方式 |
| :--- | :--- | :--- |
| `ANTHROPIC_API_KEY environment variable is not set` | Vercel 未設定環境變數 | 至 Project → Settings → Environment Variables 新增後重新部署 |
| `401` / `authentication_error` | API Key 無效或被撤銷 | 至 Anthropic Console 重新產生 |
| `429` / `rate_limit_error` | 超過速率限制 | 等待後重試，或升級 Anthropic 帳號額度 |
| `400` / `invalid_request_error` | 圖片格式不支援 | 僅支援 jpeg / png / gif / webp |
| `Response has no body` | 開發環境不支援 streaming | 改用 `vercel dev` 或部署到 Vercel 測試 |
| `'yarn' 不是內部或外部命令` 啟動 vercel dev 時 | Vercel project 設定指定 yarn，但本機未安裝 | `npm i -g yarn`（暫時 workaround） |
| `Failed to detect a server running on port XXXXX` | Vite 沒綁到 vercel dev 預期的 port | 確認 `vite.config.ts` 內 `server.port` 有讀 `process.env.PORT`（本 repo 已加） |

---

## License

MIT © [hoganalin](https://github.com/hoganalin)

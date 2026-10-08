# 晶粒外觀檢查改善專案 | Die Visual Inspection Improvement (PDCA)

> 以封裝段「晶粒外觀檢查」為情境的智慧製造改善專案。產線有檢驗規範，但判讀靠人眼：逐顆找缺陷、量尺寸、對條文，慢，小缺陷也容易漏看。
> 本專案驗證：用**有版本號的檢驗規範**＋**AI 只辨識缺陷、規則推導判定**，能不能比人工更快，而且判得不比人工差；再加上 **p 管制圖預警**與**經人確認的異常處置單**。

> [!IMPORTANT]
> **情境與數據皆為模擬。** 痛點來自作者過去的目檢經驗；人工對照組是作者本人照規範判的兩輪（79 筆，真實判定）；標準樣本集為「真實晶粒底圖＋程式注入已知尺寸缺陷」的**半合成影像**（[ADR-0002](docs/adr/0002-semi-synthetic-reference-samples.md)）；管制圖的 25 批為依一致性分析量到的漏判／誤判率**統計模擬**，並刻意注入漂移情境。規範中的允收數值皆為**假設值**，非業界標準。本作品完成到導入階段 ② PoC 驗證，③④ 為規劃。

用詞以 [CONTEXT.md](CONTEXT.md)（領域詞彙表）為準。

---

## 改善故事 | PDCA

| 階段 | 內容 | 在哪裡 |
| :--- | :--- | :--- |
| **Plan · 痛點** | 有檢驗規範，但判讀靠人眼：每顆都要找缺陷、量尺寸、對條文（作者實測 34.9 秒／顆），人會累、小缺陷會漏看、門檻附近的量測因人而異；多半只記結果，難追溯、難統計。要回答的問題：**導入 AI 後，質檢能不能更快，而且答對率、漏判率不比人工差？** | [CONTEXT.md](CONTEXT.md) |
| **Plan · 檢驗規範** | 把規範寫成程式能執行、有版本號的 **檢驗規範 v1**：4 類缺陷分類（`CHP` 崩角／`CRK` 裂紋／`SCR` 刮傷／`CON` 污染）、核心區／周邊區、以 µm 計的允收標準、合併規則（取最嚴重）。 | [docs/spec/inspection-spec-v1.md](docs/spec/inspection-spec-v1.md) |
| **Do · AI 只辨識、規則做判定** | AI 只回報缺陷代碼、區域與量測值；**判定 (Pass / Warning / Fail) 由系統依允收標準推導**，每筆判定附上觸發條文與規範版本。避免把人的不一致換成 AI 的不一致。 | [ADR-0001](docs/adr/0001-verdict-derived-from-spec-not-ai.md)、`src/features/inspection/spec/` |
| **Check · 人工 vs AI** | 同一份標準樣本集：**人眼＋規範**（作者本人照規範判兩輪）對 **AI＋規則**（3 位模擬評估者，規範 v1 → v2），以計數值 MSA 比較每顆判讀時間、與標準答案一致率、漏判率、誤判率、重複性、再現性、人工複判率。另有「只給 AI 口述標準、讓它直接判」的對照，用來看 AI 沒有規則時會怎樣。 | [experiment/](experiment/)、[結果摘要](experiment/results/msa-summary.md) |
| **Check · 管制圖預警** | 以批不良率畫 p 管制圖（Phase I 估中心線與 ±3σ）；超出 UCL ＝ **異常**，連續 7 點上升或 3 點中 2 點超過 2σ ＝ **預警**；缺陷分類柏拉圖指出主要貢獻者。 | 系統「管制看板」 |
| **Act · 異常處置單** | 預警或異常觸發時，AI 依批脈絡（訊號、規則、p 值、柏拉圖變化）**草擬**異常處置單：異常描述、可能原因、確認項目、暫時對策、通知單位、建議追蹤日；**須經人審閱、確認後才算送出**。 | 系統右側面板 |
| **Act · 導入計畫** | 專案章程、四個導入階段時程、RACI、風險清單、週會追蹤表。 | [docs/rollout/](docs/rollout/) |

### 結果一覽（同樣 40 張樣本）

| 指標 | 人眼＋規範（作者） | AI＋規則 v1 | AI＋規則 v2 | 門檻 |
| :--- | ---: | ---: | ---: | ---: |
| 每顆判讀時間 | 34.9 秒 | — | 8.2 秒 | — |
| 漏判率 | 23.5% | 37.0% | 0.0% | ≤ 5% |
| 與標準答案一致率 | 70.9% | 60.8% | 75.8% | ≥ 90% |
| 重複性 | 87.2% | 77.5% | 92.5% | ≥ 90% |
| 人工複判率 | 25.3% | 23.3% | 25.8% | ≤ 30% |
| 評估者間一致率 | — | 60.0% | 82.5% | ≥ 90% |
| 誤判率 | 2.3% | 3.0% | 7.6% | ≤ 3%（假設值） |

結論：v2 的 AI 更快、更不會放走壞的，但好晶粒被誤退較多，**還不能取代人工**，未進入單線試行。AI 的 8.2 秒是 API 回應時間，不含取像；人工組只有作者一人，且作者是規範撰寫者；樣本為半合成、AI 評估者為模擬。只給 AI 口述標準時，評估者間一致率 57.5%、人工複判率 42.5%。

---

## 系統功能 | What the app does

| 頁籤 | 做什麼 |
| :--- | :--- |
| **專案總覽**（首頁） | 用標準樣本 S25 走一次「缺陷清單 → 允收標準條文 → 判定」；人眼＋規範 vs AI＋規則的對照（含每顆判讀時間與較差的誤判率）、AI 兩輪的一致性分析、管制圖摘要、導入階段與規範 v2 提案、PDCA 對照。 |
| **單張判定** | 直接點選內建的 **標準樣本 S01–S40**（半合成影像，附標準答案與實驗中錄下的 AI 回覆），或上傳一張晶粒影像 → **判定明細**：逐缺陷列出代碼＋中文名、檢驗區域（核心區／周邊區）、量測值 (µm)、觸發的允收標準、該缺陷判定；整體判定與意義（Pass 放行／Warning 送人工複判／Fail 退件）；規範版本標章。結果記入目前批。 |
| **批檢驗** | 一次上傳多張影像，逐顆判定並記入目前批（批號可切換或開新批）。 |
| **批紀錄** | 每批的 n、Pass／Warning／Fail、**批不良率**；可展開逐顆判定明細；匯出批彙總 CSV 與判定明細 CSV（含規範版本、缺陷明細、判定依據）。資料存在瀏覽器 localStorage。 |
| **管制看板** | 載入 `public/data/lots.json`（統計模擬批；若不存在則用內建備援資料，同 schema、明確標示模擬），再接上批紀錄中的實測批；手刻 SVG p 管制圖＋判異標記；基準期 vs 近期的缺陷分類柏拉圖。 |
| **異常處置單**（右側） | 選一個預警／異常批 →「草擬異常處置單」（AI 串流草擬）→ 逐欄編輯、勾選通知單位、填確認人 →「確認送出」（僅標記為已確認並存於本機，不會真的發送）。 |

**AI 回覆無法解析時**：判定固定為 Warning，原因「AI 回覆無法解析，送人工複判」。系統不捏造信心度或量測值（原本 AI 自評的「信心度」已移除——它不是可驗證的量測，不能當判定依據）。

**沒有 AI 服務時**（GitHub Pages 靜態版、純 `npm run dev`）：左欄顯示「AI 服務 未連線」，即時判定與處置單草擬會停用並說明原因；標準樣本的標準答案推導、實驗中錄下的 AI 回覆、批紀錄與管制看板仍可完整瀏覽。

**標準樣本資料**：`src/features/samples/referenceData.ts` 由 `python experiment/export_app_data.py` 產生（標準答案＋改善後第 1 次的 120 筆 AI 回覆＋一致性分析摘要），影像在 `public/samples/`。實驗結果更新後重跑此腳本；`npm run check:spec` 會驗證前端規則引擎與 `spec_v1.py` 的推導一致。

---

## 架構 | Architecture

```
Browser ──fetch──▶ /api/inspect  ─ Anthropic SDK ─▶ Claude（只回缺陷清單 JSON）
                        │
                        └─ judgeDie()：依檢驗規範 v1 推導判定（與前端共用同一份程式碼）
Browser ──fetch──▶ /api/chat     ─ Anthropic SDK ─▶ Claude（串流草擬異常處置單）
```

**API Key 只在伺服器端**：`ANTHROPIC_API_KEY` 透過 Vercel Environment Variables 注入 serverless functions，不會出現在前端 bundle。

```text
api/                               # Vercel Serverless Functions（持有 ANTHROPIC_API_KEY）
├── _lib.ts                        # Anthropic client、media-type、JSON 解析、錯誤對應
├── inspect.ts                     # 規範 v1 prompt → 驗證缺陷清單 → 規則推導判定
└── chat.ts                        # 異常處置單草擬（chunked text streaming）

src/features/
├── inspection/
│   ├── spec/inspectionSpecV1.ts   # 檢驗規範 v1 as code（api/ 與 src/ 共用）
│   ├── components/                # ImageUploader、InspectionResult（判定明細）、LotInspectionPanel
│   └── hooks/                     # useInspection、useBatchInspection
├── lots/                          # 批 (Lot) 紀錄：useLots（localStorage）、LotPicker、LotRecordPanel、CSV
├── control/                       # spc.ts（p 管制圖＋判異＋柏拉圖）、PChart（SVG）、ControlDashboard、備援資料
└── actionPlan/                    # 異常處置單：串流草擬、欄位解析、人確認、本機保存
scripts/check-spec.ts              # 規則引擎與判異規則的自我檢查（npm run check:spec）
```

---

## 部署到 Vercel | Deployment

1. **Push 至 GitHub repository**，於 Vercel 連結該 repo。
2. **設定 Environment Variables**（Project Settings → Environment Variables）：

   | 變數名稱 | 值 | 必須？ |
   | :--- | :--- | :--- |
   | `ANTHROPIC_API_KEY` | 由 [Anthropic Console](https://console.anthropic.com/settings/keys) 申請 | 必填 |
   | `CLAUDE_MODEL` | 預設 `claude-sonnet-4-6` | 選填 |

3. **部署**——Vercel 自動偵測 Vite 並打包前端，同時將 `api/*.ts` 編譯為 serverless functions。

> **安全提醒**：`ANTHROPIC_API_KEY` **絕對不要**加上 `VITE_` 前綴，否則會被打包進前端 bundle 而外洩。所有 AI 呼叫都透過 `/api/*` 由 serverless functions 代理執行。

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

只起 Vite 前端，瀏覽器開 `http://localhost:5173/ai-inspection-demo/`。**`/api/*` 呼叫會 404**（判定與處置單草擬不會動），但**管制看板可以完整顯示**（模擬批資料不需要 API）。

### 完整堆疊本地測試（含 AI 功能）

要測判定與處置單草擬必須用 `vercel dev`，它會同時起 Vite ＋ 把 `api/*.ts` 編譯成本地 serverless functions。

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
npm run build       # 型別檢查 + 正式版打包（tsc -b && vite build）
npm run lint        # ESLint
npm run check:spec  # 檢驗規範 v1 規則引擎與判異規則的自我檢查（Node 內建 TS type stripping）
npm run preview     # 本地預覽正式版前端
```

---

## 錯誤診斷 | Troubleshooting

| 錯誤訊息 | 原因 | 解決方式 |
| :--- | :--- | :--- |
| `ANTHROPIC_API_KEY environment variable is not set` | Vercel 未設定環境變數 | 至 Project → Settings → Environment Variables 新增後重新部署 |
| `401` / `authentication_error` | API Key 無效或被撤銷 | 至 Anthropic Console 重新產生 |
| `429` / `rate_limit_error` | 超過速率限制 | 等待後重試，或升級 Anthropic 帳號額度 |
| 找不到 `/api/inspect`、`/api/chat`（404） | 用 `npm run dev` 純 Vite 模式 | 改用 `vercel dev` 或部署版 |
| `Response has no body` | 開發環境不支援 streaming | 改用 `vercel dev` 或部署到 Vercel 測試 |
| `'yarn' 不是內部或外部命令` 啟動 vercel dev 時 | Vercel project 設定指定 yarn，但本機未安裝 | `npm i -g yarn`（暫時 workaround） |
| `Failed to detect a server running on port XXXXX` | Vite 沒綁到 vercel dev 預期的 port | 確認 `vite.config.ts` 內 `server.port` 有讀 `process.env.PORT`（本 repo 已加） |

---

## License

MIT © [hoganalin](https://github.com/hoganalin)

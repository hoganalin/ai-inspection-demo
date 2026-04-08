# 💎 QualityAI Vision Platform

> **下一代工廠智慧監控解決方案**  
> 基於 Google Gemini 2.0 Flash 驅動的多模態視覺品質檢測系統。

[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev)
[![Gemini](https://img.shields.io/badge/Gemini-2.0_Flash-4285f4?logo=google&logoColor=white)](https://ai.google.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)](https://vitejs.dev)
[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub_Pages-222?logo=github)](https://hoganalin.github.io/ai-inspection-demo/)

---

## 🌐 線上展示 | Live Demo

**👉 [https://hoganalin.github.io/ai-inspection-demo/](https://hoganalin.github.io/ai-inspection-demo/)**

> ⚠️ **使用前注意**：本展示需要您自備 Gemini API Key。進入網頁後系統會自動引導您填入，金鑰僅存放於您的瀏覽器本地端（localStorage），不會傳至任何第三方。
>
> 免費申請：[https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

---

## 🚀 核心功能 | Features

本平台專為工業自動化檢測設計，提供從單一零件到大規模批次分析的全方位支援：

| 模式 | 重點功能 | 說明 |
| :--- | :--- | :--- |
| **🔍 單張檢測** | 智慧判定與重析 | 自動判斷 `Pass` / `Warning` / `Fail`；支援一鍵原圖重析與信心度閾值過濾。 |
| **📦 批次檢測** | 高產能流線分析 | 支援多圖拖放與佇列處理，依序完成後可即時匯出 `CSV` 檢驗報告。 |
| **⚖️ A/B 比對** | 差異化診斷 | 同時分析兩組樣品，精準對比瑕疵差異、位置與相似度評估。 |
| **📊 圖表看板** | 數據視覺化 | 內建 SVG 動態甜甜圈圖與趨勢長條圖，即時監控通過率與 AI 信心度。 |
| **💬 AI 助理** | 脈絡化諮詢 | 串流式多輪對話，自動帶入檢測報告作為上下文，提供修復建議。 |

---

## 🛠️ 技術架構 | Architecture

系統採用特徵導向（Feature-based）架構，確保邏輯模組化與高可維護性：

```text
src/
├── features/
│   ├── inspection/          # 視覺檢測核心
│   │   ├── api/             # Gemini 2.0 Flash API 封裝（Vision / Compare）
│   │   ├── components/      # ImageUploader、StatsDashboard、History、Batch、Comparison
│   │   ├── hooks/           # useInspection（含閾值 & 錯誤分類）、useHistory、useBatchInspection
│   │   └── utils/           # Canvas 縮圖生成、base64 轉換
│   └── chat/                # AI 對話模組：串流輸出與檢測結果上下文注入
└── components/
    └── Layout/              # AppShell 頂層框架、ApiKeyModal 引導彈窗
```

---

## ⚙️ 本地開發 | Local Setup

```bash
# 1. Clone 專案
git clone https://github.com/hoganalin/ai-inspection-demo.git
cd ai-inspection-demo

# 2. 安裝依賴
npm install

# 3. 設定 API Key（或直接在瀏覽器介面填入）
cp .env.example .env
# 在 .env 中填入：VITE_GEMINI_API_KEY=您的金鑰

# 4. 啟動開發伺服器
npm run dev
```

---

## 🔑 API Key 設定說明

本專案採用 **前端直接呼叫 Gemini API** 的架構，有以下兩種設定方式：

### 方式一：透過介面填入（推薦給展示、Demo 用途）
直接開啟網頁，系統會在首次進入時彈出引導視窗，填入 Key 後即可立即使用。金鑰會透過 `localStorage` 保存於您的瀏覽器本地端。

### 方式二：透過 `.env` 設定（本地開發用）
```env
VITE_GEMINI_API_KEY=AIzaSy...
```

> ⚠️ **安全提醒**：請勿將 API Key 直接 Hardcode 進原始碼或 commit 至公開 Repository，Google 的 Secret Scanning 系統會自動偵測並作廢外洩的金鑰。

---

## 📋 錯誤診斷

| 錯誤訊息 | 原因 | 解決方式 |
| :--- | :--- | :--- |
| API Key 無效或已被停用 | Key 外洩被 Google 自動 Revoke | 重新至 AI Studio 申請新 Key |
| 請求太頻繁，API 速率限制中 | 免費版每分鐘最多 15 次請求 | 等待約 1 分鐘後重試 |
| 模型不存在或不支援 | API Key 無此模型的存取權限 | 確認 Key 的 API 允許清單 |

---

## 📄 License

MIT © [hoganalin](https://github.com/hoganalin)

# experiment/ — 標準樣本集、一致性分析、管制圖（皆為模擬）

本資料夾是「晶粒外觀檢查改善專案」的數據與實驗管線。用詞依 [CONTEXT.md](../CONTEXT.md)；判定依 [檢驗規範 v1](../docs/spec/inspection-spec-v1.md)；決策見 [ADR-0001](../docs/adr/0001-verdict-derived-from-spec-not-ai.md)、[ADR-0002](../docs/adr/0002-semi-synthetic-reference-samples.md)。

> **全部為模擬**：樣本影像為程式產生、評估者為模擬 AI 評估者、25 批為統計模擬。結果用來示範方法，不代表任何真實產線。

## 環境

```bash
# venv 放在 repo 外（Windows 路徑長度限制：放在很深的 scratchpad 目錄時 anthropic 套件會安裝不完整）
python -m venv C:\Users\<you>\AppData\Local\Temp\aiv
C:\Users\<you>\AppData\Local\Temp\aiv\Scripts\python -m pip install pillow numpy openpyxl matplotlib anthropic
# Windows 終端機輸出中文請設定
set PYTHONIOENCODING=utf-8
```

API 金鑰：`run_msa.py` 執行時從 repo 根目錄的 `.env.local` 讀取 `ANTHROPIC_API_KEY`，不會印出、不會寫入任何輸出檔。

## 檔案

| 檔案 | 用途 |
| --- | --- |
| `spec_v1.py` | 檢驗規範 v1 規則引擎：缺陷清單 → 判定（含邊界值、CON 核心區計點、取最嚴重）。`python spec_v1.py` 執行自我測試 |
| `generate_samples.py` | Step 1：產生 `samples/S01–S40.png` 與 `samples/reference.json`（標準答案） |
| `run_msa.py` | Step 2：呼叫 Claude 執行 Before／After 實驗，原始回覆快取於 `raw/*.jsonl`，含預算保護 |
| `analyze_msa.py` | Step 2：計算一致性指標，輸出 `results/msa-results.xlsx`、`results/msa-metrics.json` |
| `spec_v2.py` | 檢驗規範 v2 規則引擎：框選範圍 → 尺寸／區域／是否經過 pad，加上安全路由（`python experiment/spec_v2.py` 自我測試） |
| `run_v2.py` | 第二輪：每顆晶粒 36 張放大圖一次判讀，原始回覆快取於 `raw/v2.jsonl`，獨立預算保護（預設 US$12） |
| `analyze_v2.py` | 第二輪：用與第一輪相同的指標定義計算，輸出 `results/v2-metrics.json` |
| `make_self_form.py` | 產生作者本人判定兩輪用的空白表單 `results/self-judgment-form.xlsx` |
| `simulate_lots.py` | Step 3：25 批 × 50 顆模擬、p 管制圖、柏拉圖，輸出 `results/control-chart.xlsx`、`p-chart.png`、`pareto.png`、`../public/data/lots.json` |
| `results/msa-summary.md` | 一致性分析結果與發現（人工撰寫，數字來自 `msa-metrics.json`） |

## 重跑步驟

```bash
cd <repo>
PY=C:/Users/<you>/AppData/Local/Temp/aiv/Scripts/python.exe

# Step 1 — 標準樣本集（固定亂數種子，可完全重現）
$PY experiment/spec_v1.py
$PY experiment/generate_samples.py

# Step 2 — 一致性分析
$PY experiment/run_msa.py run --images S38,S20 --trials 1 --budget 4.5   # 前導測試 (smoke test)
$PY experiment/run_msa.py run --trials 2 --budget 4.5                    # 正式執行（自動從快取續跑）
$PY experiment/run_msa.py cost                                           # 查看累計花費
$PY experiment/analyze_msa.py --trials 1   # 主要指標用第 1 次判定；重複性自動用第 1、2 次配對

# 第二輪（檢驗規範 v2）
$PY experiment/run_v2.py run --images S25,S38,S16 --appraisers 甲 --trials 1 --show   # 前導測試
$PY experiment/run_v2.py run --trials 2 --budget 12                                  # 正式（從快取續跑）
$PY experiment/analyze_v2.py
$PY experiment/make_self_form.py

# Step 3 — 管制圖（讀取 results/msa-metrics.json 的改善後混淆矩陣）
$PY experiment/simulate_lots.py
```

`raw/` 已有全部回覆時，`run_msa.py run` 不會再呼叫 API（0 元）；`analyze_msa.py` 與 `simulate_lots.py` 完全離線。

## 樣本產生方式（與 ADR-0002 的差異）

ADR-0002 原規劃以 CC 授權的真實晶粒照片 (Wikimedia die shot) 為底圖。實作改為**程序化產生底圖**：深色矽基底、核心區電路區塊（記憶體陣列、邏輯、類比、繞線通道紋路）、20–24 px 的 seal ring 亮環、沿四邊 16 × 16 px、距邊緣 40 px 的 pad 與走線，完全符合規範 v1 幾何，且無授權問題。代價是底圖不如真實照片複雜（AI 判讀可能比真實情況容易或困難），此限制在結果中註明。

缺陷以已知參數注入（4× 超取樣抗鋸齒繪製）：
- `CHP` 崩角：自晶粒邊緣向內的不規則缺口，暗色缺口＋亮色破斷邊，最大深度精確等於設定值。
- `CRK` 裂紋：暗色細鋸齒線（隨機遊走）。
- `SCR` 刮傷：亮色細直線（輕微彎曲），可設定是否經過 pad。
- `CON` 污染：不規則圓形顆粒（褐色或白色、含陰影與反光），控制直徑、區域、點數。

每張影像另加隨機亮度、漸層照明、色偏與雜訊。檢驗區域、`crossesPad`、`touchesSealRing` 由實際繪製的幾何計算並驗證。40 張 = 20 良品（13 張無缺陷、7 張只有門檻以下缺陷）＋ 20 缺陷品，標準答案判定分布 22 Pass／9 Warning／9 Fail，涵蓋 Pass／Warning／Fail 邊界附近樣本（例：CHP 8／25 µm、SCR 280 µm）。檔名順序已打亂，不透露類別。

PNG 含雜訊，40 張約 50 MB；若不想放進 git，可只保留產生腳本（可完全重現）並將 `samples/*.png` 加入 `.gitignore`。

## 一致性分析設計

- 模型 `claude-sonnet-4-6`（與 app 相同），temperature 1.0（API 預設值；SDK 1.x 已移除此參數，故以 `extra_body` 傳入）。每次呼叫獨立。
- **Before**：甲／乙／丙 三人 system prompt 完全相同，只差口述標準，AI 直接輸出 `pass|warning|fail`。
- **After**：三人共用同一份規範 v1 全文＋幾何與比例尺（prompt caching），只差一行中性角色（日班／夜班／假日班），AI 只回報缺陷清單，判定由 `spec_v1.py` 推導。
- 兩個條件的輸出格式規則相同：可先用最多 100 字簡述觀察，最後一行輸出 JSON（取最後一個合法 JSON 物件解析）。
- 最終設計：3 評估者 × 2 條件 × 40 張 × **2 次**（原規劃 3 次，因預算限制減為 2 次，見 `results/msa-summary.md`）。
- **實際完成狀況**：兩次判定全部完成（每條件 240 筆）。第一次執行到第 335 次呼叫時 API 帳戶額度耗盡，2026-10-06 加值後以 `run_msa.py run --trials 2 --budget 4.5` 從快取補跑其餘 169 次（US$1.17，總計 US$3.46）。分析用 `analyze_msa.py --trials 1`：一致率、漏判率等主要指標用第 1 次判定（與網站錄下的回覆、`simulate_lots.py` 的管制圖模擬同一份資料），重複性用第 1、2 次配對；兩次合計的數字列在 `results/msa-summary.md` 作為對照（`--trials 2` 可重產，看完再以 `--trials 1` 還原）。
- 累計實際花費 **US$2.28**（335 次計費呼叫，含前導測試 24 次）。

### 成本與預算保護

- 價格（claude-api skill 模型價目表，快取日 2026-09-25；與 Anthropic 官方定價一致）：`claude-sonnet-4-6` 輸入 **US$3.00／MTok**、輸出 **US$15.00／MTok**、prompt cache 寫入（5 分鐘 TTL）**US$3.75／MTok**（1.25×）、cache 讀取 **US$0.30／MTok**（0.1×）。
- 每筆回覆以實際 `usage`（input／output／cache write／cache read tokens）× 上述價格計算，存在 `raw/*.jsonl` 的 `costUsd`，累計寫入 `raw/cost_ledger.json`。
- 每次呼叫前檢查：已花費（含 `raw/pilot/` 的前導測試）＋進行中預留＋本次預估（已觀測最大單次成本 × 1.2）若超過 `--budget`（預設 5.00，正式執行用 4.50）即停止排程，已快取結果全部保留。
- `raw/pilot/`：第一版 prompt 的前導測試回覆（輸出格式不一致，發現後修正 prompt）；不納入分析，但成本計入總額。

## 管制圖模擬設計（`simulate_lots.py`）

- 25 批 × 50 顆，亂數種子 `20261005`（真實缺陷流程與判定層使用不同亂數流，所以不同判定層下的真實缺陷完全相同）。
- 真實缺陷：每顆晶粒每類缺陷獨立出現，嚴重度分成門檻以下／Warning 級／Fail 級。基準期真實 Fail 約 4%、Warning 約 6%（參數見 `control-chart.xlsx`「模擬參數」）。
- 漂移情境：自 L15 起，CHP 出現機率每批 +3.5 個百分點，CHP 中 Fail 級比例由 0.30 線性升到 0.70（L25）。漂移參數調整過一次（原為 +2.2、0.55），種子未改。
- **判定層（主圖與 `public/data/lots.json` 的假設）**：依一致性分析「改善後」實測、按缺陷分類分開的混淆矩陣抽樣 AI＋規則判定；AI 判 Warning 的晶粒送人工複判，並**假設人工複判得到真實判定**；AI 判 Pass／Fail 直接放行或退件，所以漏判率與誤判率維持實測值（0.370／0.030）。這是建議的導入設計，不是已驗證的事實。
- 敏感度分析：同一真實流程，(a) 不做人工複判 → 漂移完全沒被偵測；(b) 完美判定 → L19 異常。見 `control-chart.xlsx`「敏感度分析」與 `results/control-chart-summary.json`。
- p 管制圖：中心線與 ±3σ 以 L01–L14（Phase I）計算；判異規則為超出 UCL → 異常；連續 7 點上升，或 3 點中 2 點超過 +2σ（同側）→ 預警。「提早 N 批」只在 Phase II（L15 起）計算，Phase I 的訊號另外列出（本次 L10 為誤警報）。
- `lots.json` 不含管制界限（由 web app 計算），欄位依 app 規格固定。

# 檢驗規範 v1 — 晶粒外觀檢查

> 規範版本：`v1` ・ 生效：2026-10-05 ・ 所有數值為**假設值**（模擬情境，非業界標準）。用詞依 [CONTEXT.md](../../CONTEXT.md)。

## 1. 晶粒幾何與量測換算

| 項目 | 值 |
| --- | --- |
| 晶粒尺寸 | 5 mm × 5 mm |
| 影像尺寸 | 1000 × 1000 px（晶粒填滿畫面） |
| 換算 | **5 µm/px** |
| Seal ring | 距晶粒邊緣 100–120 µm（20–24 px）的環 |
| **周邊區** | 晶粒邊緣至 seal ring 外緣（0–100 µm，0–20 px） |
| **核心區** | seal ring 內緣以內（> 120 µm，> 24 px），含 pad |
| Pad | 核心區內沿四邊排列的方形銲墊，各 80 µm × 80 µm（16 × 16 px），距邊緣 200 µm（40 px） |

缺陷所在**檢驗區域**以缺陷最深入晶粒的點判定。

## 2. 缺陷分類

| 代碼 | 名稱 | 量測方式 |
| --- | --- | --- |
| `CHP` | 崩角（edge chipping） | 自晶粒邊緣向內的最大深度 (µm) |
| `CRK` | 裂紋（crack） | 有／無（任何長度） |
| `SCR` | 刮傷（scratch） | 長度 (µm)；是否經過 pad |
| `CON` | 污染／異物（contamination） | 單點直徑 (µm)；核心區內計點數 |

## 3. 允收標準

| 代碼 | 周邊區 | 核心區 |
| --- | --- | --- |
| `CHP` | 深度 < 10 µm → Pass；10–25 µm → Warning；> 25 µm 或觸及 seal ring → Fail | 延伸進核心區 → Fail |
| `CRK` | 任何 → Fail | 任何 → Fail |
| `SCR` | 長度 < 300 µm → Pass；≥ 300 µm → Warning | < 100 µm → Pass；100–300 µm → Warning；> 300 µm 或經過 pad → Fail |
| `CON` | 單點 < 50 µm → 不計；≥ 50 µm → Warning | 單點 ≥ 20 µm 計 1 點：1–2 點 → Warning；≥ 3 點 → Fail；單點 > 50 µm → Fail；< 20 µm 不計 |

邊界值歸屬：表中「<」「>」為嚴格不等式，「≥」含等號，「a–b」區間**含兩端**（例：`CHP` 周邊區 10 µm → Warning，25 µm → Warning，25.1 µm → Fail）。

## 4. 合併規則

一顆晶粒的**判定**＝其所有缺陷判定中最嚴重者（Fail > Warning > Pass）；無缺陷 → Pass。

## 5. 判定的意義與處置

| 判定 | 意義 | 處置 |
| --- | --- | --- |
| Pass | 符合允收標準 | 放行 |
| Warning | 落在灰色地帶 | 送**人工複判** |
| Fail | 不符允收標準 | 退件 |

## 6. AI 與規則的分工（見 ADR-0001）

AI 只回報缺陷清單，每筆含：`code`（上表代碼之一）、`zone`（`core` | `peripheral`）、量測值（`depthUm` / `lengthUm` / `diameterUm`）、`crossesPad`（SCR）、`touchesSealRing`（CHP）。**判定**由系統依本規範推導，並記錄 `specVersion: "v1"`。

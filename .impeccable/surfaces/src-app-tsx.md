---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/index.css","src/components"]
---

# Surface brief: whole app (晶粒外觀檢查改善專案)

**Scope:** the entire SPA (app shell plus 總覽, 單張判定, 批檢驗, 批紀錄, 管制看板, and the 異常處置單 panel). Visitor mode: **Operate**. The working tool is what is being judged.

**Audience and job:** a 均華 hiring manager opening the link alone on a desktop, and the author demoing live on a projector. They should understand what was built, see the mechanism working on a real sample, and believe four things: rigor, project drive, floor sense, and honesty.

**Confirmed scope additions:**
- (1) A new 專案總覽 page, which is the first screen and the demo opener. It covers the PDCA story, the MSA before/after numbers including the worse 漏判率, and 導入階段 ①② done, ③ not recommended, ④ planned.
- (2) The built-in reference samples S01–S40 are clickable for 判定 and compared with the 標準答案.
- (3) Honest degradation when `/api/*` is unreachable.

**Must stay untouched:** all domain logic, hooks, the API contract, localStorage keys, the terminology in CONTEXT.md, and the simulation disclosure.

**Feels wrong if:** it looks like a toy or student project, like a literary magazine (cream paper, serif, terracotta), or like a sci-fi "AI" neon dashboard.

## Direction contract

THESIS: Every die is a calibrated micrograph plate: true scale, zone boundaries, and numbered leader-line callouts draw the chain AI 回報 → 規範條文 → 判定 directly on the image. Refuses the category default of a dark AI-vision dashboard with bounding boxes plus confidence %, and the KPI-card SaaS shell.

OWN-WORLD: Silicon-indigo shell (#1B2140 family) holding the dark die plates, on a cool optical-white work ground (#F3F5F8), never cream. Ink near-black. Thin-film interference colours do the state jobs only: Pass green #2F8F5B, Warning/預警 gold #D89B12, Fail/異常 red-violet #B4235A, plus one royal blue #3552D6 for selection and links. A flat, square, rule-divided plate grammar: no cards, shadows, or rounded panels. Workhorse sans for CJK, a technical mono for codes and readouts. Figure numbers (圖 n), scale bars, and 1 px leader lines.

STORY: The visitor sees a real sample judged on the first screen, reads that the AI only reports while the rules decide, sees honest numbers (including the 37.0% 漏判率), then clicks a reference sample to run the mechanism themselves. They leave trusting the method and the author.

FIRST VIEWPORT: Silicon-indigo left rail (mark, nav 01–05 總覽/單張判定/批檢驗/批紀錄/管制看板, persistent simulation disclosure at its foot). Main area: header line with project, 規範 v1, and stage PoC ②. Left two-thirds: 圖 1, sample S25 at true scale on its indigo plate, with the core/peripheral boundary, scale bar, and callout ① on the SCR scratch. The right column holds the derivation rows (AI 回報 SCR · 核心區 · 450 µm → 規範 v1 SCR 核心區條文 → Fail), then the MSA before/after table with 漏判率 14.8% → 37.0% in red-violet. The primary action 「用標準樣本試判定 →」 sits under the plate. The 導入階段 ①–④ strip runs below.

SIGNATURE: calibrated plate. A live SVG layer reads layout boxes and draws 1 device-px leader lines from each defect on the die to its coded row. The scale bar is computed from 5 µm/px and the rendered size. Insets are pixel-honest (one visible pixel = 5 µm). Callouts render white while they are "AI 回報" and then take the verdict colour once the rule derives the result. Motion grammar: a single 160 ms ease-out draw of the leader lines, with reduced-motion snapping.

RAISES:
- Variable-font specimen: scale contrast carries hierarchy.
- Centre-rail setting: the 1 px ruling engine.
- Emigre bitmap: pixel honesty.
- Labanotation: defect bars at true scale on a shared µm axis against the limit.
- Vertical feed: one die owns the plate, with prev/next one keypress away.
- J-card: tentative vs committed ink for AI output until a rule or a named person commits it.

FORM: 晶粒顯微圖版 (die micrograph plate), position 6 of 7 on the ordered list; seed key eeaee6d2 (re-roll 1).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- The exact CJK/Latin faces are chosen at build time.
- Mobile: the rail collapses to a top bar plus bottom tab switch for 檢驗/處置單.

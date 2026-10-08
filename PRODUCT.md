# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: the hiring side at 均華, reading the deployed link on their own.** An interviewer or hiring manager for the 「智慧製造專案專員」 role opens the link from the résumé on a desktop browser, with no one explaining it. The app has to make its own case: what problem it solves, how, and what was actually measured.
- **Primary: the author demoing it live in the interview**, on a projector or screen share, narrating as they click. The UI has to stay legible at a distance and support a spoken walkthrough (upload → verdict detail → lot → p-chart signal → action plan).
- **Simulated in-product persona:** a packaging-line quality/process engineer doing 晶粒外觀檢查 after Die Sorter AOI. The app is built as their working tool, and evaluators judge whether it feels like something a factory would really use.

## Product Purpose

A portfolio PoC of a smart-manufacturing improvement project (PDCA), built around a real pain point from the author's past 人工目檢 experience: the line already has a written inspection spec, but **judging is done by the human eye**. Each die means finding defects, measuring and matching clauses by hand, so inspection is slow, small defects get missed, and boundary measurements vary by person. The question the project answers: with AI reporting defects and rules deriving the Verdict, can inspection be faster while accuracy and 漏判 are no worse than a human's? The comparison baseline is the author's own two rounds of judging by the spec (real data); the oral-standard condition only shows how AI behaves without rules. Public copy names no former employer for the pain point.

The app turns that into a traceable flow: a versioned 檢驗規範 → AI reports defects only → rules derive the Verdict → lots roll up into a p-chart with SPC rules → 預警／異常 trigger an AI-drafted, human-confirmed 異常處置單.

Success means an evaluator leaves believing all four of these: the author is **methodologically rigorous** (spec, rule-derived verdicts, MSA, SPC); can **drive a project** to the line (PDCA loop, rollout plan, RACI, risks); has **real production-line sense** (vocabulary and workflow from the floor); and is **honest** about what is simulated, assumed, and unproven.

## Positioning

The AI does not judge. It only reports defect class, zone, and measurements, and the Verdict is derived by versioned rules (ADR-0001). That swaps human inconsistency for a traceable rule, not for AI inconsistency. Every Verdict cites its triggering clause and spec version. The project measures itself with attribute agreement analysis and publishes the result even though it was unflattering. A neighboring "AI defect detection" demo that lets the model output pass/fail plus a confidence score cannot truthfully claim any of this.

**Framing for 均華（decided 2026-10-06）**: 均華 builds semiconductor packaging equipment (Chip Sorter, Die Bonder, laser marking, molding, precision molds); the role improves 均華's *own* manufacturing. Lead with the **transferable improvement method** (pain point → versioned spec → data validation → early warning → action plan → rollout plan), add one mapping to 均華's own factory scenarios (framed as hypotheses to verify on site, not facts), and treat knowledge of the Chip Sorter customer-side process as a bonus, not the main pitch.

## Operating Context

- Domain: 封裝段晶粒外觀檢查; Die Sorter → AOI 複判; defect classes `CHP` 崩角, `CRK` 裂紋, `SCR` 刮傷, `CON` 污染; zones 核心區／周邊區; 5 µm/px geometry.
- Workflow in the app: 單張判定 (upload one die → 判定明細) → 批檢驗 (multi-upload into the current Lot) → 批紀錄 (per-lot n, Pass/Warning/Fail, 批不良率, CSV export) → 管制看板 (p-chart, Phase I = first 14 lots, signal markers, baseline vs recent Pareto) → 異常處置單 side panel (stream draft, edit fields, tick 通知單位, name a confirmer, 確認送出 stored locally).
- Rituals referenced: SPC 判異準則, OCAP-like action plans (never called OCAP), weekly tracking meetings, four 導入階段 (① MSA + spec → ② PoC → ③ 單線試行 → ④ 擴線與 MES 介接; only ① and ② done).
- Language: Traditional Chinese UI, domain terms per `CONTEXT.md`.

## Capabilities and Constraints

- React 19 + TypeScript + Vite SPA, Tailwind v3 + CSS custom properties; Vercel serverless functions (`/api/inspect`, `/api/chat`) hold `ANTHROPIC_API_KEY` server-side only. A non-Vercel build is served under base `/ai-inspection-demo/` (GitHub Pages).
- `npm run dev` runs without the API: 管制看板 works fully, AI features 404. The design must degrade honestly when the API is unreachable.
- Terminology is binding (`CONTEXT.md`): Verdict is Pass / Warning / Fail only; **預警 (lot-level) ≠ 判定 Warning (die-level)**, never a bare "warning" in UI copy; 異常 = above UCL; the action plan is 異常處置單, never "OCAP"; 批 (Lot) ≠ 批次上傳 (an operation).
- Processing progress (`idle | analyzing | done | error`) is separate from the Verdict.
- Unparseable AI output → Verdict Warning with reason 「AI 回覆無法解析，送人工複判」. The system never fabricates confidence or measurements, and gives no Verdict on failure.
- 異常處置單: AI drafts only; a human must review and confirm, and 確認送出 does not actually send anything.
- Data lives in localStorage (`die_inspection_lots_v1`, `action_plans_v1`).
- Desktop-first two-panel layout; mobile switches between 檢驗 and 處置單.

## Brand Commitments

None visual. The user confirmed the entire current look (MUJI-style paper, 「檢」 seal, bilingual labels) is replaceable. What is binding is content and truth: domain vocabulary, the simulation disclosure, and the AI-reports / rules-judge separation.

## Evidence on Hand

- `docs/spec/inspection-spec-v1.md`: 檢驗規範 v1, acceptance values marked **假設值**, not an industry standard.
- `docs/adr/0001-*.md`, `docs/adr/0002-*.md`: verdict-from-spec decision; semi-synthetic reference samples.
- `experiment/samples/S01–S40.png` + `reference.json`: semi-synthetic die images with reference answers.
- `experiment/results/msa-summary.md`, `msa-metrics.json`, `msa-results.xlsx`: the MSA before/after. **The honest result:** after spec v1, 人工複判率 improved (42.5% → 23.3%), but 漏判率 worsened (14.8% → 37.0%), agreement barely moved, after-spec repeatability got worse once measured (85.8% → 77.5%, below the 90% gate); a second round with spec v2 (tiled zoom, program-measured sizes, safe routing; 2026-10-07) brought 漏判率 to 0% and repeatability to 92.5%, but 誤判率 rose to 7.6% and 評估者間一致率 is 82.5%, so the v2 gate is still not passed, and the recommendation is **not** to proceed to ③. This must never be presented as a win.
- `experiment/results/p-chart.png`, `pareto.png`, `control-chart.xlsx`, `control-chart-summary.json`; `public/data/lots.json`: 25 statistically simulated lots × 50 dies, with an injected CHP drift scenario.
- `docs/rollout/導入計畫.xlsx`: charter, phase timeline, RACI, risk list, weekly tracker.
- Absent, and not to be fabricated: real fab data, real customers, real yield or cost savings, any production deployment, industry-standard acceptance values, a confidence score.

## Product Principles

1. **Rules judge, AI reports.** Every Verdict shows its derivation (defect → zone → measurement → clause → spec version). Nothing in the UI implies the model decided.
2. **Simulation is disclosed where the data appears**, not only in the README. Simulated, assumed, and measured are always distinguishable.
3. **Show the unflattering number.** Rigor is proven by reporting what didn't work and what the next PDCA turn would change.
4. **Speak the floor's language.** Domain vocabulary, codes, units (µm, %, n), and SPC conventions come before generic dashboard idiom.
5. **Humans own the action.** AI drafts the 異常處置單; a named person confirms it. The UI makes that ownership explicit.

## Accessibility & Inclusion

Must stay legible on a projector or screen share at a distance (live demo) and on an ordinary office desktop. Verdict and signal states must not rely on color alone. No other product-specific standard has been established.

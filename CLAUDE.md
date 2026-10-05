# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (UI only — /api/* calls will 404)
vercel dev        # Start Vite + serverless functions together (full stack, needs Vercel CLI)
npm run build     # Type-check + production build (tsc -b && vite build)
npm run lint      # ESLint
npm run check:spec # Self-check of spec-v1 rule engine + p-chart rules (Node type stripping)
npm run preview   # Preview production build locally
```

No test framework is configured (see `npm run check:spec`).

### `vercel dev` local quirks

`vercel dev` is the only way to test `/api/*` locally, but it has known friction in this repo:

- The Vercel project is configured to use **yarn** for install/build, even though the repo has `package-lock.json` (no `yarn.lock`). Until that setting is changed, `vercel dev` requires yarn on PATH (`npm i -g yarn`).
- Vite must honor `process.env.PORT` so `vercel dev` can detect it — handled in `vite.config.ts` (`server.port: process.env.PORT ? Number(process.env.PORT) : undefined`). Don't remove this line.
- `vercel dev` sometimes fails to inject `ANTHROPIC_API_KEY` from `.env.local` into the function runtime (yields `ANTHROPIC_API_KEY environment variable is not set`). Workaround: `export ANTHROPIC_API_KEY=...` in the shell before `vercel dev`. Long-term fix: ensure `vercel env add ANTHROPIC_API_KEY development` has been run.
- Local URL is `http://localhost:3000` (not Vite's 5173).

## Architecture

React 19 + TypeScript SPA on **Vite**, with Anthropic-powered AI features served via **Vercel Serverless Functions**. The Anthropic API key lives **only** in `process.env.ANTHROPIC_API_KEY` on the server (Vercel Env Vars) — it is never exposed to the browser.

Domain: 晶粒外觀檢查改善專案 (PDCA). Use the glossary in `CONTEXT.md` for UI copy and code names (Verdict, InspectionSpec, DefectClass, InspectionZone, Lot, LotDefectRate, WarningSignal, OutOfControl, ActionPlan). 預警 (lot-level) ≠ 判定 Warning (die-level) — never just "warning" in UI copy; don't call the action plan "OCAP". Rules live in `docs/spec/inspection-spec-v1.md`; key decision in `docs/adr/0001-verdict-derived-from-spec-not-ai.md` (AI reports defects only; verdict is derived by rules).

### Request flow

```
Browser  ──fetch──▶  /api/inspect  ──Anthropic SDK──▶  Claude (defect list JSON only) → judgeDie() derives verdict
                     /api/chat     (chunked streaming 異常處置單 draft)
```

### App shell and pages
- **Shell** (`src/components/Layout/AppShell.tsx`): silicon-indigo left rail (nav, 規範 v1, AI 服務 status, persistent simulation disclosure); collapses to a top bar under 900px. Pages are hash-routed in `src/App.tsx` (`#/overview`, `#/inspect`, `#/lot`, `#/records`, `#/control`).
- **專案總覽** (`features/overview/OverviewPage.tsx`, first screen): S25 calibrated plate + rule derivation, MSA before/after (honest: 漏判率 got worse), p-chart summary, 導入階段, PDCA index.
- **單張判定** (`InspectPage`): reference samples S01–S40 or upload → `DiePlate` + 判定明細, 標準答案 derivation, recorded MSA replies. **批檢驗** (`LotInspectionPanel`), **批紀錄** (`LotRecordPanel`).
- **管制看板** (`ControlDashboard`): p-chart, 判異清單, Pareto; `ActionPlanPanel` (異常處置單: AI drafts, human edits and confirms, localStorage only) is its right column.
- `hooks/useApiStatus.ts` probes `POST /api/inspect` with `{}` (400 JSON before any Anthropic call) → `online | offline`; offline (GitHub Pages / plain Vite) disables live AI and says why.

### Serverless functions (`api/`)

Both are **Node.js** functions sharing `api/_lib.ts` (Anthropic client factory, media-type validation, JSON-fence stripping, error mapping). Default model: `claude-sonnet-4-6`, overridable via `CLAUDE_MODEL` env var.

- `api/inspect.ts` — POST `{ imageBase64, mimeType }` → `{ result: InspectionResult }`. Prompt encodes spec v1 geometry (5 µm/px, zones, defect classes). Model returns `{"defects":[...]}` only; server validates with `parseDefectList` and derives the verdict with `judgeDie`. Unparseable/invalid → verdict `warning`, reason 「AI 回覆無法解析，送人工複判」 (no fabricated numbers).
- `api/chat.ts` — POST `{ signal: LotSignalContext, today }` → `text/plain` **chunked streaming** 異常處置單 draft with `## 異常描述 / 可能原因 / 確認項目 / 暫時對策 / 通知單位 / 建議追蹤日` sections. Frontend reads via `fetch().body.getReader()` (no SSE framing).

`api/inspect.ts` imports the rule engine from `src/features/inspection/spec/inspectionSpecV1.js` (Vercel Node ESM needs the `.js` extension on relative imports). Keep that file dependency-free (no relative imports, no DOM/Node APIs, no enums) since both tsconfig projects and the API runtime use it.

### Frontend feature modules (`src/features/`)

- **`inspection/`** — `spec/inspectionSpecV1.ts` (spec as code: types, labels, `judgeDie`, `parseDefectList`), `api/inspectionApi.ts` (`inspectDie`), `hooks/useInspection.ts` (processing `progress: idle | analyzing | done | error`, separate from `result.verdict: pass | warning | fail`), `hooks/useBatchInspection.ts` (multi-file upload operation), components `ImageUploader`, `InspectionResult` (判定明細), `LotInspectionPanel`.
- **`lots/`** — `useLots` (lots + current lot id in localStorage key `die_inspection_lots_v1`, try/catch, drops thumbnails if quota exceeded), `summarizeLot`, CSV export, `LotPicker`, `LotRecordPanel`.
- **`control/`** — `spc.ts` (pure: `computeControlChart` p-chart with Phase I = first 14 lots, per-lot limits, rules >UCL → 異常, 7 rising / 2-of-3 beyond 2σ → 預警; `compareParetos`), `controlView.ts` (dataset + live lots → chart, Pareto, `LotSignalContext[]`), `hooks/useLotsDataset.ts` (loads `${BASE_URL}data/lots.json`, falls back to `data/fallbackLots.ts`), `PChart` (hand-rolled SVG), `ParetoCompare`, `ControlDashboard`.
- **`actionPlan/`** — `api/actionPlanApi.ts` (streams `/api/chat`), `parseDraft.ts`, `useActionPlans` (localStorage `action_plans_v1`, lifted to `App`), `ActionPlanPanel` (AI-draft fields shown as tentative until edited/confirmed).
- **`samples/`** — `referenceData.ts` is **generated** by `python experiment/export_app_data.py` (40 reference samples + 120 recorded after-condition AI replies + MSA headline metrics); `sampleModel.ts` derives verdicts with `judgeDie`; images in `public/samples/` (1000 px JPEG) and `public/samples/thumbs/`. Re-run the export script whenever `experiment/` results change.
- **`inspection/components/`** — `DiePlate` (SVG overlay in µm units: seal ring/core boundary, 1 mm scale bar, 標準答案 markers, pixel-honest inset), `LeaderLayer` (leader lines between `data-anchor` elements; AI only reports zones, so lines end at zone tags, never invented positions), `ScaleBar` (true-scale measurement vs `acceptanceScale()` limits).

Self-check (no test framework): `npm run check:spec` runs `scripts/check-spec.ts` with Node type stripping. It also verifies `acceptanceScale` against `judgeDefect`, the 40 reference verdicts, TS-vs-`spec_v1.py` parity on recorded replies, and the 37.0% 漏判率.

### TypeScript projects

`tsconfig.json` references three sub-projects:
- `tsconfig.app.json` — frontend (`src/`), `vite/client` types
- `tsconfig.node.json` — `vite.config.ts`, `node` types
- `tsconfig.api.json` — serverless functions (`api/`), `node` types (also type-checks the shared spec file it imports)

### Styling

Visual world: 顯微圖版 (die micrograph plate). Direction contract lives in `.impeccable/surfaces/src-app-tsx.md`; product truth in `PRODUCT.md`. Plain CSS in `src/index.css` (Tailwind v3 directives kept for preflight only) with tokens: silicon shell `--si-*`, work ground `--ground`/`--surface`/`--rule`, ink `--ink`/`--ink-2`/`--ink-3`, states `--pass` / `--warn` (Warning・預警) / `--fail` (Fail・異常) each with `-ink` (text) and `-tint` (fill), `--accent` for selection. Square corners, 1px rules, no shadows/cards. Fonts: Archivo + Noto Sans TC, JetBrains Mono for codes/measurements only. Use the tokens, never hex. Icons and `VERDICT_STYLE` / `SIGNAL_STYLE` in `src/components/ui/icons.tsx`; `VerdictMark` (○△✕ as SVG), `VerdictChip`, `DieMark` in `src/components/ui/marks.tsx`.

### Deployment

Vercel Project Settings → Environment Variables → set `ANTHROPIC_API_KEY` (and optionally `CLAUDE_MODEL`). `vercel.json` rewrites everything except `/api/*` to `/` (SPA routing). The key never ships in the client bundle. Non-Vercel builds use base `/ai-inspection-demo/`, so fetch static data via `import.meta.env.BASE_URL`.

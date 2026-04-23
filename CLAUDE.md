# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (UI only — /api/* calls will 404)
vercel dev        # Start Vite + serverless functions together (full stack, needs Vercel CLI)
npm run build     # Type-check + production build (tsc -b && vite build)
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

No test framework is configured.

## Architecture

React 19 + TypeScript SPA on **Vite**, with Anthropic-powered AI features served via **Vercel Serverless Functions**. The Anthropic API key lives **only** in `process.env.ANTHROPIC_API_KEY` on the server (Vercel Env Vars) — it is never exposed to the browser.

### Request flow

```
Browser  ──fetch──▶  /api/inspect   ──Anthropic SDK──▶  Claude Sonnet 4.6
                     /api/compare
                     /api/chat (chunked streaming)
```

### Two-panel layout
- **Left panel** (`src/App.tsx`): `ImageUploader` + `InspectionResultPanel` (plus tabs: Batch, A/B, History, Stats)
- **Right panel** (`src/App.tsx`): `ChatPanel` — streaming multi-turn conversation

### Serverless functions (`api/`)

All three are **Node.js** functions. They share `api/_lib.ts` (Anthropic client factory, media-type validation, JSON-fence stripping, error mapping). Default model: `claude-sonnet-4-6`, overridable via `CLAUDE_MODEL` env var.

- `api/inspect.ts` — POST `{ imageBase64, mimeType, customCriteria? }` → `{ result: InspectionResult }`. JSON parsing happens server-side; on parse failure returns a `warning` fallback.
- `api/compare.ts` — POST `{ imageABase64, imageBBase64, mimeTypeA, mimeTypeB, customCriteria? }` → `{ result: ComparisonResult }`.
- `api/chat.ts` — POST `{ history, message, inspectionSummary? }` → `text/plain` **chunked streaming** body. Frontend reads via `fetch().body.getReader()` (no SSE framing — raw text deltas).

### Frontend feature modules (`src/features/`)

**`inspection/`**
- `api/inspectionApi.ts`: thin `fetch` wrapper for `/api/inspect` and `/api/compare`.
- `hooks/useInspection.ts`: manages `status` (`idle | analyzing | pass | fail | warning`), `result`, `imagePreview`, plus `analyze` / `reanalyze` / `reset`.
- `hooks/useBatchInspection.ts`, `hooks/useComparison.ts`: same pattern for batch and A/B flows.
- Types: `InspectionResult` (status, confidence 0-100, summary, defects[], recommendation, analyzedAt), `ComparisonResult`.

**`chat/`**
- `api/chatApi.ts`: `streamChatMessage(messages, newMessage, context, onChunk)` — POSTs to `/api/chat`, reads chunked body via `getReader()`, decodes with `TextDecoder`, invokes `onChunk` per delta.
- `hooks/useChat.ts`: manages message list and streaming state.
- `ChatContext` carries `inspectionSummary` from the inspection result to ground the chat.

### TypeScript projects

`tsconfig.json` references three sub-projects:
- `tsconfig.app.json` — frontend (`src/`), `vite/client` types
- `tsconfig.node.json` — `vite.config.ts`, `node` types
- `tsconfig.api.json` — serverless functions (`api/`), `node` types

### Styling

Tailwind CSS v3 + CSS custom properties (`--bg`, `--primary`, `--accent`, `--success`, `--danger`, etc.) defined in `src/index.css`. Use these CSS variables for color references rather than hardcoded hex values.

### Deployment

Vercel Project Settings → Environment Variables → set `ANTHROPIC_API_KEY` (and optionally `CLAUDE_MODEL`). `vercel.json` rewrites everything except `/api/*` to `/` (SPA routing). The key never ships in the client bundle.

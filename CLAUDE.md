# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite)
npm run build     # Type-check + production build (tsc -b && vite build)
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

No test framework is configured.

## Architecture

This is a **pure frontend** React 19 + TypeScript app (no backend). The Gemini API key is entered by the user and stored in `localStorage` under `gemini_api_key`.

### Two-panel layout
- **Left panel** (`src/App.tsx`): API key input + `ImageUploader` + `InspectionResultPanel`
- **Right panel** (`src/App.tsx`): `ChatPanel` — streaming multi-turn conversation

### Feature modules (`src/features/`)

**`inspection/`** — image upload and Gemini Vision analysis
- `api/inspectionApi.ts`: `analyzeImage(apiKey, imageBase64, mimeType)` — calls `gemini-1.5-flash` with a Chinese-language quality inspection prompt; expects raw JSON back (no markdown fences); falls back gracefully if JSON parsing fails
- `hooks/useInspection.ts`: manages `status` (`idle | analyzing | pass | fail | warning`), `result`, `imagePreview`, and `reset`
- Types: `InspectionResult` (status, confidence 0-100, summary, defects[], recommendation, analyzedAt)

**`chat/`** — streaming multi-turn AI conversation
- `api/chatApi.ts`: `streamChatMessage(apiKey, messages, newMessage, context, onChunk)` — uses `model.startChat()` with history + `sendMessageStream()`; injects inspection summary as system context when available
- `hooks/useChat.ts`: manages message list and streaming state
- `ChatContext` carries `inspectionSummary` from the inspection result to ground the chat

### Styling
Tailwind CSS v3 + CSS custom properties (`--factory-*`) defined in `src/index.css` for the dark industrial theme (dark navy background, cyan accent `#00d4ff`). Use these CSS variables for all color references rather than hardcoded hex values.

# AI Features — CourtControl AI

## Overview

CourtControl AI uses Google Gemini (via Genkit) for intelligent schedule optimization.
All AI features require `GOOGLE_GENAI_API_KEY` to be set. When the key is missing or
a placeholder, **all AI features are explicitly disabled** — no silent fallbacks.

## Features

### 1. AI Schedule Optimization (`/dashboard/schedule`)
- **What it does**: Generates an optimized match schedule using Gemini 2.5 Flash-Lite.
- **Input**: Tournament details, participants, locations, strategic goals.
- **Output**: Optimized match assignments with court/time slots.
- **When disabled**: Button shows "AI kapali" banner. Clicking shows a toast error.

### 2. Bracket Generation (`/dashboard/schedule`)
- **What it does**: Deterministic single-elimination bracket generation.
- **AI dependency**: None — this is pure TypeScript math, no LLM calls.
- **When disabled**: Still works normally.

## Behavior When Key Is Missing

| Component | Behavior |
|-----------|----------|
| `/api/ai/status` | Returns HTTP 503 with `{ error: "ai_not_configured", ... }` |
| `/api/health` → `checks.ai_quota` | `ok: false`, reason: key missing |
| `/api/health` → `checks.env` | `ai_key_configured: false` |
| Schedule page UI | Red banner: "AI features disabled" |
| AI Auto-Schedule button | Shows toast on click, does not call server |
| `optimizeTournamentSchedule()` | Throws `AiNotConfiguredError` |

## Enabling AI

Set the environment variable:

```bash
GOOGLE_GENAI_API_KEY=your-real-key-here
```

No code changes needed. The feature activates automatically on next request.

## Health Check Notes

- `checks.scheduler`: Returns `ok: false` when `SCHEDULER_URL` is not set (dev mode).
  The scheduler is a separate OR-Tools service, not the AI model.
- `checks.ai_quota`: Returns `ok: false` when `GOOGLE_GENAI_API_KEY` is missing.

## Models

| Model | Use Case | Cost (per 1M tokens) |
|-------|----------|---------------------|
| `gemini-2.5-flash-lite` | Default — schedule optimization | $0.10 in / $0.40 out |
| `gemini-2.5-flash` | Premium reasoning (override) | $0.30 in / $2.50 out |
| `gemini-3.1-flash-lite` | Next-gen (preview) | $0.25 in / $1.50 out |

Override with `GOOGLE_AI_MODEL` env var.

# Backend deployment for real AI pricing

This repository now supports a safer split between the public GitHub Pages demo and a private backend. GitHub Pages must not store API keys. To restore higher accuracy, deploy the Node backend separately and configure the public page to call that backend.

## Runtime architecture

The public page at `docs/index.html` first checks `GET /health` on the configured backend URL. If the backend is reachable, it submits uploaded garment images to `POST /api/evaluate-stream-batch` and reads the streaming events used by the original app flow:

| Event | Purpose |
|---|---|
| `phase1` | Initial AI vision detection and rule-based price estimate. |
| `market` | Market enrichment from configured resale/retail data provider. |
| `phase2` | Multi-agent consensus and refined price. |
| `error` | Backend-side fallback/error status. |

If no backend URL is configured, or the backend call fails, the page clearly falls back to lower-accuracy demo mode.

## Required environment variables

| Variable | Required for | Notes |
|---|---|---|
| `OPENAI_API_KEY` | AI vision / OpenAI-compatible provider | The backend now uses the shared LLM resolver so OpenAI-compatible base URLs can work when configured. |
| `ANTHROPIC_API_KEY` | Claude provider in multi-agent consensus | Needed for full three-provider consensus. |
| `GOOGLE_AI_API_KEY` | Gemini provider in multi-agent consensus | Needed for full three-provider consensus. |
| `RETAILED_API_KEY` | Market enrichment via retailed/retails.io service | Without this, the backend reports that market data is not fully ready. |
| `CORS_ORIGINS` | Browser access from GitHub Pages | Set to `https://aiteammate9-rgb.github.io` in production. Multiple origins can be comma-separated. |
| `PORT` | Server port | Provided automatically by most hosting platforms. |

## Build and start commands

```bash
pnpm install
pnpm build
pnpm start
```

The server exposes `GET /health`, which returns capability flags without exposing secret values. The public page uses these flags to avoid claiming that **AI 3 ตัว** or **retails.io** are active unless the backend is configured for them.

## Configure the public GitHub Pages page

Open the public demo, click **ตั้งค่า Backend URL**, and enter the deployed backend origin, for example:

```text
https://your-backend.example.com
```

The URL is stored only in the browser's local storage. It is not committed to the repository and no API keys are exposed in GitHub Pages.

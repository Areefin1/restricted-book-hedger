# Deployment and operational notes

The local demo is complete; public hosting is a separate operational step. No cloud resources or public endpoint are created by the demo commands.

## Single origin

Install `backend/requirements.txt`, run `npm ci` and `npm run build` in `frontend/`, and package both `backend/` (including data/metadata) and `frontend/dist/` in their repository-relative locations. Run:

```bash
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
```

Use your hosting platform's HTTPS ingress. Build with a blank `VITE_API_BASE_URL` and `VITE_USE_MOCK=false`. FastAPI serves `/`, `/favicon.svg`, and `/assets`; the frontend uses hash navigation. API errors remain JSON and are not replaced by a catch-all HTML page. Readiness is `/api/health`; successful startup requires the validated cache. This is a small research service with no authentication, persistence, or trading functionality.

## Separate frontend and API

Build React with `VITE_API_BASE_URL=https://your-api.example` and `VITE_USE_MOCK=false`. Serve `frontend/dist/` as static assets. Set the backend's `CORS_ORIGINS` to the exact HTTPS frontend origin(s), comma-separated. Configure HTTPS on both services and verify browser reachability. No secrets belong in Vite variables. The Vite development proxy is not part of the production build.

## Optional Gemini chat

Set `GEMINI_API_KEY` in `backend/.env` for local use or in the backend host's secret environment settings. Restart the backend after changing it. The key stays on the server; never put it in a `VITE_` variable. The pinned `google-genai` dependency is included in `backend/requirements.txt`.

The bottom-right assistant sends questions to `POST /api/explanations`, which recomputes the current simulation before passing its summary, assumptions, events, and metadata to Gemini. It uses `gemini-3.1-flash-lite`. Chat covers the full simulation period; chart zoom and research plots are not included. Questions, the latest six conversation turns, and simulation context are sent to Google. Conversation history lives in the browser's memory, survives minimizing and tab navigation, and clears when simulation inputs or the data version change or the page reloads. Mock mode disables AI chat.

The original simulation-only explanation request still works. Chat additionally accepts `question` (up to 2,000 characters) and `history` (up to 12 user/assistant messages). Missing configuration returns 503; provider failures return a retryable 502 response. The loading animation respects the device's reduced-motion setting.

## Cache lifecycle and reproducibility

Use the checked-in cache for a reproducible presentation. Refresh explicitly while the service is stopped; restart every worker after replacing files. Prices and metadata have individually atomic replacements and matching hashes; interruption between replacements yields visible unknown-provenance notes rather than falsely attributing a different cache. Research is precomputed once per worker. Each response includes the loaded data version.

Record the Python/Node versions, dependency installs, data hash, and build artifacts used for a release. Direct Python dependencies are pinned, and frontend transitive dependencies are locked in package-lock.json. Python transitive dependencies are not fully locked. Review data-provider redistribution terms before public redistribution or commercial use. Configure platform logs, restart policy, storage, and any institutional access controls before operational use.

## Release checks

Run backend tests, frontend lint/build, and browser tests. Check all presets and both research plots. For a separate-origin deployment, repeat a browser simulation against the deployed URLs and inspect metadata. Rehearse the demo without downloading prices. The full Plotly bundle remains a large lazy-loaded asset; a purpose-built smaller bundle can improve first-chart load time.

# Repository structure

The repository contains a FastAPI application, a React interface, standalone research, and supporting review evidence. Commands below run from the repository root unless stated otherwise.

```text
backend/
  app/
    main.py                  API setup, lifecycle, static frontend serving
    config.py                Environment settings and stable cache paths
    routes/                  HTTP adapters and error mapping
    schemas/                 Validated API inputs and outputs
    services/                Shared application workflows and Gemini explanations
    hedger/                  Financial calculations, data loading, provenance
  data/                      Runtime price cache and matching metadata
  research/                  Standalone funded-inverse research prototype
  scripts/                   Explicit data-download and Gemini utilities
  tests/
    fixtures/                Small synthetic inputs
    research/                Tests for the standalone prototype
frontend/
  src/
    api/                     HTTP client, types, API errors
    features/                Simulator, research, chat, and other product features
    components/              Components shared across features
    analysis/                Display calculations and synthetic-model helpers
    hooks/                   Shared React hooks
    mock/                    Explicit synthetic API and data
    styles/                  Global theme and shared layouts
  e2e/                       Browser tests
scripts/                     Whole-project orchestration, including demo.py
docs/
  reviews/                   Historical reports, probe scripts, fixtures, evidence
```

## Placement rules

- Put financial calculations in `backend/app/hedger/`. These modules must not depend on HTTP requests or Gemini.
- Put workflows used by multiple routes in `backend/app/services/`. Routes validate requests, call these workflows, and map errors to HTTP responses; routes do not call other routes.
- Keep request and response models in `backend/app/schemas/`.
- Keep feature-specific React components and styles together under `frontend/src/features/`. For example, chat lives in `features/chat/HedgeChat.tsx` and `features/chat/chat.css`. Keep components used across features in `components/`.
- Keep frontend calculations needed to present API results in `analysis/`. Synthetic calculations support explicit mock mode; the Python API remains authoritative for real simulations.
- Put backend development utilities in `backend/scripts/` and whole-project launch/build orchestration in root `scripts/`. Utilities use explicit `main()` entry points and must not run provider requests on import.
- Keep the runtime cache in `backend/data/` and synthetic test inputs in `backend/tests/fixtures/`. The standalone funded-inverse prototype in `backend/research/` is distinct from the application's hedge overlay.

## Entry points

| Task | Command |
| --- | --- |
| Build and serve the complete demo | `python scripts/demo.py` |
| API with hot reload | `python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000` |
| Frontend with hot reload | `npm --prefix frontend run dev` |
| Backend and research tests | `python -m pytest` |
| Frontend lint and build | `npm --prefix frontend run lint`, then `npm --prefix frontend run build` |
| Browser tests | `npm --prefix frontend run test:e2e` |
| Data-refresh options | `python backend/scripts/download_prices.py --help` |
| List available Gemini models | `python backend/scripts/list_gemini_models.py` |
| Live Gemini smoke check | `python backend/scripts/gemini_smoke.py` |
| Standalone prototype diagnostics without charts | `python backend/research/check_convexity.py --no-plots` |

The Gemini utilities require a backend `GEMINI_API_KEY` and make live Google API requests. The smoke check also needs a running backend; `--base-url` can select its origin. Each utility supports `--help` without making a provider request. The research checker reads only the local cache; omit `--no-plots` to open charts, which additionally requires the Python `plotly` package.

`backend/.env` remains the local backend configuration file. Frontend environment files stay under `frontend/`. Generated `dist/`, `node_modules/`, Python caches, and browser-test artifacts stay ignored by Git.

See [deployment](deployment.md), [methodology](methodology.md), and the [review archive](reviews/README.md) for operational details and research limitations.

# HedgeLab: Bond Portfolio Risk Simulator

A React and FastAPI research application for comparing an HYG-proxy bond portfolio with a static short hedge and a funded, buy-and-hold SJB position. Explore historical performance, hedge mechanics, financing assumptions, and the differences between a static hedge and a daily-reset inverse ETF.

This project is educational historical analysis. It does not execute trades, forecast returns, or determine whether a hedge is permissible for a restricted portfolio. The bundled market and cash data are **unverified legacy inputs**, visibly labeled in the interface.

## Features

- **Historical simulations:** portfolio value, profit/loss, returns, drawdowns, and exposure drift across unhedged, static short, and SJB-hedged strategies.
- **Scenario and assumption controls:** stress/choppy presets, custom dates, hedge ratios, borrowing and cash assumptions, funding/rebate spreads, transaction costs, proxy stresses, capacity limits, and equity cutoffs.
- **Hedge mechanics and research views:** daily-return diagnostics, rolling windows, two-day illustrations, and an in-sample hedge-ratio search. See the current research limitations below.
- **Gemini chat:** a floating assistant for explanations and follow-up questions grounded in server-calculated simulation results, with message history and an animated loading indicator.
- **Explicit synthetic mode:** deterministic data for frontend development; API failures never silently switch the interface to mock results.

## Quick start

The project has been developed and checked with **Python 3.13, Node.js 24, and npm 11**. Run commands from the repository root.

Install dependencies in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
npm --prefix frontend ci
```

On macOS/Linux, activate the environment with `source .venv/bin/activate` instead.

Build and start the complete local demo:

```powershell
python scripts/demo.py
```

Open **http://127.0.0.1:8000**. One Python process serves the API and the compiled frontend. Stop it with Ctrl+C. The bundled price cache is used; starting the app does not download market data.

Reuse an existing frontend build:

```powershell
python scripts/demo.py --skip-build
```

Add `--port 8001` if port 8000 is occupied. Cached-data analysis can run offline after dependencies and frontend assets are installed; Gemini chat requires network access.

## Development

With the Python environment active, run these commands in separate terminals:

```powershell
python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

```powershell
npm --prefix frontend run dev
```

Open **http://127.0.0.1:5173**. Vite proxies `/api` to the backend on port 8000. Backend code reloads automatically; changing the cached data requires restarting the backend.

## Configuration

Use `backend/.env.example` as the template for a local `backend/.env`. The settings loader resolves that file independently of your terminal's working directory. Environment variables override its values.

| Backend setting | Default / purpose |
| --- | --- |
| `APP_NAME` | `Restricted Book Hedger` |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173`; comma-separated frontend origins |
| `PRICES_PATH` | `data/prices.csv`, resolved relative to `backend/` |
| `METADATA_PATH` | `data/metadata.json`, resolved relative to `backend/` |
| `GEMINI_API_KEY` | Optional; enables AI explanations and chat |

Frontend settings can go in `frontend/.env.local`, using `frontend/.env.example` as a reference:

| Frontend setting | Default / purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Blank for the local proxy or single-origin demo; set the API origin for separate hosting |
| `VITE_USE_MOCK` | `false`; set exactly `true` to use labeled synthetic data |

Restart Vite or rebuild the frontend after changing frontend environment settings. Local environment files are ignored by Git; example templates remain shareable. Keep the Gemini key in backend configuration, because `VITE_` variables are exposed to the browser.

## Gemini assistant

Add your key to `backend/.env`, then restart the backend:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
```

Open **Ask about results** in the bottom-right corner. The backend recomputes the current simulation and sends its summary, assumptions, events, and data metadata to Gemini. The configured model is `gemini-3.1-flash-lite`.

Chat covers the **full simulation period**. Chart zoom and research plots are not sent. Questions, the latest six conversation turns, and simulation context are sent to Google. History stays in browser memory, survives minimizing and navigation, and resets when the simulation or data version changes or the page reloads. AI chat is disabled in synthetic mock mode.

Development utilities, both of which make live Google API requests:

```powershell
python backend/scripts/list_gemini_models.py
python backend/scripts/gemini_smoke.py
```

The smoke check also needs a running backend; use `--base-url http://127.0.0.1:8001` to target a different port. Both utilities support `--help` without making a request. Missing Gemini configuration returns HTTP 503; provider failures return HTTP 502 with a retryable message.

## Repository layout

```text
backend/
  app/
    routes/          HTTP adapters
    schemas/         Validated API inputs and outputs
    services/        Shared simulation workflows and Gemini explanations
    hedger/          Financial calculations, data loading, and provenance
  data/              Runtime price cache and metadata
  research/          Standalone funded-inverse prototype
  scripts/           Data-download and Gemini utilities
  tests/             API/calculation tests, synthetic fixtures, research tests
frontend/
  src/
    api/             API client and TypeScript contracts
    features/        Simulator, risk, mechanics, research, search, chat, assumptions
    components/      Shared UI components
    analysis/        Display calculations and synthetic-model helpers
    mock/            Synthetic API and data
  e2e/               Playwright browser tests
scripts/             Whole-project orchestration
docs/                Methodology, API contract, deployment, and review archive
```

The standalone prototype in `backend/research/` models a separately funded inverse position and is distinct from the application's portfolio hedge overlay. Inspect its local-cache diagnostics with:

```powershell
python backend/research/check_convexity.py --no-plots
```

Omitting `--no-plots` opens charts and additionally requires the Python `plotly` package. See the [repository structure guide](docs/repository-structure.md) for file-placement rules and entry points.

## Data and modeling limits

The bundled `backend/data/prices.csv` contains 3,912 shared observations from March 22, 2011 through October 9, 2026. Its matching `metadata.json` records cache identity and adjustment conventions, but the original retrieval time and provider verification are unavailable. A matching hash establishes file identity, not historical accuracy.

The loader validates positive finite prices and unique dates, sorts observations without forward filling, and uses adjusted HYG/SJB prices or normalized `hyg`/`sjb` columns. A missing or invalid price cache prevents startup. Missing or mismatched provenance remains visible in metadata.

The static hedge approximates negative reinvested adjusted HYG returns; it is not an executable fixed-share short ledger. HYG is a proxy for the restricted book. Borrowing, funding, trading costs, and other controls are modeled assumptions rather than verified broker terms. The project does not replicate the referenced paper's equity dataset or establish out-of-sample performance.

Synthetic arithmetic inputs live in [backend/tests/fixtures/](backend/tests/fixtures/). Recorded review evidence lives in [docs/reviews/](docs/reviews/README.md).

Refresh data explicitly while the service is stopped:

```powershell
python backend/scripts/download_prices.py --cash-returns-csv path/to/cash.csv --cash-source "Provider, retrieval date, return convention and alignment"
```

This requires provider access and a local `date,rf_return` CSV containing decimal cash returns over intervals ending on every retained ETF date. Missing cash dates are rejected. Parsed provider output and supplied cash bytes are archived by hash. Prices and provenance are staged before replacement. Use `--help` for date-range options and see [methodology](docs/methodology.md) for cash-return conventions.

`python backend/scripts/download_prices.py --describe-existing` describes the existing cache without downloading data; it overwrites the metadata sidecar. Restart the backend after replacing the cache.

## Verification and current status

```powershell
python -m pytest
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test:e2e
```

Pytest discovers application and standalone-prototype tests under `backend/tests/`. Browser tests build the frontend and launch an isolated backend on port 8765. Windows defaults to installed Edge; use `BROWSER_CHANNEL=chrome` for installed Chrome. On other systems, run `npx playwright install chromium` from `frontend/`. `HEDGER_PYTHON` can select the test server's Python interpreter.

**Latest local verification, October 10, 2026:** frontend lint/build passed; all 14 focused desktop/mobile chat and accounting checks passed using mocked Gemini responses. The full backend suite reported **178 passed and five failed**. Those existing failures concern rolling-window cash/excess-return fields, volatility conventions, and the research API response schema. The full research workflow is not currently validated; earlier remediation reports describe historical snapshots rather than current passing status.

To run the focused browser checks against an existing build:

```powershell
cd frontend
npx playwright test explanation.spec.ts accounting.spec.ts
```

The full Plotly bundle produces a large-chunk build warning; the production build succeeds.

## API and documentation

Interactive API documentation is available at **http://127.0.0.1:8000/docs** while the backend is running.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Worker health |
| GET | `/api/metadata` | Coverage, provenance, data hash, and supported features |
| GET | `/api/scenarios` | Stress/choppy presets and full history |
| POST | `/api/simulations` | Portfolio paths, performance, exposures, events, and assumptions |
| POST | `/api/explanations` | Gemini explanations and follow-up chat |
| GET | `/api/research/sanity` | Daily-return diagnostics |
| GET | `/api/research/convexity?window_days=63` | Rolling-window research; subject to the known schema issue above |
| POST | `/api/recommendations` | In-sample historical hedge-ratio search |

- [Methodology](docs/methodology.md): formulas, conventions, and interpretation limits.
- [API contract](docs/api-contract.md): fields, units, and error behavior.
- [Repository structure](docs/repository-structure.md): folder responsibilities and utility commands.
- [Deployment](docs/deployment.md): single-origin and separate-service hosting.
- [Demo script](docs/demo-script.md): presentation flow and reference figures.
- [Remediation record](docs/integrity-remediation.md) and [review archive](docs/reviews/README.md): historical findings, evidence, and outstanding data requirements.
- [Team plan](docs/team-plan.md): delivery scope and deferred work.

## Troubleshooting

- **API unreachable:** start the backend and confirm Vite's proxy targets its port. Retry in the interface.
- **Gemini unavailable:** check backend configuration and restart it after changing the key. For temporary provider failures, use the chat's retry control.
- **Synthetic labels appear:** set `VITE_USE_MOCK=false`, restart Vite or rebuild, and reload.
- **Research returns HTTP 500:** see the known rolling-window schema mismatch under current status.
- **Cross-origin errors:** use the local proxy/single-origin demo or configure the backend's `CORS_ORIGINS` for the deployed frontend.
- **Browser tests cannot launch:** choose an installed browser channel or install Playwright Chromium.

Public hosting, user accounts, saved simulations, trade execution, and portfolio-specific institutional modeling remain outside the current local demo.

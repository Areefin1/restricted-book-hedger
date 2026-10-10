# Restricted Book Hedger

A working React/FastAPI research demo comparing an HYG-proxy bond book with a fixed initial short hedge and a buy-and-hold SJB hedge. It includes portfolio paths and P/L, drawdown/risk views, three historical presets, daily regression diagnostics, rolling-window research, and an in-sample hedge-ratio search.

Educational historical analysis. HYG is a proxy, financing and trading costs are simplified, and the app does not execute trades or determine whether a hedge is permissible for a restricted portfolio.

The [P0/P1 remediation table](docs/integrity-remediation.md) records fixes and remaining data requirements. Simulation and search share matched cash financing, assumed spreads/trading costs, proxy stresses, capacity limits and equity cutoffs. Research uses excess returns and zero-mean realized variation. Bundled prices and cash quotes remain **unverified legacy inputs**, labeled in the interface. No actual holdings or broker terms have been supplied.

## Run the demo

Verified development environment: Python 3.13, Node.js 24, npm 11. Install dependencies once from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
npm --prefix frontend ci
```

On macOS/Linux, activate with `source .venv/bin/activate` instead.

Start the complete demo:

```powershell
python scripts/demo.py
```

Open **http://127.0.0.1:8000**. This builds React and serves its assets and the API from one Python process. Stop with Ctrl+C. The checked-in historical cache is used; no data download is required. After the first build, this command also works without an internet connection:

```powershell
python scripts/demo.py --skip-build
```

Use `--port 8001` if port 8000 is occupied. A custom frontend `.env.local` must leave `VITE_API_BASE_URL` blank and `VITE_USE_MOCK=false` for the single-server demo. Environment changes require rebuilding.

## Develop with hot reload

Run these commands in separate terminals from the repository root, with the Python environment active:

```powershell
python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

```powershell
npm --prefix frontend run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to the backend on port 8000. Python calculations are authoritative. To develop the UI against deterministic synthetic data, explicitly set `VITE_USE_MOCK=true` in `frontend/.env.local`; the UI labels that mode. There is no automatic fallback to synthetic results when the real API fails.

## Data and configuration

`backend/data/prices.csv` contains 3,912 shared observations from March 22, 2011 through October 9, 2026. The loader uses `hyg_adj_close`/`sjb_adj_close` (or normalized `hyg`/`sjb` columns), validates positive finite prices and unique dates, and sorts dates without forward filling. Cached prices are loaded once per API worker. Research and presets are precomputed from that snapshot; restart the server after changing the cache.

`backend/data/metadata.json` records the exact SHA-256 hash and adjustment convention. The legacy cache's original retrieval time is unknown and is explicitly recorded as null. Describing an existing file does not retrospectively verify its provider response.

Optional: copy `backend/.env.example` to `backend/.env`. Supported settings are `APP_NAME`, `CORS_ORIGINS`, `PRICES_PATH`, and `METADATA_PATH`; environment variables take precedence. Relative cache paths resolve from `backend/`. A missing/invalid price cache prevents startup. Missing or mismatched provenance produces visible metadata notes and does not claim a source it cannot establish.

Refresh the cache explicitly (requires provider access):

```powershell
python backend/scripts/download_prices.py --cash-returns-csv path/to/cash.csv --cash-source "Provider, retrieval date, return convention and alignment"
```

The refresher requires a local `date,rf_return` CSV of decimal cash returns over intervals ending on every retained ETF date. Convert/compound source inputs to that convention before import; see [methodology](docs/methodology.md). Missing cash dates are rejected. Parsed provider output and supplied cash bytes are archived by hash. No provider download was performed during remediation. The downloader uses yfinance with `auto_adjust=False`, retains raw and adjusted closes, removes rows missing either fund, validates staged prices before replacing the cache, and writes provenance. `--start YYYY-MM-DD` and `--end YYYY-MM-DD` bound the download; end is exclusive. Never refresh during a rehearsal. To identify an existing legacy cache without downloading:

```powershell
python backend/scripts/download_prices.py --describe-existing
```

This overwrites the provenance sidecar with an honest legacy-cache description. `sample_prices.csv` is a small synthetic arithmetic fixture, not the demo's market cache.

## Verification

```powershell
python -m pytest
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test:e2e
```

Run the root command above to include API tests and the standalone convexity prototype (configured by `pytest.ini`). The browser suite builds the frontend, starts an isolated API server on port 8765, and checks desktop/mobile views, scenario switching, calculations displayed from HTTP responses, research charts, ratio search, and invalid-input recovery. It uses installed Edge on Windows. On other systems install the test browser with `npx playwright install chromium` from `frontend/`. Set `BROWSER_CHANNEL=chrome` to use installed Chrome. Set `HEDGER_PYTHON` if tests need a particular Python executable.

## API and documentation

Interactive API docs: http://127.0.0.1:8000/docs.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Worker health |
| GET | `/api/metadata` | Coverage, source, hash, and supported features |
| GET | `/api/scenarios` | Validated stress/choppy presets and full history |
| POST | `/api/simulations` | Paths, P/L, returns, drawdown, and assumptions |
| GET | `/api/research/sanity` | Daily return diagnostics |
| GET | `/api/research/convexity?window_days=63` | Rolling return/volatility points |
| POST | `/api/recommendations` | In-sample historical ratio grid search |

- [API contract](docs/api-contract.md): complete fields, units, and error behavior.
- [Methodology](docs/methodology.md): formulas, windows, costs, presets, and interpretation limits.
- [Demo script](docs/demo-script.md): rehearsal steps and reference numbers.
- [Team plan and delivery status](docs/team-plan.md): ownership, acceptance criteria, and deferred scope.
- [Deployment notes](docs/deployment.md): single-origin and separate-service setups.

## Troubleshooting

- **API cannot be reached:** start Python; for hot reload, confirm port 8000 matches Vite's proxy. Retry in the interface.
- **Price cache not found:** inspect `PRICES_PATH`; use the included cache or explicitly refresh it.
- **Unexpected synthetic labels:** remove `VITE_USE_MOCK=true`, restart Vite/rebuild, and reload.
- **Cross-origin errors:** use the same-origin demo/proxy, or allow the exact frontend origin in `CORS_ORIGINS` when deploying separately.
- **Browser test cannot launch:** select an installed browser channel or install Playwright Chromium. Tests launch an isolated profile.
- **Plotly build warning:** the plotting library is a large lazy-loaded asset; local builds succeed. A smaller chart bundle remains a performance improvement.

The academic overlay, public hosting, accounts, saved simulations, and portfolio-specific institutional modeling remain outside the local demo. No formal academic replication or out-of-sample investment claim is made.

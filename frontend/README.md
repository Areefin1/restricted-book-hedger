# Restricted Book Hedger frontend

React, TypeScript, Vite, and Plotly UI for the Python historical hedge API. Run `npm ci`, then `npm run dev` from this directory. Vite serves http://127.0.0.1:5173 and proxies `/api` to http://127.0.0.1:8000. Start the backend using the [root README](../README.md).

`npm run build` type-checks and produces `dist/`; `npm run lint` checks the source. For the single-server demo, build with a blank `VITE_API_BASE_URL` and `VITE_USE_MOCK=false`, then run `python scripts/demo.py --skip-build` from the repository root.

The shared API client defaults to real HTTP. Set `VITE_API_BASE_URL` only for a separate API origin. Synthetic data is an explicit UI-development option (`VITE_USE_MOCK=true`), never an error fallback. Restart/rebuild after changing Vite variables. API types mirror [the contract](../docs/api-contract.md); Python is authoritative for simulation, research, and search. Frontend derived metrics are calculated from returned paths.

`npm run test:e2e` builds the UI and runs Playwright against a temporary API on port 8765. It checks desktop/mobile navigation, presets, real API results, charts, ratio search, and input recovery. Windows defaults to installed Edge; set `BROWSER_CHANNEL=chrome` for installed Chrome, or use Playwright Chromium on other systems (`npx playwright install chromium`). The Python environment must contain backend dependencies; `HEDGER_PYTHON` can select an interpreter. Screenshots/traces are written to ignored `test-results/`.

The Plotly library loads lazily and remains the largest bundle. Cached-data analysis works without third-party network access after dependencies and assets have been installed/built. Optional Gemini chat requires backend access to Google's API.

Feature-specific components live under `src/features/`; components shared across features live under `src/components/`. Chat and its styles are colocated in `src/features/chat/`. See the [repository structure](../docs/repository-structure.md) for placement rules and backend utility commands.

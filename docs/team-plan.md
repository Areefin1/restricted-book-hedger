# Restricted Book Hedger: Four-Person Work Plan

## 1. What you are building

A React web app with a Python backend that compares how two hedges would have protected a bond portfolio over a historical period:

- **Unhedged portfolio:** the original investment, modeled using HYG.
- **Static short hedge:** a position that gains when HYG falls.
- **SJB hedge:** an inverse ETF whose returns reset daily.

Users enter a portfolio size, hedge ratio, and date range. The app shows portfolio paths, profit/loss, and maximum drawdown. A research tab compares the two hedges across rolling windows. An optional recommendation tab searches for a hedge ratio using a stated historical risk objective.

This plan follows the supplied project idea. It does not independently verify the paper, provider details, or financial claims. Treat those as research tasks before presenting conclusions.

## 2. Stack and architecture

| Area | Proposed tool | Purpose |
| --- | --- | --- |
| Frontend | React + Vite + TypeScript | Forms, navigation, charts, and result displays |
| Backend API | Python + FastAPI + Uvicorn | Validate requests and expose calculation modules over HTTP |
| Data | yfinance and cached CSV files | Obtain price history; support a demo without live downloads |
| Analysis | pandas and NumPy | Returns, portfolio calculations, and rolling statistics |
| Charts | Plotly through a React wrapper | Interactive portfolio and research charts |
| Verification | pytest; frontend type checking/build | Check financial calculations, API contracts, and frontend integration |

React sends JSON requests to FastAPI. FastAPI loads cached data, calls the Python analysis modules, and returns JSON results. React renders those results. Keep financial calculations in Python so there is one authoritative implementation.

**Required demo:** React interface, working API, cached prices, simulator, three historical presets, empirical convexity chart, and clear assumptions.

**Stretch features:** recommendation search, theoretical overlay, result export, accounts, and saved simulations. A database and authentication can be added when persistence is required.

## 3. Balanced division across four people

React introduces a separate frontend and API, so the earlier Streamlit estimate no longer applies. Budget approximately **14–18 person-hours each**, including 2 shared hours, or **56–72 person-hours total**. These are provisional estimates for teammates with mixed Python/React experience. Rebalance after the first integration checkpoint.

| Person | Responsibility | Individual work | Shared work | Total |
| --- | --- | --- | --- | --- |
| A | Data pipeline, FastAPI foundation, and research endpoints | 12–16 hours | 2 hours | 14–18 hours |
| B | Simulator, risk metrics, simulation endpoint, optional recommender | 12–16 hours | 2 hours | 14–18 hours |
| C | Research calculations and React research charts | 12–16 hours | 2 hours | 14–18 hours |
| D | React shell, simulator UI, API client, and frontend integration | 12–16 hours | 2 hours | 14–18 hours |

C implements a complete research feature across Python and React, which reduces the amount of frontend work assigned to D. A owns API plumbing; B owns simulation request/response models and routes. Each person fixes their own module's integration issues.

### Person A — Data pipeline and API foundation

1. Download and clean HYG/SJB prices with a documented adjusted-price convention.
2. Align trading dates and validate duplicates, missing values, and positive prices.
3. Cache prices and provenance metadata; provide synthetic sample data immediately.
4. Create the FastAPI application, configuration, health endpoint, and allowed frontend origins.
5. Load the cache once per process and avoid downloading data inside user requests.
6. Define shared error handling and JSON serialization rules.
7. Expose metadata, scenarios, sanity-check, and convexity endpoints using B/C modules.
8. Test data validation, missing-cache behavior, and research API responses.
9. Own backend run instructions and the backend deployment checklist.

**Done when:** The API serves valid JSON from cached data, accepts the intended frontend origin, documents its endpoints, and handles unavailable data clearly.

### Person B — Simulator, metrics, and simulation API

1. Calculate unhedged, static-short-hedged, and SJB-hedged portfolio paths.
2. Compute final dollar P/L, percentage return, and maximum drawdown.
3. Document comparable capital accounting and explicit short-borrow assumptions.
4. Define and validate historical scenario presets.
5. Implement simulation request validation and the simulation endpoint.
6. Return daily paths, summary rows, effective dates, and assumptions in the agreed schema.
7. Test the two-day examples, ratio 0, invalid ranges, and drawdown calculations.
8. If time permits, implement the ratio search and recommendation endpoint.
9. Help D verify that frontend labels and displayed values match backend units.

**Done when:** Known examples pass and React can obtain a validated simulation through the API.

**Balancing rule:** Recommendation remains optional. If simulation takes longer than expected, another finished teammate can take recommendation work, or the team can cut it.

### Person C — Research calculations and React research tab

1. Calculate daily returns and regression diagnostics.
2. Produce rolling 63-trading-day HYG/SJB returns and realized volatility.
3. Provide reusable Python functions and fixtures to A for API wiring.
4. Implement React daily-return and rolling-window scatter charts.
5. Color rolling points by volatility and overlay the static-short reference line.
6. Add loading, empty-data, and error states to the research tab.
7. Document benchmark differences, overlapping windows, and interpretation limits.
8. Verify the cited paper before adding a theoretical overlay.
9. Test rolling-window boundaries and manually check chart units and reference lines.

**Done when:** The research tab renders API data correctly and its written interpretation follows the evidence.

### Person D — React interface and frontend integration

1. Create the React + Vite + TypeScript project and app shell.
2. Build reusable input controls, tabs, metric cards, and the summary table.
3. Build the simulator form and portfolio line chart.
4. Create the shared API client and TypeScript response types.
5. Wire scenario selection, submission, loading, errors, and retry behavior.
6. Integrate C's research tab; add the recommendation view only if ready.
7. Handle stale requests so an older response cannot overwrite newer results.
8. Add responsive layout, readable labels, finance explanations, and the disclaimer.
9. Own frontend run instructions, demo script, and first deployed frontend check.

**Done when:** The React app runs against FastAPI, all required views work, and a new teammate can follow the README.

## 4. Proposed folder structure

This is a proposed structure, not a set of files already created.

```text
restricted-book-hedger/
    README.md
    .gitignore

    frontend/
        package.json
        package-lock.json
        index.html
        vite.config.ts
        tsconfig.json
        .env.example
        src/
            main.tsx
            App.tsx
            api/
                client.ts
                types.ts
            components/
                SimulationForm.tsx
                MetricCard.tsx
                SummaryTable.tsx
                PortfolioChart.tsx
            features/
                simulator/
                    SimulatorTab.tsx
                research/
                    ResearchTab.tsx
                    DailyReturnChart.tsx
                    ConvexityChart.tsx
                recommendation/
                    RecommendationTab.tsx
            styles/
                global.css

    backend/
        requirements.txt
        .env.example
        app/
            __init__.py
            main.py
            config.py
            schemas/
                __init__.py
                simulation.py
                research.py
                recommendation.py
            routes/
                __init__.py
                health.py
                metadata.py
                simulation.py
                research.py
                recommendation.py
            hedger/
                __init__.py
                data.py
                hedge.py
                metrics.py
                scenarios.py
                sanity.py
                convexity.py
                recommend.py
        data/
            sample_prices.csv
            prices.csv
            metadata.json
        scripts/
            download_prices.py
        tests/
            test_data.py
            test_hedge.py
            test_metrics.py
            test_convexity.py
            test_api.py
            test_recommend.py

    docs/
        team-plan.md
        api-contract.md
        methodology.md
        demo-script.md
```

| Files or directories | Owner |
| --- | --- |
| backend/app/main.py, config.py, health/metadata/research routes, data pipeline | A |
| backend/app/hedger/hedge.py, metrics.py, scenarios.py, recommend.py | B |
| Simulation and recommendation schemas/routes | B |
| Sanity and convexity calculation modules; research schema | C, with A reviewing the API schema |
| frontend/src/features/research/ | C |
| React shell, shared components, client/types, simulator and recommendation views | D |
| Tests | Corresponding module owner |
| docs/api-contract.md | A leads; all four agree changes |
| docs/methodology.md | C leads; A/B contribute |
| README.md, docs/demo-script.md | D leads; everyone contributes |

Keep routes thin: validate input, call an analysis function, serialize output. Keep analysis modules independent of FastAPI and React. Build recommendation files only if that feature is included.

## 5. Shared contracts: agree before coding

### Internal price table

Python modules use a pandas DataFrame indexed by sorted trading date, with positive numeric columns hyg and sjb. The CSV stores date as a column. Use common valid trading dates; do not silently fill missing prices.

### Proposed API endpoints

| Endpoint | Purpose | Owner |
| --- | --- | --- |
| GET /api/health | Confirm the service is running | A |
| GET /api/metadata | Available date range, data provenance, and supported features | A |
| GET /api/scenarios | Named scenario IDs and date ranges | A exposes B's definitions |
| POST /api/simulations | Calculate portfolio paths and summary | B |
| GET /api/research/sanity | Regression diagnostics and daily-return points | A exposes C's calculations |
| GET /api/research/convexity?window_days=63 | Rolling-window points | A exposes C's calculations |
| POST /api/recommendations | Optional historical ratio search | B |

Research endpoints use the full cached history for the MVP. Add bounded date filters only if needed. Limit input sizes and permitted window lengths.

### Simulation request

```json
{
  "book_size": 1000000,
  "hedge_ratio": 0.6,
  "start_date": "2022-01-03",
  "end_date": "2022-12-30",
  "annual_borrow_rate": 0.02
}
```

These are illustrative inputs, not verified scenario presets. The UI resolves a selected preset into dates before submitting.

### Simulation response shape

| Field | Contents |
| --- | --- |
| paths | Array of objects containing date, unhedged, static_short_hedged, sjb_hedged |
| summary | Array containing strategy, final_pnl, return_pct, max_drawdown_pct |
| effective_start_date / effective_end_date | Actual first and last trading dates used |
| assumptions | Proxy, capital accounting, and cost conventions |
| data_version | Cache version or hash used for reproducibility |

Conventions:

- API dates use YYYY-MM-DD; currency values are numeric dollars.
- Request rates/ratios are decimals: 0.02 means 2%.
- Fields ending in _pct are percentage points: 5.0 means 5%.
- Drawdown is displayed as a nonnegative loss magnitude.
- Research returns and volatility use decimals; React converts them to percentage labels.
- Serialize DataFrames into JSON arrays; convert NumPy values to ordinary numbers.
- Never emit NaN or Infinity. Use null for unavailable diagnostics and explain why.
- Resolve nontrading boundary dates to available dates within the requested range; reject an empty range and report effective dates.
- Agree a consistent error body, for example {"error": {"code": "INVALID_RANGE", "message": "No prices available in this range"}}.
- Normalize framework validation errors into that format.
- Check fixtures into the project so frontend work does not depend on a finished API.

Internal analysis functions remain load_prices, simulate_hedges, run_sanity_check, calculate_rolling_windows, and recommend_ratio. They return Python/pandas objects; the API layer converts them to the external contract.

## 6. Build order and handoffs

| Stage | A | B | C | D | Exit condition |
| --- | --- | --- | --- | --- | --- |
| Shared kickoff: 30 minutes | Data/API conventions | Accounting and simulation schema | Research schema | UI flow and response types | Contracts and fixtures agreed |
| Parallel foundations | Cache and API skeleton | Simulator on sample data | Research math and chart fixtures | React shell and mock results | Each workstream runs |
| First integration | API loading/errors | Simulation route | Research data and React tab | Simulator API connection | Browser-to-API round trip works |
| Complete core | Research endpoints | Cost/metric validation | Chart interpretation | Required views and error states | Full demo works with cached data |
| Optional work | Backend deploy/config support | Ratio search if feasible | Theory overlay if verified | Recommendation view/polish | Stretch work does not destabilize core |
| Shared finish: 90 minutes | Data/API Q&A | Math Q&A | Research Q&A | Lead rehearsal | Fresh-start run and pitch pass |

Integrate one simulation request early. A and D jointly own API connectivity; B and C own calculation accuracy.

### Local development

After scaffolding the proposed projects:

Backend terminal, from backend/:

```bash
python -m venv .venv
# Activate the virtual environment for your operating system.
python -m pip install -r requirements.txt
python scripts/download_prices.py
python -m uvicorn app.main:app --reload --port 8000
```

Frontend terminal, from frontend/:

```bash
npm install
npm run dev
```

The download step is optional when the cache exists. Set VITE_API_BASE_URL=http://localhost:8000 in the frontend environment and allow the actual frontend origin in backend configuration. Vite environment values are public browser configuration; keep secrets on the backend.

### Deployment responsibilities

- D: build and deploy the React frontend; configure the production API URL.
- A: deploy the Python service and cached data; configure allowed frontend origins, logs, and health checks.
- B/C: verify deployed results against the local reference examples.
- Use HTTPS for both services and verify the browser can reach the API.
- Vercel is a potential frontend host; a managed container host is a potential backend host. Confirm provider requirements when implementing deployment.
- Docker is optional packaging for the backend. Kubernetes and Supabase remain later additions driven by operational or persistence needs.
- A local offline demo requires both frontend assets and backend to run locally with cached data.

## 7. Modeling decisions the team must make explicit

These are implementation requirements, not conclusions about which investment is best.

1. **HYG is a proxy.** The demo models the locked book as tracking HYG; an actual collection of bonds may behave differently.
2. **Use comparable accounting.** One simple MVP convention is that each series represents original book value plus hedge P/L. The initial SJB purchase is offset by a financing account; financing interest is assumed zero unless modeled. Label this convention clearly.
3. **Separate hedge P/L from portfolio value.** The hedged result is book P/L plus hedge P/L, minus separately modeled costs.
4. **Document adjusted-price behavior.** B must state how adjusted HYG returns approximate short exposure and distributions. This is a simplified comparison, not a complete executable short-trade ledger.
5. **Avoid double-counting fees.** Verify what the chosen return series incorporates before subtracting costs. Display embedded ETF expenses as an explanatory estimate, not an additional deduction from an already net-of-expenses series.
6. **Treat costs as assumptions.** Borrow rates, financing, spreads, and trading costs should be explicit; do not call a regression intercept an exact fund expense.
7. **Distinguish loss from drawdown.** Final P/L measures the change from the start. Maximum drawdown measures the largest fall from a previous peak.
8. **Choose one recommendation objective.** A reasonable MVP is to minimize the worst ending portfolio return across rolling 63-day windows. This differs from minimizing within-window maximum drawdown; do not interchange the two.
9. **Expect a boundary result.** An unconstrained search may select full hedging. That is an outcome of the chosen objective, not a universal recommendation. Report costs and upside tradeoffs.
10. **Label historical optimization.** If selection and evaluation use the same history, call the result in-sample. Use a separate later test period before claiming out-of-sample performance.
11. **Validate preset dates.** Select exact dates for the COVID and 2022 scenarios; choose and document the choppy period using a stated rule rather than cherry-picking a favorable result.

## 8. Verification and definition of done

- [ ] Cached data loads with the internet disconnected.
- [ ] Prices are sorted, unique by date, positive, and aligned.
- [ ] The simulator reproduces the two-day examples from the project brief.
- [ ] With ratio 0, both hedged paths equal the unhedged path.
- [ ] Costs and capital assumptions are visible and consistent.
- [ ] Maximum drawdown passes a small manually calculated example.
- [ ] A 63-day return window uses 63 daily return intervals, requiring 64 price observations.
- [ ] Invalid inputs produce useful messages.
- [ ] All required tabs run from fresh frontend and backend environments.
- [ ] Browser requests reach the API in local and deployed environments.
- [ ] Request/response units, date formats, validation errors, and stale-request handling match the contract.
- [ ] Frontend production build succeeds; backend calculation and API checks pass.
- [ ] Recommendations, if included, match the displayed objective.
- [ ] Research conclusions are supported by the resulting charts.
- [ ] All four people can explain their module and its limitations.

Run backend checks from backend/ with python -m pytest. Run frontend checks from frontend/ using the configured type-check command and npm run build. Also manually verify one complete simulation and each required research chart through the browser.

## 9. Collaboration rules

- Use one branch per workstream: feature/data, feature/simulator, feature/research, feature/ui.
- Each owner opens small pull requests and includes sample output or screenshots where useful.
- Review changes with another person before merging.
- Keep App.tsx and shared frontend components primarily with D; keep API foundation changes primarily with A.
- Tell the team before changing a shared function signature or output column.
- If blocked, use sample data or sample outputs instead of waiting.
- Each person contributes a short explanation and one limitation to the demo script.

**If time runs short:** finish the simulator API and React simulator view first, then the empirical convexity chart. Cut the theoretical overlay and recommender before cutting correctness checks or the final rehearsal.

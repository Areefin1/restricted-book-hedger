# Restricted Book Hedger

A web application for exploring how different hedges would have protected a restricted high-yield bond portfolio during historical market periods.

The app compares an unhedged portfolio, a static short hedge, and an inverse ETF hedge. It uses historical HYG and SJB data to display portfolio performance, risk metrics, and the tradeoffs between the two hedge approaches.

> Educational research prototype. Historical simulations are not forecasts or investment advice. Any real hedge requires independent investment, legal, and compliance review.

## The problem

Credit funds participating in corporate restructurings may receive confidential information that restricts their ability to trade particular securities. While their holdings remain restricted, they can still be exposed to market declines.

This project explores whether a separate broad-market hedge could reduce that exposure. It models the restricted portfolio using HYG as a proxy and compares two historical hedge strategies.

## The strategies

| Strategy | How the prototype models it |
| --- | --- |
| Unhedged | A starting bond portfolio whose returns follow HYG |
| Static short | A fixed initial short exposure to HYG, with an explicit borrowing-cost assumption |
| Inverse ETF | A fixed initial investment in SJB, held over the selected period |

HYG is a high-yield corporate bond ETF. SJB is an inverse ETF targeting the opposite of its benchmark's daily performance. Its multi-day return can differ from simply reversing HYG's cumulative return.

The portfolio proxy and short accounting are simplifying assumptions. The app does not model an actual institution's individual bonds or execute trades.

## Features

### Hedge Simulator

Enter a portfolio value, hedge ratio, and historical date range. Compare:

- Daily paths for all three portfolio strategies.
- Final dollar profit or loss and percentage return.
- Maximum drawdown: the largest decline from a previous portfolio peak.
- Explicit cost and capital-accounting assumptions.

Planned scenario presets include the COVID market shock, the 2022 decline, and a documented choppy period. Exact dates should be validated against the available dataset.

### Convexity Test

Explore rolling 63-trading-day windows to compare HYG and SJB returns. A scatter chart colors windows by realized volatility and includes a static-short reference line.

A daily-return sanity check also examines how closely SJB moves inversely to HYG.

### Historical Hedge-Ratio Search — Optional

Compare candidate hedge ratios under a defined historical risk objective. Display the selected ratio, evaluation period, candidate results, and costs.

The result is a historical optimization, not a universally optimal hedge. Selection and evaluation on the same history must be labeled in-sample.

## Research motivation

The original proposal draws inspiration from *In Defense of Leveraged and Inverse Funds*, attributed in the proposal to Jennifer N. Carpenter, Fangzhou Lu, and Robert F. Whitelaw, dated August 18, 2026.

The project investigates the proposal's hypothesis about daily resetting and path-dependent payoffs using high-yield bond ETF data. It should report what the data shows, including findings that disagree with the hypothesis.

The paper's bibliographic details, publication status, theoretical formulas, and applicability to these funds must be verified before including a theoretical overlay or claiming a formal replication.

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React, Vite, TypeScript |
| Charts | Plotly with a React integration |
| Backend API | Python, FastAPI, Uvicorn |
| Analysis | pandas, NumPy |
| Market data | yfinance with cached CSV files |
| Backend verification | pytest |

## How it works

1. A separate download script retrieves historical HYG and SJB prices.
2. The backend aligns the series on shared trading dates and caches adjusted prices.
3. A user enters simulation parameters in React.
4. React sends a JSON request to FastAPI.
5. Python selects the date range and calculates portfolio paths and risk metrics.
6. FastAPI returns JSON; React renders charts and summaries.

Market data is reused across requests rather than downloaded for every simulation.

## Inputs

| Input | Meaning |
| --- | --- |
| Book size | Starting dollar value of the modeled bond portfolio |
| Hedge ratio | Initial hedge exposure divided by book size; 0.6 means 60% |
| Start and end dates | Historical period to simulate |
| Annual borrow rate | Assumed yearly borrowing rate for the static short |
| Scenario preset | A shortcut that selects a documented date range |

A hedge ratio describes initial exposure, not a guaranteed percentage reduction in losses.

## Proposed project structure

The following is the intended layout. This README does not imply that every component has already been implemented.

```text
restricted-book-hedger/
    README.md
    frontend/
        package.json
        src/
            App.tsx
            api/
            components/
            features/
                simulator/
                research/
                recommendation/
    backend/
        requirements.txt
        app/
            main.py
            config.py
            routes/
            schemas/
            hedger/
                data.py
                hedge.py
                metrics.py
                scenarios.py
                sanity.py
                convexity.py
                recommend.py
        data/
            hyg.csv
            sjb.csv
            prices.csv
            metadata.json
        scripts/
            download_prices.py
        tests/
    docs/
        team-plan.md
        api-contract.md
        methodology.md
        demo-script.md
```

## Local development

These instructions assume the proposed frontend and backend have been scaffolded. Run the frontend and backend in separate terminals.

### Backend

From the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python scripts/download_prices.py
python -m uvicorn app.main:app --reload --port 8000
```

On macOS or Linux, activate the environment using:

```bash
source .venv/bin/activate
```

Skip the download command if a validated cache is already available.

Backend address: http://localhost:8000  
FastAPI documentation, when enabled: http://localhost:8000/docs

### Frontend

From the repository root in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the address printed by Vite.

Create frontend/.env.local with:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

The frontend API client must read this variable. Configure the backend to allow the actual frontend origin through CORS. Frontend environment values are public; store credentials and secrets only on the backend.

## Data

Download daily historical prices for HYG and SJB using the same adjustment convention. Keep the original per-fund files for inspection and produce a combined simulation input:

```csv
date,hyg,sjb
```

The combined file should contain:

- Sorted, unique trading dates.
- Positive adjusted prices.
- Only dates with valid observations for both funds.
- No silently filled missing prices.

Record data source, retrieval time, date coverage, adjustment settings, and a data version in metadata.json. A requested range must contain enough valid observations for the selected calculation.

Adjusted prices are analytical inputs rather than executable trade prices. Review data-provider usage and redistribution terms before a public or commercial deployment.

## Planned API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | /api/health | Service health |
| GET | /api/metadata | Data coverage and assumptions |
| GET | /api/scenarios | Historical presets |
| POST | /api/simulations | Portfolio simulation |
| GET | /api/research/sanity | Daily-return diagnostics |
| GET | /api/research/convexity | Rolling-window analysis |
| POST | /api/recommendations | Optional historical ratio search |

Example simulation request:

```json
{
  "book_size": 1000000,
  "hedge_ratio": 0.6,
  "start_date": "2022-01-03",
  "end_date": "2022-12-30",
  "annual_borrow_rate": 0.02
}
```

These dates are illustrative inputs. Return actual effective trading dates, portfolio paths, summary metrics, assumptions, and the data version. Finalize the request/response schemas in docs/api-contract.md before integration.

## Verification

From backend/:

```powershell
python -m pytest
```

From frontend/:

```powershell
npm run build
```

Required checks include known two-day examples, zero-hedge behavior, drawdown calculations, date alignment, validation errors, and a complete browser-to-API simulation.

## Team responsibilities

| Person | Primary responsibility |
| --- | --- |
| A | Data pipeline, FastAPI foundation, and research endpoint wiring |
| B | Simulator, metrics, simulation endpoint, and optional recommendation |
| C | Research calculations and React research charts |
| D | React interface, shared API client, and frontend integration |

All four contribute to review, documentation, integration, and demo rehearsal.

## Deployment direction

The React frontend and Python API can be deployed separately. A potential setup is Vercel for the frontend and a managed container service for the backend.

Docker can package the Python service and its dependencies. Supabase can be added for authentication and saved simulations if those features become necessary. Kubernetes is a later operational choice rather than a requirement for the prototype.

Before deployment, configure production API URLs, allowed origins, HTTPS, logs, and cache availability. Verify provider requirements when selecting hosting.

## Institutional use and limitations

The intended audience is credit investment and risk teams exploring market hedges for restricted exposures. The prototype supports historical comparison; it does not establish that a hedge is permissible, liquid enough, or suitable for a particular portfolio.

An institutional version would require actual portfolio exposures, better cost and liquidity modeling, reliable data access, reproducible reporting, access controls, and independent model validation.

A broad-market hedge may reduce general market exposure while leaving issuer-specific default risk largely unprotected. Past performance does not establish future protection.

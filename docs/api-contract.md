# API contract

The React HTTP client and FastAPI implement this contract. Base path: `/api`. Responses are JSON, dates are ISO calendar dates (`YYYY-MM-DD`), money is numeric USD, input rates/ratios are decimals, `_pct` fields use percentage points (5 = 5%), and research returns/volatility use decimals (0.05 = 5%). Drawdown is a nonnegative loss magnitude. JSON never contains NaN or Infinity.

## Health, metadata, and scenarios

`GET /health` returns `{"status":"ok"}` after successful cache initialization. A missing/invalid cache or fewer than two observations prevents worker startup.

`GET /metadata` returns:

| Field | Type | Meaning |
| --- | --- | --- |
| first_date / last_date | date string | Loaded coverage |
| trading_days | integer | Shared price observations, including the initial price |
| data_version | string | `sha256:` followed by the loaded CSV content hash |
| sha256 | string | Full cache digest |
| provenance / source / adjustment | string | Source description and price conventions |
| retrieved_at | string or null | Recorded download time; null for the legacy cache |
| is_synthetic | boolean | Explicit synthetic-data label |
| features | object | `{"recommendation": true}` |
| notes | string array | Missing/stale provenance warnings |

A provenance sidecar is trusted only when its hash matches the prices. The existing legacy cache is identified honestly; its historical retrieval time is not reconstructed.

`GET /scenarios` returns an array of `{id, name, start_date, end_date, rule}`. Dates resolve to actual observations. Stress presets are omitted when the intended coverage is unavailable; choppy is omitted when no eligible window exists. `full` is always present. See methodology for the selection rules.

## Simulation

`POST /simulations` accepts:

```json
{
  "book_size": 1000000,
  "hedge_ratio": 0.6,
  "start_date": "2022-01-03",
  "end_date": "2022-12-30",
  "annual_borrow_rate": 0.02
}
```

All fields are required. `book_size` is finite, greater than zero, and at most 50 billion; the UI limits it to at least $1,000. `hedge_ratio` is 0 through 1. `annual_borrow_rate` is 0 through 0.25. Numeric strings, booleans, extra fields, timestamp dates, and nonfinite numbers are rejected. Start cannot follow end. Inclusive boundaries resolve inward; at least two prices must remain. A partially overlapping range uses only available observations and reports effective dates.

Response fields:

| Field | Contents |
| --- | --- |
| paths | Sorted array of `{date, unhedged, static_short_hedged, sjb_hedged, unhedged_pnl, static_short_hedged_pnl, sjb_hedged_pnl}`; values/P&L are dollars |
| summary | Exactly one `{strategy, final_pnl, return_pct, max_drawdown_pct}` per strategy |
| effective_start_date / effective_end_date | Actual first/last path dates |
| assumptions | Array of `{label, detail}` explaining accounting and costs |
| data_version | Loaded CSV content identity |

Strategy IDs are `unhedged`, `static_short_hedged`, and `sjb_hedged`. Each total-value path starts at book size; each P/L starts at zero. Borrow is already deducted from the short path and summary and must not be deducted again.

## Research

`GET /research/sanity` returns `{points, beta, intercept_daily, r_squared, correlation, observations, notes, data_version}`. Each point contains `{date, hyg_return, sjb_return}`. OLS regresses SJB daily adjusted returns on HYG daily adjusted returns. Diagnostics are null with explanatory notes when fewer than three returns or zero variance prevents a fit. `intercept_daily` is a daily decimal; the UI's annualized display multiplies it by 252 and is not a fee estimate.

`GET /research/convexity?window_days=63` accepts integer window lengths **21, 63, or 126** (default 63). It returns `{window_days, points, notes, data_version}`. Each point has `{start_date, end_date, hyg_return, sjb_return, hyg_realized_vol}`. N intervals require N+1 prices. Returns and annualized volatility are decimals. Insufficient history returns an empty points array. Research always uses the full loaded cache.

## Historical ratio search

`POST /recommendations` accepts:

```json
{
  "start_date": "2022-01-03",
  "end_date": "2022-12-30",
  "instrument": "sjb",
  "window_days": 63,
  "annual_borrow_rate": 0.02
}
```

`instrument` is `sjb` or `static_short`. `window_days` defaults to 63 and permits 21/63/126. Other fields are required, with the simulation date/borrow conventions. Extra fields are rejected. The selected history must include a complete window.

The response contains `instrument`, `objective`, `recommended_ratio`, `objective_value_pct`, `grid`, `windows_evaluated`, `in_sample`, `effective_start_date`, `effective_end_date`, `assumptions`, and `data_version`. Each of the 21 grid rows contains `{hedge_ratio, worst_window_return_pct, median_window_return_pct, best_window_return_pct}`. Ratios run from 0 to 1 in 0.05 increments. The objective maximizes the worst ending portfolio return; numerical ties within 1e-9 percentage points favor the smaller ratio. `in_sample` is true. Each rolling window starts with a freshly sized hedge and uses its own calendar-day borrow accrual.

## Errors and lifecycle

Errors use `{"error":{"code":"INVALID_RANGE","message":"..."}}`.

| HTTP status | Code | Meaning |
| --- | --- | --- |
| 422 | VALIDATION_ERROR | Malformed JSON, invalid fields/types/bounds, unsupported search window, or invalid date order |
| 422 | INVALID_RANGE | No sufficient selected prices, incomplete search window, or unusable calculation inputs |
| 422 | INVALID_WINDOW | Unsupported research window length |
| 404 | NOT_FOUND | Unknown resource |
| 405 | METHOD_NOT_ALLOWED | Wrong HTTP method; Allow header retained |
| 500 | INTERNAL_ERROR | Unexpected error; details logged on the server |

The frontend shows errors and offers retries for failed requests; it does not fall back to mock prices. Older responses cannot overwrite newer requests. Data and metadata are fixed for the worker lifetime; restart after a refresh. CORS allows configured origins, GET/POST, and Content-Type, without credentials. The combined local demo requires no cross-origin requests.

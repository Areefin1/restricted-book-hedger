# Methodology

This paper-inspired research demo compares adjusted HYG/SJB return series. HYG is the example restricted book. It does not replicate the paper's equity dataset or model executable fixed-share trades. See the [remediation table](integrity-remediation.md) for resolved defects and outstanding data requirements.

## Data and cash inputs

The bundled cache has 3,912 shared observations, March 22, 2011–October 9, 2026. Its identity is `sha256:49468ede28065fd6492c0ef54488ae34cd0a49367e2a8da8fd8889bcaef503dc`. Prices and historical cash quotes remain **unverified**; the original provider responses, adjustment verification and retrieval time were not recorded. Updating the matching sidecar does not establish market accuracy. No price bytes were changed by the remediation.

`hyg_adj_close`/`sjb_adj_close` (or `hyg`/`sjb`) are analytical adjusted return series. Raw closes are retained for inspection. The loader rejects conflicting aliases, duplicate dates/columns, and missing, nonfinite or nonpositive prices. It sorts dates without forward filling. Exchange-calendar completeness, corporate actions and independent vendor reconciliation remain open.

One helper, `funding.py`, defines cash intervals throughout the API and standalone prototype:

1. An explicit `annual_cash_rate` overrides the cache and assumes a constant effective annual decimal rate: `(1+r)^(elapsed calendar days/365)-1` per interval.
2. Otherwise `rf_return` is the decimal return over the interval ending at each observation. No annual-yield conversion or extra weekend accrual is applied.
3. Otherwise legacy `rf_annual_pct` is interpreted **only as an unverified assumption**: previous observation's effective annual percentage over actual/365. This is not a verified Treasury, discount-yield or broker convention.

The first observation starts the holding period and accrues zero. Negative rates above -100% are supported. Missing cash inputs never silently become zero. A price-only cache supports health/metadata and simulations/searches with an explicit cash assumption; cached research returns 422 until cash data exists. Synthetic mock data explicitly assumes zero cash.

The refresher now requires a local cash CSV and source description. The file must contain `date,rf_return`, with a finite decimal return above -1 for every retained ETF date. Convert any source yield into returns using its actual quote basis and availability timing before import. If ETF dates skip source sessions, compound source returns across those sessions; do not assume missing dates are zero or forward fill. The importer rejects missing dates. Parsed provider output and exact supplied cash bytes are archived by hash; parsed output is not an original HTTP response. Provenance remains unverified pending independent checks.

## Equal-equity investor overlays

Let B be initial equity, h the initial hedge ratio, n=hB, H and J the adjusted HYG/SJB growth factors, G the compounded cash growth factor, and t actual calendar years since inception. Let b be assumed book beta and a annual additive basis stress. The underlying book is `Q=B*[1+b*(H-1)+a*t]`; default b=1, a=0 follows HYG. These are simple sensitivities, not estimated holdings, DV01, CS01, coupon, default or recovery models.

Let f be the continuous annual funding spread, s the continuous annual rebate haircut, r the simple annual borrow fee, and c round-trip trading cost in basis points. Define `F=G*exp(f*t)`, `R=G*exp(-s*t)` and `C=n*c/10000` after inception (zero at inception).

| Strategy | Modeled total equity before cutoff |
| --- | --- |
| Unhedged | `Q` |
| Static negative-return overlay | `Q - n*(H-1) + n*(R-1) - n*r*t - C` |
| Buy-and-hold SJB overlay | `Q + n*(J-1) - n*(F-1) - C` |

Each path starts at B; cumulative P/L equals value minus B. Short proceeds earn modeled cash less the rebate haircut; the SJB purchase pays cash plus the funding spread. This also represents opportunity cost when financed from available cash. Borrow fees are separate from rebate haircuts: do not enter the same net financing charge twice. Cash accounts compound; borrow remains a constant simple fee on initial notional. Both simulation and every fresh search window use the same formulas and cutoff. Frontend mock calculations use the same definitions and are checked against the real API with nonzero financing/stresses.

ETF expenses and distribution economics are embedded in adjusted returns and are not subtracted again. Negative reinvested HYG return differs from a fixed-share short with cash distribution liabilities. The model does not maintain share counts or a dividend-payment ledger. Hypothetical round-trip cost is charged once on initial notional after inception; it is not observed execution or continuously accumulated turnover.

## Capacity, termination and exposure drift

`max_hedge_notional`, when supplied, caps initial n. Simulation rejects an excess; search omits infeasible grid ratios using actual book size. A blank limit means capacity is **unverified**, not infinite market liquidity. No quotes, NAV, ADV, participation, premium/discount or nonlinear market impact are inferred.

Each strategy freezes at the first closing value at or below `termination_floor*B`, retaining closing overshoot. Default floor zero prevents a negative-equity path from later recovering in the research output. Events identify strategy and date. This is a conservative research cutoff, **not broker margin, an executable liquidation price, or permission to sell a restricted book**. Intraday margin, borrow recalls, changing marked borrow fees, derivative counterparty exposure and actual collateral schedules remain open. Stress the floor, cash/borrow costs, proxy beta and basis rather than assuming that a terminal payoff was accessible.

Daily hedge/book diagnostics are `h*H/(Q/B)` and `h*J/(Q/B)`. They are modeled return-series exposure ratios excluding cash, not measured index beta or holdings-based residual risk. A ratio is unavailable when the underlying book is nonpositive or that strategy has terminated. Initial investments are held; the investor does not rebalance. SJB's internal daily reset does not maintain the investor's hedge ratio. No maintained-exposure strategy is claimed.

## Performance metrics and mechanics

`final_pnl=final_value-B`; `return_pct=100*(final_value/B-1)`; `max_drawdown_pct=100*max(1-value/running_peak)`. Drawdown can exceed 100% when a closing loss overshoots zero. Portfolio-risk volatility is sample standard deviation of daily equity returns times sqrt(252); undefined returns after nonpositive equity and insufficient observations display `n/a`. Borrow display stops at that strategy's cutoff. Frozen periods are included in reported paths.

Mechanics uses separately returned **instrument total returns**, not funded hedge P/L or the stressed proxy book. Its negative-HYG line is explicitly a zero-carry reference before financing and costs. It remains available at hedge ratio zero.

## Excess-return research and paper volatility

Daily OLS regresses `SJB daily total return - interval cash return` on `HYG daily total return - interval cash return`. Degenerate fits return null. Annualized intercept is daily intercept times 252, a descriptive diagnostic rather than an expense estimate. HYG is a tradable proxy, not the exact underlying index. Cached research uses cache cash inputs; simulation's constant-rate override does not rewrite the research cache.

For each N-interval window, compound the asset and cash separately. Research `hyg_return` and `sjb_return` are **asset compounded total return minus cash compounded return**, not compounded daily excess returns. Separate `*_total_return` and `cash_return` fields preserve the decomposition. `hyg_realized_vol=sqrt(sum(daily HYG excess return²)*252/N)` is zero-mean annualized realized variation. `hyg_sample_vol` separately reports demeaned sample excess volatility. Constant trends therefore retain variation under the zero-mean measure. N intervals use N+1 prices; M prices yield max(0,M-N) windows. Supported N: 21, 63, 126.

On excess-return axes, `y=-x` is the no-rebalance **funded** inverse benchmark before costs: a $1 position has $2 in cash minus $1 of HYG, total return `2G-H-1`, excess return `G-H`. This is distinct from the app's investor overlay. The standalone `backend/research/convexity.py` uses this funded definition and the same cash helper/zero-mean excess variation. Its continuous theory curve accepts a cash growth factor for consistent carry; an optional continuous-rate illustration is separately identified. Daily discrete and continuous ideal-reset curves are theoretical comparisons, not actual SJB execution.

Window counts are not independent sample sizes. Volatility terciles and gap averages are descriptive. Benchmark timing, tracking, distributions and expenses also affect the gap; these charts do not isolate a causal reset effect.

## Presets and search

2020 stress covers February 3–June 30; 2022 covers the calendar year resolved inward. The choppy rule selects the highest zero-mean **total-return** volatility among 126-interval windows with absolute HYG total return at most 2%, excluding the stress presets. It deliberately uses total returns so financing assumptions cannot change the scenario. Earliest tied window wins. Selection is in-sample.

Search tests h=0,.05,…,1 within the capacity limit. Each overlapping window starts fresh, applies all cash/cost/proxy/cutoff assumptions, and contributes ending equity return. The highest worst-window return wins; ties within 1e-9 percentage points favor the smaller ratio. This is a grid optimum for terminal loss, not minimum drawdown, a continuous optimum or an out-of-sample result. Returned window length identifies the displayed result; stale results cannot be applied while inputs update.

## Portfolio-specific use remains open

A real portfolio normally comes from a brokerage/custodian holdings export or portfolio system: identifiers, quantities, currency, value and cash flows. Separate interest-rate and spread exposures, concentration, defaults, optionality and FX must be modeled. Broker funding, rebate, borrow and collateral terms come from the relevant account/rate schedule. Assumptions support research sensitivities; they cannot validate feasibility or protection for a particular book. Verified cash/market data, actual holdings and broker terms remain team actions in the remediation table.

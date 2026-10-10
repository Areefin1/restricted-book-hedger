# Methodology

This demo compares observed adjusted return series. It models the locked bond book with HYG and compares fixed initial short-HYG and long-SJB hedge exposures. It does not execute trades or establish legal permission, portfolio suitability, or future protection.

## Data and reproducibility

The checked-in cache has 3,912 common observations, March 22, 2011 through October 9, 2026. Analytical prices are `hyg_adj_close` and `sjb_adj_close`; raw closes are retained for inspection. Adjusted prices approximate returns including distributions and corporate actions rather than executable trade prices. The downloader requests `auto_adjust=False` and explicitly selects adjusted closes, drops incomplete paired observations, and does not forward fill.

The loader rejects duplicate dates, missing/nonfinite/nonpositive prices, and malformed required columns; it sorts dates. Shared observations need not form a complete exchange calendar. The cache hash identifies exact input bytes; metadata provenance is used only when its recorded hash matches. The legacy retrieval timestamp is unknown. This validates file structure and reproducibility, not the accuracy of the original provider response. Explicit refreshes record provider and retrieval settings and time. Normal requests require no internet connection.

## Portfolio accounting

Let B be starting book value, h the initial hedge ratio, H(t) and J(t) adjusted HYG/SJB prices, and r the annual borrow rate. Define R_H(t) = H(t)/H(0) - 1, R_J(t) = J(t)/J(0) - 1, and d(t) actual elapsed calendar days from inception.

- Unhedged value: `B * (1 + R_H(t))`.
- Static-short-hedged value: `B * (1 + R_H(t)) - h*B*R_H(t) - h*B*r*d(t)/365`.
- SJB-hedged value: `B * (1 + R_H(t)) + h*B*R_J(t)`.
- Portfolio P/L: total value minus B.

All strategies start at B; both hedges have fixed initial exposure hB. The SJB purchase is offset by a financing account with zero interest. The investor does not rebalance either hedge during a simulation. SJB's internal daily resetting is reflected in its observed prices.

The static short is negative adjusted HYG returns on an initial notional, a simplified analytical approximation rather than a fixed-share executable short ledger with separate distribution payments. Borrow is simple actual/365 fixed accrual on the initial notional, including weekends and holidays, with zero cost at inception. Short proceeds earn no interest. Embedded fund expenses are not deducted a second time. Spreads, commissions, margin, recalls, financing costs, liquidity, and institution-specific taxes are omitted. Ratio zero makes both hedged paths equal the book; ratio one makes the static path flat before borrow costs.

## Metrics

`final_pnl = final_value - initial_value`. `return_pct = 100*(final_value/initial_value - 1)`. For running peak P(t), `max_drawdown_pct = 100*max(1 - value(t)/P(t))`. Drawdown is a positive loss magnitude; it can exceed 100% if a financed modeled portfolio goes negative. Final loss and drawdown answer different questions.

Frontend risk views derive peak/trough dates, daily returns, worst day, and annualized volatility from the API paths. Volatility uses sample standard deviation (`ddof=1`) of daily simple returns times sqrt(252). Fewer than two daily returns or undefined returns produce unavailable volatility, displayed as `n/a`. The displayed short borrow amount uses the same actual/365 formula as Python. Hedge P/L in the summary is the incremental portfolio result after modeled borrow costs.

## Daily sanity check

Daily returns are `price(t)/price(t-1) - 1`. OLS fits `SJB return = intercept + beta * HYG return + residual`. The API reports beta, daily intercept, correlation, R-squared, observations, and all points. At least three daily returns and nonzero variance in both series are required; otherwise diagnostics are null with a note.

HYG is a comparison proxy; the two funds have benchmark and implementation differences. A beta near -1 indicates inverse co-movement and does not prove exact target delivery. The intercept includes benchmark differences, expenses, tracking, and noise. Multiplying it by 252 is an illustrative annualized diagnostic, not an estimate of a fund's exact fee.

## Rolling-window comparison

Permitted windows are 21, 63, and 126 trading return intervals. N intervals require N+1 price observations, and a cache with M prices yields max(0, M-N) overlapping windows. Window returns are endpoint adjusted-price ratios minus one. HYG realized volatility uses the N daily returns in that same window, sample standard deviation, and sqrt(252).

The scatter plots SJB cumulative return against HYG cumulative return, colored by annualized HYG volatility. The line `y = -x` is a static short reference **before borrow costs**. A point's vertical gap is `SJB return + HYG return`. Volatility terciles sort windows and split into approximately equal counts, reporting descriptive means and share of positive gaps.

Windows overlap and are highly dependent. Counts do not represent independent experiments. Differences in benchmark exposure, distributions, tracking, and expenses affect the observed gap alongside daily compounding. The chart does not identify causal effects of resetting or establish a theoretical convexity curve.

## Presets

- **2020 stress:** February 3?June 30, 2020, covering the selloff and initial recovery. This is a stated broad period, not an optimized peak-to-trough selection.
- **2022 drawdown:** calendar 2022, resolving to January 3?December 30 in this cache.
- **Choppy period:** among 126-interval windows with absolute net HYG return <= 2%, choose the highest realized HYG volatility, excluding windows overlapping the two stress presets. Earliest window wins equal volatility. Selection is in-sample, so this preset illustrates a rule rather than unbiased evidence.
- **Full history:** all common cache dates.

All presets return actual cached dates. In shorter custom caches, unavailable stress presets and an unavailable choppy preset are omitted. Custom requested boundaries resolve inward and effective dates are displayed.

## Historical ratio search

For each candidate ratio 0, 0.05, ..., 1, independently simulate the ending portfolio return for every selected rolling window with a fresh hedge. Choose the ratio maximizing the minimum ending return, with ties within 1e-9 percentage points favoring the smaller ratio. Short costs use each window's actual elapsed days / 365. Show worst, median, and best outcomes to expose upside tradeoffs.

This objective is not within-window maximum drawdown minimization. The optimum may lie at the full-hedge boundary. Selection and evaluation use the same data (`in_sample=true`); there is no holdout or claim of out-of-sample performance. Search results are descriptive historical optimizations, not investment instructions.

## Research scope and limitations

The proposal's cited academic paper and theoretical formulas have not been independently verified for this implementation. No theoretical overlay or formal replication claim is included. The app reports empirical results without asserting that one instrument universally outperforms another. Institutional extension would require actual portfolio exposures, verified licensed data, exposure/basis modeling, financing/liquidity assumptions, independent validation, and appropriate access controls.

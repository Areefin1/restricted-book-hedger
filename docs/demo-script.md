# Demo script

Use the bundled cache and default settings for a reproducible five-minute presentation. No live download is required.

## Start and rehearse

Install dependencies following the root README. From the repository root, with the Python environment active, run `python scripts/demo.py`. Open http://127.0.0.1:8000. For repeat rehearsals with existing frontend assets, use `python scripts/demo.py --skip-build`. Stop with Ctrl+C. Avoid refreshing prices during rehearsal; a changed hash can change every reference number below.

Confirm the interface says **Cached market data** and shows the 2011–2026 coverage. If it says synthetic, remove `VITE_USE_MOCK=true` and rebuild. Cache version for these references:

`sha256:1a1065cba7340944bbf13f109aed00942edea74e7c4cdfe6626b0c79a42b8d9c`

## Presentation sequence

1. **Overview:** explain that a restricted bond book can retain market exposure, and HYG is this prototype's proxy. Select **2022 drawdown**, book size $1,000,000, hedge ratio 0.6, and borrow rate 2%. Point out all paths start with the same accounted capital and display separate portfolio P/L.
2. **Risk analysis:** distinguish final loss from peak-to-trough drawdown. Borrow cost is approximately **$11,868**, using 361 calendar days / 365 on $600,000 initial exposure. It is already deducted from the short results.
3. **Preset comparison:** switch to **2020 stress** (February 3–June 30, 2020) and **Choppy period** (June 13–December 9, 2011). Read the rule beside the controls: the choppy preset is chosen by volatility and a near-flat HYG return rule, not by whether SJB wins. Return to 2022.
4. **Hedge mechanics:** show the two-day illustration and the selected-period instrument returns. The illustration is idealized arithmetic; the observed market gap also reflects benchmark differences and tracking. Set the ratio to zero briefly: both hedge paths match unhedged, and the instrument-decomposition panel explains why it needs positive hedge exposure.
5. **Research:** show the daily scatter and fitted slope, then the 63-interval rolling scatter with volatility colors and static `y=-x` reference. Switch to 21 or 126 intervals. Emphasize overlapping windows and that the static reference excludes borrow cost.
6. **Recommendation:** use 2022 and 63 intervals. Switch between SJB and static short. Explain that the search maximizes the worst ending return across rolling windows and displays median/best tradeoffs; it does not minimize within-window drawdown. Both instruments select ratio 1.00 on this specific input. Use the apply button to return the ratio to the simulator.
7. **Assumptions:** show source, data hash, unknown legacy retrieval time, capital accounting, and excluded costs. Close by stating this is historical research, not permission or a recommendation to trade a restricted exposure.

## Reference output: 2022 defaults

| Strategy | Final portfolio P/L | Return | Maximum drawdown |
| --- | --- | --- | --- |
| Unhedged | -$109,418 | -10.94% | 15.52% |
| Static short hedge | -$55,636 | -5.56% | 7.09% |
| SJB hedge | -$52,343 | -5.23% | 6.40% |

Full-cache daily diagnostics are approximately beta **-1.0055**, correlation **-0.9704**, R-squared **0.9417**, with **3,911 daily returns**. The daily intercept is about 0.000008663; its annualized display is descriptive, not an exact fee estimate. There are **3,849** overlapping 63-interval windows.

For the 2022 63-interval ratio search with 2% borrowing, the selected ratio is 1.00; the worst ending return is approximately **-1.36% for SJB** and **-0.52% for static short**. This differs from the whole-year simulation because the search restarts the hedge in each rolling window.

## Questions to be ready for

- **Why adjusted prices?** They provide a consistent analytical return series including distributions; the static short is a simplified return approximation, not a complete transaction ledger.
- **Is SJB always better?** No. These views describe selected historical windows, and the two instruments differ in costs and exposures.
- **Why can the search pick full hedging?** Its objective prioritizes the worst ending outcome; the chart exposes the upside sacrificed in other windows.
- **Can this be used for a real restricted book?** It would need actual exposures, permissible-instrument review, better financing/liquidity modeling, and independent validation.
- **Does this replicate the proposed paper?** No theoretical overlay or formal replication is claimed; this delivery is empirical.

## Verification and recovery

Run `python -m pytest` from the root, `npm --prefix frontend run lint`, and `npm --prefix frontend run test:e2e`. Browser tests exercise desktop and mobile versions of every main view and invalid-input recovery. Screenshots/traces are in ignored `frontend/test-results/`.

If the backend is unavailable, the UI displays an error instead of invented market results. Restart it and click Retry. If a custom range has fewer than two shared prices, choose a valid preset. An incomplete ratio-search window needs at least 64 prices for 63 intervals. The same-origin demo needs neither internet access nor a second frontend process after dependencies and assets have been installed.

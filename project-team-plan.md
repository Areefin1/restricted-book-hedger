# Restricted Book Hedger: Four-Person Work Plan

## 1. What you are building

A Python web app that compares how two hedges would have protected a bond portfolio over a historical period:

- **Unhedged portfolio:** the original investment, modeled using HYG.
- **Static short hedge:** a position that gains when HYG falls.
- **SJB hedge:** an inverse ETF whose returns reset daily.

Users enter a portfolio size, hedge ratio, and date range. The app shows portfolio paths, profit/loss, and maximum drawdown. A research tab compares the two hedges across rolling windows. An optional recommendation tab searches for a hedge ratio using a stated historical risk objective.

This plan follows the supplied project idea. It does not independently verify the paper, provider details, or financial claims. Treat those as research tasks before presenting conclusions.

## 2. Stack and scope

| Area | Proposed tool | Purpose |
| --- | --- | --- |
| Language | Python | All application and analysis code |
| Interface | Streamlit | Inputs, tabs, and results |
| Data | yfinance and cached CSV files | Obtain price history; support an offline demo |
| Analysis | pandas and NumPy | Returns, portfolio calculations, and rolling statistics |
| Charts | Plotly | Interactive line and scatter charts |
| Verification | pytest | Check the financial calculations with small known examples |

For this version, you do not need a separate React frontend, REST API, database, authentication, or trading integration.

**Required demo:** cached data, working simulator, three historical presets, convexity chart, clear assumptions, and a rehearsed pitch.

**Stretch features:** recommendation search, theoretical payoff overlay, CSV result export. Build these only after the required demo works.

## 3. Balanced division across four people

These are planning estimates for a small student MVP, assuming roughly similar Python experience. They are person-hours, not a guarantee of completion time. Each person has approximately 9–11 hours, including shared setup and review. Total effort is approximately 36–44 person-hours.

| Person | Main responsibility | Owned files | Individual work | Shared work | Total |
| --- | --- | --- | --- | --- | --- |
| A | Data pipeline and recommendation | data.py, recommend.py, download_prices.py; corresponding tests | 7–9 hours | 2 hours | 9–11 hours |
| B | Hedge simulator and risk metrics | hedge.py, metrics.py, scenarios.py; corresponding tests | 7–9 hours | 2 hours | 9–11 hours |
| C | Research analysis and analytical charts | sanity.py, convexity.py, research.py; corresponding tests; methodology notes | 7–9 hours | 2 hours | 9–11 hours |
| D | Streamlit interface and integration | app.py, sidebar.py, simulator.py, recommendation.py; README and demo script | 7–9 hours | 2 hours | 9–11 hours |

Everyone helps review and rehearse. D owns integration, but each module owner fixes their own calculation or interface issues. If one task runs long, move stretch work to the first person who finishes.

### Person A — Data and recommendation

**Goal:** Give everyone reliable input data and, if time permits, a transparent hedge-ratio search.

Tasks:

1. Download HYG and SJB history using an explicitly selected adjusted-price convention.
2. Normalize dates and column names; align both series on common trading dates.
3. Detect duplicates, missing values, nonpositive prices, and unavailable date ranges.
4. Cache a cleaned CSV and record the source, retrieval date, coverage, and adjustment convention.
5. Provide a tiny synthetic dataset immediately so others can work before downloading finishes.
6. Implement offline loading; keep network downloads out of the normal app startup path.
7. For the optional recommender, evaluate ratios from 0.0 through 1.0 in 0.1 increments using B's simulator.
8. Return the full ratio comparison table and explain the selection objective.

**Done when:** Everyone can load the same clean dataset offline; invalid data generates a clear error. If recommendations are included, every candidate ratio is visible and the selected ratio matches the stated objective.

**Balancing fallback:** If the recommender is cut, A takes offline deployment verification, data troubleshooting, and result export.

### Person B — Simulation and metrics

**Goal:** Calculate how each portfolio behaves over time.

Tasks:

1. Validate portfolio size, hedge ratio, and date window.
2. Calculate daily unhedged, static-short-hedged, and SJB-hedged portfolio paths.
3. Compute final dollar profit/loss, percentage return, and maximum drawdown.
4. Define the capital-accounting convention so all strategies start with comparable values.
5. Add an explicit annual short-borrow-cost assumption; provide an optional zero-cost comparison.
6. Define the historical scenario presets and validate that data covers them.
7. Test the supplied two-day examples and boundary cases such as ratio 0.
8. Hand D a sample result containing both time series and a summary table.

**Done when:** Known examples match expected values, zero hedging matches the unhedged portfolio, fees behave as documented, and results can be displayed without D rewriting the math.

### Person C — Sanity check and convexity analysis

**Goal:** Explore whether the observed data supports the project hypothesis.

Tasks:

1. Calculate daily returns and regress SJB returns on HYG returns; report slope, intercept, and fit.
2. Explain why a slope near −1 is only an approximate diagnostic, including benchmark differences.
3. Create rolling 63-trading-day windows.
4. Calculate each window's HYG return, SJB return, static-short reference return, and realized volatility.
5. Build the daily-return scatter plot and rolling-window scatter plot with clear labels.
6. Color rolling windows by volatility; overlay the static-short reference line.
7. Write a short methodology note covering assumptions, limitations, and what the charts actually show.
8. Verify the cited paper and formula before adding the optional theoretical overlay.

**Done when:** The plots work on cached data, the reference line is correct, and the written interpretation follows the results even if they disagree with the original hypothesis.

**Balancing fallback:** If verifying the theory takes too long, omit the overlay and use that time to review B's return conventions and prepare the research explanation.

### Person D — UI and integration

**Goal:** Turn the three modules into a usable demo.

Tasks:

1. Create a Streamlit shell that runs with sample data.
2. Add portfolio size, hedge ratio, dates, scenario presets, and cost assumptions to the sidebar.
3. Build the Hedge Simulator tab: line chart, summary table, and headline metric.
4. Wire C's research charts into the Convexity Test tab.
5. Add the Recommendation tab if A's module is ready; show the objective and limitations.
6. Handle invalid dates, empty datasets, and module errors with readable messages.
7. Add short explanations for unfamiliar finance terms and the demo disclaimer.
8. Write setup/run instructions and assemble the three-minute demo script.

**Done when:** A new teammate can follow the README and run the app; all required tabs work offline and the scenario inputs update the outputs correctly.

## 4. Proposed folder structure

The indented listing below is a potential structure, not a set of files already created.

```text
restricted-book-hedger/
    app.py
    requirements.txt
    README.md
    .gitignore

    data/
        sample_prices.csv
        prices.csv
        metadata.json

    scripts/
        download_prices.py

    hedger/
        __init__.py
        data.py
        hedge.py
        metrics.py
        scenarios.py
        sanity.py
        convexity.py
        recommend.py

    ui/
        __init__.py
        sidebar.py
        simulator.py
        research.py
        recommendation.py

    tests/
        test_data.py
        test_hedge.py
        test_metrics.py
        test_sanity.py
        test_convexity.py
        test_recommend.py

    docs/
        team-plan.md
        methodology.md
        demo-script.md
```

| Path | Purpose | Owner |
| --- | --- | --- |
| app.py | Streamlit entry point; loads data and connects tabs | D |
| data/ | Synthetic sample, cleaned cached prices, and provenance metadata | A |
| scripts/download_prices.py | Explicit command to refresh the cache | A |
| hedger/data.py | Load, clean, and validate price data | A |
| hedger/hedge.py | Calculate portfolio paths | B |
| hedger/metrics.py | Calculate P/L, returns, and maximum drawdown | B |
| hedger/scenarios.py | Named historical date ranges | B |
| hedger/sanity.py | Daily-return comparison and regression | C |
| hedger/convexity.py | Rolling-window results | C |
| hedger/recommend.py | Evaluate candidate hedge ratios using the simulator | A |
| ui/sidebar.py | Collect and validate interface inputs | D |
| ui/simulator.py | Portfolio chart and summary display | D |
| ui/research.py | Sanity and convexity chart rendering | C |
| ui/recommendation.py | Ratio comparison and explanation | D |
| tests/ | Small, meaningful checks of data handling and calculations | Each module owner |
| docs/methodology.md | Assumptions and research interpretation | C, with A and B |
| docs/demo-script.md | Pitch flow and talking points | D, with everyone |

Keep calculation modules independent of Streamlit. UI files should display results rather than contain financial formulas. For a shorter hackathon, merge UI components into app.py while retaining the analysis modules.

## 5. Shared interfaces: agree before coding

### Price table

All modules receive a pandas DataFrame with:

| Field | Meaning | Rule |
| --- | --- | --- |
| date | Trading date | CSV column; converted to a sorted DatetimeIndex in Python |
| hyg | Adjusted HYG price | Positive number |
| sjb | Adjusted SJB price | Positive number |

Use only common dates with valid prices. Do not silently fill missing trading prices. Save enough metadata to reproduce the input convention.

### Proposed function contracts

```python
# A: returns a clean DataFrame indexed by date.
load_prices(path) -> pandas.DataFrame

# B: returns {"paths": DataFrame, "summary": DataFrame,
#             "assumptions": dict}.
simulate_hedges(
    prices,
    book_size,
    hedge_ratio,
    start_date,
    end_date,
    annual_borrow_rate=0.0,
) -> dict

# C: returns slope, intercept, fit, and daily-return data.
run_sanity_check(prices) -> dict

# C: returns window dates, HYG return, SJB return,
#    static-short return, and annualized volatility.
calculate_rolling_windows(prices, window_days=63) -> pandas.DataFrame

# A: returns the selected ratio, candidate results,
#    objective, and evaluation dates.
recommend_ratio(prices, ratios, window_days=63, annual_borrow_rate=0.0) -> dict
```

These signatures are design contracts, not runnable code. Finalize output column names during setup. Provide sample outputs so D can build the interface immediately.

Use paths named unhedged, static_short_hedged, and sjb_hedged. Summary rows should use those same names and include final_pnl, return_pct, and max_drawdown_pct.

## 6. Build order and handoffs

| Stage | A | B | C | D | Exit condition |
| --- | --- | --- | --- | --- | --- |
| Shared kickoff: about 30 minutes | Agree data schema | Agree portfolio accounting | Agree return conventions | Agree output schemas | Sample data and contracts available |
| Parallel foundations | Cache real data | Simulator on sample data | Rolling analysis on sample data | App shell with placeholders | Each component runs independently |
| First integration | Deliver validated CSV | Deliver paths and summary | Deliver charts and interpretation | Connect required tabs | Complete offline core demo |
| Optional work and checks | Ratio search | Cost handling and edge cases | Theory overlay if verified | Recommendation display and polish | Stretch work included only if stable |
| Shared finish: about 90 minutes | Data Q&A | Math Q&A | Research Q&A | Lead rehearsal | Fresh-start run and three-minute demo pass |

The recommendation depends on the simulator. The UI depends on agreed outputs, but can start with fixtures. Research analysis depends on price data, but can start with the synthetic sample.

Integrate the simulator first. Avoid leaving all integration until the final hour.

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
- [ ] All required tabs run from a fresh environment.
- [ ] Recommendations, if included, match the displayed objective.
- [ ] Research conclusions are supported by the resulting charts.
- [ ] All four people can explain their module and its limitations.

Suggested local workflow once requirements.txt exists:

```bash
python -m venv .venv
python -m pip install -r requirements.txt
python scripts/download_prices.py
python -m pytest
python -m streamlit run app.py
```

Activate the virtual environment before installing dependencies, using the command appropriate to your operating system. The download step should be optional when a valid cache is already present.

## 9. Collaboration rules

- Use one branch per workstream: feature/data, feature/simulator, feature/research, feature/ui.
- Each owner opens small pull requests and includes sample output or screenshots where useful.
- Review changes with another person before merging.
- Keep app.py edits primarily with D to reduce merge conflicts.
- Tell the team before changing a shared function signature or output column.
- If blocked, use sample data or sample outputs instead of waiting.
- Each person contributes a short explanation and one limitation to the demo script.

**If time runs short:** finish the simulator and cached-data interface first, then the empirical convexity chart. Cut the theoretical overlay and recommender before cutting correctness checks or the final rehearsal.

"""Presets resolved against available dates, with an explicit choppy rule."""

import pandas as pd

from app.hedger.convexity import calculate_rolling_windows


def build_scenarios(prices: pd.DataFrame) -> list[dict]:
    scenarios = []
    for scenario_id, name, start, end, rule in [
        ("covid-2020", "2020 stress", "2020-02-03", "2020-06-30", "February through June 2020: selloff and initial recovery; dates resolved inward to shared observations."),
        ("rates-2022", "2022 drawdown", "2022-01-01", "2022-12-31", "Calendar 2022; dates resolved inward to shared observations."),
    ]:
        # Omit presets if the cache cannot cover the intended period.
        if prices.index[0] > pd.Timestamp(start) + pd.Timedelta(days=7) or prices.index[-1] < pd.Timestamp(end) - pd.Timedelta(days=7):
            continue
        selected = prices.loc[start:end]
        if len(selected) >= 2:
            scenarios.append(dict(id=scenario_id, name=name, start_date=selected.index[0].strftime("%Y-%m-%d"),
                                  end_date=selected.index[-1].strftime("%Y-%m-%d"), rule=rule))
    # The preset selects on total proxy returns, independently of cash inputs.
    windows = calculate_rolling_windows(prices.assign(rf_return=0.0), 126)
    candidates = windows.loc[windows.hyg_total_return.abs() <= 0.02]
    for scenario in scenarios:
        candidates = candidates.loc[~((candidates.start_date <= scenario["end_date"]) & (candidates.end_date >= scenario["start_date"]))]
    if not candidates.empty:
        best = candidates.loc[candidates.hyg_realized_vol.idxmax()]
        scenarios.append(dict(id="choppy", name="Choppy period", start_date=best.start_date, end_date=best.end_date,
                              rule="Highest HYG realized volatility among 126-interval windows with absolute net HYG return <= 2%, excluding overlaps with stress presets. Earliest window wins ties; selected in-sample."))
    scenarios.append(dict(id="full", name="Full history", start_date=prices.index[0].strftime("%Y-%m-%d"),
                          end_date=prices.index[-1].strftime("%Y-%m-%d"), rule="All shared observations in the loaded cache."))
    return scenarios

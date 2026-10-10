"""In-sample grid search maximizing the worst rolling ending return."""

import numpy as np
import pandas as pd

from app.hedger.assumptions import simulation_assumptions
from app.hedger.convexity import calculate_rolling_windows
from app.hedger.data import select_date_range


def recommend_ratio(prices: pd.DataFrame, start_date, end_date, instrument: str,
                    window_days: int = 63, annual_borrow_rate: float = 0.0) -> dict:
    if instrument not in {"static_short", "sjb"}:
        raise ValueError("instrument must be static_short or sjb")
    if not np.isfinite(annual_borrow_rate) or not 0 <= annual_borrow_rate <= 0.25:
        raise ValueError("Annual borrow rate must be between 0 and 0.25")
    selected = select_date_range(prices, start_date, end_date)
    windows = calculate_rolling_windows(selected, window_days)
    if windows.empty:
        raise ValueError(f"A {window_days}-interval window requires at least {window_days + 1} price observations")
    days = (pd.to_datetime(windows.end_date) - pd.to_datetime(windows.start_date)).dt.days.to_numpy()
    hyg, sjb = windows.hyg_return.to_numpy(), windows.sjb_return.to_numpy()
    grid = []
    for ratio in np.arange(21) / 20:
        returns = ((1 - ratio) * hyg - ratio * annual_borrow_rate * days / 365
                   if instrument == "static_short" else hyg + ratio * sjb)
        grid.append(dict(hedge_ratio=float(ratio), worst_window_return_pct=float(returns.min() * 100),
                         median_window_return_pct=float(np.median(returns) * 100), best_window_return_pct=float(returns.max() * 100)))
    # Stable ordering breaks numerical ties toward the smaller hedge ratio.
    best = grid[0]
    for row in grid[1:]:
        if row["worst_window_return_pct"] > best["worst_window_return_pct"] + 1e-9:
            best = row
    return dict(instrument=instrument, objective="Maximize the worst ending portfolio return across overlapping rolling windows.",
                recommended_ratio=best["hedge_ratio"], objective_value_pct=best["worst_window_return_pct"], grid=grid,
                windows_evaluated=len(windows), in_sample=True,
                effective_start_date=selected.index[0].strftime("%Y-%m-%d"), effective_end_date=selected.index[-1].strftime("%Y-%m-%d"),
                assumptions=simulation_assumptions(annual_borrow_rate) + [
                    {"label": "Historical selection", "detail": "Selected and evaluated on the same history; no out-of-sample validation. Each window starts with a fresh hedge."},
                    {"label": "Grid and tradeoffs", "detail": "Ratios 0 to 1 in steps of 0.05; ties favor the smaller ratio. The objective ignores upside sacrificed in other windows and is not within-window drawdown minimization."},
                ])

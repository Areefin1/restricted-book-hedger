"""Overlapping return windows using N intervals and N+1 prices."""

import numpy as np
import pandas as pd

PERMITTED_WINDOWS = (21, 63, 126)


def calculate_rolling_windows(prices: pd.DataFrame, window_days: int = 63) -> pd.DataFrame:
    if isinstance(window_days, bool) or window_days not in PERMITTED_WINDOWS:
        raise ValueError("window_days must be one of 21, 63, 126")
    columns = ["start_date", "end_date", "hyg_return", "sjb_return", "hyg_realized_vol"]
    if len(prices) <= window_days:
        return pd.DataFrame(columns=columns)
    returns = prices["hyg"].pct_change(fill_method=None)
    cumulative = prices[["hyg", "sjb"]] / prices[["hyg", "sjb"]].shift(window_days) - 1
    volatility = returns.rolling(window_days).std(ddof=1) * np.sqrt(252)
    return pd.DataFrame({
        "start_date": prices.index[:-window_days].strftime("%Y-%m-%d"),
        "end_date": prices.index[window_days:].strftime("%Y-%m-%d"),
        "hyg_return": cumulative["hyg"].iloc[window_days:].to_numpy(),
        "sjb_return": cumulative["sjb"].iloc[window_days:].to_numpy(),
        "hyg_realized_vol": volatility.iloc[window_days:].to_numpy(),
    })


def window_notes(window_days: int) -> list[str]:
    return [
        f"Each window uses {window_days} return intervals and {window_days + 1} prices; volatility is sample daily standard deviation times sqrt(252).",
        "Windows overlap and are not independent observations.",
        "The static reference y = -x excludes borrowing costs. HYG and SJB have benchmark differences; the observed gap cannot be attributed solely to daily resetting.",
    ]

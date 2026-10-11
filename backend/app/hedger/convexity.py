"""Overlapping return windows using N intervals and N+1 prices."""

import numpy as np
import pandas as pd

from app.hedger.funding import cash_returns

PERMITTED_WINDOWS = (21, 63, 126)

def calculate_rolling_windows(prices: pd.DataFrame, window_days: int = 63) -> pd.DataFrame:
    if isinstance(window_days, bool) or window_days not in PERMITTED_WINDOWS:
        raise ValueError("window_days must be one of 21, 63, 126")
    columns = ["start_date", "end_date", "hyg_return", "sjb_return", "hyg_realized_vol",
               "hyg_total_return", "sjb_total_return", "cash_return", "hyg_sample_vol"]
    if len(prices) <= window_days:
        return pd.DataFrame(columns=columns)
    cash = cash_returns(prices)
    returns = prices["hyg"].pct_change(fill_method=None) - cash
    cumulative = prices[["hyg", "sjb"]] / prices[["hyg", "sjb"]].shift(window_days) - 1
    cash_growth = (1 + cash).cumprod()
    cash_return = cash_growth / cash_growth.shift(window_days) - 1
    volatility = np.sqrt(returns.pow(2).rolling(window_days).mean() * 252)
    sample_volatility = returns.rolling(window_days).std(ddof=1) * np.sqrt(252)
    return pd.DataFrame({
        "start_date": prices.index[:-window_days].strftime("%Y-%m-%d"),
        "end_date": prices.index[window_days:].strftime("%Y-%m-%d"),
        "hyg_return": (cumulative["hyg"] - cash_return).iloc[window_days:].to_numpy(),
        "sjb_return": (cumulative["sjb"] - cash_return).iloc[window_days:].to_numpy(),
        "hyg_realized_vol": volatility.iloc[window_days:].to_numpy(),
        "hyg_total_return": cumulative["hyg"].iloc[window_days:].to_numpy(),
        "sjb_total_return": cumulative["sjb"].iloc[window_days:].to_numpy(),
        "cash_return": cash_return.iloc[window_days:].to_numpy(),
        "hyg_sample_vol": sample_volatility.iloc[window_days:].to_numpy(),
    })


def window_notes(window_days: int) -> list[str]:
    return [
        f"Each window uses {window_days} return intervals and {window_days + 1} prices; returns are compounded asset total return minus compounded cash return.",
        "Realized volatility is zero-mean daily HYG excess root-mean-square return times sqrt(252); demeaned sample excess volatility is reported separately.",
        "Windows overlap and are not independent observations.",
        "The static reference y = -x is the excess return of a funded static inverse position before borrowing and trading costs. HYG and SJB have benchmark differences; the observed gap cannot be attributed solely to daily resetting.",
    ]

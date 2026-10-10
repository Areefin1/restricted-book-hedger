import numpy as np
import pandas as pd
from app.hedger.funding import cash_returns

TRADING_DAYS = 252

def rolling_windows(prices: pd.DataFrame, window: int = 63) -> pd.DataFrame:
    """Standalone funded $1 inverse position: $2 in cash minus $1 of HYG.

    This is not the app's investor hedge overlay. Cash intervals and excess
    variation use the same funding.py convention as the app.
    """
    if isinstance(window, bool) or not isinstance(window, int) or window <= 0:
        raise ValueError("window must be a positive integer interval count")
    daily = prices[["hyg_adj_close", "sjb_adj_close"]].rename(
        columns={"hyg_adj_close": "hyg", "sjb_adj_close": "sjb"}).pct_change()
    daily["rf"] = cash_returns(prices)
    daily = daily.dropna()

    rows = []
    for i in range(len(daily) - window + 1):
        w = daily.iloc[i:i + window]
        h, s, r = w["hyg"], w["sjb"], w["rf"]
        H = (1 + h).prod()                         # HYG growth factor
        G = (1 + r).prod()                         # cash growth factor

        sjb    = (1 + s).prod() - 1                # SJB actual
        static = 2 * G - H - 1                     # exact static short
        ideal  = (1 - h + 2 * r).prod() - 1        # perfect daily -1x fund
        convexity = ((1 - h).prod() - 1) - (1 - H) # same comparison at zero rates

        rows.append({
            "start": prices.index[i],
            "end": w.index[-1],
            "hyg_ret": H - 1,
            "hyg_ex": H - G,                       # HYG excess return (x-axis)
            "sjb_ret": sjb,
            "static_ret": static,
            "rf": G - 1,
            "vol": np.sqrt(((h - r) ** 2).sum()),
            "convexity": convexity,
            "rate_interaction": (ideal - static) - convexity,
            "costs_tracking": sjb - ideal,
        })

    df = pd.DataFrame(rows, columns=["start", "end", "hyg_ret", "hyg_ex", "sjb_ret", "static_ret", "rf", "vol", "convexity", "rate_interaction", "costs_tracking"])
    df["sjb_minus_static"] = df["sjb_ret"] - df["static_ret"]

    labels = ["Low vol", "Med vol", "High vol"]
    if len(df) >= 3:
        df["vol_bucket"] = pd.qcut(df["vol"].rank(method="first"), 3, labels=labels)
    else:
        df["vol_bucket"] = pd.NA
    return df


def theory_curve(hyg_grid, vol_window, window=63, r=0.0, cash_growth_factor=None):
    """Paper eq. 4 with p = -1: continuously reset inverse fund.
    vol_window is zero-mean excess variation over the window (eq. 20).
    Pass the modeled cash growth factor for calendar/carry consistency. Otherwise
    r is an explicitly assumed continuous annual rate on window/252 years.
    Returns funded total return; subtract G-1 for excess return.
    """
    T = window / TRADING_DAYS
    sigma_sq_T = vol_window ** 2                      # eq. 20 vol is already over the window
    G = np.exp(r * T) if cash_growth_factor is None else cash_growth_factor
    return G**2 * np.exp(-sigma_sq_T) / (1 + hyg_grid) - 1


def summary(df: pd.DataFrame, big_move=0.05) -> dict:
    big = df["hyg_ret"].abs() > big_move
    return {
        "windows": len(df),
        "sjb_beat_static_big_moves": (df.loc[big, "sjb_minus_static"] > 0).mean(),
        "sjb_beat_static_small_moves": (df.loc[~big, "sjb_minus_static"] > 0).mean(),
        "avg_gap_overall": df["sjb_minus_static"].mean(),
    }

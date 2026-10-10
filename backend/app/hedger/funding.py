"""One cash-return convention for simulations, research and prototypes.

rf_return is the decimal cash return for the interval ending on each date.
Legacy annual quotes are an explicitly unverified effective-annual assumption.
The first price has no modeled holding interval and therefore zero accrual.
"""
import numpy as np
import pandas as pd


def cash_returns(prices: pd.DataFrame, annual_cash_rate: float | None = None) -> pd.Series:
    days = prices.index.to_series().diff().dt.days.fillna(0).to_numpy()
    if annual_cash_rate is not None:
        if isinstance(annual_cash_rate, bool) or not np.isfinite(annual_cash_rate) or annual_cash_rate <= -1:
            raise ValueError("Annual cash rate must be finite and greater than -100%")
        values = np.expm1(np.log1p(annual_cash_rate) * days / 365)
    elif "rf_return" in prices:
        values = pd.to_numeric(prices.rf_return, errors="coerce").to_numpy(dtype=float).copy()
    elif "rf_annual_pct" in prices:
        quotes = pd.to_numeric(prices.rf_annual_pct, errors="coerce").to_numpy(dtype=float)
        if not np.isfinite(quotes).all() or (quotes <= -100).any():
            raise ValueError("Annual cash quotes must be finite and greater than -100%")
        previous = np.r_[quotes[0], quotes[:-1]] / 100
        values = np.expm1(np.log1p(previous) * days / 365)
    else:
        raise ValueError("Cash returns are required: supply rf_return, an explicitly assumed rf_annual_pct series, or annual_cash_rate")
    if not np.isfinite(values).all() or (values <= -1).any():
        raise ValueError("Cash interval returns must be finite and greater than -100%")
    values[0] = 0.0
    return pd.Series(values, index=prices.index, name="rf_return")


def cash_growth(prices: pd.DataFrame, annual_cash_rate: float | None = None,
                annual_spread: float = 0.0) -> np.ndarray:
    days = (prices.index - prices.index[0]).days.to_numpy()
    growth = np.cumprod(1 + cash_returns(prices, annual_cash_rate).to_numpy())
    return growth * np.exp(annual_spread * days / 365)


def cash_note(prices: pd.DataFrame, annual_cash_rate: float | None = None) -> str:
    if annual_cash_rate is not None:
        return f"User-assumed constant effective annual cash rate {annual_cash_rate:.2%}; actual/365. Not historical broker terms."
    if "rf_return" in prices:
        return "Cash returns use the supplied decimal interval-return series; provenance must be checked separately. No annual-yield conversion."
    return "UNVERIFIED cash assumption: legacy rf_annual_pct is interpreted as an effective annual percentage, using the previous observation and actual/365. Original provider and quote basis are unknown."

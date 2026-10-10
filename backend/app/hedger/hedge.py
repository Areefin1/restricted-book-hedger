"""Financed return-series overlays, not executable fixed-share trades."""
from math import isfinite
from numbers import Real

import numpy as np
import pandas as pd

from app.hedger.accounting import overlay_values, terminate_paths
from app.hedger.funding import cash_growth

STRATEGIES = ("unhedged", "static_short_hedged", "sjb_hedged")


def _finite_number(value, name):
    if isinstance(value, bool) or not isinstance(value, Real):
        raise ValueError(f"{name} must be a finite number")
    try:
        number = float(value)
    except (OverflowError, ValueError) as exc:
        raise ValueError(f"{name} must be a finite number") from exc
    if not isfinite(number):
        raise ValueError(f"{name} must be a finite number")
    return number


def simulate_hedges(prices, book_size, hedge_ratio, annual_borrow_rate=0.0,
                    annual_cash_rate=None, funding_spread=0.0, rebate_spread=0.0,
                    round_trip_cost_bps=0.0, book_beta=1.0, annual_basis_return=0.0,
                    termination_floor=0.0, max_hedge_notional=None):
    book_size = _finite_number(book_size, "Book size")
    hedge_ratio = _finite_number(hedge_ratio, "Hedge ratio")
    annual_borrow_rate = _finite_number(annual_borrow_rate, "Annual borrow rate")
    if book_size <= 0:
        raise ValueError("Book size must be positive")
    if not 0 <= hedge_ratio <= 1:
        raise ValueError("Hedge ratio must be between 0 and 1")
    if annual_borrow_rate < 0:
        raise ValueError("Annual borrow rate must be nonnegative")
    for value, name, lower, upper in [
        (funding_spread, "Funding spread", 0, 1), (rebate_spread, "Rebate spread", 0, 1),
        (round_trip_cost_bps, "Round-trip cost", 0, 10000), (book_beta, "Book beta", 0, 3),
        (annual_basis_return, "Annual basis return", -1, 1), (termination_floor, "Termination floor", 0, .99),
    ]:
        if not lower <= _finite_number(value, name) <= upper:
            raise ValueError(f"{name} must be between {lower} and {upper}")
    if max_hedge_notional is not None:
        if _finite_number(max_hedge_notional, "Hedge capacity") <= 0:
            raise ValueError("Hedge capacity must be positive")
        if book_size * hedge_ratio > max_hedge_notional:
            raise ValueError("Initial hedge exceeds the user-supplied hedge capacity")
    if not isinstance(prices, pd.DataFrame) or len(prices) < 2:
        raise ValueError("At least two price observations are required")
    if not prices.columns.is_unique or not {"hyg", "sjb"}.issubset(prices.columns):
        raise ValueError("Prices must contain unique hyg and sjb columns")
    if not isinstance(prices.index, pd.DatetimeIndex):
        raise ValueError("Prices must use a DatetimeIndex")
    if prices.index.hasnans or prices.index.has_duplicates:
        raise ValueError("Trading dates must be valid and unique")
    if not prices.index.is_monotonic_increasing:
        raise ValueError("Trading dates must be sorted")
    if prices.index.tz is not None or not prices.index.equals(prices.index.normalize()):
        raise ValueError("Trading dates must be timezone-naive calendar dates")
    values = prices[["hyg", "sjb"]].apply(pd.to_numeric, errors="coerce")
    if any(pd.api.types.is_bool_dtype(values[c]) or pd.api.types.is_complex_dtype(values[c]) for c in values):
        raise ValueError("Prices must be positive, finite real numbers")
    if not np.isfinite(values.to_numpy(dtype=float)).all() or (values <= 0).any().any():
        raise ValueError("Prices must be positive, finite real numbers")
    growth = values.to_numpy(dtype=float) / values.iloc[0].to_numpy(dtype=float)
    days = (prices.index - prices.index[0]).days.to_numpy()
    rebate = cash_growth(prices, annual_cash_rate, -rebate_spread)
    funding = cash_growth(prices, annual_cash_rate, funding_spread)
    with np.errstate(over="ignore", invalid="ignore"):
        array = overlay_values(growth[:, 0], growth[:, 1], rebate, funding, days,
                               book_size, hedge_ratio, annual_borrow_rate,
                               round_trip_cost_bps, book_beta, annual_basis_return)
    if not np.isfinite(array).all():
        raise ValueError("Simulation inputs produce nonfinite portfolio values")
    array, stops, breached = terminate_paths(array, book_size * termination_floor)
    results = pd.DataFrame(array, columns=STRATEGIES, index=prices.index.copy())
    for strategy in STRATEGIES:
        results[f"{strategy}_pnl"] = results[strategy] - book_size
    book = book_size * (1 + book_beta * (growth[:, 0] - 1) + annual_basis_return * days / 365)
    results.attrs["exposures"] = [
        {"date": date.date(),
         "static_short_ratio": float(hedge_ratio * growth[i, 0] * book_size / book[i]) if book[i] > 0 and not (breached[1] and i >= stops[1]) else None,
         "sjb_ratio": float(hedge_ratio * growth[i, 1] * book_size / book[i]) if book[i] > 0 and not (breached[2] and i >= stops[2]) else None}
        for i, date in enumerate(prices.index)
    ]
    results.attrs["events"] = [
        {"date": prices.index[stops[i]].date(), "strategy": strategy,
         "reason": "Research path terminated at the assumed equity floor; overshoot retained. This does not model an executable liquidation or broker margin."}
        for i, strategy in enumerate(STRATEGIES) if breached[i]
    ]
    results.attrs["instrument_returns"] = [
        {"date": date.date(), "hyg_return": float(growth[i, 0] - 1),
         "sjb_return": float(growth[i, 1] - 1)} for i, date in enumerate(prices.index)
    ]
    results.attrs["events"].sort(key=lambda event: event["date"])
    results.index.name = "date"
    return results

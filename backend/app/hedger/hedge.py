from math import isfinite
from numbers import Real

import numpy as np
import pandas as pd


def _finite_number(value: float, name: str) -> float:
    """Reject nonnumeric inputs, booleans, and nonfinite values."""
    if isinstance(value, bool) or not isinstance(value, Real):
        raise ValueError(f"{name} must be a finite number")
    try:
        number = float(value)
    except (OverflowError, ValueError) as exc:
        raise ValueError(f"{name} must be a finite number") from exc
    if not isfinite(number):
        raise ValueError(f"{name} must be a finite number")
    return number


def simulate_hedges(prices: pd.DataFrame, book_size: float, hedge_ratio: float, annual_borrow_rate: float = 0.0,) -> pd.DataFrame:
    """Return daily portfolio values and P/L for an HYG-proxy book and two hedges.

    The three strategy columns contain total portfolio values. Matching *_pnl
    columns contain cumulative portfolio profit/loss: total value - book_size.
    P/L starts at zero and includes any modeled borrow costs.

    Expect selected, adjusted hyg/sjb prices indexed by sorted trading dates.
    Total-value paths begin at book_size. Both hedges are fixed at inception;
    the SJB purchase is offset by financing with zero interest. The short uses
    negative adjusted HYG returns as a simplified P/L model, not a trade ledger.

    Borrow cost is simple interest on initial short exposure using actual elapsed
    calendar days divided by 365. Short-sale proceeds earn no interest. No extra
    ETF expense deduction, transaction costs, or daily rebalancing are applied.
    The MVP permits hedge ratios from zero to one. Inputs are not modified.
    """
    book_size = _finite_number(book_size, "Book size")
    hedge_ratio = _finite_number(hedge_ratio, "Hedge ratio")
    annual_borrow_rate = _finite_number(annual_borrow_rate, "Annual borrow rate")

    if book_size <= 0:
        raise ValueError("Book size must be positive")
    if not 0 <= hedge_ratio <= 1:
        raise ValueError("Hedge ratio must be between 0 and 1")
    if annual_borrow_rate < 0:
        raise ValueError("Annual borrow rate must be nonnegative")

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
    if any(
        pd.api.types.is_bool_dtype(values[column])
        or pd.api.types.is_complex_dtype(values[column])
        for column in values.columns
    ):
        raise ValueError("Prices must be positive, finite real numbers")
    if not np.isfinite(values.to_numpy()).all() or (values <= 0).any().any():
        raise ValueError("Prices must be positive, finite real numbers")

    # Returns relative to inception preserve the fixed initial hedge positions.
    hyg_return = values["hyg"] / values["hyg"].iloc[0] - 1
    sjb_return = values["sjb"] / values["sjb"].iloc[0] - 1
    initial_hedge = book_size * hedge_ratio
    unhedged = book_size * (1 + hyg_return)
    static_pnl = -initial_hedge * hyg_return
    sjb_pnl = initial_hedge * sjb_return

    # Calendar-day accrual includes weekends; inception has zero borrow cost.
    elapsed_days = (prices.index - prices.index[0]).days.to_numpy()
    borrow_cost = initial_hedge * annual_borrow_rate * (elapsed_days / 365)

    results = pd.DataFrame(
        {
            "unhedged": unhedged,
            "static_short_hedged": unhedged + static_pnl - borrow_cost,
            "sjb_hedged": unhedged + sjb_pnl,
        },
        index=prices.index.copy(),
    )
    for strategy in ("unhedged", "static_short_hedged", "sjb_hedged"):
        results[f"{strategy}_pnl"] = results[strategy] - book_size
    results.index.name = "date"
    if not np.isfinite(results.to_numpy()).all():
        raise ValueError("Simulation inputs produce nonfinite portfolio values")
    return results


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


def simulate_hedges(
    prices: pd.DataFrame,
    book_size: float,
    hedge_ratio: float,
    annual_borrow_rate: float = 0.0,
) -> pd.DataFrame:
    """
    Return daily portfolio values for an HYG-proxy bond book
    with static-short and SJB hedges.

    Expected columns:
        hyg            - HYG adjusted close
        sjb            - SJB adjusted close
        rf_annual_pct  - Annualized risk-free rate in percent
                         Example: 4.5 means 4.5% annually.

    Financing assumptions:
        - Static HYG short earns the risk-free rate on
          its initial short-sale collateral.
        - Static HYG short pays a separate gross annual borrow fee.
        - SJB purchase is financed at the risk-free rate.
        - Initial hedge positions are not rebalanced.
        - No additional ETF expense deduction is applied.

    Annualized risk-free rates are converted to interval returns
    using actual calendar days / 365.

    The previous observation's rate is used for each interval.

    These are simplified financing assumptions, not observed
    historical short rebates or actual loan rates.
    """

    # -----------------------------
    # 1. Validate numeric inputs
    # -----------------------------

    book_size = _finite_number(book_size, "Book size")
    hedge_ratio = _finite_number(hedge_ratio, "Hedge ratio")
    annual_borrow_rate = _finite_number(
        annual_borrow_rate, "Annual borrow rate"
    )

    if book_size <= 0:
        raise ValueError("Book size must be positive")

    if not 0 <= hedge_ratio <= 1:
        raise ValueError("Hedge ratio must be between 0 and 1")

    if annual_borrow_rate < 0:
        raise ValueError("Annual borrow rate must be nonnegative")

    # -----------------------------
    # 2. Validate DataFrame
    # -----------------------------

    if not isinstance(prices, pd.DataFrame) or len(prices) < 2:
        raise ValueError("At least two price observations are required")

    required_columns = {"hyg", "sjb", "rf_annual_pct"}

    if (
        not prices.columns.is_unique
        or not required_columns.issubset(prices.columns)
    ):
        raise ValueError(
            "Prices must contain unique hyg, sjb, "
            "and rf_annual_pct columns"
        )

    if not isinstance(prices.index, pd.DatetimeIndex):
        raise ValueError("Prices must use a DatetimeIndex")

    if prices.index.hasnans or prices.index.has_duplicates:
        raise ValueError("Trading dates must be valid and unique")

    if not prices.index.is_monotonic_increasing:
        raise ValueError("Trading dates must be sorted")

    if (
        prices.index.tz is not None
        or not prices.index.equals(prices.index.normalize())
    ):
        raise ValueError(
            "Trading dates must be timezone-naive calendar dates"
        )

    # -----------------------------
    # 3. Validate prices
    # -----------------------------

    values = prices[["hyg", "sjb"]].apply(
        pd.to_numeric, errors="coerce"
    )

    if any(
        pd.api.types.is_bool_dtype(values[column])
        or pd.api.types.is_complex_dtype(values[column])
        for column in values.columns
    ):
        raise ValueError(
            "Prices must be positive, finite real numbers"
        )

    if (
        not np.isfinite(values.to_numpy(dtype=float)).all()
        or (values <= 0).any().any()
    ):
        raise ValueError(
            "Prices must be positive, finite real numbers"
        )

    # -----------------------------
    # 4. Validate annualized risk-free rates
    # -----------------------------

    raw_rates = prices["rf_annual_pct"]

    if (
        pd.api.types.is_bool_dtype(raw_rates)
        or pd.api.types.is_complex_dtype(raw_rates)
    ):
        raise ValueError(
            "Risk-free rates must be finite real numbers"
        )

    rates = pd.to_numeric(
        raw_rates,
        errors="coerce"
    )

    if (
        not np.isfinite(rates.to_numpy(dtype=float)).all()
        or (rates <= -100).any()
    ):
        raise ValueError(
            "Annualized risk-free rates must be finite "
            "and greater than -100%"
        )

    # Convert percentage to annual decimal rate.
    # Example: 4.5 -> 0.045
    annual_rates = rates / 100.0

    # -----------------------------
    # 5. Calculate HYG and SJB returns
    # -----------------------------

    hyg_return = (
        values["hyg"] / values["hyg"].iloc[0] - 1
    )

    sjb_return = (
        values["sjb"] / values["sjb"].iloc[0] - 1
    )

    initial_hedge = book_size * hedge_ratio

    unhedged = book_size * (1 + hyg_return)

    static_pnl = -initial_hedge * hyg_return

    sjb_pnl = initial_hedge * sjb_return

    # -----------------------------
    # 6. Accumulate risk-free returns
    # -----------------------------

    # Calendar days between consecutive observations.
    # Example: Friday -> Monday = 3 days.
    days_between = (
        prices.index.to_series()
        .diff()
        .dt.days
        .fillna(0)
    )

    # Use the previous observation's annualized rate
    # for each interval.
    interval_annual_rates = annual_rates.shift(1).fillna(0)

    # Convert annualized rates into interval returns.
    #
    # Example:
    # Annual rate = 4%
    # Interval = 3 calendar days
    #
    # Interval return = (1.04) ** (3 / 365) - 1

    interval_returns = (
        (1 + interval_annual_rates)
        ** (days_between / 365)
        - 1
    )

    # Accumulated growth of $1 at the risk-free rate.
    # Starts at 1.0 on the first observation.
    risk_free_growth = (
        1 + interval_returns
    ).cumprod()

    # Interest earned on initial short-sale collateral.
    short_interest = initial_hedge * (
        risk_free_growth - 1
    )

    # Cost of financing the initial SJB purchase.
    sjb_financing_cost = initial_hedge * (
        risk_free_growth - 1
    )

    # -----------------------------
    # 7. Calculate HYG borrowing fees
    # -----------------------------

    # Borrow fee uses simple interest on initial
    # short exposure, including calendar days.

    elapsed_days = (
        prices.index - prices.index[0]
    ).days.to_numpy()

    borrow_cost = (
        initial_hedge
        * annual_borrow_rate
        * (elapsed_days / 365)
    )

    # -----------------------------
    # 8. Calculate portfolio values
    # -----------------------------

    results = pd.DataFrame(
        {
            "unhedged": unhedged,

            "static_short_hedged": (
                unhedged
                + static_pnl
                + short_interest
                - borrow_cost
            ),

            "sjb_hedged": (
                unhedged
                + sjb_pnl
                - sjb_financing_cost
            ),
        },
        index=prices.index.copy(),
    )

    results.index.name = "date"

    if not np.isfinite(results.to_numpy()).all():
        raise ValueError(
            "Simulation inputs produce nonfinite portfolio values"
        )

    return results
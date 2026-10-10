import numpy as np
import pandas as pd

STRATEGIES = ("unhedged", "static_short_hedged", "sjb_hedged")

def validate_values(values: pd.Series) -> np.ndarray:
    if not isinstance(values, pd.Series) or values.empty:
        raise ValueError("A portfolio path must be a nonempty pandas Series")

    numeric = pd.to_numeric(values, errors="coerce")
    if pd.api.types.is_bool_dtype(numeric) or pd.api.types.is_complex_dtype(numeric):
        raise ValueError("Portfolio values must be finite real numbers")

    array = numeric.to_numpy(dtype=float, na_value=np.nan)
    if not np.isfinite(array).all():
        raise ValueError("Portfolio values must be finite real numbers")

    if array[0] <= 0:
        raise ValueError("Starting portfolio value must be positive")
    return array


def max_drawdown_pct(values: pd.Series) -> float:
    array = validate_values(values)
    running_peaks = np.maximum.accumulate(array)
    with np.errstate(over="ignore", invalid="ignore"):
        drawdowns = (1- array / running_peaks) * 100

    if not np.isfinite(drawdowns).all():
        raise ValueError("Portfolio values produce nonfinite drawdown metrics")
    return float(drawdowns.max())


def summarize_paths(paths: pd.DataFrame) -> pd.DataFrame:
    """Return one summary row for each strategy produced by simulate_hedges.

    final_pnl is in dollars. return_pct and max_drawdown_pct are percentage
    points, so 5.0 means 5%. Each path's first value is its starting capital.
    Costs already included in the portfolio paths are not deducted again.
    Calculations retain full precision; the frontend handles display rounding.
    """
    if not isinstance(paths, pd.DataFrame) or paths.empty:
        raise ValueError("Portfolio paths must be a nonempty pandas DataFrame")
    if not paths.columns.is_unique or not set(STRATEGIES).issubset(paths.columns):
        raise ValueError("Portfolio paths must contain all three unique strategy columns")
    if not isinstance(paths.index, pd.DatetimeIndex):
        raise ValueError("Portfolio paths must use a DatetimeIndex")
    if paths.index.hasnans or paths.index.has_duplicates:
        raise ValueError("Portfolio dates must be valid and unique")
    if not paths.index.is_monotonic_increasing:
        raise ValueError("Portfolio dates must be sorted")

    rows = []
    for strategy in STRATEGIES:
        values = validate_values(paths[strategy])
        start = values[0]
        end = values[-1]
        with np.errstate(over="ignore", invalid="ignore", divide="ignore"):
            final_pnl = float(end - start)
            return_pct = float((end / start - 1) * 100)
        if not np.isfinite([final_pnl, return_pct]).all():
            raise ValueError("Portfolio values produce nonfinite summary metrics")
        rows.append(
            {
                "strategy": strategy,
                "final_pnl": final_pnl,
                "return_pct": return_pct,
                "max_drawdown_pct": max_drawdown_pct(paths[strategy]),
            }
        )

    return pd.DataFrame(rows)

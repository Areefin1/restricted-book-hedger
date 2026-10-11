
import os
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import psycopg
from dotenv import load_dotenv


# data.py is assumed to be in backend/app/hedger/
BACKEND_DIR = Path(__file__).resolve().parents[2]

# Prefer a local .env file; fall back to your existing .env.example setup.
env_path = BACKEND_DIR / ".env"
if not env_path.is_file():
    raise SystemExit("Backend .env file not found")
    

load_dotenv(env_path)


def load_prices(
    start_date: str | date | None = None,
    end_date: str | date | None = None
) -> pd.DataFrame:
    """
    Load historical prices from TigerData into a pandas DataFrame.

    Returns:
        DatetimeIndex named 'date'
        Columns: hyg, sjb, rf_annual_pct
    """

    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise ValueError("DATABASE_URL is missing from environment variables")

    start = _parse_boundary(start_date, "Start date") if start_date is not None else None
    end = _parse_boundary(end_date, "End date") if end_date is not None else None

    if start is not None and end is not None and start > end:
        raise ValueError("Start date must not follow end date")

    query = """
        SELECT
            date,
            hyg_adj_close AS hyg,
            sjb_adj_close AS sjb,
            rf_annual_pct
        FROM prices
        WHERE (%s::date IS NULL OR date >= %s::date)
          AND (%s::date IS NULL OR date <= %s::date)
        ORDER BY date ASC
    """

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                query,
                (start, start, end, end)
            )
            rows = cursor.fetchall()
            columns = [column.name for column in cursor.description]

    prices = pd.DataFrame(rows, columns=columns)

    if prices.empty:
        raise ValueError("No price data found in TigerData for the selected range")

    if "date" not in prices.columns:
        raise ValueError("Database results are missing the date column")

    dates = pd.to_datetime(prices["date"], errors="coerce")

    if dates.isna().any():
        raise ValueError("Database contains missing or invalid trading dates")

    if dates.duplicated().any():
        raise ValueError("Database contains duplicate trading dates")

    if dates.dt.tz is not None:
        raise ValueError("Trading dates must be timezone-naive")

    if not dates.equals(dates.dt.normalize()):
        raise ValueError("Trading dates must be calendar dates")

    values = prices[["hyg", "sjb"]].apply(pd.to_numeric, errors="coerce")

    if values.isna().any().any():
        raise ValueError("Prices must be numeric and complete")

    if not np.isfinite(values.to_numpy(dtype=float)).all():
        raise ValueError("Prices must be finite")

    if (values <= 0).any().any():
        raise ValueError("Prices must be positive")

    for column in ("rf_annual_pct",):
        rates = pd.to_numeric(prices[column], errors="coerce")

        if not np.isfinite(rates.to_numpy(dtype=float)).all() or (rates <= -100).any():
            raise ValueError(
                f"{column} must be complete, finite and greater than -100"
            )

        values[column] = rates

    values.index = pd.DatetimeIndex(dates, name="date")

    return values.sort_index()


def _parse_boundary(value: str | date, label: str) -> pd.Timestamp:
    if not isinstance(value, (str, date)):
        raise ValueError(
            f"{label} must be a valid calendar date (YYYY-MM-DD)"
        )

    try:
        parsed = pd.to_datetime(
            value,
            format="%Y-%m-%d",
            errors="raise"
        )
    except (ValueError, TypeError, OverflowError) as exc:
        raise ValueError(
            f"{label} must be a valid calendar date (YYYY-MM-DD)"
        ) from exc

    if pd.isna(parsed) or parsed.tzinfo is not None:
        raise ValueError(
            f"{label} must be a valid timezone-naive calendar date"
        )

    return parsed.normalize()


def select_date_range(
    prices: pd.DataFrame,
    start_date: str | date,
    end_date: str | date
) -> pd.DataFrame:
    start = _parse_boundary(start_date, "Start date")
    end = _parse_boundary(end_date, "End date")

    if start > end:
        raise ValueError("Start date must not follow end date")

    selected = prices.loc[
        (prices.index >= start) & (prices.index <= end)
    ]

    if len(selected) < 2:
        raise ValueError(
            "At least two price observations are required in this range"
        )

    return selected.copy()

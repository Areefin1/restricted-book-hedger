import csv
from datetime import date
from pathlib import Path

import numpy as np 
import pandas as pd 

def load_prices(csv_path: str | Path) -> pd.DataFrame:
    path = Path(csv_path)
    if not path.is_file():
        raise FileNotFoundError(f"Price cache not found: {path}")

    with path.open(encoding="utf-8-sig", newline="") as source:
        header = next(csv.reader(source), None)
        if not header:
            raise ValueError("Price cache is empty")
        if len(header) != len(set(header)):
            raise ValueError("Price cache contains duplicate columns")

        source.seek(0)
        try:
            prices = pd.read_csv(source, dtype={"date":"string"})
        except (pd.errors.EmptyDataError, pd.errors.ParserError) as exc:
            raise ValueError("Price cache is empty or contains malformed CSV") from exc
    
    if prices.empty:
        raise ValueError("Price cache is empty")
    if "date" not in prices.columns:
        raise ValueError("Price cache is missing the date column")

    if {"hyg", "sjb"}.issubset(prices.columns):
        prices = prices.loc[:,["date","hyg","sjb"]].copy()
    elif {"hyg_adj_close", "sjb_adj_close"}.issubset(prices.columns):
         prices = prices.loc[:, ["date", "hyg_adj_close", "sjb_adj_close"]].rename(
            columns={"hyg_adj_close": "hyg", "sjb_adj_close": "sjb"}
        )
    else: 
        raise ValueError("Price cache requires hyg/sjb or hyg_adj_close/sjb_adj_close columns")

    dates = pd.to_datetime(prices["date"], format="%Y-%m-%d", errors="coerce")
    if dates.isna().any():
        raise ValueError("Price cache contains missing or invalid trading dates")
    if dates.duplicated().any():
        raise ValueError("Price cache contains duplicate trading dates")

    values = prices[["hyg", "sjb"]].apply(pd.to_numeric, errors="coerce")
    if values.isna().any().any():
        raise ValueError("Prices must be numeric and complete")
    if not np.isfinite(values.to_numpy()).all():
        raise ValueError("Prices must be finite")
    if (values <= 0).any().any():
        raise ValueError("Prices must be positive")

    values.index = pd.DatetimeIndex(dates, name="date")
    return values.sort_index()
    

def _parse_boundary(value: str | date, label:str) -> pd.Timestamp:
    if not isinstance(value,(str,date)):
        raise ValueError(f"{label} must be a valid calendar date (YYYY-MM-DD)")

    try:
        parsed = pd.to_datetime(value, format="%Y-%m-%d", errors="raise")
    except (ValueError, TypeError, OverflowError) as exc:
        raise ValueError(f"{label} must be a valid calendar date (YYYY-MM-DD)") from exc

    if pd.isna(parsed) or parsed.tzinfo is not None:
        raise ValueError(f"{label} must be a valid timezone-naive calendar date")
    return parsed.normalize()



def select_date_range(prices: pd.DataFrame, start_date: str | date, end_date: str | date) -> pd.DataFrame:
    start = _parse_boundary(start_date, "Start date")
    end = _parse_boundary(end_date, "End date")
    if start > end:
        raise ValueError("Start date must not follow end date")

    selected = prices.loc[(prices.index >= start) & (prices.index <= end)]
    
    if len(selected) < 2:
        raise ValueError("At least two price observations are required in this range")
    
    return selected.copy()

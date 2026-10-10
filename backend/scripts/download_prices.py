"""Explicit cache refresh; normal app startup never accesses a data provider."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import pandas as pd

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.config import Settings
from app.hedger.data import load_prices


def import_cash(path: Path, index: pd.DatetimeIndex) -> pd.Series:
    """Import decimal returns accrued over each ending-date observation interval.

    A trading-day RF file must first be compounded onto the ETF observation
    calendar; this importer deliberately rejects missing dates rather than fill.
    """
    frame = pd.read_csv(path)
    if not {"date", "rf_return"}.issubset(frame.columns):
        raise ValueError("Cash CSV requires date,rf_return (decimal interval returns)")
    dates = pd.to_datetime(frame.date, errors="raise")
    if dates.isna().any() or dates.dt.tz is not None or not dates.equals(dates.dt.normalize()) or dates.duplicated().any() or not dates.is_monotonic_increasing:
        raise ValueError("Cash dates must be valid, timezone-naive calendar dates, unique and sorted")
    series = pd.Series(pd.to_numeric(frame.rf_return, errors="raise").to_numpy(), index=dates)
    result = series.reindex(index)
    import numpy as np
    if result.isna().any() or not np.isfinite(result).all() or (result <= -1).any():
        raise ValueError("Cash returns must cover every ETF date, be finite, and exceed -1")
    return result


def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, suffix=".tmp", delete=False) as temporary:
        staged = Path(temporary.name)
        temporary.write(content)
    try:
        staged.replace(path)
    finally:
        staged.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", default="2011-03-01")
    parser.add_argument("--end", help="Exclusive download end date; default is provider's latest data")
    parser.add_argument("--describe-existing", action="store_true", help="Validate and identify an existing legacy cache without downloading or claiming a retrieval time")
    parser.add_argument("--cash-returns-csv", type=Path, help="Local date,rf_return file: decimal return over the interval ending on each ETF date")
    parser.add_argument("--cash-source", help="Source, retrieval date, quote basis and interval alignment of the supplied cash file")
    args = parser.parse_args()
    settings = Settings()
    cash_provenance = "UNVERIFIED legacy rf_annual_pct; original source, quote basis and timing unavailable. Interpreted only as an assumed effective annual rate, prior observation, actual/365."
    if args.describe_existing:
        prices = load_prices(settings.prices_path)
        raw = settings.prices_path.read_bytes()
        source = "unverified legacy repository cache"
        provenance = "Bundled HYG/SJB analytical return series. Original provider response, adjustment verification and retrieval time were not recorded; cache identity alone does not verify historical accuracy."
        retrieved_at = None
        if 'rf_return' in prices:
            cash_provenance = "UNVERIFIED supplied decimal ending-interval cash returns; source and alignment were not recorded."
    else:
        if not args.cash_returns_csv or not args.cash_source:
            parser.error("A refresh requires --cash-returns-csv and --cash-source; financing must not silently disappear")
        import yfinance as yf

        downloaded = yf.download(["HYG", "SJB"], start=args.start, end=args.end,
                                 auto_adjust=False, progress=False)
        if downloaded.empty:
            raise RuntimeError("Provider returned no prices; existing cache was preserved")
        columns = [("Close", "HYG"), ("Adj Close", "HYG"), ("Close", "SJB"), ("Adj Close", "SJB")]
        cleaned = downloaded.loc[:, columns].dropna().copy()
        cleaned.columns = ["hyg_close", "hyg_adj_close", "sjb_close", "sjb_adj_close"]
        cleaned.index.name = "date"
        cleaned["rf_return"] = import_cash(args.cash_returns_csv, cleaned.index)
        raw = cleaned.to_csv(date_format="%Y-%m-%d").encode("utf-8")
        # Archive parsed provider output and cash bytes before cache replacement.
        archive = settings.prices_path.parent / "sources"
        provider_raw = downloaded.to_csv(date_format="%Y-%m-%d").encode("utf-8")
        provider_digest = hashlib.sha256(provider_raw).hexdigest()
        atomic_write(archive / (provider_digest + "-provider.csv"), provider_raw)
        cash_raw = args.cash_returns_csv.read_bytes()
        cash_digest = hashlib.sha256(cash_raw).hexdigest()
        atomic_write(archive / (cash_digest + "-cash.csv"), cash_raw)
        # Validate the staged file before replacing a working cache.
        settings.prices_path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=settings.prices_path.parent, suffix=".csv", delete=False) as temporary:
            staged = Path(temporary.name)
            temporary.write(raw)
        try:
            prices = load_prices(staged)
            if len(prices) < 2:
                raise RuntimeError("Provider returned fewer than two shared observations")
            staged.replace(settings.prices_path)
        finally:
            staged.unlink(missing_ok=True)
        source = "Yahoo Finance via yfinance"
        provenance = "Historical HYG/SJB adjusted closes downloaded through yfinance from Yahoo Finance; common valid dates only, without forward filling."
        retrieved_at = datetime.now(timezone.utc).isoformat()
        provenance += f" Parsed provider extraction SHA256 {provider_digest}; yfinance {yf.__version__}; start={args.start}, end={args.end} (exclusive); {len(downloaded)-len(cleaned)} incomplete paired rows excluded. Parsed output is retained, not the original HTTP payload."
        cash_provenance = f"{args.cash_source}; decimal ending-interval returns; cash input SHA256 {cash_digest}. No forward filling."
    digest = hashlib.sha256(raw).hexdigest()
    metadata = dict(source=source, provenance=provenance, retrieved_at=retrieved_at,
                    metadata_recorded_at=datetime.now(timezone.utc).isoformat(),
                    first_date=str(prices.index[0].date()), last_date=str(prices.index[-1].date()),
                    trading_days=len(prices), adjustment="auto_adjust=False; analytical inputs use Adj Close for both funds. Raw closes are retained for inspection.",
                    sha256=digest, data_version=f"sha256:{digest}", is_synthetic=None if args.describe_existing else False,
                    verified=False, cash_provenance=cash_provenance)
    atomic_write(settings.metadata_path, (json.dumps(metadata, indent=2) + "\n").encode("utf-8"))
    print(f"Validated {len(prices)} shared observations: {metadata['first_date']} to {metadata['last_date']}")
    print(f"Prices: {settings.prices_path}\nMetadata: {settings.metadata_path}\nVersion: {metadata['data_version']}")


if __name__ == "__main__":
    main()

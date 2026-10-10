"""Explicit cache refresh; normal app startup never accesses a data provider."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import tempfile

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.config import Settings
from app.hedger.data import load_prices


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
    args = parser.parse_args()
    settings = Settings()
    if args.describe_existing:
        prices = load_prices(settings.prices_path)
        raw = settings.prices_path.read_bytes()
        source = "legacy repository cache"
        provenance = "Bundled historical HYG/SJB adjusted-close cache. The repository downloader uses yfinance/Yahoo Finance; this legacy cache's original retrieval time and provider response were not recorded."
        retrieved_at = None
    else:
        import yfinance as yf

        downloaded = yf.download(["HYG", "SJB"], start=args.start, end=args.end,
                                 auto_adjust=False, progress=False)
        if downloaded.empty:
            raise RuntimeError("Provider returned no prices; existing cache was preserved")
        columns = [("Close", "HYG"), ("Adj Close", "HYG"), ("Close", "SJB"), ("Adj Close", "SJB")]
        cleaned = downloaded.loc[:, columns].dropna().copy()
        cleaned.columns = ["hyg_close", "hyg_adj_close", "sjb_close", "sjb_adj_close"]
        cleaned.index.name = "date"
        raw = cleaned.to_csv(date_format="%Y-%m-%d").encode("utf-8")
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
    digest = hashlib.sha256(raw).hexdigest()
    metadata = dict(source=source, provenance=provenance, retrieved_at=retrieved_at,
                    metadata_recorded_at=datetime.now(timezone.utc).isoformat(),
                    first_date=str(prices.index[0].date()), last_date=str(prices.index[-1].date()),
                    trading_days=len(prices), adjustment="auto_adjust=False; analytical inputs use Adj Close for both funds. Raw closes are retained for inspection.",
                    sha256=digest, data_version=f"sha256:{digest}", is_synthetic=False)
    atomic_write(settings.metadata_path, (json.dumps(metadata, indent=2) + "\n").encode("utf-8"))
    print(f"Validated {len(prices)} shared observations: {metadata['first_date']} to {metadata['last_date']}")
    print(f"Prices: {settings.prices_path}\nMetadata: {settings.metadata_path}\nVersion: {metadata['data_version']}")


if __name__ == "__main__":
    main()

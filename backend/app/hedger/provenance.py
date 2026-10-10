"""Content-addressed cache identity with honest provenance for legacy files."""

import hashlib
import json
from pathlib import Path

import pandas as pd


def cache_metadata(prices_path: Path, metadata_path: Path, prices: pd.DataFrame) -> dict:
    digest = hashlib.sha256(prices_path.read_bytes()).hexdigest()
    source, notes = {}, []
    if metadata_path.is_file() and metadata_path.stat().st_size:
        try:
            candidate = json.loads(metadata_path.read_text(encoding="utf-8"))
            if isinstance(candidate, dict) and candidate.get("sha256") == digest:
                source = candidate
            else:
                notes.append("Provenance sidecar does not match this cache; source details are unavailable.")
        except (ValueError, OSError):
            notes.append("Provenance sidecar could not be read; source details are unavailable.")
    else:
        notes.append("No provenance sidecar is available for this cache.")
    return dict(first_date=prices.index[0].strftime("%Y-%m-%d"), last_date=prices.index[-1].strftime("%Y-%m-%d"),
                trading_days=len(prices), data_version=f"sha256:{digest}", sha256=digest,
                provenance=source.get("provenance", "Local adjusted-price cache; original source and retrieval time are unavailable."),
                retrieved_at=source.get("retrieved_at"), source=source.get("source", "unknown"),
                adjustment=source.get("adjustment", "Adjusted hyg/sjb analytical return series; see methodology."),
                is_synthetic=source.get("is_synthetic"), cash_provenance=source.get("cash_provenance", "Unverified cash inputs; original source, quote basis, and timing are unknown."),
                verified=bool(source.get("verified", False)), features={"recommendation": True}, notes=notes)

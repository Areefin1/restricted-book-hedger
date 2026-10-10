"""A stale or malformed sidecar must never identify a different cache."""

import hashlib
import json

from app.hedger.data import load_prices
from app.hedger.provenance import cache_metadata


def test_matching_sidecar_and_changed_prices(tmp_path):
    path = tmp_path / "prices.csv"
    path.write_text("date,hyg,sjb\n2022-01-03,100,50\n2022-01-04,99,51\n")
    sidecar = tmp_path / "metadata.json"
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    sidecar.write_text(json.dumps(dict(sha256=digest, provenance="Verified fixture source", retrieved_at="2026-10-09T12:00:00Z", is_synthetic=True)))
    matched = cache_metadata(path, sidecar, load_prices(path))
    assert matched["provenance"] == "Verified fixture source"
    assert matched["retrieved_at"] == "2026-10-09T12:00:00Z"
    assert matched["is_synthetic"] is True
    path.write_text("date,hyg,sjb\n2022-01-03,100,50\n2022-01-04,98,51\n")
    stale = cache_metadata(path, sidecar, load_prices(path))
    assert stale["retrieved_at"] is None
    assert stale["source"] == "unknown"
    assert stale["data_version"] != matched["data_version"]
    assert stale["notes"]


def test_malformed_sidecar_keeps_valid_cache_usable(tmp_path):
    path = tmp_path / "prices.csv"
    path.write_text("date,hyg,sjb\n2022-01-03,100,50\n2022-01-04,99,51\n")
    sidecar = tmp_path / "metadata.json"
    sidecar.write_text("{broken json")
    result = cache_metadata(path, sidecar, load_prices(path))
    assert result["trading_days"] == 2
    assert result["retrieved_at"] is None
    assert result["notes"]

"""Complete HTTP contract using a fixture plus the bundled historical cache."""

import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.hedger.data import load_prices
from app.main import create_app


@pytest.fixture
def client(tmp_path):
    path = tmp_path / "prices.csv"
    pd.DataFrame({"date": pd.bdate_range("2022-01-03", periods=140),
                  "hyg": 100 * np.cumprod(1 + np.resize([.01, -.02, .005], 140)),
                  "rf_return": 0.0, "sjb": 50 * np.cumprod(1 + np.resize([-.01, .02, -.005], 140))}).to_csv(path, index=False)
    with TestClient(create_app(Settings(_env_file=None, prices_path=path, metadata_path=tmp_path / "missing.json"))) as connection:
        yield connection


def test_complete_contract_with_finite_json_and_version(client):
    metadata = client.get("/api/metadata").json()
    assert metadata["trading_days"] == 140
    assert metadata["data_version"].startswith("sha256:")
    assert metadata["notes"]  # Missing provenance is visible rather than invented.
    assert client.get("/api/scenarios").json()[-1]["id"] == "full"
    payload = dict(book_size=100000, hedge_ratio=.5, annual_borrow_rate=.02,
                   start_date="2022-01-01", end_date="2022-12-31")
    response = client.post("/api/simulations", json=payload)
    assert response.status_code == 200, response.text
    result = response.json()
    assert len(result["paths"]) == 140
    assert result["effective_start_date"] == metadata["first_date"]
    assert {row["strategy"] for row in result["summary"]} == {"unhedged", "static_short_hedged", "sjb_hedged"}
    assert all(point["unhedged_pnl"] == pytest.approx(point["unhedged"] - 100000) for point in result["paths"])
    for endpoint in ["/api/research/sanity", "/api/research/convexity?window_days=21", "/api/research/convexity?window_days=63", "/api/research/convexity?window_days=126"]:
        research = client.get(endpoint)
        assert research.status_code == 200, research.text
        assert research.json()["data_version"] == metadata["data_version"]
        assert "NaN" not in research.text and "Infinity" not in research.text
    for instrument in ["sjb", "static_short"]:
        search = client.post("/api/recommendations", json=dict(start_date=payload["start_date"], end_date=payload["end_date"],
                             instrument=instrument, window_days=63, annual_borrow_rate=.02))
        assert search.status_code == 200, search.text
        assert len(search.json()["grid"]) == 21
        assert search.json()["data_version"] == metadata["data_version"]


def test_http_zero_hedge_and_calendar_day_borrow(client):
    body = dict(book_size=100000, hedge_ratio=0, annual_borrow_rate=.02, start_date="2022-01-07", end_date="2022-01-12")
    zero = client.post("/api/simulations", json=body).json()
    for point in zero["paths"]:
        assert point["unhedged"] == point["static_short_hedged"] == point["sjb_hedged"]
    body["hedge_ratio"] = 1
    full = client.post("/api/simulations", json=body).json()
    assert full["paths"][-1]["static_short_hedged"] == pytest.approx(100000 - 100000 * .02 * 5 / 365)


def test_bad_requests_keep_error_contract(client):
    assert client.get("/api/research/convexity?window_days=62").status_code == 422
    assert client.get("/api/research/convexity?window_days=abc").json()["error"]["code"] == "VALIDATION_ERROR"
    body = dict(book_size=100000, hedge_ratio=.5, annual_borrow_rate=.02, start_date="2030-01-01", end_date="2030-12-31")
    assert client.post("/api/simulations", json=body).json()["error"]["code"] == "INVALID_RANGE"
    body["hedge_ratio"] = 2
    assert client.post("/api/simulations", json=body).json()["error"]["code"] == "VALIDATION_ERROR"
    search = dict(start_date="2022-01-03", end_date="2022-01-10", instrument="sjb", annual_borrow_rate=0, window_days=63)
    assert client.post("/api/recommendations", json=search).json()["error"]["code"] == "INVALID_RANGE"


def test_bundled_cache_presets_and_reproducible_2022_demo():
    backend = Path(__file__).resolve().parents[1]
    settings = Settings(_env_file=None, prices_path=backend / "data/prices.csv", metadata_path=backend / "data/metadata.json")
    prices = load_prices(settings.prices_path)
    with TestClient(create_app(settings)) as client:
        metadata = client.get("/api/metadata").json()
        assert metadata["data_version"] == "sha256:" + hashlib.sha256(settings.prices_path.read_bytes()).hexdigest()
        scenarios = client.get("/api/scenarios").json()
        assert {"covid-2020", "rates-2022", "choppy"}.issubset({scenario["id"] for scenario in scenarios})
        for scenario in scenarios:
            response = client.post("/api/simulations", json=dict(book_size=1000000, hedge_ratio=.6, annual_borrow_rate=.02,
                                   start_date=scenario["start_date"], end_date=scenario["end_date"]))
            assert response.status_code == 200, response.text
            assert response.json()["effective_start_date"] == scenario["start_date"]
            assert response.json()["effective_end_date"] == scenario["end_date"]
        choppy = next(s for s in scenarios if s["id"] == "choppy")
        period = prices.loc[choppy["start_date"]:choppy["end_date"]]
        assert len(period) == 127
        assert abs(period.hyg.iloc[-1] / period.hyg.iloc[0] - 1) <= .02
        if (backend.parent / "frontend/dist/index.html").is_file():
            assert client.get("/").status_code == 200
            assert "text/html" in client.get("/").headers["content-type"]
        assert client.get("/api/missing").json()["error"]["code"] == "NOT_FOUND"


def test_bundled_research_matches_prices_csv_directly():
    """Check the chart API against independent arithmetic on the actual CSV."""
    backend = Path(__file__).resolve().parents[1]
    path = backend / "data/prices.csv"
    raw = pd.read_csv(path, parse_dates=["date"]).sort_values("date").reset_index(drop=True)
    hyg = raw["hyg_adj_close"].to_numpy()
    sjb = raw["sjb_adj_close"].to_numpy()
    days = raw.date.diff().dt.days.fillna(0).to_numpy()
    # The bundled CSV contains legacy annual cash quotes. Use the previous
    # observation over each actual calendar interval, without the app helper.
    quotes = raw["rf_annual_pct"].to_numpy() / 100
    cash = np.expm1(np.log1p(np.r_[quotes[0], quotes[:-1]]) * days / 365)
    version = "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()
    settings = Settings(_env_file=None, prices_path=path, metadata_path=backend / "data/metadata.json")
    with TestClient(create_app(settings)) as client:
        for window in (21, 63, 126):
            response = client.get(f"/api/research/convexity?window_days={window}")
            assert response.status_code == 200, response.text
            result = response.json()
            assert result["data_version"] == version
            assert len(result["points"]) == len(raw) - window
            for start in (0, (len(raw) - window) // 2, len(raw) - window - 1):
                end = start + window
                point = result["points"][start]
                interval_cash = cash[start + 1:end + 1]
                cash_return = np.prod(1 + interval_cash) - 1
                daily = hyg[start + 1:end + 1] / hyg[start:end] - 1 - interval_cash
                assert point["start_date"] == str(raw.date.iloc[start].date())
                assert point["end_date"] == str(raw.date.iloc[end].date())
                assert point["hyg_total_return"] == pytest.approx(hyg[end] / hyg[start] - 1)
                assert point["sjb_total_return"] == pytest.approx(sjb[end] / sjb[start] - 1)
                assert point["cash_return"] == pytest.approx(cash_return)
                assert point["hyg_return"] == pytest.approx(hyg[end] / hyg[start] - 1 - cash_return)
                assert point["sjb_return"] == pytest.approx(sjb[end] / sjb[start] - 1 - cash_return)
                assert point["hyg_realized_vol"] == pytest.approx(np.sqrt(252 * np.mean(daily ** 2)))
                assert point["hyg_sample_vol"] == pytest.approx(np.std(daily, ddof=1) * np.sqrt(252))

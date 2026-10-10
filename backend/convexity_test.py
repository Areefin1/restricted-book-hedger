import numpy as np
import pandas as pd
import pytest
from convexity import rolling_windows, theory_curve

def make_prices(hyg_rets, sjb_rets, start=100.0, rf_pct=0.0):
    """Build a price table (same columns as data.py) from chosen daily returns."""
    dates = pd.bdate_range("2020-01-01", periods=len(hyg_rets) + 1)
    hyg = start * np.cumprod([1.0] + [1 + r for r in hyg_rets])
    sjb = start * np.cumprod([1.0] + [1 + r for r in sjb_rets])
    return pd.DataFrame({"hyg_adj_close": hyg, "sjb_adj_close": sjb, "rf_annual_pct": rf_pct}, index=dates)

def test_choppy_market_matches_doc_example():
    # HYG +10% then -10%; SJB does the opposite each day
    df = rolling_windows(make_prices([0.10, -0.10], [-0.10, 0.10]), window=2)
    row = df.iloc[0]
    assert row["hyg_ret"] == pytest.approx(-0.01)    # $100 -> $110 -> $99
    assert row["sjb_ret"] == pytest.approx(-0.01)    # $100 -> $90 -> $99
    assert row["static_ret"] == pytest.approx(0.01)  # short gains what HYG loses
    assert row["sjb_minus_static"] < 0               # choppy path hurts SJB

def test_steady_crash_matches_doc_example():
    df = rolling_windows(make_prices([-0.10, -0.10], [0.10, 0.10]), window=2)
    row = df.iloc[0]
    assert row["hyg_ret"] == pytest.approx(-0.19)
    assert row["sjb_ret"] == pytest.approx(0.21)
    assert row["static_ret"] == pytest.approx(0.19)
    assert row["sjb_minus_static"] == pytest.approx(0.02)  # SJB wins by 2 points

def test_window_count():
    # 11 prices -> 10 daily returns -> 10 - 3 + 1 = 8 windows
    rets = [0.01, -0.02, 0.03, -0.01, 0.02, -0.03, 0.01, 0.02, -0.01, 0.01]
    df = rolling_windows(make_prices(rets, [-r for r in rets]), window=3)
    assert len(df) == 8

def test_vol_formula():
    # sqrt(0.1^2 + 0.1^2) = sqrt(0.02)
    df = rolling_windows(make_prices([0.10, -0.10], [-0.10, 0.10]), window=2)
    assert df.iloc[0]["vol"] == pytest.approx(np.sqrt(0.02))

def test_theory_curve_with_no_vol_and_no_rates():
    # With zero vol and zero rates, eq. 4 reduces to 1/(1+x) - 1
    x = np.array([-0.2, 0.0, 0.25])
    expected = 1 / (1 + x) - 1
    assert theory_curve(x, vol_window=0.0, r=0.0) == pytest.approx(expected)

def test_single_window_has_no_bucket():
    df = rolling_windows(make_prices([0.10, -0.10], [-0.10, 0.10]), window=2)
    assert pd.isna(df.iloc[0]["vol_bucket"])

def test_decomposition_adds_up():
    rets = [0.02, -0.03, 0.01, 0.04, -0.02]
    df = rolling_windows(make_prices(rets, [-x for x in rets], rf_pct=5.0), window=3)
    parts = df["convexity"] + df["rate_interaction"] + df["costs_tracking"]
    assert (df["sjb_minus_static"] - parts).abs().max() < 1e-12

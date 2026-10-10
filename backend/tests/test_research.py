"""Independent arithmetic and boundary checks for research and ratio search."""

import numpy as np
import pandas as pd
import pytest

from app.hedger.convexity import calculate_rolling_windows
from app.hedger.hedge import simulate_hedges
from app.hedger.recommend import recommend_ratio
from app.hedger.sanity import run_sanity_check


@pytest.fixture
def prices():
    returns = np.resize([0.01, -0.02, 0.005, -0.003], 130)
    return pd.DataFrame({"hyg": 100 * np.r_[1, np.cumprod(1 + returns)],
                         "rf_return": 0.0, "sjb": 50 * np.r_[1, np.cumprod(1 - returns)]},
                        index=pd.bdate_range("2022-01-03", periods=131, name="date"))


def test_63_intervals_need_64_prices_and_use_only_window_returns(prices):
    assert calculate_rolling_windows(prices.iloc[:63]).empty
    result = calculate_rolling_windows(prices.iloc[:64])
    assert len(result) == 1
    row = result.iloc[0]
    assert row.hyg_return == pytest.approx(prices.hyg.iloc[63] / prices.hyg.iloc[0] - 1)
    assert row.hyg_realized_vol == pytest.approx(np.sqrt(np.mean(prices.hyg.pct_change().dropna().iloc[:63] ** 2)) * np.sqrt(252))
    assert row.start_date == "2022-01-03"
    assert row.end_date == str(prices.index[63].date())
    assert len(calculate_rolling_windows(prices)) == len(prices) - 63


def test_exact_inverse_daily_fit_and_degenerate_json(prices):
    result = run_sanity_check(prices)
    assert result["beta"] == pytest.approx(-1)
    assert result["intercept_daily"] == pytest.approx(0, abs=1e-12)
    assert result["r_squared"] == pytest.approx(1)
    assert result["correlation"] == pytest.approx(-1)
    assert result["observations"] == 130
    flat = run_sanity_check(prices.assign(hyg=100, sjb=50))
    assert flat["beta"] is None
    assert any("unavailable" in note for note in flat["notes"])


@pytest.mark.parametrize("instrument,strategy", [("static_short", "static_short_hedged"), ("sjb", "sjb_hedged")])
def test_search_matches_independent_simulations_in_every_window(prices, instrument, strategy):
    result = recommend_ratio(prices, prices.index[0].date(), prices.index[-1].date(), instrument, 21, .02)
    assert result["in_sample"] is True
    assert result["windows_evaluated"] == 110
    for row in result["grid"]:
        endings = []
        for start in range(len(prices) - 21):
            path = simulate_hedges(prices.iloc[start:start + 22], 100, row["hedge_ratio"], .02)
            endings.append(path[strategy].iloc[-1] - 100)
        assert row["worst_window_return_pct"] == pytest.approx(min(endings), abs=1e-10)
        assert row["median_window_return_pct"] == pytest.approx(np.median(endings), abs=1e-10)
        assert row["best_window_return_pct"] == pytest.approx(max(endings), abs=1e-10)
    assert result["objective_value_pct"] == max(row["worst_window_return_pct"] for row in result["grid"])


def test_search_ties_choose_smallest_ratio(prices):
    flat = prices.assign(hyg=100, sjb=50)
    result = recommend_ratio(flat, flat.index[0].date(), flat.index[-1].date(), "sjb", 63, 0)
    assert result["recommended_ratio"] == 0


def test_search_rejects_insufficient_history_and_bad_windows(prices):
    with pytest.raises(ValueError, match="64"):
        recommend_ratio(prices.iloc[:63], "2022-01-01", "2023-01-01", "sjb")
    with pytest.raises(ValueError, match="window_days"):
        calculate_rolling_windows(prices, 62)

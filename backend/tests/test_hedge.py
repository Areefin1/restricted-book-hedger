"""Check portfolio accounting, fixed exposures, costs, and invalid inputs."""

import numpy as np
import pandas as pd
import pytest

from app.hedger.data import load_prices, select_date_range
from app.hedger.hedge import simulate_hedges


@pytest.fixture
def prices():
    return pd.DataFrame(
        {"hyg": [100.0, 90.0, 99.0], "sjb": [50.0, 54.0, 49.5]},
        index=pd.DatetimeIndex(["2022-01-07", "2022-01-10", "2022-01-12"], name="date"),
    )


def test_known_paths_start_at_book_size_and_keep_fixed_positions(prices):
    original = prices.copy(deep=True)
    results = simulate_hedges(prices, 100_000, 0.5)

    np.testing.assert_allclose(
        results.to_numpy(),
        [[100_000, 100_000, 100_000], [90_000, 95_000, 94_000], [99_000, 99_500, 98_500]],
    )
    assert list(results.columns) == ["unhedged", "static_short_hedged", "sjb_hedged"]
    pd.testing.assert_index_equal(results.index, prices.index)
    pd.testing.assert_frame_equal(prices, original)


def test_zero_hedge_matches_unhedged_even_with_borrow_rate(prices):
    results = simulate_hedges(prices, 100_000, 0, 0.02)
    np.testing.assert_allclose(results["unhedged"], results["static_short_hedged"])
    np.testing.assert_allclose(results["unhedged"], results["sjb_hedged"])


def test_full_static_hedge_is_flat_before_costs(prices):
    results = simulate_hedges(prices, 100_000, 1)
    np.testing.assert_allclose(results["static_short_hedged"], 100_000)


def test_borrow_cost_uses_initial_exposure_and_calendar_days(prices):
    free = simulate_hedges(prices, 100_000, 0.5)
    charged = simulate_hedges(prices, 100_000, 0.5, 0.02)
    expected_costs = np.array([0, 3, 5]) * 50_000 * 0.02 / 365

    np.testing.assert_allclose(
        free["static_short_hedged"] - charged["static_short_hedged"], expected_costs
    )
    pd.testing.assert_series_equal(free["unhedged"], charged["unhedged"])
    pd.testing.assert_series_equal(free["sjb_hedged"], charged["sjb_hedged"])


def test_loader_selection_and_simulation_work_together(tmp_path):
    path = tmp_path / "prices.csv"
    path.write_text(
        "date,hyg_close,hyg_adj_close,sjb_close,sjb_adj_close\n"
        "2022-01-03,110,100,60,50\n2022-01-04,100,90,64,54\n",
        encoding="utf-8",
    )
    selected = select_date_range(load_prices(path), "2022-01-01", "2022-01-04")
    results = simulate_hedges(selected, 100_000, 0.5)
    np.testing.assert_allclose(results.iloc[-1], [90_000, 95_000, 94_000])


@pytest.mark.parametrize(
    "overrides,message",
    [
        ({"book_size": 0}, "Book size must be positive"),
        ({"book_size": -1}, "Book size must be positive"),
        ({"book_size": np.nan}, "Book size must be a finite number"),
        ({"book_size": np.inf}, "Book size must be a finite number"),
        ({"book_size": True}, "Book size must be a finite number"),
        ({"book_size": "100000"}, "Book size must be a finite number"),
        ({"hedge_ratio": -0.1}, "Hedge ratio must be between"),
        ({"hedge_ratio": 1.1}, "Hedge ratio must be between"),
        ({"hedge_ratio": np.inf}, "Hedge ratio must be a finite number"),
        ({"hedge_ratio": None}, "Hedge ratio must be a finite number"),
        ({"annual_borrow_rate": -0.02}, "Annual borrow rate must be nonnegative"),
        ({"annual_borrow_rate": np.nan}, "Annual borrow rate must be a finite number"),
    ],
)
def test_rejects_invalid_simulation_parameters(prices, overrides, message):
    parameters = {"book_size": 100_000, "hedge_ratio": 0.5, "annual_borrow_rate": 0.02}
    parameters.update(overrides)
    with pytest.raises(ValueError, match=message):
        simulate_hedges(prices, **parameters)


@pytest.mark.parametrize("row_count", [0, 1])
def test_requires_two_observations(prices, row_count):
    with pytest.raises(ValueError, match="At least two"):
        simulate_hedges(prices.iloc[:row_count], 100_000, 0.5)


def test_rejects_missing_columns(prices):
    with pytest.raises(ValueError, match="unique hyg and sjb columns"):
        simulate_hedges(prices.rename(columns={"hyg": "hyg_adj_close"}), 100_000, 0.5)


@pytest.mark.parametrize("value", [0, -1, np.nan, np.inf, "invalid"])
def test_rejects_invalid_prices(prices, value):
    invalid = prices.astype(object)
    invalid.iloc[1, 0] = value
    with pytest.raises(ValueError, match="positive, finite real numbers"):
        simulate_hedges(invalid, 100_000, 0.5)


@pytest.mark.parametrize(
    "index,message",
    [
        (pd.RangeIndex(3), "DatetimeIndex"),
        (pd.DatetimeIndex(["2022-01-07", "2022-01-07", "2022-01-12"]), "unique"),
        (pd.DatetimeIndex(["2022-01-07", None, "2022-01-12"]), "valid"),
        (pd.DatetimeIndex(["2022-01-12", "2022-01-10", "2022-01-07"]), "sorted"),
        (pd.date_range("2022-01-07", periods=3, tz="UTC"), "timezone-naive"),
    ],
)
def test_rejects_invalid_trading_dates(prices, index, message):
    prices.index = index
    with pytest.raises(ValueError, match=message):
        simulate_hedges(prices, 100_000, 0.5)

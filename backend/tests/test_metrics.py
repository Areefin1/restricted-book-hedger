"""Verify summary units and drawdown against manually calculated examples."""

import numpy as np
import pandas as pd
import pytest

from app.hedger.hedge import simulate_hedges
from app.hedger.metrics import max_drawdown_pct, summarize_paths


@pytest.mark.parametrize(
    "values,expected",
    [
        ([100, 110, 99], 10),
        ([100, 80, 120, 90], 25),
        ([100, 80, 120], 20),
        ([100, 110, 120], 0),
        ([100, 100, 100], 0),
        ([100, 90, 80], 20),
        ([100], 0),
        ([100, 0], 100),
        ([100, -20], 120),
    ],
)
def test_drawdown_examples(values, expected):
    assert max_drawdown_pct(pd.Series(values)) == pytest.approx(expected)


@pytest.fixture
def paths():
    return pd.DataFrame(
        {
            "unhedged": [100_000, 110_000, 99_000],
            "static_short_hedged": [100_000, 105_000, 99_500],
            "sjb_hedged": [100_000, 108_000, 98_500],
        },
        index=pd.date_range("2022-01-03", periods=3, name="date"),
    )


def test_summary_uses_dollars_and_percentage_points_without_modifying_paths(paths):
    original = paths.copy(deep=True)
    summary = summarize_paths(paths)

    assert list(summary.columns) == ["strategy", "final_pnl", "return_pct", "max_drawdown_pct"]
    assert list(summary["strategy"]) == ["unhedged", "static_short_hedged", "sjb_hedged"]
    np.testing.assert_allclose(summary["final_pnl"], [-1000, -500, -1500])
    np.testing.assert_allclose(summary["return_pct"], [-1, -0.5, -1.5])
    np.testing.assert_allclose(
        summary["max_drawdown_pct"], [10, 5500 / 105000 * 100, 9500 / 108000 * 100]
    )
    pd.testing.assert_frame_equal(paths, original)


def test_simulation_summary_includes_borrow_cost_only_once():
    prices = pd.DataFrame(
        {"hyg": [100.0, 100.0], "sjb": [50.0, 50.0]},
        index=pd.DatetimeIndex(["2022-01-01", "2023-01-01"], name="date"),
    )
    paths = simulate_hedges(prices, 100_000, 0.5, annual_borrow_rate=0.02)
    summary = summarize_paths(paths).set_index("strategy")

    assert summary.loc["unhedged", "final_pnl"] == pytest.approx(0)
    assert summary.loc["sjb_hedged", "final_pnl"] == pytest.approx(0)
    assert summary.loc["static_short_hedged", "final_pnl"] == pytest.approx(-1000)
    assert summary.loc["static_short_hedged", "return_pct"] == pytest.approx(-1)
    assert summary.loc["static_short_hedged", "max_drawdown_pct"] == pytest.approx(1)


@pytest.mark.parametrize("values", [[], [0, 100], [-1, 100], [100, np.nan], [100, np.inf], [100, "bad"], [True, False]])
def test_rejects_invalid_values(values):
    with pytest.raises(ValueError):
        max_drawdown_pct(pd.Series(values))


def test_summary_rejects_invalid_strategy_path(paths):
    paths.loc[paths.index[1], "sjb_hedged"] = np.nan
    with pytest.raises(ValueError, match="finite real numbers"):
        summarize_paths(paths)


def test_summary_requires_all_strategy_columns(paths):
    with pytest.raises(ValueError, match="three unique strategy columns"):
        summarize_paths(paths.drop(columns="sjb_hedged"))


def test_summary_rejects_unsorted_dates(paths):
    with pytest.raises(ValueError, match="sorted"):
        summarize_paths(paths.iloc[::-1])


def test_summary_rejects_empty_paths(paths):
    with pytest.raises(ValueError, match="nonempty"):
        summarize_paths(paths.iloc[:0])


def test_summary_rejects_duplicate_dates(paths):
    paths.index = pd.DatetimeIndex(["2022-01-03", "2022-01-03", "2022-01-05"])
    with pytest.raises(ValueError, match="unique"):
        summarize_paths(paths)

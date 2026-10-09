"""Checks for the price-table contract and inclusive date selection."""

from datetime import date

import pandas as pd
import pytest

from app.hedger.data import load_prices, select_date_range


def write_cache(tmp_path, content):
    path = tmp_path / "prices.csv"
    path.write_text(content, encoding="utf-8")
    return path


@pytest.mark.parametrize(
    "header,rows",
    [
        ("date,hyg,sjb", "2022-01-04,99,51\n2022-01-03,100,50\n"),
        (
            "date,hyg_close,hyg_adj_close,sjb_close,sjb_adj_close",
            "2022-01-04,109,99,61,51\n2022-01-03,110,100,60,50\n",
        ),
    ],
)
def test_loads_both_formats_and_sorts_without_using_raw_close(tmp_path, header, rows):
    prices = load_prices(write_cache(tmp_path, header + "\n" + rows))

    assert list(prices.columns) == ["hyg", "sjb"]
    assert isinstance(prices.index, pd.DatetimeIndex)
    assert prices.index.name == "date"
    assert list(prices.index.strftime("%Y-%m-%d")) == ["2022-01-03", "2022-01-04"]
    assert prices.to_numpy().tolist() == [[100, 50], [99, 51]]


@pytest.mark.parametrize(
    "content,message",
    [
        ("", "empty"),
        ("date,hyg,sjb\n", "empty"),
        ("hyg,sjb\n100,50\n", "date column"),
        ("date,hyg\n2022-01-03,100\n", "requires"),
        ("date,hyg,hyg,sjb\n2022-01-03,100,100,50\n", "duplicate columns"),
        ("date,hyg,sjb\ninvalid,100,50\n", "invalid trading dates"),
        ("date,hyg,sjb\n2022-02-30,100,50\n", "invalid trading dates"),
        ("date,hyg,sjb\n,100,50\n", "invalid trading dates"),
        (
            "date,hyg,sjb\n2022-01-03,100,50\n2022-01-03,99,51\n",
            "duplicate trading dates",
        ),
        ("date,hyg,sjb\n2022-01-03,,50\n", "numeric and complete"),
        ("date,hyg,sjb\n2022-01-03,invalid,50\n", "numeric and complete"),
        ("date,hyg,sjb\n2022-01-03,NaN,50\n", "numeric and complete"),
        ("date,hyg,sjb\n2022-01-03,inf,50\n", "finite"),
        ("date,hyg,sjb\n2022-01-03,100,-inf\n", "finite"),
        ("date,hyg,sjb\n2022-01-03,0,50\n", "positive"),
        ("date,hyg,sjb\n2022-01-03,100,-1\n", "positive"),
    ],
)
def test_rejects_invalid_cache(tmp_path, content, message):
    with pytest.raises(ValueError, match=message):
        load_prices(write_cache(tmp_path, content))


def test_missing_cache(tmp_path):
    with pytest.raises(FileNotFoundError, match="Price cache not found"):
        load_prices(tmp_path / "missing.csv")


@pytest.fixture
def prices(tmp_path):
    return load_prices(
        write_cache(
            tmp_path,
            "date,hyg,sjb\n2022-01-03,100,50\n2022-01-04,99,51\n2022-01-05,98,52\n",
        )
    )


def test_nontrading_boundary_resolves_inside_range_without_changing_source(prices):
    selected = select_date_range(prices, "2022-01-01", date(2022, 1, 4))

    assert list(selected.index.strftime("%Y-%m-%d")) == ["2022-01-03", "2022-01-04"]
    selected.iloc[0, 0] = 1
    assert prices.iloc[0, 0] == 100


@pytest.mark.parametrize(
    "start,end,message",
    [
        ("2022-01-05", "2022-01-03", "Start date must not follow"),
        ("2022-01-03", "2022-01-03", "At least two"),
        ("2023-01-01", "2023-01-31", "At least two"),
        ("invalid", "2022-01-05", "Start date must be"),
        ("2022-01-03", "2022-02-30", "End date must be"),
        (None, "2022-01-05", "Start date must be"),
        (20220103, "2022-01-05", "Start date must be"),
    ],
)
def test_rejects_invalid_or_insufficient_ranges(prices, start, end, message):
    with pytest.raises(ValueError, match=message):
        select_date_range(prices, start, end)

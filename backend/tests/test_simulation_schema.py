"""Validate the frontend contract, units, dates, and finite JSON numbers."""

import json
from datetime import date

import pandas as pd
import pytest
from pydantic import ValidationError

from app.hedger.hedge import simulate_hedges
from app.schemas.simulation import SimulationRequest, SimulationResponse, SummaryRow


@pytest.fixture
def request_payload():
    return {
        "book_size": 100000,
        "hedge_ratio": 0.5,
        "start_date": "2022-01-03",
        "end_date": "2022-01-04",
        "annual_borrow_rate": 0.02,
    }


def test_request_parses_dates_and_round_trips_json(request_payload):
    request = SimulationRequest.model_validate(request_payload)
    assert request.start_date == date(2022, 1, 3)
    assert request.hedge_ratio == 0.5
    assert request.annual_borrow_rate == 0.02
    assert json.loads(request.model_dump_json(exclude_unset=True)) == request_payload


@pytest.mark.parametrize(
    "field,value",
    [
        ("book_size", 0), ("book_size", -1), ("book_size", float("inf")),
        ("book_size", "100000"), ("book_size", True),
        ("hedge_ratio", -0.1), ("hedge_ratio", 1.1), ("hedge_ratio", float("nan")),
        ("annual_borrow_rate", -0.02), ("annual_borrow_rate", float("inf")),
        ("start_date", "2022-02-30"), ("start_date", "20220103"),
        ("start_date", "2022-01-03T00:00:00"), ("start_date", 1641168000),
        ("start_date", "2022-01-05"), ("unexpected_field", 1),
    ],
)
def test_request_rejects_invalid_inputs(request_payload, field, value):
    request_payload[field] = value
    with pytest.raises(ValidationError):
        SimulationRequest.model_validate(request_payload)


def test_request_requires_explicit_borrow_assumption(request_payload):
    del request_payload["annual_borrow_rate"]
    with pytest.raises(ValidationError, match="annual_borrow_rate"):
        SimulationRequest.model_validate(request_payload)


def test_zero_hedge_and_equal_dates_are_valid_request_inputs(request_payload):
    request_payload.update(hedge_ratio=0, annual_borrow_rate=0, end_date="2022-01-03")
    # Sufficient available observations are checked later by date selection.
    SimulationRequest.model_validate(request_payload)


@pytest.fixture
def response_payload():
    return {
        "paths": [
            {"date": "2022-01-03", "unhedged": 100000, "static_short_hedged": 100000, "sjb_hedged": 100000,
             "unhedged_pnl": 0, "static_short_hedged_pnl": 0, "sjb_hedged_pnl": 0},
            {"date": "2022-01-04", "unhedged": 90000, "static_short_hedged": 95000, "sjb_hedged": 94000,
             "unhedged_pnl": -10000, "static_short_hedged_pnl": -5000, "sjb_hedged_pnl": -6000},
        ],
        "summary": [
            {"strategy": "unhedged", "final_pnl": -10000, "return_pct": -10, "max_drawdown_pct": 10},
            {"strategy": "static_short_hedged", "final_pnl": -5000, "return_pct": -5, "max_drawdown_pct": 5},
            {"strategy": "sjb_hedged", "final_pnl": -6000, "return_pct": -6, "max_drawdown_pct": 6},
        ],
        "effective_start_date": "2022-01-03",
        "effective_end_date": "2022-01-04",
        "assumptions": [{"label": "Accounting", "detail": "Original book plus hedge P/L; zero financing interest."}],
        "data_version": "fixture-v1",
    }


def test_response_matches_frontend_json_and_preserves_units(response_payload):
    response = SimulationResponse.model_validate(response_payload)
    assert json.loads(response.model_dump_json(exclude_unset=True)) == response_payload
    assert response.summary[0].return_pct == -10
    assert response.summary[0].max_drawdown_pct == 10


def test_accepts_path_records_from_simulator(response_payload):
    prices = pd.DataFrame(
        {"hyg": [100.0, 90.0], "rf_return": 0.0, "sjb": [50.0, 54.0]},
        index=pd.DatetimeIndex(["2022-01-03", "2022-01-04"], name="date"),
    )
    response_payload["paths"] = simulate_hedges(prices, 100000, 0.5).reset_index().to_dict("records")
    response = SimulationResponse.model_validate(response_payload)
    assert response.paths[-1].unhedged == pytest.approx(90000)
    assert response.paths[-1].unhedged_pnl == pytest.approx(-10000)
    assert response.paths[-1].static_short_hedged_pnl == pytest.approx(-5000)
    assert response.paths[-1].sjb_hedged_pnl == pytest.approx(-6000)
    assert response.paths[0].unhedged_pnl == 0
    assert response.paths[0].date == date(2022, 1, 3)


@pytest.mark.parametrize("case", ["nan", "nonfinite_pnl", "unknown_strategy", "negative_drawdown", "duplicate_strategy", "unsorted", "duplicate_date", "effective_date", "empty_paths", "empty_assumptions", "blank_version"])
def test_rejects_invalid_responses(response_payload, case):
    if case == "nan":
        response_payload["paths"][0]["unhedged"] = float("nan")
    elif case == "nonfinite_pnl":
        response_payload["paths"][0]["unhedged_pnl"] = float("inf")
    elif case == "unknown_strategy":
        response_payload["summary"][0]["strategy"] = "other"
    elif case == "negative_drawdown":
        response_payload["summary"][0]["max_drawdown_pct"] = -1
    elif case == "duplicate_strategy":
        response_payload["summary"][1]["strategy"] = "unhedged"
    elif case == "unsorted":
        response_payload["paths"].reverse()
    elif case == "duplicate_date":
        response_payload["paths"][1]["date"] = "2022-01-03"
    elif case == "effective_date":
        response_payload["effective_start_date"] = "2022-01-01"
    elif case == "empty_paths":
        response_payload["paths"] = []
    elif case == "empty_assumptions":
        response_payload["assumptions"] = []
    elif case == "blank_version":
        response_payload["data_version"] = " "
    with pytest.raises(ValidationError):
        SimulationResponse.model_validate(response_payload)


def test_drawdown_can_exceed_100_percent_when_portfolio_goes_negative():
    row = SummaryRow(strategy="unhedged", final_pnl=-120, return_pct=-120, max_drawdown_pct=120)
    assert row.max_drawdown_pct == 120

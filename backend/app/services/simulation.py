"""Assemble simulation results without depending on HTTP request objects."""

import pandas as pd

from app.hedger.assumptions import simulation_assumptions
from app.hedger.data import select_date_range
from app.hedger.hedge import simulate_hedges
from app.hedger.metrics import summarize_paths
from app.schemas.simulation import SimulationRequest


def build_simulation(prices: pd.DataFrame, inputs: SimulationRequest, data_version: str) -> dict:
    selected = select_date_range(prices, inputs.start_date, inputs.end_date)
    paths = simulate_hedges(selected, **inputs.model_dump(exclude={"start_date", "end_date"}))
    summary = summarize_paths(paths)
    modeling_options = inputs.model_dump(exclude={
        "start_date", "end_date", "book_size", "hedge_ratio", "annual_borrow_rate",
    })
    return {
        "paths": paths.reset_index().to_dict("records"),
        "summary": summary.to_dict("records"),
        "effective_start_date": selected.index[0].date(),
        "effective_end_date": selected.index[-1].date(),
        "assumptions": simulation_assumptions(inputs.annual_borrow_rate, selected, **modeling_options),
        "exposures": paths.attrs["exposures"],
        "events": paths.attrs["events"],
        "instrument_returns": paths.attrs["instrument_returns"],
        "data_version": data_version,
    }

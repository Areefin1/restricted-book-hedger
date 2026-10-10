"""Simulation HTTP adapter; calculations remain independent of FastAPI."""

from fastapi import APIRouter, HTTPException, Request

from app.hedger.assumptions import simulation_assumptions
from app.hedger.data import select_date_range
from app.hedger.hedge import simulate_hedges
from app.hedger.metrics import summarize_paths
from app.schemas.simulation import SimulationRequest, SimulationResponse

router = APIRouter(tags=["simulation"])

@router.post("/simulations", response_model=SimulationResponse)
def post_simulation(body: SimulationRequest, request: Request):
    try:
        selected = select_date_range(request.app.state.prices, body.start_date, body.end_date)
        paths = simulate_hedges(selected, **body.model_dump(exclude={"start_date", "end_date"}))
        summary = summarize_paths(paths)
    except ValueError as exc:
        raise HTTPException(422, detail={"code": "INVALID_RANGE", "message": str(exc)}) from exc
    return dict(paths=paths.reset_index().to_dict("records"), summary=summary.to_dict("records"),
                effective_start_date=selected.index[0].date(), effective_end_date=selected.index[-1].date(),
                assumptions=simulation_assumptions(body.annual_borrow_rate, selected, **body.model_dump(exclude={"start_date", "end_date", "book_size", "hedge_ratio", "annual_borrow_rate"})),
                exposures=paths.attrs["exposures"], events=paths.attrs["events"],
                instrument_returns=paths.attrs["instrument_returns"],
                data_version=request.app.state.metadata["data_version"])

"""Simulation HTTP adapter; calculations remain independent of FastAPI."""

from fastapi import APIRouter, HTTPException, Request

from app.schemas.simulation import SimulationRequest, SimulationResponse
from app.services.simulation import build_simulation

router = APIRouter(tags=["simulation"])


@router.post("/simulations", response_model=SimulationResponse)
def post_simulation(body: SimulationRequest, request: Request):
    try:
        return build_simulation(
            request.app.state.prices, body, request.app.state.metadata["data_version"],
        )
    except ValueError as exc:
        raise HTTPException(422, detail={"code": "INVALID_RANGE", "message": str(exc)}) from exc

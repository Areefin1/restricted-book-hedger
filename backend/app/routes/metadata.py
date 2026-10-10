"""Cache coverage, provenance, and validated presets."""

from fastapi import APIRouter, Request

from app.schemas.metadata import MetadataResponse, Scenario

router = APIRouter(tags=["metadata"])

@router.get("/metadata", response_model=MetadataResponse)
def get_metadata(request: Request):
    return request.app.state.metadata


@router.get("/scenarios", response_model=list[Scenario])
def get_scenarios(request: Request):
    return request.app.state.scenarios
    prices = load_prices("data/prices.csv")
    return {
        "first_date": prices.index[0].strftime("%Y-%m-%d"),
        "last_date": prices.index[1].strftime("%Y-%m-%d"),
        "trading_days": len(prices),
    }

"""Research responses precomputed from the worker's immutable cache."""

from fastapi import APIRouter, HTTPException, Query, Request

from app.hedger.convexity import PERMITTED_WINDOWS
from app.schemas.research import ConvexityResponse, SanityResponse

router = APIRouter(tags=["research"])

@router.get("/research/sanity", response_model=SanityResponse)
def get_sanity(request: Request):
    if request.app.state.research_error:
        raise HTTPException(422, detail=request.app.state.research_error)
    return request.app.state.sanity


@router.get("/research/convexity", response_model=ConvexityResponse)
def get_convexity(request: Request, window_days: int = Query(63)):
    if window_days not in PERMITTED_WINDOWS:
        raise HTTPException(422, detail={"code": "INVALID_WINDOW", "message": "window_days must be one of 21, 63, 126"})
    if request.app.state.research_error:
        raise HTTPException(422, detail=request.app.state.research_error)
    return request.app.state.convexity[window_days]

"""Historical search endpoint."""

from fastapi import APIRouter, HTTPException, Request

from app.hedger.recommend import recommend_ratio
from app.schemas.recommendation import RecommendationRequest, RecommendationResponse

router = APIRouter(tags=["recommendation"])

@router.post("/recommendations", response_model=RecommendationResponse)
def post_recommendation(body: RecommendationRequest, request: Request):
    try:
        result = recommend_ratio(request.app.state.prices, **body.model_dump())
    except ValueError as exc:
        raise HTTPException(422, detail={"code": "INVALID_RANGE", "message": str(exc)}) from exc
    return {**result, "data_version": request.app.state.metadata["data_version"]}

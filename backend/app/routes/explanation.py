"""HTTP adapter for grounded simulation explanations and follow-up questions."""

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from google.genai import errors

from app.schemas.explanation import ExplanationRequest, ExplanationResponse
from app.schemas.simulation import SimulationRequest, SimulationResponse
from app.services.explanations import build_explanation_context, explain_simulation
from app.services.simulation import build_simulation
from app.services.chat_view import build_view_context

router = APIRouter(tags=["explanation"])


@router.post("/explanations", response_model=ExplanationResponse)
def post_explanation(body: ExplanationRequest, request: Request):
    settings = request.app.state.settings

    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail={"code": "AI_NOT_CONFIGURED", "message": "Gemini is not configured."},
        )

    if body.view and body.view.data_version and body.view.data_version != request.app.state.metadata['data_version']:
        raise HTTPException(409, detail={'code': 'STALE_DATA', 'message': 'The dataset changed. Refresh the page and try again.'})
    inputs = SimulationRequest.model_validate(body.model_dump(exclude={"question", "history", "view"}))
    try:
        raw_result = build_simulation(
            request.app.state.prices, inputs, request.app.state.metadata["data_version"],
        )
    except ValueError as exc:
        raise HTTPException(422, detail={"code": "INVALID_RANGE", "message": str(exc)}) from exc
    result = SimulationResponse.model_validate(raw_result)
    context = build_explanation_context(inputs, result, request.app.state.metadata)
    if body.view:
        try:
            context['current_view'] = build_view_context(body.view, inputs, result, request.app.state)
            context['scope'] = 'Active page and visible chart range; full-period simulation summary is separately labeled.'
        except ValueError as exc:
            raise HTTPException(422, detail={'code': 'INVALID_VIEW', 'message': str(exc)}) from exc

    try:
        text = explain_simulation(
            jsonable_encoder(context),
            settings,
            question=body.question,
            history=[message.model_dump() for message in body.history],
        )
    except (errors.APIError, httpx.HTTPError, RuntimeError) as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "AI_UNAVAILABLE",
                "message": "Could not generate an explanation. Try again later.",
            },
        ) from exc

    return {
        "explanation": text,
        "data_version": result.data_version,
    }

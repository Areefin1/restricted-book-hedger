from fastapi import APIRouter, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from google.genai import errors
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field

from app.explanations import explain_simulation
from app.routes.simulation import post_simulation
from app.schemas.simulation import SimulationRequest, SimulationResponse

router = APIRouter(tags=["explanation"])


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=12000)


class ExplanationRequest(SimulationRequest):
    question: str = Field(default="Explain these results.", min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=12)


class ExplanationResponse(BaseModel):
    explanation: str
    data_version: str


@router.post("/explanations", response_model=ExplanationResponse)
def post_explanation(body: ExplanationRequest, request: Request):
    settings = request.app.state.settings

    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail={"code": "AI_NOT_CONFIGURED", "message": "Gemini is not configured."},
        )

    inputs = SimulationRequest.model_validate(body.model_dump(exclude={"question", "history"}))
    result = SimulationResponse.model_validate(post_simulation(inputs, request))
    simulation = result.model_dump(mode="json")

    context = {
        "scope": "entire simulation period; no zoom applied",
        "inputs": inputs.model_dump(mode="json"),
        "effective_start_date": simulation["effective_start_date"],
        "effective_end_date": simulation["effective_end_date"],
        "units": {
            "final_pnl": "USD",
            "return_pct": "percentage points",
            "max_drawdown_pct": "positive loss in percentage points",
        },
        "summary": simulation["summary"],
        "events": simulation["events"],
        "assumptions": simulation["assumptions"],
        "data_metadata": request.app.state.metadata,
    }

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
        "data_version": simulation["data_version"],
    }

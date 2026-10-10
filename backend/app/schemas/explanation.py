"""Validated requests and responses for simulation explanations and chat."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.simulation import SimulationRequest


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

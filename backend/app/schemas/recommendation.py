"""Validation for the historical ratio search."""

from datetime import date
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.research import WindowDays
from app.schemas.simulation import Assumption, FiniteNumber, SimulationRequest


class RecommendationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start_date: date
    end_date: date
    instrument: Literal["static_short", "sjb"]
    window_days: WindowDays = 63
    annual_borrow_rate: FiniteNumber = Field(ge=0, le=0.25)

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def calendar_date(cls, value):
        return SimulationRequest.validate_calendar_date(value)

    @model_validator(mode="after")
    def ordered_dates(self) -> Self:
        if self.start_date > self.end_date:
            raise ValueError("Start date must not follow end date")
        return self


class RatioGridRow(BaseModel):
    hedge_ratio: FiniteNumber
    worst_window_return_pct: FiniteNumber
    median_window_return_pct: FiniteNumber
    best_window_return_pct: FiniteNumber


class RecommendationResponse(BaseModel):
    instrument: Literal["static_short", "sjb"]
    objective: str
    recommended_ratio: FiniteNumber
    objective_value_pct: FiniteNumber
    grid: list[RatioGridRow]
    windows_evaluated: int
    in_sample: bool
    effective_start_date: date
    effective_end_date: date
    assumptions: list[Assumption]
    data_version: str

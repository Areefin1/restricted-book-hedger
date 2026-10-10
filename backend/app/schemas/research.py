"""Finite JSON schemas for empirical research."""

from datetime import date
from typing import Literal

from pydantic import BaseModel

from app.schemas.simulation import FiniteNumber

WindowDays = Literal[21, 63, 126]


class DailyReturnPoint(BaseModel):
    date: date
    hyg_return: FiniteNumber
    sjb_return: FiniteNumber


class SanityResponse(BaseModel):
    points: list[DailyReturnPoint]
    beta: FiniteNumber | None
    intercept_daily: FiniteNumber | None
    r_squared: FiniteNumber | None
    correlation: FiniteNumber | None
    observations: int
    notes: list[str]
    data_version: str


class RollingWindowPoint(BaseModel):
    start_date: date
    end_date: date
    hyg_return: FiniteNumber
    sjb_return: FiniteNumber
    hyg_realized_vol: FiniteNumber


class ConvexityResponse(BaseModel):
    window_days: WindowDays
    points: list[RollingWindowPoint]
    notes: list[str]
    data_version: str

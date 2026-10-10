"""Validated API inputs and outputs for historical portfolio simulations."""

from datetime import date as Date
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


StrategyId = Literal["unhedged", "static_short_hedged", "sjb_hedged"]
FiniteNumber = Annotated[float, Field(strict=True, allow_inf_nan=False)]


class _SimulationModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ModelingOptions(_SimulationModel):
    annual_cash_rate: FiniteNumber | None = Field(default=None, gt=-1, le=1)
    funding_spread: FiniteNumber = Field(default=0, ge=0, le=1)
    rebate_spread: FiniteNumber = Field(default=0, ge=0, le=1)
    round_trip_cost_bps: FiniteNumber = Field(default=0, ge=0, le=10000)
    book_beta: FiniteNumber = Field(default=1, ge=0, le=3)
    annual_basis_return: FiniteNumber = Field(default=0, ge=-1, le=1)
    termination_floor: FiniteNumber = Field(default=0, ge=0, le=.99)
    max_hedge_notional: FiniteNumber | None = Field(default=None, gt=0)


class SimulationRequest(ModelingOptions):
    """User choices; dates are calendar dates and rates are decimal fractions."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "book_size": 1000000,
                    "hedge_ratio": 0.6,
                    "start_date": "2022-01-03",
                    "end_date": "2022-12-30",
                    "annual_borrow_rate": 0.02,
                }
            ]
        }
    )

    book_size: FiniteNumber = Field(gt=0, le=50_000_000_000, description="Starting book value in dollars")
    hedge_ratio: FiniteNumber = Field(
        ge=0, le=1, description="Initial hedge exposure / book size; 0.6 means 60%"
    )
    start_date: Date = Field(description="Inclusive requested start date, YYYY-MM-DD")
    end_date: Date = Field(description="Inclusive requested end date, YYYY-MM-DD")
    annual_borrow_rate: FiniteNumber = Field(
        ge=0, le=0.25, description="Annual short-borrow rate; 0.02 means 2%"
    )

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def validate_calendar_date(cls, value: object) -> Date:
        # Reject timestamps and datetime strings rather than truncating them.
        if type(value) is Date:
            return value
        if isinstance(value, str) and len(value) == 10:
            try:
                parsed = Date.fromisoformat(value)
            except ValueError:
                pass
            else:
                if parsed.isoformat() == value:
                    return parsed
        raise ValueError("Dates must be calendar dates in YYYY-MM-DD format")

    @model_validator(mode="after")
    def validate_date_order(self) -> Self:
        if self.start_date > self.end_date:
            raise ValueError("Start date must not follow end date")
        return self


class PathPoint(_SimulationModel):
    """Total values and cumulative portfolio P/L in dollars on a trading date."""

    date: Date
    unhedged: FiniteNumber
    static_short_hedged: FiniteNumber
    sjb_hedged: FiniteNumber
    unhedged_pnl: FiniteNumber
    static_short_hedged_pnl: FiniteNumber
    sjb_hedged_pnl: FiniteNumber


class SummaryRow(_SimulationModel):
    """Performance metrics; *_pct fields use percentage points (5.0 = 5%)."""

    strategy: StrategyId
    final_pnl: FiniteNumber = Field(description="Final profit/loss in dollars")
    return_pct: FiniteNumber = Field(description="Return in percentage points")
    max_drawdown_pct: FiniteNumber = Field(
        ge=0, description="Nonnegative peak-to-trough loss in percentage points"
    )


class Assumption(_SimulationModel):
    """A modeling or cost convention displayed alongside the results."""

    label: str = Field(min_length=1)
    detail: str = Field(min_length=1)


class ExposurePoint(_SimulationModel):
    date: Date
    static_short_ratio: FiniteNumber | None
    sjb_ratio: FiniteNumber | None


class TerminationEvent(_SimulationModel):
    date: Date
    strategy: StrategyId
    reason: str


class InstrumentReturn(_SimulationModel):
    date: Date
    hyg_return: FiniteNumber
    sjb_return: FiniteNumber


class SimulationResponse(_SimulationModel):
    """Complete results returned by POST /api/simulations."""

    paths: list[PathPoint] = Field(min_length=2)
    summary: list[SummaryRow] = Field(min_length=3, max_length=3)
    effective_start_date: Date
    effective_end_date: Date
    assumptions: list[Assumption] = Field(min_length=1)
    data_version: str = Field(min_length=1)
    exposures: list[ExposurePoint] = Field(default_factory=list)
    events: list[TerminationEvent] = Field(default_factory=list)
    instrument_returns: list[InstrumentReturn] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_result_structure(self) -> Self:
        dates = [point.date for point in self.paths]
        if any(previous >= current for previous, current in zip(dates, dates[1:])):
            raise ValueError("Path dates must be sorted and unique")
        if self.effective_start_date != dates[0] or self.effective_end_date != dates[-1]:
            raise ValueError("Effective dates must match the first and last path dates")
        if len({row.strategy for row in self.summary}) != 3:
            raise ValueError("Summary must contain each strategy exactly once")
        return self

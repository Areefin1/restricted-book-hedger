"""Public cache and preset schemas."""

from datetime import date

from pydantic import BaseModel


class Features(BaseModel):
    recommendation: bool


class MetadataResponse(BaseModel):
    first_date: date
    last_date: date
    trading_days: int
    data_version: str
    sha256: str
    provenance: str
    retrieved_at: str | None
    source: str
    adjustment: str
    is_synthetic: bool
    features: Features
    notes: list[str]


class Scenario(BaseModel):
    id: str
    name: str
    start_date: date
    end_date: date
    rule: str

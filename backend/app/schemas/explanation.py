"""Validated requests and responses for simulation explanations and chat."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.simulation import FiniteNumber, SimulationRequest

ChartId = Literal['portfolio', 'drawdown', 'exposure', 'max-drawdown', 'mechanics', 'daily', 'convexity', 'volatility', 'ratio-search']
AxisValue = FiniteNumber | Annotated[str, Field(max_length=40)]


class ChartViewport(BaseModel):
    model_config = ConfigDict(extra='forbid')
    chart: ChartId
    x_range: tuple[AxisValue, AxisValue] | None = None
    y_range: tuple[AxisValue, AxisValue] | None = None
    y2_range: tuple[AxisValue, AxisValue] | None = None
    hidden_series: list[Annotated[str, Field(max_length=80)]] = Field(default_factory=list, max_length=12)


class ChatView(BaseModel):
    model_config = ConfigDict(extra='forbid')
    page: Literal['simulator', 'risk', 'strategies', 'research', 'recommendation', 'assumptions'] = 'simulator'
    window_days: Literal[21, 63, 126] = 63
    instrument: Literal['sjb', 'static_short'] = 'sjb'
    chart_mode: Literal['value', 'pnl', 'return'] = 'value'
    example: Literal['choppy', 'down', 'up'] = 'choppy'
    charts: list[ChartViewport] = Field(default_factory=list, max_length=9)
    data_version: str | None = Field(default=None, max_length=100)


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=12000)


class ExplanationRequest(SimulationRequest):
    question: str = Field(default="Explain these results.", min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=12)
    view: ChatView | None = None


class ExplanationResponse(BaseModel):
    explanation: str
    data_version: str

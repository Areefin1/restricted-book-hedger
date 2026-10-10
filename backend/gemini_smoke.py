import json

import httpx
from google import genai

from app.config import Settings
from app.explanations import explain_simulation


settings = Settings()

if not settings.gemini_api_key:
    raise SystemExit("GEMINI_API_KEY is missing.")


simulation_inputs = {
    "book_size": 1_000_000,
    "hedge_ratio": 0.6,
    "start_date": "2022-01-03",
    "end_date": "2022-12-30",
    "annual_borrow_rate": 0.02,
}


with httpx.Client(
    base_url="http://127.0.0.1:8000",
    timeout=30,
) as backend:
    simulation_response = backend.post(
        "/api/simulations",
        json=simulation_inputs,
    )
    simulation_response.raise_for_status()
    simulation = simulation_response.json()

    metadata_response = backend.get("/api/metadata")
    metadata_response.raise_for_status()
    metadata = metadata_response.json()

context = {
    "scope": "entire simulation period; no zoom applied",
    "inputs": simulation_inputs,
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
    "data_metadata": metadata,
}


explanation = explain_simulation(context, settings)
print(explanation)
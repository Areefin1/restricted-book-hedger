"""Explain a local backend simulation with Gemini; explicitly makes a live API call."""

import argparse
from pathlib import Path
import sys

import httpx

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.config import Settings
from app.schemas.simulation import SimulationRequest, SimulationResponse
from app.services.explanations import build_explanation_context, explain_simulation


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    settings = Settings()
    if not settings.gemini_api_key:
        raise SystemExit("GEMINI_API_KEY is missing.")

    inputs = SimulationRequest(
        book_size=1_000_000, hedge_ratio=0.6,
        start_date="2022-01-03", end_date="2022-12-30", annual_borrow_rate=0.02,
    )
    with httpx.Client(base_url=args.base_url, timeout=30) as backend:
        response = backend.post("/api/simulations", json=inputs.model_dump(mode="json"))
        response.raise_for_status()
        simulation = SimulationResponse.model_validate(response.json())
        response = backend.get("/api/metadata")
        response.raise_for_status()
        metadata = response.json()

    context = build_explanation_context(inputs, simulation, metadata)
    print(explain_simulation(context, settings))


if __name__ == "__main__":
    main()

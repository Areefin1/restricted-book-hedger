"""List models supporting content generation for the configured Gemini key."""

import argparse
from pathlib import Path
import sys

from google import genai

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.config import Settings


def main() -> None:
    argparse.ArgumentParser(description=__doc__).parse_args()
    settings = Settings()
    if not settings.gemini_api_key:
        raise SystemExit("GEMINI_API_KEY is missing.")
    with genai.Client(api_key=settings.gemini_api_key.get_secret_value()) as client:
        for model in client.models.list():
            if "generateContent" in (model.supported_actions or []):
                print(model.name)


if __name__ == "__main__":
    main()

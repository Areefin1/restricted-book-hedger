from google import genai

from app.config import Settings


settings = Settings()

if not settings.gemini_api_key:
    raise SystemExit("GEMINI_API_KEY is missing.")

with genai.Client(
    api_key=settings.gemini_api_key.get_secret_value()
) as client:
    for model in client.models.list():
        actions = model.supported_actions or []

        if "generateContent" in actions:
            print(model.name)
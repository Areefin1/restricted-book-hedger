"""Backend settings loaded from environment variables and backend/.env."""

from pathlib import Path
from urllib.parse import urlsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    """Environment variables override .env values; defaults support local use."""

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Restricted Book Hedger"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    prices_path: Path = Path("data/prices.csv")
    metadata_path: Path = Path("data/metadata.json")

    @field_validator("prices_path", "metadata_path", mode="before")
    @classmethod
    def resolve_cache_path(cls, value: str | Path) -> Path:
        if not isinstance(value, (str, Path)) or (
            isinstance(value, str) and not value.strip()
        ):
            raise ValueError("Cache paths must not be empty")
        path = Path(value).expanduser()
        if not path.is_absolute():
            path = BACKEND_DIR / path
        return path.resolve()

    @field_validator("cors_origins")
    @classmethod
    def validate_origins(cls, value: str) -> str:
        origins = []
        for origin in value.split(","):
            origin = origin.strip()
            if not origin:
                continue
            try:
                parsed = urlsplit(origin)
                parsed.port  # Validate an explicitly supplied port.
                valid = (
                    parsed.scheme in {"http", "https"}
                    and parsed.hostname is not None
                    and parsed.username is None
                    and parsed.password is None
                    and parsed.path in {"", "/"}
                    and not parsed.query
                    and not parsed.fragment
                    and not any(character.isspace() for character in origin)
                )
            except ValueError:
                valid = False
            if not valid:
                raise ValueError(
                    "CORS_ORIGINS must contain comma-separated HTTP(S) origins "
                    "without credentials, paths, queries, or fragments"
                )
            normalized = origin.rstrip("/")
            if normalized not in origins:
                origins.append(normalized)
        return ",".join(origins)

    @property
    def allowed_origins(self) -> list[str]:
        """An empty CORS_ORIGINS setting disables cross-origin browser access."""
        return self.cors_origins.split(",") if self.cors_origins else []

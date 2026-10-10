"""Verify environment settings, stable paths, and frontend origins."""

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.config import BACKEND_DIR, Settings


@pytest.fixture(autouse=True)
def clear_settings_environment(monkeypatch):
    for key in ("APP_NAME", "CORS_ORIGINS", "PRICES_PATH", "METADATA_PATH"):
        monkeypatch.delenv(key, raising=False)


def test_defaults_are_independent_of_working_directory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    settings = Settings(_env_file=None)
    assert settings.prices_path == BACKEND_DIR / "data" / "prices.csv"
    assert settings.metadata_path == BACKEND_DIR / "data" / "metadata.json"
    assert settings.allowed_origins == ["http://localhost:5173", "http://127.0.0.1:5173"]


def test_environment_overrides_dotenv_file(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "APP_NAME=Fixture API\nPRICES_PATH=data/fixture.csv\n"
        "CORS_ORIGINS=https://example.com/\nMETADATA_PATH=data/fixture.json\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("APP_NAME", "Environment API")
    settings = Settings(_env_file=env_file)
    assert settings.app_name == "Environment API"
    assert settings.prices_path == BACKEND_DIR / "data" / "fixture.csv"
    assert settings.metadata_path == BACKEND_DIR / "data" / "fixture.json"
    assert settings.allowed_origins == ["https://example.com"]


def test_absolute_cache_paths_are_preserved(tmp_path):
    settings = Settings(_env_file=None, prices_path=tmp_path / "prices.csv")
    assert settings.prices_path == (tmp_path / "prices.csv").resolve()
    assert isinstance(settings.prices_path, Path)


def test_origins_are_trimmed_and_deduplicated():
    settings = Settings(
        _env_file=None, cors_origins=" https://example.com/ ,http://localhost:5173,https://example.com "
    )
    assert settings.allowed_origins == ["https://example.com", "http://localhost:5173"]
    assert Settings(_env_file=None, cors_origins="").allowed_origins == []


@pytest.mark.parametrize(
    "origin",
    ["*", "localhost:5173", "ftp://example.com", "https://example.com/path",
     "https://example.com?query=1", "https://user:pass@example.com",
     "http://localhost:invalid", "http://local host:5173"],
)
def test_rejects_invalid_origins(origin):
    with pytest.raises(ValidationError, match="CORS_ORIGINS"):
        Settings(_env_file=None, cors_origins=origin)


@pytest.mark.parametrize("field", ["prices_path", "metadata_path"])
def test_rejects_empty_cache_paths(field):
    with pytest.raises(ValidationError, match="must not be empty"):
        Settings(_env_file=None, **{field: ""})

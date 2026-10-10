"""Check startup cache loading, browser access, and shared error responses."""

import pandas as pd
import pytest
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient

import app.main as main
from app.config import Settings


@pytest.fixture
def application(tmp_path):
    cache = tmp_path / "prices.csv"
    cache.write_text("date,hyg,sjb\n2022-01-03,100,50\n2022-01-04,99,51\n", encoding="utf-8")
    settings = Settings(
        _env_file=None, prices_path=cache, cors_origins="http://localhost:5173"
    )
    return main.create_app(settings)


def test_cache_loads_once_at_startup_and_health_works(application, monkeypatch):
    calls = []
    original_loader = main.load_prices

    def counted_loader(path):
        calls.append(path)
        return original_loader(path)

    monkeypatch.setattr(main, "load_prices", counted_loader)
    assert application.state.prices is None
    with TestClient(application) as client:
        assert client.get("/api/health").json() == {"status": "ok"}
        assert client.get("/api/health").status_code == 200
        assert len(calls) == 1
        assert list(application.state.prices.columns) == ["hyg", "sjb"]
        assert isinstance(application.state.prices.index, pd.DatetimeIndex)
        assert "/api/health" in client.get("/openapi.json").json()["paths"]
    assert application.state.prices is None


@pytest.mark.parametrize("content", [None, "date,hyg,sjb\n2022-01-03,-1,50\n"])
def test_missing_or_invalid_cache_stops_startup(tmp_path, content):
    cache = tmp_path / "prices.csv"
    if content is not None:
        cache.write_text(content, encoding="utf-8")
    application = main.create_app(Settings(_env_file=None, prices_path=cache))
    with pytest.raises(RuntimeError, match="Unable to load price cache"):
        with TestClient(application):
            pass


def test_cors_preflight_accepts_configured_origin(application):
    with TestClient(application) as client:
        response = client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
        denied = client.get("/api/health", headers={"Origin": "https://unlisted.example"})
        assert "access-control-allow-origin" not in denied.headers


def test_unknown_route_and_method_use_error_contract(application):
    with TestClient(application) as client:
        response = client.get("/api/missing")
        assert response.status_code == 404
        assert response.json() == {"error": {"code": "NOT_FOUND", "message": "Not Found"}}
        response = client.post("/api/health")
        assert response.status_code == 405
        assert response.json()["error"]["code"] == "METHOD_NOT_ALLOWED"
        assert "GET" in response.headers["allow"]


def test_validation_errors_are_normalized(application):
    @application.get("/test/validation")
    def validation_endpoint(count: int):
        return {"count": count}

    with TestClient(application) as client:
        response = client.get("/test/validation?count=invalid")
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"
        assert "query.count" in response.json()["error"]["message"]


def test_structured_http_errors_preserve_code_message_and_headers(application):
    @application.get("/test/http-error")
    def http_error_endpoint():
        raise HTTPException(
            status_code=401,
            detail={"code": "AUTH_REQUIRED", "message": "Authentication required"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    with TestClient(application) as client:
        response = client.get("/test/http-error")
        assert response.status_code == 401
        assert response.headers["www-authenticate"] == "Bearer"
        assert response.json() == {
            "error": {"code": "AUTH_REQUIRED", "message": "Authentication required"}
        }


def test_unexpected_errors_have_cors_and_do_not_expose_exception(application):
    @application.get("/test/crash")
    def crash_endpoint(request: Request):
        raise RuntimeError("Internal implementation detail")

    with TestClient(application) as client:
        response = client.get("/test/crash", headers={"Origin": "http://localhost:5173"})
        assert response.status_code == 500
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
        assert response.json() == {
            "error": {"code": "INTERNAL_ERROR", "message": "An unexpected server error occurred"}
        }

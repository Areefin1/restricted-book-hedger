"""FastAPI entry point, shared cache lifecycle, CORS, and API errors."""

import logging
from contextlib import asynccontextmanager
from http import HTTPStatus
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException

from app.config import Settings
from app.hedger.data import load_prices
from app.hedger.convexity import PERMITTED_WINDOWS, calculate_rolling_windows, window_notes
from app.hedger.provenance import cache_metadata
from app.hedger.sanity import run_sanity_check
from app.hedger.scenarios import build_scenarios
from app.routes import explanation, health, metadata, recommendation, research, simulation


logger = logging.getLogger(__name__)


def _error_response(
    status_code: int, code: str, message: str, headers: dict[str, str] | None = None
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}},
        headers=headers,
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build an app; tests can supply settings pointing to a fixture cache."""
    settings = settings if settings is not None else Settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        # Read local data once per worker, not at import or inside each request.
        try:
            application.state.prices = load_prices(settings.prices_path)
        except (OSError, ValueError) as exc:
            raise RuntimeError(
                f"Unable to load price cache at {settings.prices_path}: {exc}"
            ) from exc
        logger.info("Loaded %d price observations", len(application.state.prices))
        prices = application.state.prices
        if len(prices) < 2:
            raise RuntimeError("Price cache requires at least two observations")
        application.state.metadata = cache_metadata(settings.prices_path, settings.metadata_path, prices)
        version = application.state.metadata["data_version"]
        application.state.scenarios = build_scenarios(prices)
        application.state.research_error = None
        try:
            from app.hedger.funding import cash_note
            application.state.sanity = {**run_sanity_check(prices), "data_version": version}
            application.state.convexity = {
                window: dict(window_days=window, points=calculate_rolling_windows(prices, window).to_dict("records"),
                             notes=window_notes(window) + [cash_note(prices)], data_version=version)
                for window in PERMITTED_WINDOWS
            }
        except ValueError as exc:
            # A price-only cache still supports health, metadata, and simulations
            # with an explicit cash assumption. Research must never assume zero.
            application.state.research_error = str(exc)
        try:
            yield
        finally:
            application.state.prices = None

    application = FastAPI(title=settings.app_name, lifespan=lifespan)
    application.state.settings = settings
    application.state.prices = None

    # Keep unexpected errors inside CORS so the browser can read their JSON.
    @application.middleware("http")
    async def handle_unexpected_errors(request: Request, call_next):
        try:
            return await call_next(request)
        except Exception:
            logger.exception("Unhandled API error for %s", request.url.path)
            return _error_response(
                500, "INTERNAL_ERROR", "An unexpected server error occurred"
            )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError):
        message = "; ".join(
            f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
            for error in exc.errors()
        )
        return _error_response(422, "VALIDATION_ERROR", message or "Invalid request")

    @application.exception_handler(HTTPException)
    async def handle_http_error(request: Request, exc: HTTPException):
        # Future routes may supply detail={"code": ..., "message": ...}.
        if isinstance(exc.detail, dict) and all(
            isinstance(exc.detail.get(key), str) for key in ("code", "message")
        ):
            code = exc.detail["code"]
            message = exc.detail["message"]
        else:
            try:
                status = HTTPStatus(exc.status_code)
                code = status.name
                fallback = status.phrase
            except ValueError:
                code, fallback = "HTTP_ERROR", "Request failed"
            message = exc.detail if isinstance(exc.detail, str) else fallback
        return _error_response(exc.status_code, code, message, exc.headers)

    for router in (
        health.router,
        metadata.router,
        simulation.router,
        research.router,
        recommendation.router,
        explanation.router,
    ):
        application.include_router(router, prefix="/api")
    # Only known frontend paths are served; never swallow API 404/405 responses.
    frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    if (frontend_dist / "index.html").is_file():
        application.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

        @application.get("/", include_in_schema=False)
        def frontend_index():
            return FileResponse(frontend_dist / "index.html")

        @application.get("/favicon.svg", include_in_schema=False)
        def favicon():
            return FileResponse(frontend_dist / "favicon.svg", media_type="image/svg+xml")
    return application


app = create_app()

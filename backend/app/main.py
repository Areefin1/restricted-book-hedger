from fastapi import FastAPI
from app.routes import health

app = FastAPI(title = "Restricted Book Hedger")

app.include_router(health.router, prefix="/api")
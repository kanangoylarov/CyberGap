from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.controllers import stats_controller, fingerprint_controller, log_controller, ws_controller
from app.utils.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logging.getLogger(__name__).info("Admin API starting up")
    yield
    logging.getLogger(__name__).info("Admin API shutting down")


app = FastAPI(
    title="Admin API",
    description="Read-only admin API for monitoring the honeypot security system",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stats_controller.router)
app.include_router(fingerprint_controller.router)
app.include_router(log_controller.router)
app.include_router(ws_controller.router)


@app.get("/health")
async def health():
    return {"status": "ok"}

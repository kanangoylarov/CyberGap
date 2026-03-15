import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.controllers.cart_controller import router as cart_router
from app.controllers.order_controller import router as order_router
from app.controllers.product_controller import router as product_router
from app.core.database import async_session, engine
from app.utils.logging import setup_logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("Application starting up")
    yield
    logger.info("Application shutting down")
    await engine.dispose()


app = FastAPI(
    title="Store API",
    description="E-commerce store backend API",
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

app.include_router(product_router)
app.include_router(cart_router)
app.include_router(order_router)


@app.get("/health")
async def health_check():
    """Health check endpoint that verifies database connectivity."""
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as exc:
        logger.error("Health check failed: %s", str(exc))
        return {"status": "unhealthy", "database": "disconnected", "error": str(exc)}

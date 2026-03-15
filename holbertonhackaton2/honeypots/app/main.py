from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.repositories.dummy_data_repository import DummyDataRepository
from app.services.dummy_store_service import DummyStoreService
from app.services.forensic_logger_service import ForensicLoggerService
from app.services.behavior import get_behavior
from app.controllers import product_controller, cart_controller, order_controller
from app.middleware.forensic_middleware import ForensicMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize services and attach them to app.state
    repo = DummyDataRepository()
    behavior = get_behavior(settings.HONEYPOT_TYPE)
    app.state.store_service = DummyStoreService(repo, behavior)
    app.state.behavior = behavior
    app.state.forensic_logger = ForensicLoggerService()
    yield


app = FastAPI(title="Store API", version="1.0.0", lifespan=lifespan)

# CORS — wide open so the honeypot looks like a real permissive store API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Standard store routes (same endpoints as the real store-backend)
app.include_router(product_controller.router)
app.include_router(cart_controller.router)
app.include_router(order_controller.router)

# Add behavior-specific bait routes.
# We eagerly create the behavior at module level so we can register its
# extra router before the app starts accepting requests.
_behavior = get_behavior(settings.HONEYPOT_TYPE)
_extra_router = _behavior.get_extra_router()
if _extra_router:
    app.include_router(_extra_router)

# Forensic middleware — captures every request/response for analysis
app.add_middleware(ForensicMiddleware, forensic_logger=ForensicLoggerService())


@app.get("/health")
async def health():
    return {"status": "healthy", "honeypot_type": settings.HONEYPOT_TYPE}

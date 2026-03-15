from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.database import init_db, close_db, async_session_factory
from app.core.redis import init_redis, close_redis, get_redis
from app.repositories.redis_repository import RedisRepository
from app.repositories.log_repository import LogRepository
from app.services.fingerprint_service import FingerprintService
from app.services.feature_extractor_service import FeatureExtractorService
from app.services.classifier_client_service import ClassifierClientService
from app.services.routing_service import RoutingService
from app.services.proxy_service import ProxyService
from app.controllers import health_controller, proxy_controller
from app.middleware.request_interceptor import RequestInterceptorMiddleware
from app.utils.logging import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Gateway starting up...")
    await init_redis()
    redis = get_redis()
    logger.info("Redis connected")
    await init_db()
    logger.info("Database initialized")

    redis_repo = RedisRepository(redis)
    log_repo = LogRepository(async_session_factory)
    fingerprint_svc = FingerprintService()
    feature_extractor_svc = FeatureExtractorService(redis_repo)
    classifier_client_svc = ClassifierClientService(settings.AI_CLASSIFIER_URL)
    routing_svc = RoutingService(
        fingerprint_svc,
        feature_extractor_svc,
        classifier_client_svc,
        redis_repo,
        log_repo,
        settings,
    )
    proxy_svc = ProxyService()
    proxy_controller.init_services(routing_svc, proxy_svc)

    logger.info("Gateway ready")
    yield
    logger.info("Gateway shutting down...")
    await close_redis()
    await close_db()


app = FastAPI(title="AI Security Gateway", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestInterceptorMiddleware)
app.include_router(health_controller.router)
app.include_router(proxy_controller.router)  # catch-all LAST

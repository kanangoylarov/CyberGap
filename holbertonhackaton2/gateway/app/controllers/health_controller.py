from fastapi import APIRouter
from app.core.redis import get_redis
from app.utils.logging import logger

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    try:
        redis = get_redis()
        await redis.ping()
        return {"status": "healthy", "redis": "connected"}
    except Exception:
        return {"status": "degraded", "redis": "disconnected"}

from typing import Optional

import redis.asyncio as aioredis

from app.config import settings

redis_pool: Optional[aioredis.Redis] = None


async def init_redis() -> None:
    """Create the global Redis connection."""
    global redis_pool
    redis_pool = aioredis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        decode_responses=True,
        socket_connect_timeout=5,
        retry_on_timeout=True,
    )


async def close_redis() -> None:
    """Close the global Redis connection."""
    global redis_pool
    if redis_pool is not None:
        await redis_pool.close()
        redis_pool = None


def get_redis() -> aioredis.Redis:
    """Return the current Redis connection. Raises if not initialised."""
    if redis_pool is None:
        raise RuntimeError("Redis pool is not initialised. Call init_redis() first.")
    return redis_pool

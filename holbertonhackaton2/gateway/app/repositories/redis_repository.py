from typing import Optional

import redis.asyncio as aioredis


class RedisRepository:
    """Thin wrapper around Redis for fingerprint caching, connection counters, and rate limiting."""

    def __init__(self, redis: aioredis.Redis) -> None:
        self._redis = redis

    # ---- fingerprint classification cache ----

    async def get_fingerprint_classification(self, fingerprint: str) -> Optional[int]:
        """Return cached attack_type for the fingerprint, or None if not cached."""
        value = await self._redis.get(f"fp:{fingerprint}")
        if value is not None:
            return int(value)
        return None

    async def set_fingerprint_classification(
        self, fingerprint: str, attack_type: int, ttl: int = 3600
    ) -> None:
        """Cache the classification result for a fingerprint with a TTL."""
        await self._redis.setex(f"fp:{fingerprint}", ttl, attack_type)

    # ---- connection counters (ct_* features) ----

    async def increment_connection_counter(
        self, key_type: str, *parts: str, ttl: int = 300
    ) -> int:
        """Atomically increment a connection counter and set expiry.

        Key format: ct:{key_type}:{part1}:{part2}:...
        Returns the new count after incrementing.
        """
        key = f"ct:{key_type}:{':'.join(parts)}"
        async with self._redis.pipeline(transaction=True) as pipe:
            pipe.incr(key)
            pipe.expire(key, ttl)
            results = await pipe.execute()
        return int(results[0])

    async def get_connection_counter(self, key_type: str, *parts: str) -> int:
        """Read the current value of a connection counter (0 if missing)."""
        key = f"ct:{key_type}:{':'.join(parts)}"
        value = await self._redis.get(key)
        if value is not None:
            return int(value)
        return 0

    # ---- rate limiting ----

    async def increment_rate(self, source_ip: str, ttl: int = 60) -> int:
        """Increment request count for a source IP within a sliding window.

        Key format: rate:{source_ip}
        Returns the new count after incrementing.
        """
        key = f"rate:{source_ip}"
        async with self._redis.pipeline(transaction=True) as pipe:
            pipe.incr(key)
            pipe.expire(key, ttl)
            results = await pipe.execute()
        return int(results[0])

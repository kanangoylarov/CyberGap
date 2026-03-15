import asyncio
import logging
import random
from typing import Optional

from fastapi import Request

from app.services.behavior.base import BaseBehavior

logger = logging.getLogger("honeypot.dos")


class DosBehavior(BaseBehavior):
    def get_type_name(self) -> str:
        return "dos"

    async def pre_response_hook(self, request: Request) -> Optional[dict]:
        delay = random.uniform(1.0, 5.0)
        source_ip = request.client.host if request.client else "unknown"
        logger.info(
            "Tarpitting request from %s for %.1f seconds (path=%s)",
            source_ip,
            delay,
            request.url.path,
        )
        await asyncio.sleep(delay)
        return None

    def modify_headers(self, headers: dict) -> dict:
        headers["Server"] = "Apache/2.4.41 (Ubuntu)"
        headers["X-Powered-By"] = "PHP/7.4.3"
        headers["Retry-After"] = str(random.randint(5, 30))
        return headers

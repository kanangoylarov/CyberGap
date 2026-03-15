import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from app.utils.logging import logger


class RequestInterceptorMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        latency_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "request_processed",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "latency_ms": round(latency_ms, 2),
                "client_ip": request.client.host if request.client else "unknown",
            },
        )
        response.headers["X-Process-Time"] = f"{latency_ms:.2f}ms"
        return response

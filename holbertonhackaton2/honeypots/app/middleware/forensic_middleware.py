import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response as StarletteResponse

from app.services.forensic_logger_service import ForensicLoggerService


class ForensicMiddleware(BaseHTTPMiddleware):
    """ASGI middleware that captures every request/response for forensic logging."""

    def __init__(self, app, forensic_logger: ForensicLoggerService):
        super().__init__(app)
        self._logger = forensic_logger

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()

        # Cache request body so downstream handlers can still read it
        body = await request.body()

        # Call the actual handler
        response = await call_next(request)

        latency_ms = (time.perf_counter() - start) * 1000

        # Read response body from the streaming iterator
        response_body = b""
        async for chunk in response.body_iterator:
            response_body += chunk if isinstance(chunk, bytes) else chunk.encode()

        # Log forensically
        await self._logger.log_request(
            request,
            body,
            response.status_code,
            response_body.decode("utf-8", errors="replace"),
            latency_ms,
        )

        # Modify headers via behavior (e.g. fake Server / X-Powered-By)
        behavior = request.app.state.behavior
        headers = dict(response.headers)
        headers = behavior.modify_headers(headers)

        # Return new response with modified headers and captured body
        return StarletteResponse(
            content=response_body,
            status_code=response.status_code,
            headers=headers,
            media_type=response.media_type,
        )

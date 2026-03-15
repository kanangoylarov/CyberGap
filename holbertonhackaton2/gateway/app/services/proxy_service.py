import httpx
from fastapi import Request
from fastapi.responses import Response

from app.core.constants import HOP_BY_HOP_HEADERS
from app.utils.logging import logger


class ProxyService:
    """Transparently proxies HTTP requests to an upstream server."""

    async def forward_request(
        self,
        request: Request,
        upstream_host: str,
        upstream_port: int,
    ) -> Response:
        """Forward the incoming request to the specified upstream and return its response."""
        # Build the upstream URL preserving path and query string
        path = request.url.path
        query = request.url.query
        url = f"http://{upstream_host}:{upstream_port}{path}"
        if query:
            url = f"{url}?{query}"

        # Read the request body
        body = await request.body()

        # Build forwarded headers, filtering out hop-by-hop headers
        raw_headers = dict(request.headers)
        headers = self._filter_hop_by_hop(raw_headers)

        # Remove the Host header so httpx sets it correctly for the upstream
        headers.pop("host", None)

        # Add standard proxy headers
        client_ip = (
            request.client.host if request.client else "0.0.0.0"
        )
        existing_forwarded = request.headers.get("x-forwarded-for")
        if existing_forwarded:
            headers["x-forwarded-for"] = f"{existing_forwarded}, {client_ip}"
        else:
            headers["x-forwarded-for"] = client_ip

        headers["x-real-ip"] = client_ip

        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                upstream_response = await client.request(
                    method=request.method,
                    url=url,
                    headers=headers,
                    content=body,
                )

            # Filter hop-by-hop headers from the upstream response
            response_headers = self._filter_hop_by_hop(
                dict(upstream_response.headers)
            )

            return Response(
                content=upstream_response.content,
                status_code=upstream_response.status_code,
                headers=response_headers,
            )

        except httpx.TimeoutException:
            logger.warning(
                "Upstream timeout: %s:%d%s", upstream_host, upstream_port, path
            )
            return Response(
                content='{"detail": "Gateway Timeout"}',
                status_code=504,
                media_type="application/json",
            )

        except httpx.ConnectError:
            logger.error(
                "Upstream connection refused: %s:%d%s",
                upstream_host,
                upstream_port,
                path,
            )
            return Response(
                content='{"detail": "Bad Gateway"}',
                status_code=502,
                media_type="application/json",
            )

        except Exception as e:
            logger.error(
                "Proxy error forwarding to %s:%d%s: %s",
                upstream_host,
                upstream_port,
                path,
                e,
            )
            return Response(
                content='{"detail": "Internal Server Error"}',
                status_code=500,
                media_type="application/json",
            )

    @staticmethod
    def _filter_hop_by_hop(headers: dict) -> dict:
        """Remove hop-by-hop headers that must not be forwarded between proxies."""
        return {
            k: v
            for k, v in headers.items()
            if k.lower() not in HOP_BY_HOP_HEADERS
        }

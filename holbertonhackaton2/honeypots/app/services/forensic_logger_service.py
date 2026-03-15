import json
import logging
from datetime import datetime, timezone
from fastapi import Request
from app.config import settings

logger = logging.getLogger("honeypot.forensic")


class ForensicLoggerService:
    def __init__(self):
        self._honeypot_type = settings.HONEYPOT_TYPE

    async def log_request(
        self,
        request: Request,
        request_body: bytes,
        response_status: int,
        response_body: str,
        latency_ms: float,
    ) -> None:
        source_ip = request.client.host if request.client else "unknown"
        headers_dict = dict(request.headers)
        query_params = dict(request.query_params)
        body_str = request_body[:10240].decode("utf-8", errors="replace")
        if len(request_body) > 10240:
            body_str += "[TRUNCATED]"
        log_entry = {
            "event": "honeypot_interaction",
            "honeypot_type": self._honeypot_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source_ip": source_ip,
            "method": request.method,
            "path": str(request.url.path),
            "headers": headers_dict,
            "query_params": query_params,
            "body": body_str,
            "body_size": len(request_body),
            "response_status": response_status,
            "response_body_preview": response_body[:500],
            "latency_ms": round(latency_ms, 1),
        }
        logger.info(json.dumps(log_entry))

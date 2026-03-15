import hashlib
import math
import re
from collections import Counter

from fastapi import Request

from app.models.schemas import RequestSignature


class FingerprintService:
    """Computes a deterministic fingerprint from HTTP request attributes."""

    def compute_fingerprint(self, signature: RequestSignature) -> str:
        """SHA-256 hash of concatenated normalized request attributes."""
        parts = [
            signature.source_ip,
            signature.user_agent,
            signature.accept_language,
            signature.accept_encoding,
            "|".join(sorted(signature.header_order)),
            signature.request_method,
            signature.path_pattern,
            "|".join(sorted(signature.query_param_keys)),
            signature.content_type or "",
            f"{signature.body_entropy:.4f}",
            str(signature.content_length),
        ]
        canonical = "|".join(parts)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    async def extract_signature(self, request: Request) -> RequestSignature:
        """Extract all fingerprint attributes from a FastAPI Request."""
        # source_ip: X-Forwarded-For (first entry), X-Real-IP, client.host, fallback
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            source_ip = forwarded_for.split(",")[0].strip()
        elif request.headers.get("x-real-ip"):
            source_ip = request.headers["x-real-ip"].strip()
        elif request.client:
            source_ip = request.client.host
        else:
            source_ip = "0.0.0.0"

        # user_agent: lowercased
        user_agent = (request.headers.get("user-agent") or "").lower()

        # Accept headers
        accept_language = request.headers.get("accept-language", "")
        accept_encoding = request.headers.get("accept-encoding", "")

        # header_order: list of lowercased header names in arrival order
        header_order = [k.lower() for k in request.headers.keys()]

        # Request method (uppercased)
        request_method = request.method.upper()

        # Path pattern: normalize numeric and UUID segments
        path_pattern = self._normalize_path(request.url.path)

        # Query parameter keys (sorted)
        query_param_keys = sorted(request.query_params.keys())

        # Content-Type header
        content_type = request.headers.get("content-type")

        # Body
        body = await request.body()
        body_entropy = self._compute_entropy(body)
        content_length = len(body)

        return RequestSignature(
            source_ip=source_ip,
            user_agent=user_agent,
            accept_language=accept_language,
            accept_encoding=accept_encoding,
            header_order=header_order,
            request_method=request_method,
            path_pattern=path_pattern,
            query_param_keys=query_param_keys,
            content_type=content_type,
            body_entropy=body_entropy,
            content_length=content_length,
        )

    @staticmethod
    def _compute_entropy(data: bytes) -> float:
        """Shannon entropy of byte data. Returns 0.0 for empty."""
        if not data:
            return 0.0
        counter = Counter(data)
        length = len(data)
        entropy = -sum(
            (count / length) * math.log2(count / length)
            for count in counter.values()
        )
        return round(entropy, 4)

    @staticmethod
    def _normalize_path(path: str) -> str:
        """Replace numeric and UUID segments with *."""
        uuid_pattern = re.compile(
            r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}"
            r"-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
        )
        segments = path.split("/")
        normalized = []
        for seg in segments:
            if seg.isdigit():
                normalized.append("*")
            elif uuid_pattern.match(seg):
                normalized.append("*")
            else:
                normalized.append(seg)
        return "/".join(normalized)

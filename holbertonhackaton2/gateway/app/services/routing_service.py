import asyncio
import json
import time
from datetime import datetime, timezone

from fastapi import Request

from app.services.fingerprint_service import FingerprintService
from app.services.feature_extractor_service import FeatureExtractorService
from app.services.classifier_client_service import ClassifierClientService
from app.repositories.redis_repository import RedisRepository
from app.repositories.log_repository import LogRepository
from app.models.schemas import GatewayLogCreate
from app.core.constants import ATTACK_ROUTES, ATTACK_LABELS
from app.config import Settings
from app.utils.logging import logger


class RoutingService:
    """Orchestrates fingerprinting, classification, caching, and upstream resolution."""

    def __init__(
        self,
        fingerprint_svc: FingerprintService,
        feature_extractor_svc: FeatureExtractorService,
        classifier_client_svc: ClassifierClientService,
        redis_repo: RedisRepository,
        log_repo: LogRepository,
        settings: Settings,
    ):
        self._fingerprint_svc = fingerprint_svc
        self._feature_extractor_svc = feature_extractor_svc
        self._classifier_client_svc = classifier_client_svc
        self._redis_repo = redis_repo
        self._log_repo = log_repo
        self._settings = settings

    async def resolve_upstream(
        self, request: Request
    ) -> tuple[str, int, int, float]:
        """Determine the upstream target for a request.

        Returns:
            A tuple of (host, port, attack_type, confidence).
        """
        start = time.perf_counter()

        # 1. Extract signature from the incoming request
        signature = await self._fingerprint_svc.extract_signature(request)

        # 2. Compute the fingerprint hash
        fingerprint = self._fingerprint_svc.compute_fingerprint(signature)

        # 3. Check Redis cache for a previous classification
        cached_type = await self._redis_repo.get_fingerprint_classification(fingerprint)

        if cached_type is not None:
            attack_type = cached_type
            confidence = 1.0
        else:
            # 4. Cache miss: extract features and classify
            features = await self._feature_extractor_svc.extract_features(
                request, signature
            )
            result = await self._classifier_client_svc.classify(features)
            attack_type = result.attack_type
            confidence = result.confidence

            # Cache the classification result
            await self._redis_repo.set_fingerprint_classification(
                fingerprint,
                attack_type,
                ttl=self._settings.FINGERPRINT_TTL,
            )

        # 5. Look up the upstream route based on attack type
        host, port = ATTACK_ROUTES.get(
            attack_type,
            (
                self._settings.STORE_BACKEND_HOST,
                self._settings.STORE_BACKEND_PORT,
            ),
        )

        # 6. Fire-and-forget: log the decision to the database
        elapsed_ms = (time.perf_counter() - start) * 1000
        attack_label = ATTACK_LABELS.get(attack_type, "Unknown")
        log_entry = GatewayLogCreate(
            timestamp=datetime.now(timezone.utc),
            fingerprint=fingerprint,
            source_ip=signature.source_ip,
            attack_type=attack_type,
            attack_label=attack_label,
            confidence=confidence,
            upstream=f"{host}:{port}",
            latency_ms=elapsed_ms,
            method=signature.request_method,
            path=signature.path_pattern,
            user_agent=signature.user_agent,
        )
        asyncio.create_task(self._safe_log(log_entry))

        # 7. Return the routing decision
        return host, port, attack_type, confidence

    async def _safe_log(self, log_entry: GatewayLogCreate) -> None:
        """Write a log entry to the database, swallowing exceptions."""
        try:
            await self._log_repo.create_log(log_entry)
        except Exception as e:
            logger.error("Failed to persist gateway log: %s", e)

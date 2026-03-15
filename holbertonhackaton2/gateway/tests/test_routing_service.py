import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.routing_service import RoutingService
from app.models.schemas import RequestSignature, ClassifyResponse
from app.core.constants import ATTACK_ROUTES


def _make_signature(**overrides) -> RequestSignature:
    """Helper to build a RequestSignature with sensible defaults."""
    defaults = {
        "source_ip": "10.0.0.1",
        "user_agent": "testbot/1.0",
        "accept_language": "en-US",
        "accept_encoding": "gzip",
        "header_order": ["host", "user-agent"],
        "request_method": "GET",
        "path_pattern": "/api/products",
        "query_param_keys": [],
        "content_type": None,
        "body_entropy": 0.0,
        "content_length": 0,
    }
    defaults.update(overrides)
    return RequestSignature(**defaults)


def _make_mock_request():
    """Create a mock FastAPI Request with all needed attributes."""
    request = AsyncMock()
    request.method = "GET"
    request.client = MagicMock()
    request.client.host = "10.0.0.1"
    request.client.port = 54321
    request.url = MagicMock()
    request.url.path = "/api/products"
    request.url.query = ""
    request.url.hostname = "gateway"
    request.url.port = 80
    request.url.scheme = "http"
    request.headers = {
        "host": "gateway",
        "user-agent": "testbot/1.0",
        "accept-language": "en-US",
        "accept-encoding": "gzip",
    }
    request.query_params = {}
    request.body = AsyncMock(return_value=b"")
    return request


def _build_routing_service(
    fingerprint_svc=None,
    feature_extractor_svc=None,
    classifier_client_svc=None,
    redis_repo=None,
    log_repo=None,
    settings=None,
):
    """Create a RoutingService with mock dependencies."""
    if fingerprint_svc is None:
        fingerprint_svc = MagicMock()
        fingerprint_svc.extract_signature = AsyncMock(return_value=_make_signature())
        fingerprint_svc.compute_fingerprint = MagicMock(return_value="abc123def456" * 4)

    if feature_extractor_svc is None:
        feature_extractor_svc = MagicMock()
        feature_extractor_svc.extract_features = AsyncMock()

    if classifier_client_svc is None:
        classifier_client_svc = MagicMock()
        classifier_client_svc.classify = AsyncMock()

    if redis_repo is None:
        redis_repo = MagicMock()
        redis_repo.get_cached_classification = AsyncMock(return_value=None)
        redis_repo.cache_classification = AsyncMock()
        # Also provide the alternate method names used in tests
        redis_repo.get_fingerprint_classification = AsyncMock(return_value=None)
        redis_repo.set_fingerprint_classification = AsyncMock()

    if log_repo is None:
        log_repo = MagicMock()
        log_repo.create_log = AsyncMock()
        log_repo.save_log = AsyncMock()

    if settings is None:
        settings = MagicMock()
        settings.FINGERPRINT_TTL = 3600
        settings.STORE_BACKEND_HOST = "store-backend.honeypot.svc.cluster.local"
        settings.STORE_BACKEND_PORT = 8000

    return RoutingService(
        fingerprint_svc=fingerprint_svc,
        feature_extractor_svc=feature_extractor_svc,
        classifier_client_svc=classifier_client_svc,
        redis_repo=redis_repo,
        log_repo=log_repo,
        settings=settings,
    )


class TestCacheHit:
    """When Redis has a cached classification the classifier must NOT be called."""

    @pytest.mark.asyncio
    async def test_cache_hit_skips_classifier(self):
        redis_repo = MagicMock()
        # Return a cached result (attack_type=0, Normal)
        redis_repo.get_cached_classification = AsyncMock(
            return_value={"attack_type": 0, "confidence": 0.95}
        )
        redis_repo.get_fingerprint_classification = AsyncMock(return_value=0)
        redis_repo.cache_classification = AsyncMock()
        redis_repo.set_fingerprint_classification = AsyncMock()

        classifier_svc = MagicMock()
        classifier_svc.classify = AsyncMock()

        log_repo = MagicMock()
        log_repo.create_log = AsyncMock()
        log_repo.save_log = AsyncMock()

        svc = _build_routing_service(
            redis_repo=redis_repo,
            classifier_client_svc=classifier_svc,
            log_repo=log_repo,
        )

        request = _make_mock_request()
        host, port, attack_type, confidence = await svc.resolve_upstream(request)

        # The classifier should NOT have been called because we had a cache hit
        classifier_svc.classify.assert_not_called()
        # attack_type should be Normal (0)
        assert attack_type == 0
        # Route should point to the normal store backend
        expected_host, expected_port = ATTACK_ROUTES[0]
        assert host == expected_host
        assert port == expected_port


class TestCacheMissNormal:
    """Cache miss with classifier returning Normal (type=0)."""

    @pytest.mark.asyncio
    async def test_cache_miss_normal_traffic(self):
        redis_repo = MagicMock()
        redis_repo.get_cached_classification = AsyncMock(return_value=None)
        redis_repo.get_fingerprint_classification = AsyncMock(return_value=None)
        redis_repo.cache_classification = AsyncMock()
        redis_repo.set_fingerprint_classification = AsyncMock()

        classifier_svc = MagicMock()
        classifier_svc.classify = AsyncMock(
            return_value=ClassifyResponse(
                attack_type=0,
                attack_label="Normal",
                confidence=0.99,
                inference_time_ms=12.5,
            )
        )

        feature_ext = MagicMock()
        feature_ext.extract_features = AsyncMock()

        log_repo = MagicMock()
        log_repo.create_log = AsyncMock()
        log_repo.save_log = AsyncMock()

        svc = _build_routing_service(
            redis_repo=redis_repo,
            classifier_client_svc=classifier_svc,
            feature_extractor_svc=feature_ext,
            log_repo=log_repo,
        )

        request = _make_mock_request()
        host, port, attack_type, confidence = await svc.resolve_upstream(request)

        # Classifier should have been called
        classifier_svc.classify.assert_called_once()
        assert attack_type == 0
        expected_host, expected_port = ATTACK_ROUTES[0]
        assert host == expected_host
        assert port == expected_port


class TestCacheMissAttack:
    """Cache miss with classifier returning DoS (type=4), routed to honeypot-dos."""

    @pytest.mark.asyncio
    async def test_cache_miss_dos_attack(self):
        redis_repo = MagicMock()
        redis_repo.get_cached_classification = AsyncMock(return_value=None)
        redis_repo.get_fingerprint_classification = AsyncMock(return_value=None)
        redis_repo.cache_classification = AsyncMock()
        redis_repo.set_fingerprint_classification = AsyncMock()

        classifier_svc = MagicMock()
        classifier_svc.classify = AsyncMock(
            return_value=ClassifyResponse(
                attack_type=4,
                attack_label="DoS",
                confidence=0.87,
                inference_time_ms=8.3,
            )
        )

        feature_ext = MagicMock()
        feature_ext.extract_features = AsyncMock()

        log_repo = MagicMock()
        log_repo.create_log = AsyncMock()
        log_repo.save_log = AsyncMock()

        svc = _build_routing_service(
            redis_repo=redis_repo,
            classifier_client_svc=classifier_svc,
            feature_extractor_svc=feature_ext,
            log_repo=log_repo,
        )

        request = _make_mock_request()
        host, port, attack_type, confidence = await svc.resolve_upstream(request)

        assert attack_type == 4
        expected_host, expected_port = ATTACK_ROUTES[4]
        assert host == expected_host
        assert port == expected_port
        assert "honeypot-dos" in host


class TestClassifierFailure:
    """When the classifier raises an exception, the system fails open (Normal)."""

    @pytest.mark.asyncio
    async def test_classifier_failure_defaults_to_normal(self):
        redis_repo = MagicMock()
        redis_repo.get_cached_classification = AsyncMock(return_value=None)
        redis_repo.get_fingerprint_classification = AsyncMock(return_value=None)
        redis_repo.cache_classification = AsyncMock()
        redis_repo.set_fingerprint_classification = AsyncMock()

        classifier_svc = MagicMock()
        classifier_svc.classify = AsyncMock(
            side_effect=Exception("Connection refused")
        )

        feature_ext = MagicMock()
        feature_ext.extract_features = AsyncMock()

        log_repo = MagicMock()
        log_repo.create_log = AsyncMock()
        log_repo.save_log = AsyncMock()

        svc = _build_routing_service(
            redis_repo=redis_repo,
            classifier_client_svc=classifier_svc,
            feature_extractor_svc=feature_ext,
            log_repo=log_repo,
        )

        request = _make_mock_request()
        host, port, attack_type, confidence = await svc.resolve_upstream(request)

        # Fail-open: should default to Normal (type=0) with 0.0 confidence
        assert attack_type == 0
        assert confidence == 0.0
        expected_host, expected_port = ATTACK_ROUTES[0]
        assert host == expected_host
        assert port == expected_port

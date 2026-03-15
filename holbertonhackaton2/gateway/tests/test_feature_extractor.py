import math

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.feature_extractor_service import FeatureExtractorService
from app.models.schemas import RequestSignature


def _make_signature(**overrides) -> RequestSignature:
    """Helper to build a RequestSignature with sensible defaults."""
    defaults = {
        "source_ip": "192.168.1.100",
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


def _make_mock_request(**overrides):
    """Create a mock FastAPI Request with all needed attributes."""
    request = AsyncMock()
    request.method = overrides.get("method", "GET")
    request.client = MagicMock()
    request.client.host = overrides.get("client_host", "192.168.1.100")
    request.client.port = overrides.get("client_port", 54321)
    request.url = MagicMock()
    request.url.path = overrides.get("path", "/api/products")
    request.url.hostname = overrides.get("hostname", "gateway")
    request.url.port = overrides.get("port", 80)
    request.url.scheme = overrides.get("scheme", "http")
    request.headers = overrides.get(
        "headers",
        {
            "host": "gateway",
            "user-agent": "testbot/1.0",
            "accept-language": "en-US",
            "accept-encoding": "gzip",
        },
    )
    request.query_params = {}
    request.body = AsyncMock(return_value=overrides.get("body", b""))
    return request


def _make_redis_repo():
    """Create a mock RedisRepository where increment_connection_counter returns 1."""
    redis_repo = MagicMock()
    redis_repo.increment_connection_counter = AsyncMock(return_value=1)
    return redis_repo


class TestBasicFeatures:
    """Verify that fundamental protocol fields are set correctly."""

    @pytest.mark.asyncio
    async def test_proto_is_tcp(self):
        redis_repo = _make_redis_repo()
        svc = FeatureExtractorService(redis_repo)
        sig = _make_signature()
        request = _make_mock_request()
        result = await svc.extract_features(request, sig)
        assert result.proto == "tcp"

    @pytest.mark.asyncio
    async def test_service_is_http(self):
        redis_repo = _make_redis_repo()
        svc = FeatureExtractorService(redis_repo)
        sig = _make_signature()
        request = _make_mock_request()
        result = await svc.extract_features(request, sig)
        assert result.service == "http"

    @pytest.mark.asyncio
    async def test_is_ftp_login_zero(self):
        redis_repo = _make_redis_repo()
        svc = FeatureExtractorService(redis_repo)
        sig = _make_signature()
        request = _make_mock_request()
        result = await svc.extract_features(request, sig)
        assert result.is_ftp_login == 0

    @pytest.mark.asyncio
    async def test_ct_ftp_cmd_zero(self):
        redis_repo = _make_redis_repo()
        svc = FeatureExtractorService(redis_repo)
        sig = _make_signature()
        request = _make_mock_request()
        result = await svc.extract_features(request, sig)
        assert result.ct_ftp_cmd == 0

    @pytest.mark.asyncio
    async def test_state_is_fin(self):
        redis_repo = _make_redis_repo()
        svc = FeatureExtractorService(redis_repo)
        sig = _make_signature()
        request = _make_mock_request()
        result = await svc.extract_features(request, sig)
        assert result.state == "FIN"


class TestCounterIncrements:
    """Verify that increment_connection_counter is called exactly 9 times."""

    @pytest.mark.asyncio
    async def test_counter_increments_called_9_times(self):
        redis_repo = _make_redis_repo()
        svc = FeatureExtractorService(redis_repo)
        sig = _make_signature()
        request = _make_mock_request()
        await svc.extract_features(request, sig)
        assert redis_repo.increment_connection_counter.call_count == 9

    @pytest.mark.asyncio
    async def test_counter_values_assigned_to_features(self):
        redis_repo = MagicMock()
        # Return incrementing values so each counter is distinct
        redis_repo.increment_connection_counter = AsyncMock(
            side_effect=[10, 20, 30, 40, 50, 60, 70, 80, 90]
        )
        svc = FeatureExtractorService(redis_repo)
        sig = _make_signature()
        request = _make_mock_request()
        result = await svc.extract_features(request, sig)

        # All ct_* fields should come from the Redis counters
        assert result.ct_srv_src == 10
        assert result.ct_srv_dst == 20
        assert result.ct_dst_ltm == 30
        assert result.ct_src_ltm == 40
        assert result.ct_src_dport_ltm == 50
        assert result.ct_dst_sport_ltm == 60
        assert result.ct_dst_src_ltm == 70
        assert result.ct_flw_http_mthd == 90
        assert result.ct_state_ttl == 80


class TestPacketCalculation:
    """Verify packet/byte calculations based on content_length."""

    @pytest.mark.asyncio
    async def test_spkts_for_large_payload(self):
        redis_repo = _make_redis_repo()
        svc = FeatureExtractorService(redis_repo)
        # content_length=14600 -> 14600 / 1460 = 10 packets
        sig = _make_signature(content_length=14600)
        request = _make_mock_request()
        result = await svc.extract_features(request, sig)
        assert result.Spkts == 10

    @pytest.mark.asyncio
    async def test_sbytes_equals_content_length(self):
        redis_repo = _make_redis_repo()
        svc = FeatureExtractorService(redis_repo)
        sig = _make_signature(content_length=5000)
        request = _make_mock_request()
        result = await svc.extract_features(request, sig)
        assert result.sbytes == 5000

    @pytest.mark.asyncio
    async def test_spkts_minimum_one_for_zero_content(self):
        redis_repo = _make_redis_repo()
        svc = FeatureExtractorService(redis_repo)
        sig = _make_signature(content_length=0)
        request = _make_mock_request()
        result = await svc.extract_features(request, sig)
        assert result.Spkts >= 1

    @pytest.mark.asyncio
    async def test_smeansz_calculated_correctly(self):
        redis_repo = _make_redis_repo()
        svc = FeatureExtractorService(redis_repo)
        sig = _make_signature(content_length=14600)
        request = _make_mock_request()
        result = await svc.extract_features(request, sig)
        # 14600 bytes / 10 packets = 1460 mean size
        assert result.smeansz == 14600 // 10

    @pytest.mark.asyncio
    async def test_srcip_from_signature(self):
        redis_repo = _make_redis_repo()
        svc = FeatureExtractorService(redis_repo)
        sig = _make_signature(source_ip="10.20.30.40")
        request = _make_mock_request(client_host="10.20.30.40")
        result = await svc.extract_features(request, sig)
        assert result.srcip == "10.20.30.40"

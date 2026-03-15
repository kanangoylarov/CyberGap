import pytest
from app.services.fingerprint_service import FingerprintService
from app.models.schemas import RequestSignature


def _make_signature(**overrides) -> RequestSignature:
    """Helper to build a RequestSignature with sensible defaults."""
    defaults = {
        "source_ip": "1.2.3.4",
        "user_agent": "mozilla/5.0",
        "accept_language": "en-US",
        "accept_encoding": "gzip, deflate",
        "header_order": ["host", "user-agent", "accept"],
        "request_method": "GET",
        "path_pattern": "/api/products/*",
        "query_param_keys": [],
        "content_type": None,
        "body_entropy": 0.0,
        "content_length": 0,
    }
    defaults.update(overrides)
    return RequestSignature(**defaults)


class TestComputeFingerprint:
    def test_deterministic(self):
        svc = FingerprintService()
        sig = _make_signature(
            source_ip="1.2.3.4",
            request_method="GET",
            path_pattern="/api/products/*",
        )
        fp1 = svc.compute_fingerprint(sig)
        fp2 = svc.compute_fingerprint(sig)
        assert fp1 == fp2
        assert len(fp1) == 64  # SHA-256 hex digest length

    def test_different_inputs(self):
        svc = FingerprintService()
        sig1 = _make_signature(
            source_ip="1.2.3.4",
            request_method="GET",
            path_pattern="/api/products",
        )
        sig2 = _make_signature(
            source_ip="5.6.7.8",
            request_method="GET",
            path_pattern="/api/products",
        )
        assert svc.compute_fingerprint(sig1) != svc.compute_fingerprint(sig2)

    def test_different_method_produces_different_fingerprint(self):
        svc = FingerprintService()
        sig_get = _make_signature(request_method="GET")
        sig_post = _make_signature(request_method="POST")
        assert svc.compute_fingerprint(sig_get) != svc.compute_fingerprint(sig_post)

    def test_fingerprint_is_hex_string(self):
        svc = FingerprintService()
        sig = _make_signature()
        fp = svc.compute_fingerprint(sig)
        # Should be a valid hex string
        int(fp, 16)


class TestNormalizePath:
    def test_numeric(self):
        assert FingerprintService._normalize_path("/api/products/42") == "/api/products/*"

    def test_uuid(self):
        assert (
            FingerprintService._normalize_path(
                "/api/items/550e8400-e29b-41d4-a716-446655440000"
            )
            == "/api/items/*"
        )

    def test_preserve_non_numeric(self):
        assert (
            FingerprintService._normalize_path("/api/products/search")
            == "/api/products/search"
        )

    def test_multiple_numeric_segments(self):
        assert (
            FingerprintService._normalize_path("/api/orders/99/items/7")
            == "/api/orders/*/items/*"
        )

    def test_root_path(self):
        assert FingerprintService._normalize_path("/") == "/"

    def test_no_dynamic_segments(self):
        assert (
            FingerprintService._normalize_path("/api/health")
            == "/api/health"
        )


class TestComputeEntropy:
    def test_empty(self):
        assert FingerprintService._compute_entropy(b"") == 0.0

    def test_uniform(self):
        assert FingerprintService._compute_entropy(b"\x00" * 100) == 0.0

    def test_high(self):
        entropy = FingerprintService._compute_entropy(bytes(range(256)))
        assert entropy >= 7.9  # close to 8.0 for uniform 256-byte distribution

    def test_two_distinct_bytes(self):
        # 50/50 split of two values -> entropy = 1.0
        data = b"\x00" * 50 + b"\x01" * 50
        entropy = FingerprintService._compute_entropy(data)
        assert abs(entropy - 1.0) < 0.01

    def test_single_byte(self):
        assert FingerprintService._compute_entropy(b"A") == 0.0

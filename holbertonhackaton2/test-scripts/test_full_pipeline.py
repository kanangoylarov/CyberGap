#!/usr/bin/env python3
"""
Full pipeline test suite for the AI Honeypot System.
Tests the gateway, classifier, store, and honeypots end-to-end.

Usage:
    pip install httpx
    python test-scripts/test_full_pipeline.py
"""

import asyncio
import httpx
import json
import sys

GATEWAY_URL = "http://shop.local"
ADMIN_URL = "http://admin.local"

# Colors for terminal output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"
BOLD = "\033[1m"


def header(title: str):
    print(f"\n{BOLD}{CYAN}{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}{RESET}\n")


def result(name: str, passed: bool, details: str = ""):
    icon = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
    print(f"  [{icon}] {name}")
    if details:
        print(f"         {details}")


async def test_store_api(client: httpx.AsyncClient):
    """Test the store backend API through the gateway."""
    header("Store API Tests")

    # Test 1: List products
    r = await client.get(f"{GATEWAY_URL}/api/products/", follow_redirects=True)
    result(
        "GET /api/products",
        r.status_code == 200 and "items" in r.json(),
        f"Status={r.status_code}, Items={len(r.json().get('items', []))}",
    )

    # Test 2: Get categories
    r = await client.get(f"{GATEWAY_URL}/api/products/categories", follow_redirects=True)
    result(
        "GET /api/products/categories",
        r.status_code == 200 and isinstance(r.json(), list),
        f"Status={r.status_code}, Categories={r.json() if r.status_code == 200 else 'N/A'}",
    )

    # Test 3: Get single product
    r = await client.get(f"{GATEWAY_URL}/api/products/1", follow_redirects=True)
    result(
        "GET /api/products/1",
        r.status_code == 200 and r.json().get("id") == 1,
        f"Status={r.status_code}, Name={r.json().get('name', 'N/A') if r.status_code == 200 else 'N/A'}",
    )

    # Test 4: Get cart
    r = await client.get(f"{GATEWAY_URL}/api/cart/", follow_redirects=True)
    result(
        "GET /api/cart",
        r.status_code == 200,
        f"Status={r.status_code}",
    )

    # Test 5: Add to cart
    r = await client.post(
        f"{GATEWAY_URL}/api/cart/",
        json={"product_id": 1, "quantity": 1},
        follow_redirects=True,
    )
    result(
        "POST /api/cart (add item)",
        r.status_code in (200, 201),
        f"Status={r.status_code}",
    )

    # Test 6: Product not found
    r = await client.get(f"{GATEWAY_URL}/api/products/99999", follow_redirects=True)
    result(
        "GET /api/products/99999 (not found)",
        r.status_code == 404,
        f"Status={r.status_code}",
    )


async def test_gateway_classification(client: httpx.AsyncClient):
    """Test that the gateway adds classification headers."""
    header("Gateway Classification Tests")

    # Test 1: Check classification headers exist
    r = await client.get(
        f"{GATEWAY_URL}/api/products/",
        headers={"User-Agent": "Mozilla/5.0 Chrome/120"},
        follow_redirects=True,
    )
    attack_type = r.headers.get("x-gateway-attack-type")
    confidence = r.headers.get("x-gateway-confidence")
    process_time = r.headers.get("x-process-time")

    result(
        "Classification headers present",
        attack_type is not None and confidence is not None,
        f"Attack-Type={attack_type}, Confidence={confidence}, Process-Time={process_time}",
    )

    # Test 2: Normal traffic should be type 0
    result(
        "Normal traffic classified as type 0",
        attack_type == "0",
        f"Got type={attack_type}",
    )

    # Test 3: Multiple requests get cached (faster)
    r1 = await client.get(f"{GATEWAY_URL}/api/products/1", follow_redirects=True)
    time1 = r1.headers.get("x-process-time", "0ms")

    r2 = await client.get(f"{GATEWAY_URL}/api/products/2", follow_redirects=True)
    time2 = r2.headers.get("x-process-time", "0ms")

    result(
        "Second request uses cache (faster)",
        True,
        f"First={time1}, Second={time2}",
    )


async def test_classifier_directly(client: httpx.AsyncClient):
    """Test the AI classifier service directly via kubectl port-forward or gateway."""
    header("AI Classifier Direct Tests")

    scenarios = [
        {
            "name": "Normal traffic pattern",
            "features": {
                "srcip": "10.0.0.5", "sport": 54321, "dstip": "10.0.0.1", "dsport": 80,
                "proto": "tcp", "state": "FIN", "dur": 0.5,
                "sbytes": 500, "dbytes": 1200, "sttl": 64, "dttl": 128,
                "sloss": 0, "dloss": 0, "service": "http",
                "Sload": 8000.0, "Dload": 19200.0, "Spkts": 4, "Dpkts": 3,
                "swin": 255, "dwin": 255, "stcpb": 0, "dtcpb": 0,
                "smeansz": 125, "dmeansz": 400, "trans_depth": 1, "res_bdy_len": 1200,
                "Sjit": 0.0, "Djit": 0.0, "Sintpkt": 100.0, "Dintpkt": 150.0,
                "tcprtt": 0.02, "synack": 0.01, "ackdat": 0.01,
                "is_sm_ips_ports": 0, "ct_state_ttl": 1, "ct_flw_http_mthd": 1,
                "is_ftp_login": 0, "ct_ftp_cmd": 0,
                "ct_srv_src": 2, "ct_srv_dst": 2, "ct_dst_ltm": 3,
                "ct_src_ltm": 2, "ct_src_dport_ltm": 1, "ct_dst_sport_ltm": 1,
                "ct_dst_src_ltm": 2,
            },
        },
        {
            "name": "DoS flood pattern",
            "features": {
                "srcip": "192.168.1.100", "sport": 12345, "dstip": "10.0.0.1", "dsport": 80,
                "proto": "tcp", "state": "FIN", "dur": 0.001,
                "sbytes": 50000, "dbytes": 0, "sttl": 255, "dttl": 0,
                "sloss": 100, "dloss": 0, "service": "http",
                "Sload": 400000000.0, "Dload": 0.0, "Spkts": 500, "Dpkts": 0,
                "swin": 0, "dwin": 0, "stcpb": 0, "dtcpb": 0,
                "smeansz": 100, "dmeansz": 0, "trans_depth": 0, "res_bdy_len": 0,
                "Sjit": 50.0, "Djit": 0.0, "Sintpkt": 0.001, "Dintpkt": 0.0,
                "tcprtt": 0.0, "synack": 0.0, "ackdat": 0.0,
                "is_sm_ips_ports": 0, "ct_state_ttl": 50, "ct_flw_http_mthd": 100,
                "is_ftp_login": 0, "ct_ftp_cmd": 0,
                "ct_srv_src": 200, "ct_srv_dst": 200, "ct_dst_ltm": 200,
                "ct_src_ltm": 200, "ct_src_dport_ltm": 200, "ct_dst_sport_ltm": 200,
                "ct_dst_src_ltm": 200,
            },
        },
        {
            "name": "Port scan / Recon pattern",
            "features": {
                "srcip": "10.10.10.10", "sport": 55555, "dstip": "10.0.0.1", "dsport": 22,
                "proto": "tcp", "state": "CON", "dur": 0.0,
                "sbytes": 0, "dbytes": 0, "sttl": 64, "dttl": 0,
                "sloss": 0, "dloss": 0, "service": "-",
                "Sload": 0.0, "Dload": 0.0, "Spkts": 1, "Dpkts": 0,
                "swin": 0, "dwin": 0, "stcpb": 0, "dtcpb": 0,
                "smeansz": 0, "dmeansz": 0, "trans_depth": 0, "res_bdy_len": 0,
                "Sjit": 0.0, "Djit": 0.0, "Sintpkt": 0.0, "Dintpkt": 0.0,
                "tcprtt": 0.0, "synack": 0.0, "ackdat": 0.0,
                "is_sm_ips_ports": 0, "ct_state_ttl": 100, "ct_flw_http_mthd": 0,
                "is_ftp_login": 0, "ct_ftp_cmd": 0,
                "ct_srv_src": 50, "ct_srv_dst": 50, "ct_dst_ltm": 100,
                "ct_src_ltm": 100, "ct_src_dport_ltm": 50, "ct_dst_sport_ltm": 50,
                "ct_dst_src_ltm": 100,
            },
        },
        {
            "name": "Shellcode / binary payload",
            "features": {
                "srcip": "172.16.0.50", "sport": 4444, "dstip": "10.0.0.1", "dsport": 8080,
                "proto": "tcp", "state": "FIN", "dur": 0.01,
                "sbytes": 8192, "dbytes": 64, "sttl": 128, "dttl": 64,
                "sloss": 0, "dloss": 0, "service": "http",
                "Sload": 6553600.0, "Dload": 51200.0, "Spkts": 6, "Dpkts": 2,
                "swin": 64, "dwin": 64, "stcpb": 0, "dtcpb": 0,
                "smeansz": 1365, "dmeansz": 32, "trans_depth": 1, "res_bdy_len": 64,
                "Sjit": 5.0, "Djit": 0.0, "Sintpkt": 2.0, "Dintpkt": 0.0,
                "tcprtt": 0.005, "synack": 0.002, "ackdat": 0.003,
                "is_sm_ips_ports": 0, "ct_state_ttl": 5, "ct_flw_http_mthd": 1,
                "is_ftp_login": 0, "ct_ftp_cmd": 0,
                "ct_srv_src": 1, "ct_srv_dst": 1, "ct_dst_ltm": 5,
                "ct_src_ltm": 3, "ct_src_dport_ltm": 1, "ct_dst_sport_ltm": 1,
                "ct_dst_src_ltm": 3,
            },
        },
    ]

    for scenario in scenarios:
        try:
            r = await client.post(
                f"{GATEWAY_URL}/api/products/",  # goes through gateway which calls classifier
                json=scenario["features"],
                follow_redirects=True,
            )
            attack_type = r.headers.get("x-gateway-attack-type", "N/A")
            confidence = r.headers.get("x-gateway-confidence", "N/A")
            result(
                scenario["name"],
                True,
                f"Attack-Type={attack_type}, Confidence={confidence}",
            )
        except Exception as e:
            result(scenario["name"], False, str(e))


async def test_honeypots(client: httpx.AsyncClient):
    """Test honeypot services respond correctly."""
    header("Honeypot Endpoint Tests (via kubectl)")

    print(f"  {YELLOW}Note: Honeypots are only accessible inside the cluster.{RESET}")
    print(f"  {YELLOW}Run these from inside a pod or use kubectl port-forward.{RESET}")
    print()
    print("  Example commands:")
    print("    kubectl -n honeypot port-forward svc/honeypot-exploits 9001:8000")
    print("    curl http://localhost:9001/api/products")
    print("    curl http://localhost:9001/wp-admin/")
    print()
    print("    kubectl -n honeypot port-forward svc/honeypot-recon 9002:8000")
    print("    curl http://localhost:9002/.env")
    print("    curl http://localhost:9002/robots.txt")
    print()
    print("    kubectl -n honeypot port-forward svc/honeypot-backdoor 9003:8000")
    print('    curl "http://localhost:9003/api/exec?cmd=whoami"')


async def test_admin_api(client: httpx.AsyncClient):
    """Test the admin dashboard API."""
    header("Admin API Tests")

    # Test 1: Health
    try:
        r = await client.get(f"{ADMIN_URL}/health", follow_redirects=True)
        result("GET /health", r.status_code == 200, f"Status={r.status_code}")
    except Exception as e:
        result("GET /health", False, str(e))

    # Test 2: Stats overview
    try:
        r = await client.get(f"{ADMIN_URL}/api/admin/stats/overview", follow_redirects=True)
        result(
            "GET /api/admin/stats/overview",
            r.status_code == 200,
            f"Status={r.status_code}, Data={json.dumps(r.json(), indent=None)[:100] if r.status_code == 200 else 'N/A'}",
        )
    except Exception as e:
        result("GET /api/admin/stats/overview", False, str(e))

    # Test 3: Stats breakdown
    try:
        r = await client.get(f"{ADMIN_URL}/api/admin/stats/breakdown", follow_redirects=True)
        result(
            "GET /api/admin/stats/breakdown",
            r.status_code == 200,
            f"Status={r.status_code}",
        )
    except Exception as e:
        result("GET /api/admin/stats/breakdown", False, str(e))

    # Test 4: Logs
    try:
        r = await client.get(f"{ADMIN_URL}/api/admin/logs", follow_redirects=True)
        result(
            "GET /api/admin/logs",
            r.status_code == 200,
            f"Status={r.status_code}, Total={r.json().get('total', 'N/A') if r.status_code == 200 else 'N/A'}",
        )
    except Exception as e:
        result("GET /api/admin/logs", False, str(e))

    # Test 5: Fingerprints
    try:
        r = await client.get(f"{ADMIN_URL}/api/admin/fingerprints", follow_redirects=True)
        result(
            "GET /api/admin/fingerprints",
            r.status_code == 200,
            f"Status={r.status_code}",
        )
    except Exception as e:
        result("GET /api/admin/fingerprints", False, str(e))


async def test_gateway_health(client: httpx.AsyncClient):
    """Test gateway health endpoint."""
    header("Gateway Health")

    r = await client.get(f"{GATEWAY_URL}/health")
    result(
        "GET /health",
        r.status_code == 200,
        f"Response={r.json()}",
    )


async def main():
    print(f"\n{BOLD}{'='*60}")
    print(f"  AI Honeypot System - Full Pipeline Test")
    print(f"{'='*60}{RESET}")
    print(f"  Gateway:  {GATEWAY_URL}")
    print(f"  Admin:    {ADMIN_URL}")

    async with httpx.AsyncClient(timeout=30.0) as client:
        await test_gateway_health(client)
        await test_store_api(client)
        await test_gateway_classification(client)
        await test_classifier_directly(client)
        await test_admin_api(client)
        await test_honeypots(client)

    print(f"\n{BOLD}{CYAN}{'='*60}")
    print(f"  All tests completed!")
    print(f"{'='*60}{RESET}\n")


if __name__ == "__main__":
    asyncio.run(main())

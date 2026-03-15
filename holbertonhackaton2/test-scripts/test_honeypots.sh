#!/bin/bash
# Test honeypot endpoints directly via kubectl port-forward
# Each honeypot exposes the same store API + extra bait endpoints
# Usage: ./test-scripts/test_honeypots.sh

echo "=========================================="
echo "  Honeypot Direct Tests"
echo "=========================================="

# Function to test a honeypot
test_honeypot() {
    local name=$1
    local port=$2
    local extra_path=$3

    echo ""
    echo "--- $name (port $port) ---"

    # Start port-forward in background
    kubectl -n honeypot port-forward svc/$name $port:8000 &>/dev/null &
    PF_PID=$!
    sleep 2

    # Test store API (should look identical to real store)
    echo "  Products: $(curl -s http://localhost:$port/api/products | python3 -c 'import json,sys; d=json.load(sys.stdin); print(f"OK - {len(d.get(\"items\",[]))} products")' 2>/dev/null || echo 'FAILED')"
    echo "  Health:   $(curl -s http://localhost:$port/health | python3 -m json.tool 2>/dev/null | tr -d '\n' || echo 'FAILED')"

    # Test extra bait endpoint if provided
    if [ -n "$extra_path" ]; then
        echo "  Bait ($extra_path): $(curl -s http://localhost:$port$extra_path | head -c 200)"
    fi

    # Cleanup
    kill $PF_PID 2>/dev/null
    wait $PF_PID 2>/dev/null
}

test_honeypot "honeypot-generic"   9001 ""
test_honeypot "honeypot-exploits"  9002 "/wp-admin/"
test_honeypot "honeypot-recon"     9003 "/.env"
test_honeypot "honeypot-backdoor"  9004 "/api/exec?cmd=whoami"
test_honeypot "honeypot-dos"       9005 ""
test_honeypot "honeypot-analysis"  9006 "/api/internal/users"
test_honeypot "honeypot-shellcode" 9007 ""
test_honeypot "honeypot-worms"     9008 "/api/botnet/status"
test_honeypot "honeypot-fuzzers"   9009 ""

echo ""
echo "=========================================="
echo "  All honeypot tests complete"
echo "=========================================="

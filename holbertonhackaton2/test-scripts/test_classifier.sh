#!/bin/bash
# Test the AI classifier directly with different attack patterns
# Usage: ./test-scripts/test_classifier.sh

CLASSIFIER_URL="http://shop.local/api"
# If running inside cluster: CLASSIFIER_URL="http://ai-classifier.honeypot.svc.cluster.local:8000"

echo "=========================================="
echo "  AI Classifier Test Suite"
echo "=========================================="

echo ""
echo "--- Test 1: Normal HTTP Traffic ---"
curl -s http://shop.local/api/products -o /dev/null -w "Status: %{http_code}\n" -D - 2>/dev/null | grep -i "x-gateway"
echo ""

echo "--- Test 2: Direct Classify - DoS Pattern ---"
curl -s -X POST http://shop.local/api/../classify -H "Content-Type: application/json" -d '{
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
  "ct_src_ltm": 200, "ct_src_dport_ltm": 200, "ct_dst_sport_ltm": 200, "ct_dst_src_ltm": 200
}' | python3 -m json.tool 2>/dev/null || echo "Could not reach classifier directly"
echo ""

echo "--- Test 3: Gateway Response Headers ---"
echo "GET /api/products:"
curl -s -D - http://shop.local/api/products -o /dev/null 2>/dev/null | grep -iE "x-gateway|x-process"
echo ""
echo "GET /api/cart:"
curl -s -D - http://shop.local/api/cart -o /dev/null 2>/dev/null | grep -iE "x-gateway|x-process"
echo ""

echo "=========================================="
echo "  Tests Complete"
echo "=========================================="

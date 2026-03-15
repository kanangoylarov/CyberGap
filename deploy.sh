#!/bin/bash
set -e

echo "=== CyberGap Deploy Script ==="

# Check if .env exists
if [ ! -f ./server/.env ]; then
    echo "ERROR: server/.env not found. Copy .env.example and fill in values:"
    echo "  cp .env.example server/.env"
    exit 1
fi

# Run Prisma migrations
echo "[1/4] Running database migrations..."
docker compose run --rm backend npx prisma migrate deploy --schema=src/prisma/schema.prisma

# Build and start
echo "[2/4] Building containers..."
docker compose build

echo "[3/4] Starting services..."
docker compose up -d

echo "[4/4] Checking health..."
sleep 5
if curl -sf http://localhost:3000/ping > /dev/null; then
    echo "✅ Backend is running on port 3000"
else
    echo "❌ Backend health check failed"
fi

if curl -sf http://localhost > /dev/null; then
    echo "✅ Frontend is running on port 80"
else
    echo "❌ Frontend health check failed"
fi

echo ""
echo "=== Deploy complete ==="
echo "Frontend: http://YOUR_DROPLET_IP"
echo "Backend:  http://YOUR_DROPLET_IP:3000"

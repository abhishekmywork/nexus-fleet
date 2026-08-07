#!/bin/bash
set -euo pipefail

echo "=== Nexus Fleet Deployment ==="

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env from .env.production template..."
    cp .env.production .env
    echo ">>> Edit .env with your real values, then re-run this script."
    exit 1
fi

echo "Building and starting containers..."
docker compose down
docker compose build --no-cache
docker compose up -d

echo ""
echo "=== Deployment Status ==="
docker compose ps
echo ""
echo "Frontend: http://$(hostname -I | awk '{print $1}')"
echo "Backend API: http://$(hostname -I | awk '{print $1}'):4000/api"
echo ""
echo "Default login: admin@nexus.dev / Admin123!"

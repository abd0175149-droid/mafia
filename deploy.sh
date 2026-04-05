#!/bin/bash
echo "1. Fetching latest code from GitHub main branch..."
git pull origin main

echo "2. Building new containers (current ones still running)..."
docker compose build --no-cache

echo "3. Replacing containers with new build (minimal downtime)..."
docker compose up -d --force-recreate

echo "4. Cleaning up old Docker images..."
docker image prune -f

echo "5. Verifying services..."
docker compose ps

echo "✅ Deployment Successful! System is live via Cloudflare Tunnel."

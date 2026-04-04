#!/bin/bash
echo "1. Fetching latest code from GitHub main branch..."
git pull origin main

echo "2. Stopping current Mafia Engine containers..."
docker-compose down

echo "3. Re-building containers without cache..."
docker-compose build --no-cache

echo "4. Starting the Phygital Mafia Engine..."
docker-compose up -d

echo "5. Cleaning up old Docker images..."
docker image prune -f
echo "✅ Deployment Successful! System is live via Cloudflare Tunnel."

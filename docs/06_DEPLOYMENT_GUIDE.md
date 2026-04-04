# 🚀 خطة النشر والأتمتة (Deployment & DevOps)

تم تصميم النظام ليعمل بالاستضافة الذاتية (Self-hosted) مع الاستفادة من `Cloudflare Tunnels` لتوفير اتصال آمن (HTTPS و WSS) للجمهور بدون الحاجة لإعداد (Port Forwarding) في الراوتر.

## 1. التغليف (Docker Compose)
يجمع ملف `docker-compose.yml` الخدمات الأربعة الأساسية لتعمل ككتلة واحدة:
- `frontend` (Next.js - Port 3000)
- `backend` (Node.js/Socket.io - Port 4000)
- `redis` (In-Memory State - Port 6379)
- `postgres` (Persistent DB - Port 5432)

## 2. سكربت النشر الآلي (Deployment Script)
هذا السكربت `deploy.sh` يوضع على السيرفر المضيف لتحديث المشروع كاملاً بضغطة زر عند دفع أي كود جديد إلى `GitHub`:

```bash
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
```

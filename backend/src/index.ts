// ══════════════════════════════════════════════════════
// 🎭 Phygital Mafia Engine - نقطة الدخول الرئيسية
// ══════════════════════════════════════════════════════

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import { env } from './config/env.js';
import { connectRedis, isUsingInMemory } from './config/redis.js';
import { connectDB, type Database } from './config/db.js';
import leaderRoutes from './routes/leader.routes.js';
import playerRoutes from './routes/player.routes.js';
import statsRoutes from './routes/stats.routes.js';
import gameRoutes from './routes/game.routes.js';
import { registerLobbyEvents } from './sockets/lobby.socket.js';
import { registerDayEvents } from './sockets/day.socket.js';
import { registerNightEvents } from './sockets/night.socket.js';
import { registerGameEvents } from './sockets/game.socket.js';
import { createRoom, addPlayer, updatePlayer } from './game/state.js';

async function main() {
  // ── 1. Express Setup ──────────────────────────
  const app = express();
  const httpServer = createServer(app);

  app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }));
  app.use(express.json());

  // ── 2. Connect Services ──────────────────────
  console.log('🔄 Connecting to Redis...');
  await connectRedis();

  let db: Database | null = null;
  try {
    console.log('🔄 Connecting to PostgreSQL...');
    db = await connectDB();
  } catch (err) {
    console.warn('⚠️ PostgreSQL connection failed. Stats will be disabled.', err);
  }

  // ── 3. REST Routes ────────────────────────────
  app.use('/api/leader', leaderRoutes);
  app.use('/api/player', playerRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/game', gameRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        redis: isUsingInMemory() ? '⚠️ in-memory (dev mode)' : '✅ connected',
        postgres: db ? '✅' : '⚠️ disconnected',
      },
    });
  });

  // ── 4. Socket.IO Setup ────────────────────────
  const io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  app.set('io', io);

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    registerLobbyEvents(io, socket);
    registerDayEvents(io, socket);
    registerNightEvents(io, socket);
    registerGameEvents(io, socket);
  });

  // ── 5. Start Server ───────────────────────────
  httpServer.listen(env.PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║  🎭 Phygital Mafia Engine v2                ║
║  Server running on port ${env.PORT}              ║
║  Environment: ${env.NODE_ENV.padEnd(30)}║
║  Frontend URL: ${env.FRONTEND_URL.padEnd(29)}║
╚══════════════════════════════════════════════╝
    `);

    // ── 6. Auto-Seed Test Game ────────────────────
    try {
      console.log('🌱 Seeding Dummy Game for quick testing...');
      const state = await createRoom('لعبة تجريبية (Auto Seeded)', 10, 2, '2026');
      
      const names = ['أحمد', 'محمد', 'علي', 'خالد', 'عمر', 'سارة', 'فاطمة', 'تسنيم', 'ريم', 'نور'];
      const genders: ('MALE'|'FEMALE')[] = ['MALE', 'MALE', 'MALE', 'MALE', 'MALE', 'FEMALE', 'FEMALE', 'FEMALE', 'FEMALE', 'FEMALE'];
      
      for (let i = 0; i < 10; i++) {
        await addPlayer(state.roomId, i + 1, names[i], `070000000${i}`, null);
        await updatePlayer(state.roomId, i + 1, { gender: genders[i], dob: '1995-01-01' });
      }
      console.log(`✅ Dummy Game seeded successfully!`);
      console.log(`   PIN (الشاشة الرئيسية): 2026`);
      console.log(`   Room Code (رمز الغرفة): ${state.roomCode}`);
    } catch (e) {
      console.error('❌ Failed to seed dummy game:', e);
    }
  });
}

main().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

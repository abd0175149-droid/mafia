// ══════════════════════════════════════════════════════
// 🎭 Phygital Mafia Engine - نقطة الدخول الرئيسية
// ══════════════════════════════════════════════════════

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import { env } from './config/env.js';
import { connectRedis, isUsingInMemory } from './config/redis.js';
import { connectDB, type Database } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import statsRoutes from './routes/stats.routes.js';
import { registerLobbyEvents } from './sockets/lobby.socket.js';
import { registerDayEvents } from './sockets/day.socket.js';
import { registerNightEvents } from './sockets/night.socket.js';
import { registerGameEvents } from './sockets/game.socket.js';

async function main() {
  // ── 1. Express Setup ──────────────────────────
  const app = express();
  const httpServer = createServer(app);

  app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }));
  app.use(express.json());

  // ── 2. Session Setup ──────────────────────────
  app.use(session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // ── 3. Passport (Google OAuth) ────────────────
  app.use(passport.initialize());
  app.use(passport.session());

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback',
    }, async (_accessToken, _refreshToken, profile, done) => {
      try {
        // TODO: حفظ/تحديث المستخدم في PostgreSQL
        const user = {
          googleId: profile.id,
          email: profile.emails?.[0]?.value || '',
          displayName: profile.displayName,
          avatarUrl: profile.photos?.[0]?.value || '',
        };
        done(null, user);
      } catch (err) {
        done(err as Error);
      }
    }));

    passport.serializeUser((user: any, done) => {
      done(null, user);
    });

    passport.deserializeUser((user: any, done) => {
      done(null, user);
    });
  } else {
    console.warn('⚠️ Google OAuth not configured. Auth routes will be disabled.');
  }

  // ── 4. Connect Services ──────────────────────
  console.log('🔄 Connecting to Redis...');
  await connectRedis();

  let db: Database | null = null;
  try {
    console.log('🔄 Connecting to PostgreSQL...');
    db = await connectDB();
  } catch (err) {
    console.warn('⚠️ PostgreSQL connection failed. Stats will be disabled.', err);
  }

  // ── 5. REST Routes ────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/stats', statsRoutes);

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

  // ── 6. Socket.IO Setup ────────────────────────
  const io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // تسجيل جميع أحداث السوكت
    registerLobbyEvents(io, socket);
    registerDayEvents(io, socket);
    registerNightEvents(io, socket);
    registerGameEvents(io, socket);
  });

  // ── 7. Start Server ───────────────────────────
  httpServer.listen(env.PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║  🎭 Phygital Mafia Engine                   ║
║  Server running on port ${env.PORT}              ║
║  Environment: ${env.NODE_ENV.padEnd(30)}║
║  Frontend URL: ${env.FRONTEND_URL.padEnd(29)}║
╚══════════════════════════════════════════════╝
    `);
  });
}

main().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

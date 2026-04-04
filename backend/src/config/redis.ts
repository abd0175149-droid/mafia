import { env } from './env.js';
import type { GameState } from '../game/state.js';

// ══════════════════════════════════════════════════════
// Redis Connection
// في الـ Production: يتصل بـ Redis عبر Docker
// في الـ Development: يحاول Redis ثم يستخدم In-Memory fallback
// ══════════════════════════════════════════════════════

let redisClient: any = null;
let useInMemory = false;
const memoryStore = new Map<string, string>();

export async function connectRedis(): Promise<void> {
  try {
    const { createClient } = await import('redis');

    const client = createClient({
      url: env.REDIS_URL,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy(retries: number) {
          if (env.NODE_ENV === 'development' && retries > 2) {
            return false; // في التطوير: توقف بعد 3 محاولات
          }
          return Math.min(retries * 500, 5000); // في الإنتاج: أعد المحاولة
        },
      },
    });

    client.on('error', (err: Error) => {
      if (!useInMemory && env.NODE_ENV === 'development') {
        console.warn('⚠️ Redis error, switching to In-Memory mode');
        useInMemory = true;
      }
    });

    // Timeout يدوي لبيئة التطوير فقط
    if (env.NODE_ENV === 'development') {
      const connectPromise = client.connect();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 4000)
      );
      await Promise.race([connectPromise, timeoutPromise]);
    } else {
      // في الإنتاج: انتظر بدون timeout (Redis يجب أن يكون موجود)
      await client.connect();
    }

    redisClient = client;
    useInMemory = false;
    console.log('✅ Redis connected successfully');
  } catch (err: any) {
    if (env.NODE_ENV === 'production') {
      console.error('❌ Redis connection FAILED in production! Server cannot start without Redis.');
      process.exit(1);
    }
    console.log('⚠️ Redis unavailable. Using In-Memory Store for development.');
    useInMemory = true;
    redisClient = null;
  }
}

// ── Game State Helpers ────────────────────────────

const GAME_PREFIX = 'game:';

export async function getGameState(roomId: string): Promise<GameState | null> {
  const key = `${GAME_PREFIX}${roomId}`;
  if (useInMemory || !redisClient) {
    const data = memoryStore.get(key);
    return data ? JSON.parse(data) : null;
  }
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
}

export async function setGameState(roomId: string, state: GameState): Promise<void> {
  const key = `${GAME_PREFIX}${roomId}`;
  const json = JSON.stringify(state);
  if (useInMemory || !redisClient) {
    memoryStore.set(key, json);
    return;
  }
  await redisClient.set(key, json);
}

export async function deleteGameState(roomId: string): Promise<void> {
  const key = `${GAME_PREFIX}${roomId}`;
  if (useInMemory || !redisClient) {
    memoryStore.delete(key);
    return;
  }
  await redisClient.del(key);
}

export async function gameExists(roomId: string): Promise<boolean> {
  const key = `${GAME_PREFIX}${roomId}`;
  if (useInMemory || !redisClient) {
    return memoryStore.has(key);
  }
  const exists = await redisClient.exists(key);
  return exists === 1;
}

export function isUsingInMemory(): boolean {
  return useInMemory;
}

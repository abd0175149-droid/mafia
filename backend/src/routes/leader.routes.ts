// ══════════════════════════════════════════════════════
// 🔐 مسارات مصادقة الليدر (Leader Auth Routes)
// ══════════════════════════════════════════════════════

import { Router, Request, Response, NextFunction } from 'express';
import { createHash, randomBytes } from 'crypto';
import { env } from '../config/env.js';

const router = Router();

// ── تخزين بسيط لحسابات الليدر (In-Memory + يمكن نقله لـ DB لاحقاً) ──
interface LeaderAccount {
  username: string;
  passwordHash: string;
  displayName: string;
}

const leaderAccounts: LeaderAccount[] = [];
const activeTokens: Map<string, { username: string; displayName: string; expiresAt: number }> = new Map();

// ── Helper: Hash password ──
function hashPassword(password: string): string {
  return createHash('sha256').update(password + env.JWT_SECRET).digest('hex');
}

// ── Helper: Generate token ──
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

// ── تهيئة حساب افتراضي إذا لم يوجد ──
function ensureDefaultLeader() {
  if (leaderAccounts.length === 0) {
    leaderAccounts.push({
      username: 'admin',
      passwordHash: hashPassword('mafia2026'),
      displayName: 'الليدر الرئيسي',
    });
    console.log('👑 Default leader account created: admin / mafia2026');
  }
}

// Init
ensureDefaultLeader();

// ── POST /api/leader/login ──────────────────────────
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
  }

  const leader = leaderAccounts.find(
    l => l.username === username && l.passwordHash === hashPassword(password)
  );

  if (!leader) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }

  const token = generateToken();
  activeTokens.set(token, {
    username: leader.username,
    displayName: leader.displayName,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 أيام
  });

  res.json({
    success: true,
    token,
    displayName: leader.displayName,
    username: leader.username,
  });
});

// ── GET /api/leader/verify ──────────────────────────
router.get('/verify', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ valid: false, error: 'لا يوجد توكن' });
  }

  const session = activeTokens.get(token);
  if (!session || session.expiresAt < Date.now()) {
    activeTokens.delete(token!);
    return res.status(401).json({ valid: false, error: 'توكن منتهي أو غير صالح' });
  }

  res.json({
    valid: true,
    username: session.username,
    displayName: session.displayName,
  });
});

// ── POST /api/leader/register ───────────────────────
// محمي بـ master key
router.post('/register', (req: Request, res: Response) => {
  const { username, password, displayName, masterKey } = req.body;

  // Only allow registration with master key
  if (masterKey !== env.JWT_SECRET) {
    return res.status(403).json({ error: 'غير مصرح' });
  }

  if (!username || !password || !displayName) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }

  if (leaderAccounts.find(l => l.username === username)) {
    return res.status(409).json({ error: 'اسم المستخدم موجود مسبقاً' });
  }

  leaderAccounts.push({
    username,
    passwordHash: hashPassword(password),
    displayName,
  });

  res.json({ success: true, message: 'تم إنشاء حساب الليدر بنجاح' });
});

// ── POST /api/leader/logout ─────────────────────────
router.post('/logout', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    activeTokens.delete(token);
  }
  res.json({ success: true });
});

// ── Middleware: requireLeader ────────────────────────
export function requireLeader(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
  }

  const session = activeTokens.get(token);
  if (!session || session.expiresAt < Date.now()) {
    activeTokens.delete(token!);
    return res.status(401).json({ error: 'الجلسة منتهية' });
  }

  (req as any).leader = session;
  next();
}

export default router;

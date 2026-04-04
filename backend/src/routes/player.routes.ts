// ══════════════════════════════════════════════════════
// 📱 مسارات اللاعبين (Player Routes)
// تسجيل / بحث عبر رقم الهاتف
// ══════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';

const router = Router();

// ── تخزين اللاعبين في الذاكرة (سيتم نقله لـ PostgreSQL لاحقاً) ──
export interface PlayerRecord {
  id: number;
  phone: string;
  displayName: string;
  dateOfBirth: string | null;
  gender: 'male' | 'female' | null;
  totalGamesPlayed: number;
  createdAt: string;
}

let nextPlayerId = 1;
const players: Map<string, PlayerRecord> = new Map();

// ── Helper: تطبيع رقم الهاتف الأردني ──
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // إزالة +962 والاستبدال بـ 0
  if (cleaned.startsWith('+962')) {
    cleaned = '0' + cleaned.substring(4);
  } else if (cleaned.startsWith('962')) {
    cleaned = '0' + cleaned.substring(3);
  }

  // التأكد أنه يبدأ بـ 07
  if (!cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }

  return cleaned;
}

// ── POST /api/player/lookup ─────────────────────────
// البحث عن لاعب بالهاتف
router.post('/lookup', (req: Request, res: Response) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'رقم الهاتف مطلوب' });
  }

  const normalized = normalizePhone(phone);
  const player = players.get(normalized);

  if (player) {
    res.json({ found: true, player });
  } else {
    res.json({ found: false, player: null });
  }
});

// ── POST /api/player/register ───────────────────────
// تسجيل لاعب جديد
router.post('/register', (req: Request, res: Response) => {
  const { phone, displayName, dateOfBirth, gender } = req.body;

  if (!phone || !displayName) {
    return res.status(400).json({ error: 'رقم الهاتف والاسم مطلوبان' });
  }

  const normalized = normalizePhone(phone);

  // تحقق إذا موجود
  const existing = players.get(normalized);
  if (existing) {
    // تحديث البيانات
    existing.displayName = displayName;
    if (dateOfBirth) existing.dateOfBirth = dateOfBirth;
    if (gender) existing.gender = gender;
    return res.json({ success: true, player: existing, isNew: false });
  }

  // إنشاء لاعب جديد
  const player: PlayerRecord = {
    id: nextPlayerId++,
    phone: normalized,
    displayName,
    dateOfBirth: dateOfBirth || null,
    gender: gender || null,
    totalGamesPlayed: 0,
    createdAt: new Date().toISOString(),
  };

  players.set(normalized, player);
  res.json({ success: true, player, isNew: true });
});

// ── GET /api/player/stats/:phone ────────────────────
// إحصائيات لاعب
router.get('/stats/:phone', (req: Request, res: Response) => {
  const normalized = normalizePhone(req.params.phone);
  const player = players.get(normalized);

  if (!player) {
    return res.status(404).json({ error: 'اللاعب غير موجود' });
  }

  res.json({ player });
});

export default router;

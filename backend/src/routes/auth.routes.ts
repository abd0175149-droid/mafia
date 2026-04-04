// ══════════════════════════════════════════════════════
// 🔐 مسارات المصادقة (Auth Routes) - DEPRECATED
// تم استبداله بـ leader.routes.ts و player.routes.ts
// ══════════════════════════════════════════════════════

import { Router } from 'express';

const router = Router();

// Auth routes have been moved to:
// - /api/leader (leader.routes.ts)
// - /api/player (player.routes.ts)

router.get('/status', (_req, res) => {
  res.json({ message: 'Auth routes deprecated. Use /api/leader/login instead.' });
});

export default router;

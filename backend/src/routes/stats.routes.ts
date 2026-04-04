// ══════════════════════════════════════════════════════
// 📊 مسارات الإحصائيات (Stats Routes)
// ══════════════════════════════════════════════════════

import { Router } from 'express';

const router = Router();

// قائمة المتصدرين
router.get('/leaderboard', async (_req, res) => {
  // TODO: Implement after PostgreSQL tables are populated
  res.json({ leaderboard: [] });
});

// إحصائيات لاعب محدد
router.get('/player/:id', async (req, res) => {
  const { id } = req.params;
  // TODO: Implement after PostgreSQL tables are populated
  res.json({ playerId: id, stats: {} });
});

export default router;

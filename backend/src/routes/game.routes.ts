// ══════════════════════════════════════════════════════
// 🎮 مسارات الألعاب (Game Routes) - REST API
// لجلب الألعاب النشطة + التحقق من PIN + حالة اللعبة
// ══════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { getActiveRooms } from '../sockets/lobby.socket.js';
import { getRoom, getRoomByCode } from '../game/state.js';

const router = Router();

// ── GET /api/game/active ────────────────────────────
// قائمة الألعاب النشطة (بدون PIN)
router.get('/active', (_req: Request, res: Response) => {
  const rooms = getActiveRooms().map(r => ({
    roomId: r.roomId,
    roomCode: r.roomCode,
    gameName: r.gameName,
    playerCount: r.playerCount,
    maxPlayers: r.maxPlayers,
    // لا نُرسل displayPin!
  }));

  res.json({ success: true, rooms });
});

// ── POST /api/game/verify-pin ───────────────────────
// التحقق من PIN شاشة العرض
router.post('/verify-pin', async (req: Request, res: Response) => {
  const { roomId, pin } = req.body;

  if (!roomId || !pin) {
    return res.status(400).json({ success: false, error: 'roomId و pin مطلوبان' });
  }

  const rooms = getActiveRooms();
  const room = rooms.find(r => r.roomId === roomId);

  if (!room) {
    return res.status(404).json({ success: false, error: 'اللعبة غير موجودة' });
  }

  if (room.displayPin !== pin) {
    return res.status(401).json({ success: false, error: 'الرقم السري غير صحيح' });
  }

  // جلب الحالة الكاملة
  const state = await getRoom(roomId);

  res.json({
    success: true,
    gameName: room.gameName,
    roomCode: room.roomCode,
    roomId: room.roomId,
    playerCount: room.playerCount,
    maxPlayers: room.maxPlayers,
    state,
  });
});

// ── GET /api/game/state/:roomId ─────────────────────
// حالة لعبة محددة
router.get('/state/:roomId', async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const state = await getRoom(roomId);

  if (!state) {
    return res.status(404).json({ success: false, error: 'اللعبة غير موجودة' });
  }

  res.json({
    success: true,
    state: {
      roomId: state.roomId,
      roomCode: state.roomCode,
      phase: state.phase,
      round: state.round,
      config: state.config,
      players: state.players.map(p => ({
        physicalId: p.physicalId,
        name: p.name,
        isAlive: p.isAlive,
        isSilenced: p.isSilenced,
        // لا نُرسل role!
      })),
      winner: state.winner,
    },
  });
});

// ── POST /api/game/find-by-code ─────────────────────
// البحث عن لعبة بالكود
router.post('/find-by-code', async (req: Request, res: Response) => {
  const { roomCode } = req.body;

  if (!roomCode) {
    return res.status(400).json({ success: false, error: 'كود اللعبة مطلوب' });
  }

  const state = await getRoomByCode(roomCode);
  if (!state) {
    return res.status(404).json({ success: false, error: 'لم يتم العثور على لعبة بهذا الكود' });
  }

  res.json({
    success: true,
    roomId: state.roomId,
    roomCode: state.roomCode,
    gameName: state.config.gameName,
    playerCount: state.players.length,
    maxPlayers: state.config.maxPlayers,
  });
});

// ── GET /api/game/leader-rooms ──────────────────────
// ألعاب الليدر النشطة (للرجوع بعد الخروج)
router.get('/leader-rooms', (_req: Request, res: Response) => {
  const rooms = getActiveRooms().map(r => ({
    roomId: r.roomId,
    roomCode: r.roomCode,
    gameName: r.gameName,
    playerCount: r.playerCount,
    maxPlayers: r.maxPlayers,
    displayPin: r.displayPin,
  }));

  res.json({ success: true, rooms });
});

export default router;

import { Router, Request, Response } from 'express';
import { getActiveRooms } from '../sockets/lobby.socket.js';
import { getRoom, getRoomByCode } from '../game/state.js';
import { getFinishedMatches, getMatchDetails, getMatchesBySession } from '../services/match.service.js';

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
        gender: p.gender,
        // لا نُرسل role!
      })),
      teamCounts: {
        citizenAlive: state.players.filter(p => p.isAlive && p.role && !['GODFATHER','SILENCER','CHAMELEON','MAFIA_REGULAR'].includes(p.role)).length,
        mafiaAlive: state.players.filter(p => p.isAlive && p.role && ['GODFATHER','SILENCER','CHAMELEON','MAFIA_REGULAR'].includes(p.role)).length,
      },
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

// ── GET /api/game/history ───────────────────────────
// قائمة الألعاب المنتهية
router.get('/history', async (_req: Request, res: Response) => {
  try {
    const matches = await getFinishedMatches();
    res.json({ success: true, matches });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/game/history/:matchId ──────────────────
// ملخص لعبة محددة مع اللاعبين
router.get('/history/:matchId', async (req: Request, res: Response) => {
  try {
    const matchId = parseInt(req.params.matchId);
    if (isNaN(matchId)) {
      return res.status(400).json({ success: false, error: 'matchId غير صالح' });
    }

    const details = await getMatchDetails(matchId);
    if (!details) {
      return res.status(404).json({ success: false, error: 'المباراة غير موجودة' });
    }

    res.json({ success: true, match: details });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/game/session-history/:sessionId ─────────
// جلب ألعاب session محددة
router.get('/session-history/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) {
      return res.status(400).json({ success: false, error: 'sessionId غير صالح' });
    }

    const matches = await getMatchesBySession(sessionId);
    res.json({ success: true, matches });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/game/closed-sessions ───────────────────
// قائمة الغرف المنتهية مع عدد ألعاب كل غرفة
router.get('/closed-sessions', async (_req: Request, res: Response) => {
  try {
    const { getClosedSessions } = await import('../services/session.service.js');
    const sessions = await getClosedSessions();
    res.json({ success: true, sessions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;


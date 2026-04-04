// ══════════════════════════════════════════════════════
// 🟢 أحداث اللوبي (Lobby Socket Events)
// المرجع: docs/02_LOBBY_AND_SETUP.md
// ══════════════════════════════════════════════════════

import { Server, Socket } from 'socket.io';
import { createRoom, addPlayer, updatePlayer, getRoom, bindRole, setPhase, Phase } from '../game/state.js';
import { generateRoles, validateRoleDistribution, Role } from '../game/roles.js';

export function registerLobbyEvents(io: Server, socket: Socket) {

  // ── إنشاء غرفة جديدة ──────────────────────────
  socket.on('room:create', async (data: { maxJustifications?: number }, callback) => {
    try {
      const state = await createRoom(0, data.maxJustifications || 2);
      socket.join(state.roomId);
      // وسم السوكت كليدر
      socket.data.role = 'leader';
      socket.data.roomId = state.roomId;

      callback({ success: true, roomId: state.roomId, roomCode: state.roomCode });
      console.log(`🏠 Room created: ${state.roomId} (code: ${state.roomCode})`);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── انضمام لاعب ──────────────────────────────
  socket.on('room:join', async (data: {
    roomId: string;
    physicalId: number;
    name: string;
    googleId?: string;
  }, callback) => {
    try {
      const state = await addPlayer(data.roomId, data.physicalId, data.name, data.googleId || null);
      socket.join(data.roomId);
      socket.data.role = 'player';
      socket.data.roomId = data.roomId;
      socket.data.physicalId = data.physicalId;

      // بث للجميع في الغرفة
      io.to(data.roomId).emit('room:player-joined', {
        physicalId: data.physicalId,
        name: data.name,
        totalPlayers: state.players.length,
      });

      callback({ success: true });
      console.log(`👤 Player joined: #${data.physicalId} - ${data.name}`);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── صلاحية الليدر: تعديل/إضافة لاعب يدوياً ──
  socket.on('room:override-player', async (data: {
    roomId: string;
    physicalId: number;
    name: string;
    isNew?: boolean;
  }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader can override' });
      }

      let state;
      if (data.isNew) {
        state = await addPlayer(data.roomId, data.physicalId, data.name);
      } else {
        state = await updatePlayer(data.roomId, data.physicalId, { name: data.name });
      }

      io.to(data.roomId).emit('room:player-updated', {
        physicalId: data.physicalId,
        name: data.name,
        totalPlayers: state.players.length,
      });

      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── بدء توليد الأدوار ──────────────────────────
  socket.on('room:start-generation', async (data: { roomId: string }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader can start generation' });
      }

      const state = await getRoom(data.roomId);
      if (!state) return callback({ success: false, error: 'Room not found' });

      const playerCount = state.players.length;
      if (playerCount < 6) {
        return callback({ success: false, error: 'يجب أن يكون هناك 6 لاعبين على الأقل' });
      }

      const generated = generateRoles(playerCount);
      await setPhase(data.roomId, Phase.ROLE_GENERATION);

      // إرسال القائمة لليدر للتعديل
      socket.emit('setup:roles-generated', {
        mafiaRoles: generated.mafiaRoles,
        citizenRoles: generated.citizenRoles,
        totalMafia: generated.totalMafia,
        totalCitizens: generated.totalCitizens,
      });

      callback({ success: true });
      console.log(`🎲 Roles generated for ${playerCount} players`);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── اعتماد الأدوار النهائية ──────────────────────
  socket.on('setup:roles-confirmed', async (data: {
    roomId: string;
    roles: Role[];
  }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader can confirm roles' });
      }

      const state = await getRoom(data.roomId);
      if (!state) return callback({ success: false, error: 'Room not found' });

      const validation = validateRoleDistribution(data.roles, state.players.length);
      if (!validation.valid) {
        return callback({ success: false, error: validation.error });
      }

      await setPhase(data.roomId, Phase.ROLE_BINDING);

      // إرسال واجهة Drag & Drop لليدر
      socket.emit('setup:binding-start', {
        players: state.players.map(p => ({ physicalId: p.physicalId, name: p.name })),
        roles: data.roles,
      });

      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── ربط دور بلاعب (Drag & Drop) ──────────────────
  socket.on('setup:bind-role', async (data: {
    roomId: string;
    physicalId: number;
    role: Role;
  }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader can bind roles' });
      }

      await bindRole(data.roomId, data.physicalId, data.role);
      callback({ success: true });
      console.log(`🔗 Role bound: #${data.physicalId} → ${data.role}`);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── إنهاء الربط وبدء اللعبة ──────────────────────
  socket.on('setup:binding-complete', async (data: { roomId: string }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader can complete binding' });
      }

      const state = await getRoom(data.roomId);
      if (!state) return callback({ success: false, error: 'Room not found' });

      // التحقق أن جميع اللاعبين لديهم أدوار
      const unbound = state.players.filter(p => !p.role);
      if (unbound.length > 0) {
        return callback({
          success: false,
          error: `اللاعبون التالون بدون أدوار: ${unbound.map(p => `#${p.physicalId}`).join(', ')}`,
        });
      }

      await setPhase(data.roomId, Phase.DAY_DISCUSSION);

      // إشعار الجميع ببدء اللعبة
      io.to(data.roomId).emit('game:started', {
        round: 1,
        phase: Phase.DAY_DISCUSSION,
        playerCount: state.players.length,
      });

      callback({ success: true });
      console.log(`🎮 Game started in room ${data.roomId}!`);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });
}

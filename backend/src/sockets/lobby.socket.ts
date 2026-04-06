// ══════════════════════════════════════════════════════
// 🟢 أحداث اللوبي (Lobby Socket Events)
// المرجع: docs/02_LOBBY_AND_SETUP.md
// ══════════════════════════════════════════════════════

import { Server, Socket } from 'socket.io';
import { createRoom, addPlayer, updatePlayer, updateRoom, getRoom, getRoomByCode, bindRole, setPhase, Phase } from '../game/state.js';
import { generateRoles, validateRoleDistribution, Role } from '../game/roles.js';

export const activeRooms: Map<string, { roomId: string; roomCode: string; gameName: string; playerCount: number; maxPlayers: number; displayPin: string }> = new Map();

export function getActiveRooms() {
  return Array.from(activeRooms.values());
}

export async function seedDummyGame() {
  try {
    console.log('🌱 Seeding Dummy Game for quick testing from lobby.socket.ts...');
    const state = await createRoom('لعبة تجريبية (Auto Seeded)', 10, 2, '2026');
    console.log('🌱 Room created in Redis:', state.roomId);
    
    const names = ['أحمد', 'محمد', 'علي', 'خالد', 'عمر', 'سارة', 'فاطمة', 'تسنيم', 'ريم', 'نور'];
    const genders: ('MALE'|'FEMALE')[] = ['MALE', 'MALE', 'MALE', 'MALE', 'MALE', 'FEMALE', 'FEMALE', 'FEMALE', 'FEMALE', 'FEMALE'];
    
    for (let i = 0; i < 10; i++) {
      await addPlayer(state.roomId, i + 1, names[i], `070000000${i}`, null);
      await updatePlayer(state.roomId, i + 1, { gender: genders[i], dob: '1995-01-01' });
    }
    console.log('🌱 Players inserted successfully!');

    activeRooms.set(state.roomId, {
      roomId: state.roomId,
      roomCode: state.roomCode,
      gameName: state.config.gameName,
      playerCount: 10,
      maxPlayers: state.config.maxPlayers,
      displayPin: state.config.displayPin || '2026',
    });

    console.log(`✅ Dummy Game seeded successfully. RoomId: ${state.roomId}`);
    console.log(`🎮 Current Active Rooms size now: ${activeRooms.size}`);
  } catch (e) {
    console.error('❌ Failed to seed dummy game:', e);
  }
}

export function registerLobbyEvents(io: Server, socket: Socket) {

  // ── إنشاء غرفة جديدة ──────────────────────────
  socket.on('room:create', async (data: {
    gameName: string;
    maxPlayers?: number;
    maxJustifications?: number;
    displayPin?: string;
  }, callback) => {
    try {
      const gameName = data.gameName || 'لعبة مافيا';
      const maxPlayers = Math.min(Math.max(data.maxPlayers || 10, 6), 27);

      const state = await createRoom(
        gameName,
        maxPlayers,
        data.maxJustifications || 2,
        data.displayPin,
      );

      // تجهيز كروت اللاعبين تلقائياً بأسماء افتراضية
      for (let i = 1; i <= maxPlayers; i++) {
        await addPlayer(state.roomId, i, `لاعب ${i}`, `0700000000`, null);
        await updatePlayer(state.roomId, i, { gender: 'MALE', dob: '2000-01-01' });
      }

      socket.join(state.roomId);
      socket.data.role = 'leader';
      socket.data.roomId = state.roomId;

      // تتبع الغرفة النشطة
      activeRooms.set(state.roomId, {
        roomId: state.roomId,
        roomCode: state.roomCode,
        gameName,
        playerCount: maxPlayers,
        maxPlayers,
        displayPin: state.config.displayPin,
      });

      // إرسال حدث انضمام كل لاعب للواجهات
      const updatedState = await getRoom(state.roomId);
      for (let i = 1; i <= maxPlayers; i++) {
        const playerData = updatedState?.players.find(p => p.physicalId === i);
        io.to(state.roomId).emit('room:player-joined', {
          physicalId: i,
          name: `لاعب ${i}`,
          totalPlayers: i,
          gender: playerData?.gender || 'MALE',
        });
      }

      callback({
        success: true,
        roomId: state.roomId,
        roomCode: state.roomCode,
        displayPin: state.config.displayPin,
        gameName,
      });
      console.log(`🏠 Room created: ${state.roomId} (code: ${state.roomCode}, name: ${gameName}) with ${maxPlayers} auto-players`);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── قائمة الألعاب النشطة ──────────────────────
  socket.on('room:list-active', (data: any, callback) => {
    const rooms = getActiveRooms().map(r => ({
      roomId: r.roomId,
      roomCode: r.roomCode,
      gameName: r.gameName,
      playerCount: r.playerCount,
      maxPlayers: r.maxPlayers,
    }));
    callback({ success: true, rooms });
  });

  // ── التحقق من PIN شاشة العرض ──────────────────
  socket.on('room:verify-display-pin', async (data: { roomId: string; pin: string }, callback) => {
    try {
      const room = activeRooms.get(data.roomId);
      if (!room) {
        return callback({ success: false, error: 'اللعبة غير موجودة' });
      }

      if (room.displayPin !== data.pin) {
        return callback({ success: false, error: 'الرقم السري غير صحيح' });
      }

      socket.join(data.roomId);
      socket.data.role = 'display';
      socket.data.roomId = data.roomId;

      const state = await getRoom(data.roomId);
      callback({
        success: true,
        gameName: room.gameName,
        roomCode: room.roomCode,
        playerCount: room.playerCount,
        maxPlayers: room.maxPlayers,
        state,
      });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── البحث عن غرفة بالكود ──────────────────────
  socket.on('room:find-by-code', async (data: { roomCode: string }, callback) => {
    try {
      const state = await getRoomByCode(data.roomCode);
      if (!state) {
        return callback({ success: false, error: 'لم يتم العثور على لعبة بهذا الكود' });
      }

      callback({
        success: true,
        roomId: state.roomId,
        roomCode: state.roomCode,
        gameName: state.config.gameName,
        playerCount: state.players.length,
        maxPlayers: state.config.maxPlayers,
        occupiedSeats: state.players.map(p => p.physicalId),
      });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── انضمام لاعب ──────────────────────────────
  socket.on('room:join', async (data: {
    roomId: string;
    physicalId: number;
    name: string;
    phone?: string;
    playerId?: number;
    gender?: string;
    dob?: string;
  }, callback) => {
    try {
      const state = await addPlayer(
        data.roomId,
        data.physicalId,
        data.name,
        data.phone || null,
        data.playerId || null,
      );

      // تحديث الجنس وتاريخ الميلاد إذا تم إرسالها
      if (data.gender || data.dob) {
        await updatePlayer(data.roomId, data.physicalId, {
          gender: data.gender || 'MALE',
          dob: data.dob || '2000-01-01',
        });
      }

      socket.join(data.roomId);
      socket.data.role = 'player';
      socket.data.roomId = data.roomId;
      socket.data.physicalId = data.physicalId;

      // تحديث العداد
      const room = activeRooms.get(data.roomId);
      if (room) {
        room.playerCount = state.players.length;
      }

      // بث للجميع في الغرفة
      io.to(data.roomId).emit('room:player-joined', {
        physicalId: data.physicalId,
        name: data.name,
        totalPlayers: state.players.length,
        maxPlayers: state.config.maxPlayers,
        gender: data.gender || 'MALE',
      });

      callback({ success: true });
      console.log(`👤 Player joined: #${data.physicalId} - ${data.name} (${data.gender || 'MALE'})`);
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

      let state = await getRoom(data.roomId);
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

  // ── صلاحية الليدر: إضافة لاعب أوفلاين مع كامل البيانات ──
  socket.on('room:force-add-player', async (data: {
    roomId: string;
    physicalId: number;
    name: string;
    phone: string;
    dob: string;
    gender: string;
  }, callback) => {
    try {
      console.log(`[Backend-Socket] room:force-add-player 📥 Received request from leader for room ${data.roomId}`, data);
      
      if (socket.data.role !== 'leader') {
        console.warn(`[Backend-Socket] ❌ Failure: role is ${socket.data.role}, expected 'leader'`);
        return callback({ success: false, error: 'Only leader can override' });
      }

      console.log(`[Backend-Socket] ➡️ Calling addPlayer(${data.roomId}, ${data.physicalId}, ${data.name}, ${data.phone})`);
      const state = await addPlayer(data.roomId, data.physicalId, data.name, data.phone);
      
      console.log(`[Backend-Socket] ➡️ Calling updatePlayer for dob/gender: ${data.dob}, ${data.gender}`);
      await updatePlayer(data.roomId, data.physicalId, { dob: data.dob, gender: data.gender });

      const room = activeRooms.get(data.roomId);
      if (room) {
        room.playerCount = state.players.length;
      }

      console.log(`[Backend-Socket] 📢 Emitting room:player-joined to room ${data.roomId}`);
      io.to(data.roomId).emit('room:player-joined', {
        physicalId: data.physicalId,
        name: data.name,
        totalPlayers: state.players.length,
        maxPlayers: state.config.maxPlayers,
        gender: data.gender || 'MALE',
      });

      console.log(`[Backend-Socket] ✅ Done adding player #${data.physicalId}`);
      callback({ success: true });
    } catch (err: any) {
      console.error(`[Backend-Socket] ❌ Exception in room:force-add-player:`, err.message);
      callback({ success: false, error: err.message });
    }
  });

  // ── صلاحية الليدر: إزالة لاعب ──
  socket.on('room:kick-player', async (data: {
    roomId: string;
    physicalId: number;
  }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader can kick' });
      }

      const state = await getRoom(data.roomId);
      if (!state) return callback({ success: false, error: 'Room not found' });

      // Remove player
      state.players = state.players.filter(p => p.physicalId !== data.physicalId);
      await updateRoom(data.roomId, { players: state.players });

      const room = activeRooms.get(data.roomId);
      if (room) {
        room.playerCount = state.players.length;
      }

      io.to(data.roomId).emit('room:player-kicked', {
        physicalId: data.physicalId,
        totalPlayers: state.players.length,
      });

      callback({ success: true });
      console.log(`👑 Leader kicked player: #${data.physicalId}`);
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
      io.to(data.roomId).emit('game:phase-changed', { phase: Phase.ROLE_GENERATION });

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

      await updateRoom(data.roomId, { phase: Phase.ROLE_BINDING, rolesPool: data.roles });
      io.to(data.roomId).emit('game:phase-changed', { phase: Phase.ROLE_BINDING });

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

      const unboundPlayers = state.players.filter(p => !p.role);
      if (unboundPlayers.length > 0) {
        // Calculate remaining roles in the pool
        const pool = [...(state.rolesPool || [])];
        for (const p of state.players) {
           if (p.role) {
             const idx = pool.indexOf(p.role);
             if (idx !== -1) pool.splice(idx, 1);
           }
        }
        
        // Are ALL remaining roles 'CITIZEN'? (Only Citizens can be auto-assigned)
        const nonCitizenRoles = pool.filter(r => r !== Role.CITIZEN);
        if (nonCitizenRoles.length > 0) {
           return callback({
               success: false,
               error: `يجب توزيع الأدوار المميزة والمافيا كلياً. المتبقي: ${nonCitizenRoles.join(', ')}`,
           });
        }
        
        if (pool.length !== unboundPlayers.length) {
            return callback({ success: false, error: 'عدد الأدوار المتبقية لا يطابق عدد اللاعبين غير المربوطين.' });
        }
        
        // Auto-assign remaining CITIZEN roles
        for (let i = 0; i < unboundPlayers.length; i++) {
           await bindRole(data.roomId, unboundPlayers[i].physicalId, Role.CITIZEN);
        }
        
        // Refresh state object with the updated roles from memory
        Object.assign(state, await getRoom(data.roomId));
        console.log(`🤖 Auto-bound ${unboundPlayers.length} citizens in room ${data.roomId}`);
      }

      await setPhase(data.roomId, Phase.DAY_DISCUSSION);
      io.to(data.roomId).emit('game:phase-changed', { phase: Phase.DAY_DISCUSSION });

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

  // ── شاشة العرض تنضم للغرفة (بعد التحقق من PIN عبر REST) ──
  socket.on('display:join-room', (data: { roomId: string }) => {
    if (data.roomId) {
      socket.join(data.roomId);
      socket.data.role = 'display';
      socket.data.roomId = data.roomId;
      console.log(`📺 Display joined room: ${data.roomId}`);
    }
  });

  // ── الليدر يستعيد الغرفة بعد إعادة الاتصال ──
  socket.on('room:rejoin-leader', (data: { roomId: string }) => {
    if (data.roomId) {
      socket.join(data.roomId);
      socket.data.role = 'leader';
      socket.data.roomId = data.roomId;
      console.log(`👑 Leader rejoined room: ${data.roomId}`);
    }
  });

  // ── إغلاق الغرفة (Soft Delete) ────────────────
  socket.on('room:close', async (data: { roomId: string }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader can close the room' });
      }

      await setPhase(data.roomId, Phase.GAME_OVER);
      activeRooms.delete(data.roomId);
      
      io.to(data.roomId).emit('game:closed');

      callback({ success: true });
      console.log(`🔒 Room closed manually: ${data.roomId}`);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── تنظيف عند قطع الاتصال ─────────────────────
  socket.on('disconnect', () => {
    if (socket.data.role === 'leader' && socket.data.roomId) {
      console.log(`⚠️ Leader disconnected from room ${socket.data.roomId}`);
    }
    if (socket.data.role === 'display' && socket.data.roomId) {
      console.log(`⚠️ Display disconnected from room ${socket.data.roomId}`);
    }
  });
}

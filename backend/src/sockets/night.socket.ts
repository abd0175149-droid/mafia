// ══════════════════════════════════════════════════════
// 🌙 أحداث الليل (Night Socket Events)
// المرجع: docs/04_NIGHT_PHASE_ENGINE.md
// ══════════════════════════════════════════════════════

import { Server, Socket } from 'socket.io';
import { getRoom, setPhase, Phase, getAlivePlayers } from '../game/state.js';
import { getGameState, setGameState } from '../config/redis.js';
import { resolveNight, resetNightActions, getAvailableTargets } from '../game/night-resolver.js';
import { Role, NIGHT_ACTIVE_ROLES } from '../game/roles.js';
import { WinResult } from '../game/win-checker.js';

// ترتيب الطابور الإجباري
const NIGHT_QUEUE_ORDER: Role[] = [
  Role.GODFATHER,  // 1. الشيخ
  Role.SILENCER,   // 2. القص
  Role.SHERIFF,    // 3. الشريف
  Role.DOCTOR,     // 4. الطبيب
  Role.SNIPER,     // 5. القناص
];

export function registerNightEvents(io: Server, socket: Socket) {

  // ── بدء مرحلة الليل ──────────────────────────
  socket.on('night:start', async (data: { roomId: string }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader' });
      }

      const state = await resetNightActions(data.roomId);
      await setPhase(data.roomId, Phase.NIGHT);

      // إبلاغ جميع الأطراف بتغير المرحلة
      io.to(data.roomId).emit('game:phase-changed', { phase: Phase.NIGHT });

      // إرسال أنيميشن الليل لشاشة العرض
      io.to(data.roomId).emit('display:night-started');

      // تحديد أول دور نشط حي
      const firstStep = getNextQueueStep(state, -1);
      if (firstStep) {
        socket.emit('night:queue-step', firstStep);
      }

      state.round += 1;
      // تصفير عدد مرات التبرير لكل لاعب حي — جولة جديدة
      state.players.forEach((p: any) => { if (p.isAlive) p.justificationCount = 0; });
      await setGameState(data.roomId, state);

      callback({ success: true, round: state.round });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── تسجيل اختيار الليدر لهدف الدور الحالي ──
  socket.on('night:submit-action', async (data: {
    roomId: string;
    role: Role;
    targetPhysicalId: number;
  }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader' });
      }

      const state = await getGameState(data.roomId);
      if (!state) return callback({ success: false, error: 'Room not found' });

      // تسجيل الاختيار حسب الدور
      switch (data.role) {
        case Role.GODFATHER:
          state.nightActions.godfatherTarget = data.targetPhysicalId;
          // أنيميشن اغتيال لشاشة العرض
          io.to(data.roomId).emit('night:animation', {
            type: 'ASSASSINATION_ATTEMPT',
            targetPhysicalId: data.targetPhysicalId,
          });
          break;
        case Role.SILENCER:
          state.nightActions.silencerTarget = data.targetPhysicalId;
          io.to(data.roomId).emit('night:animation', {
            type: 'SILENCE',
            targetPhysicalId: data.targetPhysicalId,
          });
          break;
        case Role.SHERIFF:
          state.nightActions.sheriffTarget = data.targetPhysicalId;
          io.to(data.roomId).emit('night:animation', {
            type: 'INVESTIGATION',
            targetPhysicalId: data.targetPhysicalId,
          });
          break;
        case Role.DOCTOR:
          state.nightActions.doctorTarget = data.targetPhysicalId;
          io.to(data.roomId).emit('night:animation', {
            type: 'PROTECTION',
            targetPhysicalId: data.targetPhysicalId,
          });
          break;
        case Role.SNIPER:
          state.nightActions.sniperTarget = data.targetPhysicalId;
          io.to(data.roomId).emit('night:animation', {
            type: 'SNIPE',
            targetPhysicalId: data.targetPhysicalId,
          });
          break;
        case Role.NURSE:
          state.nightActions.nurseTarget = data.targetPhysicalId;
          break;
      }

      await setGameState(data.roomId, state);

      // الانتقال للخطوة التالية
      const currentIndex = NIGHT_QUEUE_ORDER.indexOf(data.role);
      const nextStep = getNextQueueStep(state, currentIndex);

      if (nextStep) {
        socket.emit('night:queue-step', nextStep);
      } else {
        // انتهى الطابور → معالجة التقاطعات
        socket.emit('night:queue-complete');
      }

      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── تخطي (للقناص) ──────────────────────────────
  socket.on('night:skip-action', async (data: {
    roomId: string;
    role: Role;
  }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader' });
      }

      const state = await getGameState(data.roomId);
      if (!state) return callback({ success: false, error: 'Room not found' });

      // الانتقال للخطوة التالية
      const currentIndex = NIGHT_QUEUE_ORDER.indexOf(data.role);
      const nextStep = getNextQueueStep(state, currentIndex);

      if (nextStep) {
        socket.emit('night:queue-step', nextStep);
      } else {
        socket.emit('night:queue-complete');
      }

      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── تفعيل الممرضة يدوياً ──────────────────────
  socket.on('night:activate-nurse', async (data: { roomId: string }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader' });
      }

      const state = await getGameState(data.roomId);
      if (!state) return callback({ success: false, error: 'Room not found' });

      // التحقق أن الطبيب ميت
      const doctor = state.players.find(p => p.role === Role.DOCTOR);
      if (doctor && doctor.isAlive) {
        return callback({ success: false, error: 'الطبيب لا يزال حياً' });
      }

      const nurse = state.players.find(p => p.role === Role.NURSE && p.isAlive);
      if (!nurse) {
        return callback({ success: false, error: 'الممرضة غير موجودة أو ميتة' });
      }

      // إرسال خطوة الممرضة
      const targets = getAvailableTargets(state, Role.NURSE);
      socket.emit('night:queue-step', {
        role: Role.NURSE,
        roleName: 'الممرضة',
        availableTargets: targets.map(id => {
          const p = state.players.find(pl => pl.physicalId === id);
          return { physicalId: id, name: p?.name || '' };
        }),
        canSkip: false,
      });

      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── معالجة التقاطعات (بعد إنهاء الطابور) ────
  socket.on('night:resolve', async (data: { roomId: string }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader' });
      }

      const resolution = await resolveNight(data.roomId);
      await setPhase(data.roomId, Phase.MORNING_RECAP);

      // إرسال كروت الملخص لليدر
      socket.emit('night:morning-recap', {
        events: resolution.events,
      });

      // فحص نهاية اللعبة
      if (resolution.winResult !== WinResult.GAME_CONTINUES) {
        const state = await getRoom(data.roomId);
        io.to(data.roomId).emit('game:over', {
          winner: resolution.winResult === WinResult.MAFIA_WIN ? 'MAFIA' : 'CITIZEN',
          players: state?.players,
        });
        await setPhase(data.roomId, Phase.GAME_OVER);
      }

      callback({ success: true, events: resolution.events });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── عرض حدث على شاشة العرض ────────────────────
  socket.on('night:display-event', async (data: {
    roomId: string;
    eventIndex: number;
  }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader' });
      }

      const state = await getGameState(data.roomId);
      if (!state) return callback({ success: false, error: 'Room not found' });

      const event = state.morningEvents[data.eventIndex];
      if (!event) return callback({ success: false, error: 'Event not found' });

      event.revealed = true;
      await setGameState(data.roomId, state);

      // بث الأنيميشن لشاشة العرض
      io.to(data.roomId).emit('night:animation', {
        type: event.type,
        targetPhysicalId: event.targetPhysicalId,
        targetName: event.targetName,
        extra: event.extra,
      });

      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });
}

// ── مساعد: الحصول على الخطوة التالية في الطابور ──

interface QueueStep {
  role: Role;
  roleName: string;
  availableTargets: { physicalId: number; name: string }[];
  canSkip: boolean;
}

function getNextQueueStep(state: any, currentIndex: number): QueueStep | null {
  const ROLE_NAMES: Record<string, string> = {
    [Role.GODFATHER]: 'شيخ المافيا',
    [Role.SILENCER]: 'قص المافيا',
    [Role.SHERIFF]: 'الشريف',
    [Role.DOCTOR]: 'الطبيب',
    [Role.SNIPER]: 'القناص',
  };

  for (let i = currentIndex + 1; i < NIGHT_QUEUE_ORDER.length; i++) {
    const role = NIGHT_QUEUE_ORDER[i];

    // فحص: هل صاحب هذا الدور حي؟
    const player = state.players.find((p: any) => p.role === role && p.isAlive);
    if (!player) continue;

    const targets = getAvailableTargets(state, role);

    return {
      role,
      roleName: ROLE_NAMES[role] || role,
      availableTargets: targets.map((id: number) => {
        const p = state.players.find((pl: any) => pl.physicalId === id);
        return { physicalId: id, name: p?.name || '' };
      }),
      canSkip: role === Role.SNIPER, // القناص فقط يمكنه التخطي
    };
  }

  return null;
}

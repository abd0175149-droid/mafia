// ══════════════════════════════════════════════════════
// ☀️ أحداث النهار (Day Socket Events)
// المرجع: docs/03_DAY_PHASE_ENGINE.md
// ══════════════════════════════════════════════════════

import { Server, Socket } from 'socket.io';
import { getRoom, setPhase, Phase } from '../game/state.js';
import { createDeal, removeDeal } from '../game/deal-engine.js';
import {
  initVoting,
  castVote,
  isVotingComplete,
  getVoteResult,
  resolveVoting,
  handleTieBreaker,
  TieBreakerAction,
} from '../game/vote-engine.js';
import { WinResult } from '../game/win-checker.js';

export function registerDayEvents(io: Server, socket: Socket) {

  // ── بدء مرحلة التصويت ──────────────────────────
  socket.on('day:start-voting', async (data: { roomId: string }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader' });
      }

      const state = await initVoting(data.roomId);
      await setPhase(data.roomId, Phase.DAY_VOTING);

      io.to(data.roomId).emit('day:voting-started', {
        candidates: state.votingState.candidates,
        hiddenPlayers: state.votingState.hiddenPlayersFromVoting,
      });

      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── إنشاء اتفاقية ──────────────────────────────
  socket.on('day:create-deal', async (data: {
    roomId: string;
    initiatorPhysicalId: number;
    targetPhysicalId: number;
  }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader' });
      }

      const state = await createDeal(data.roomId, data.initiatorPhysicalId, data.targetPhysicalId);

      io.to(data.roomId).emit('day:deal-created', {
        deals: state.votingState.deals,
      });

      callback({ success: true, deals: state.votingState.deals });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── إلغاء اتفاقية ──────────────────────────────
  socket.on('day:remove-deal', async (data: {
    roomId: string;
    dealId: string;
  }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader' });
      }

      const state = await removeDeal(data.roomId, data.dealId);

      io.to(data.roomId).emit('day:deal-removed', {
        deals: state.votingState.deals,
      });

      callback({ success: true, deals: state.votingState.deals });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── تسجيل صوت ──────────────────────────────────
  socket.on('day:cast-vote', async (data: {
    roomId: string;
    candidateIndex: number;
    delta: 1 | -1;
  }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader' });
      }

      const state = await castVote(data.roomId, data.candidateIndex, data.delta);

      // بث تحديث الأصوات لحظياً
      io.to(data.roomId).emit('day:vote-update', {
        candidates: state.votingState.candidates,
        totalVotesCast: state.votingState.totalVotesCast,
      });

      // فحص الإقفال الآلي
      if (isVotingComplete(state)) {
        // فرز النتائج بدون إقصاء → الانتقال لمرحلة التبرير
        const sortResult = await getVoteResult(data.roomId);
        await setPhase(data.roomId, Phase.DAY_JUSTIFICATION);

        // إرسال بيانات التبرير (المتهمين)
        const accusedPlayers = sortResult.topCandidates.map(c => {
          const p = state.players.find(pl => pl.physicalId === c.targetPhysicalId);
          return {
            ...c,
            name: p?.name,
            role: p?.role,  // مكشوف لليدر فقط (الفرونت يفلترها)
            gender: p?.gender,
          };
        });

        io.to(data.roomId).emit('day:justification-started', {
          resultType: sortResult.type, // 'SINGLE_WINNER' | 'TIE'
          accused: accusedPlayers,
          topVotes: sortResult.topVotes,
          candidates: state.votingState.candidates,
        });

        io.to(data.roomId).emit('day:voting-locked', {
          candidates: state.votingState.candidates,
        });
      }

      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── حسم النتيجة (ليدر يضغط resolve يدوياً - Fallback) ──
  socket.on('day:resolve', async (data: { roomId: string }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader' });
      }
      // في حال ضغط الليدر resolve يدوياً (fallback)
      const sortResult = await getVoteResult(data.roomId);
      await setPhase(data.roomId, Phase.DAY_JUSTIFICATION);
      const state = await getRoom(data.roomId);
      const accusedPlayers = sortResult.topCandidates.map(c => {
        const p = state?.players.find(pl => pl.physicalId === c.targetPhysicalId);
        return { ...c, name: p?.name, role: p?.role, gender: p?.gender };
      });
      io.to(data.roomId).emit('day:justification-started', {
        resultType: sortResult.type,
        accused: accusedPlayers,
        topVotes: sortResult.topVotes,
        candidates: state?.votingState?.candidates || [],
      });
      callback({ success: true, result: sortResult });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── بدء تايمر التبرير ──────────────────────────
  socket.on('day:start-justification-timer', async (data: {
    roomId: string;
    physicalId: number;
    timeLimitSeconds: number;
  }, callback) => {
    try {
      if (socket.data.role !== 'leader') return callback({ success: false, error: 'Only leader' });

      io.to(data.roomId).emit('day:justification-timer-started', {
        physicalId: data.physicalId,
        timeLimitSeconds: data.timeLimitSeconds,
        startTime: Date.now(),
      });

      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── تنفيذ الإقصاء (بعد التبرير) ──────────────────
  socket.on('day:execute-elimination', async (data: { roomId: string }, callback) => {
    try {
      if (socket.data.role !== 'leader') return callback({ success: false, error: 'Only leader' });

      const result = await resolveVoting(data.roomId);

      if (result.type === 'TIE') {
        await setPhase(data.roomId, Phase.DAY_TIEBREAKER);
        io.to(data.roomId).emit('day:tie', { tiedCandidates: result.tiedCandidates });
      } else {
        io.to(data.roomId).emit('day:elimination-pending', {
          eliminated: result.eliminated,
          revealedRoles: result.revealedRoles,
          winResult: result.winResult,
          type: result.type,
        });
      }

      callback({ success: true, result });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── العفو (بعد التبرير) ──────────────────────────
  socket.on('day:pardon', async (data: { roomId: string }, callback) => {
    try {
      if (socket.data.role !== 'leader') return callback({ success: false, error: 'Only leader' });

      // لا إقصاء → الانتقال لليل
      io.to(data.roomId).emit('day:pardoned');
      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── كشف النتيجة ──────────────────────────────
  socket.on('day:trigger-reveal', async (data: { roomId: string, result: any }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader' });
      }

      const result = data.result;
      
      io.to(data.roomId).emit('day:elimination-revealed', {
        eliminated: result.eliminated,
        revealedRoles: result.revealedRoles,
        type: result.type,
      });

      // فحص نهاية اللعبة
      if (result.winResult !== WinResult.GAME_CONTINUES) {
        const state = await getRoom(data.roomId);
        io.to(data.roomId).emit('game:over', {
          winner: result.winResult === WinResult.MAFIA_WIN ? 'MAFIA' : 'CITIZEN',
          players: state?.players,
        });
        await setPhase(data.roomId, Phase.GAME_OVER);
      }

      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── إجراء كسر التعادل ──────────────────────────
  socket.on('day:tie-action', async (data: {
    roomId: string;
    action: TieBreakerAction;
    tiedCandidates?: any[];
  }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader' });
      }

      const state = await handleTieBreaker(data.roomId, data.action, data.tiedCandidates);

      if (data.action === TieBreakerAction.CANCEL) {
        io.to(data.roomId).emit('day:cancelled');
      } else if (data.action === TieBreakerAction.ELIMINATE_ALL) {
        io.to(data.roomId).emit('day:elimination', {
          eliminated: data.tiedCandidates?.map(c => c.targetPhysicalId) || [],
          type: 'ELIMINATE_ALL',
        });
      } else {
        await setPhase(data.roomId, Phase.DAY_VOTING);
        io.to(data.roomId).emit('day:voting-started', {
          candidates: state.votingState.candidates,
          hiddenPlayers: state.votingState.hiddenPlayersFromVoting,
          tieBreakerLevel: state.votingState.tieBreakerLevel,
        });
      }

      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── 🗣️ بدء دورة النقاش ──────────────────────────
  socket.on('day:start-discussion', async (data: {
    roomId: string;
    startPhysicalId: number;
    timeLimitSeconds: number;
  }, callback) => {
    try {
      if (socket.data.role !== 'leader') return callback({ success: false, error: 'Only leader' });

      // @ts-ignore
      const { getRoom, updateRoom, SpeakerStatus } = await import('../game/state.js');
      const state = await getRoom(data.roomId);
      if (!state) return callback({ success: false, error: 'Room not found' });

      // تحديد اللاعبين المؤهلين للتحدث (أحياء، وغير مسكتين، وغيرهم من الموتى)
      // Wait, speaking queue should have ALL alive players. We will handle 'silenced' on the fly or just keep them in queue to trigger the SILENCED animation!
      // So queue should be all players where isAlive = true.
      const alivePlayers = state.players.filter(p => p.isAlive).sort((a, b) => a.physicalId - b.physicalId);
      if (alivePlayers.length === 0) return callback({ success: false, error: 'No alive players' });

      // Re-arrange the queue starting from startPhysicalId
      const startIndex = alivePlayers.findIndex(p => p.physicalId === data.startPhysicalId);
      if (startIndex === -1) return callback({ success: false, error: 'Invalid start id' });

      const speakingQueue: number[] = [];
      for (let i = startIndex; i < alivePlayers.length; i++) speakingQueue.push(alivePlayers[i].physicalId);
      for (let i = 0; i < startIndex; i++) speakingQueue.push(alivePlayers[i].physicalId);

      const currentSpeakerId = speakingQueue.shift() || null;
      
      const upcomingSilencedId = speakingQueue.length > 0 
        ? (state.players.find(p => p.physicalId === speakingQueue[0])?.isSilenced ? speakingQueue[0] : null)
        : null;

      const discussionState = {
        currentSpeakerId,
        timeLimitSeconds: data.timeLimitSeconds,
        timeRemaining: data.timeLimitSeconds,
        startTime: null,
        status: SpeakerStatus.WAITING,
        speakingQueue,
        hasSpoken: [],
        isFinished: false,
        upcomingSilencedId,
      };

      await updateRoom(data.roomId, { discussionState });
      io.to(data.roomId).emit('day:discussion-updated', { discussionState });

      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── ⏳ أفعال التوقيت (Start, Pause, Resume) ────────
  socket.on('day:timer-action', async (data: {
    roomId: string;
    action: 'START' | 'PAUSE' | 'RESUME';
  }, callback) => {
    try {
      if (socket.data.role !== 'leader') return callback({ success: false, error: 'Only leader' });

      // @ts-ignore
      const { getRoom, updateRoom, SpeakerStatus } = await import('../game/state.js');
      const state = await getRoom(data.roomId);
      if (!state || !state.discussionState) return callback({ success: false, error: 'No active discussion' });

      const ds = state.discussionState;
      if (ds.isFinished) return callback({ success: false, error: 'Discussion is finished' });

      if (data.action === 'START' || data.action === 'RESUME') {
        ds.status = SpeakerStatus.SPEAKING;
        ds.startTime = Date.now();
      } else if (data.action === 'PAUSE') {
        // Calculate elapsed
        if (ds.startTime) {
          const elapsed = Math.floor((Date.now() - ds.startTime) / 1000);
          ds.timeRemaining = Math.max(0, ds.timeRemaining - elapsed);
        }
        ds.status = SpeakerStatus.PAUSED;
        ds.startTime = null;
      }

      await updateRoom(data.roomId, { discussionState: ds });
      io.to(data.roomId).emit('day:discussion-updated', { discussionState: ds });

      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── ⏭️ المتحدث التالي ───────────────────────────
  socket.on('day:next-speaker', async (data: { roomId: string }, callback) => {
    try {
      if (socket.data.role !== 'leader') return callback({ success: false, error: 'Only leader' });

      // @ts-ignore
      const { getRoom, updateRoom, SpeakerStatus } = await import('../game/state.js');
      const state = await getRoom(data.roomId);
      if (!state || !state.discussionState) return callback({ success: false, error: 'No active discussion' });

      const ds = state.discussionState;
      if (ds.currentSpeakerId) ds.hasSpoken.push(ds.currentSpeakerId);

      // Function to recursively find the next valid speaker (skipping silenced ones and emitting animation)
      const popNextValidSpeaker = (): number | null => {
        while (ds.speakingQueue.length > 0) {
          const nextId = ds.speakingQueue.shift()!;
          const player = state.players.find(p => p.physicalId === nextId);
          if (player?.isSilenced) {
            // Signal to clients to play animation for this specific silenced player
            io.to(data.roomId).emit('day:show-silenced', { physicalId: nextId });
            ds.hasSpoken.push(nextId);
            continue;
          }
          return nextId;
        }
        return null;
      };

      const nextSpeakerId = popNextValidSpeaker();

      if (nextSpeakerId !== null) {
        ds.currentSpeakerId = nextSpeakerId;
        ds.timeRemaining = ds.timeLimitSeconds;
        ds.startTime = null;
        ds.status = SpeakerStatus.WAITING;
        
        // Find if the one after this is silenced
        ds.upcomingSilencedId = ds.speakingQueue.length > 0 
          ? (state.players.find(p => p.physicalId === ds.speakingQueue[0])?.isSilenced ? ds.speakingQueue[0] : null)
          : null;
      } else {
        ds.currentSpeakerId = null;
        ds.isFinished = true;
        ds.startTime = null;
        ds.status = SpeakerStatus.WAITING;
      }

      await updateRoom(data.roomId, { discussionState: ds });
      io.to(data.roomId).emit('day:discussion-updated', { discussionState: ds });

      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });
}

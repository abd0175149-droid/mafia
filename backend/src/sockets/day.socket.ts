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
        candidates: state.votingState.candidates,
        hiddenPlayers: state.votingState.hiddenPlayersFromVoting,
      });

      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── إلغاء اتفاقية ──────────────────────────────
  socket.on('day:remove-deal', async (data: {
    roomId: string;
    initiatorPhysicalId: number;
    targetPhysicalId: number;
  }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader' });
      }

      const state = await removeDeal(data.roomId, data.initiatorPhysicalId, data.targetPhysicalId);

      io.to(data.roomId).emit('day:deal-removed', {
        candidates: state.votingState.candidates,
        hiddenPlayers: state.votingState.hiddenPlayersFromVoting,
      });

      callback({ success: true });
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
        io.to(data.roomId).emit('day:voting-locked', {
          candidates: state.votingState.candidates,
        });
      }

      callback({ success: true });
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // ── حسم النتيجة ──────────────────────────────
  socket.on('day:resolve', async (data: { roomId: string }, callback) => {
    try {
      if (socket.data.role !== 'leader') {
        return callback({ success: false, error: 'Only leader' });
      }

      const result = await resolveVoting(data.roomId);

      if (result.type === 'TIE') {
        await setPhase(data.roomId, Phase.DAY_TIEBREAKER);
        io.to(data.roomId).emit('day:tie', {
          tiedCandidates: result.tiedCandidates,
        });
      } else {
        io.to(data.roomId).emit('day:elimination', {
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
      }

      callback({ success: true, result });
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
        // الانتقال لليل بدون إقصاء
        io.to(data.roomId).emit('day:cancelled');
      } else if (data.action === TieBreakerAction.ELIMINATE_ALL) {
        io.to(data.roomId).emit('day:elimination', {
          eliminated: data.tiedCandidates?.map(c => c.targetPhysicalId) || [],
          type: 'ELIMINATE_ALL',
        });
      } else {
        // إعادة التصويت أو حصر
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
}

// ══════════════════════════════════════════════════════
// 🗳️ محرك التصويت (Vote Engine)
// المرجع: docs/03_DAY_PHASE_ENGINE.md - القسم 2 و 3
// ══════════════════════════════════════════════════════

import { type GameState, type Candidate, CandidateType, getAlivePlayers, type PlayerCandidate } from './state.js';
import { getGameState, setGameState } from '../config/redis.js';
import { checkWinCondition, WinResult } from './win-checker.js';
import { isMafiaRole } from './roles.js';

// ── تهيئة ساحة التصويت ──────────────────────────

/**
 * تهيئة ساحة التصويت لجولة جديدة
 * - يضاف كارت عادي لكل لاعب حي غير مُسكت
 */
export async function initVoting(roomId: string): Promise<GameState> {
  const state = await getGameState(roomId);
  if (!state) throw new Error(`Room ${roomId} not found`);

  const alive = getAlivePlayers(state);

  // استخراج أهداف الاتفاقيات لإخفاء كروتهم العادية
  const dealTargets = state.votingState.deals.map(d => d.targetPhysicalId);

  // تحويل الاتفاقيات المُجهزة إلى مرشحين للتصويت
  const dealCandidates: Candidate[] = state.votingState.deals.map(d => ({
    type: CandidateType.DEAL as const,
    id: d.id,
    initiatorPhysicalId: d.initiatorPhysicalId,
    targetPhysicalId: d.targetPhysicalId,
    votes: 0,
  }));

  // إنشاء كارت عادي للوضع الطبيعي للاعبين الأحياء غير المستهدفين باتفاقية وغير المسكتين (المسكت لا يصوت عليه؟ بلى يمكن التصويت ضده، المسكت فقط يُحرم من الكلام.. انتظر، 'غير مُسكت' في vote-engine القديم كانت تعني أنه لا يضاف كمرشح؟ لا، المسكت لا يمكن التصويت عليه ربما. سنترك الفلتر كما كان).
  const playerCandidates: Candidate[] = alive
    .filter(p => !p.isSilenced && !dealTargets.includes(p.physicalId))
    .map(p => ({
      type: CandidateType.PLAYER as const,
      targetPhysicalId: p.physicalId,
      votes: 0,
    }));

  const allCandidates = [...dealCandidates, ...playerCandidates];

  state.votingState = {
    totalVotesCast: 0,
    deals: state.votingState.deals, // نحتفظ بها لغايات المرجعية
    candidates: allCandidates,
    hiddenPlayersFromVoting: dealTargets,
    tieBreakerLevel: 0,
  };

  await setGameState(roomId, state);
  return state;
}

// ── تسجيل صوت ──────────────────────────────────

/**
 * تسجيل صوت (+1 أو -1)
 * - delta: +1 لإضافة صوت، -1 لإزالة صوت
 */
export async function castVote(
  roomId: string,
  candidateIndex: number,
  delta: 1 | -1
): Promise<GameState> {
  const state = await getGameState(roomId);
  if (!state) throw new Error(`Room ${roomId} not found`);

  const candidate = state.votingState.candidates[candidateIndex];
  if (!candidate) throw new Error(`Candidate at index ${candidateIndex} not found`);

  // منع الأصوات السالبة
  if (candidate.votes + delta < 0) {
    throw new Error('Cannot have negative votes');
  }

  candidate.votes += delta;
  state.votingState.totalVotesCast += delta;

  await setGameState(roomId, state);
  return state;
}

// ── فحص اكتمال التصويت ──────────────────────────

/**
 * الإقفال الآلي: عندما (مجموع الأصوات == عدد الأحياء)
 */
export function isVotingComplete(state: GameState): boolean {
  const aliveCount = getAlivePlayers(state).filter(p => !p.isSilenced).length;
  return state.votingState.totalVotesCast >= aliveCount;
}

// ── حسم النتيجة ──────────────────────────────────

export interface VoteResolution {
  type: 'ELIMINATION' | 'DEAL_ELIMINATION' | 'TIE';
  eliminated: number[];        // physicalIds المقصيين
  revealedRoles: { physicalId: number; role: string }[];
  winResult: WinResult;
  tiedCandidates?: Candidate[]; // في حال التعادل
}

/**
 * حسم نتيجة التصويت
 */
export async function resolveVoting(roomId: string): Promise<VoteResolution> {
  const state = await getGameState(roomId);
  if (!state) throw new Error(`Room ${roomId} not found`);

  // ترتيب المرشحين حسب الأصوات (تنازلي)
  const sorted = [...state.votingState.candidates].sort((a, b) => b.votes - a.votes);

  if (sorted.length === 0) {
    return { type: 'TIE', eliminated: [], revealedRoles: [], winResult: WinResult.GAME_CONTINUES };
  }

  const topVotes = sorted[0].votes;
  const tied = sorted.filter(c => c.votes === topVotes);

  // ── حالة التعادل ──
  if (tied.length > 1) {
    return {
      type: 'TIE',
      eliminated: [],
      revealedRoles: [],
      winResult: WinResult.GAME_CONTINUES,
      tiedCandidates: tied,
    };
  }

  // ── فوز مرشح واحد ──
  const winner = sorted[0];
  const eliminated: number[] = [];
  const revealedRoles: { physicalId: number; role: string }[] = [];

  if (winner.type === CandidateType.PLAYER) {
    // فوز لاعب عادي: يُقصى وتكشف هويته
    const player = state.players.find(p => p.physicalId === winner.targetPhysicalId);
    if (player) {
      player.isAlive = false;
      eliminated.push(player.physicalId);
      revealedRoles.push({ physicalId: player.physicalId, role: player.role || 'UNKNOWN' });
    }
  } else if (winner.type === CandidateType.DEAL) {
    // فوز اتفاقية
    const target = state.players.find(p => p.physicalId === winner.targetPhysicalId);
    const initiator = state.players.find(p => p.physicalId === winner.initiatorPhysicalId);

    if (target) {
      target.isAlive = false;
      eliminated.push(target.physicalId);
      revealedRoles.push({ physicalId: target.physicalId, role: target.role || 'UNKNOWN' });

      // إذا كان المستهدف مواطناً → يُقصى المبادر أيضاً
      if (target.role && !isMafiaRole(target.role) && initiator) {
        initiator.isAlive = false;
        eliminated.push(initiator.physicalId);
        revealedRoles.push({ physicalId: initiator.physicalId, role: initiator.role || 'UNKNOWN' });
      }
    }
  }

  // فحص شرط الفوز بعد الإقصاء
  const winResult = checkWinCondition(state);
  if (winResult !== WinResult.GAME_CONTINUES) {
    state.winner = winResult === WinResult.MAFIA_WIN ? 'MAFIA' : 'CITIZEN';
  }

  await setGameState(roomId, state);

  return { type: winner.type === CandidateType.DEAL ? 'DEAL_ELIMINATION' : 'ELIMINATION', eliminated, revealedRoles, winResult };
}

// ── كسر التعادل ──────────────────────────────────

export enum TieBreakerAction {
  REVOTE = 'REVOTE',               // تصفير وإعادة
  NARROW = 'NARROW',               // حصر التصويت بين المتعادلين
  CANCEL = 'CANCEL',               // إلغاء التصويت
  ELIMINATE_ALL = 'ELIMINATE_ALL',  // إقصاء الجميع
}

export async function handleTieBreaker(
  roomId: string,
  action: TieBreakerAction,
  tiedCandidates?: Candidate[]
): Promise<GameState> {
  const state = await getGameState(roomId);
  if (!state) throw new Error(`Room ${roomId} not found`);

  switch (action) {
    case TieBreakerAction.REVOTE:
      // تصفير العدادات وإعادة الجولة لنفس الكروت
      state.votingState.totalVotesCast = 0;
      state.votingState.candidates.forEach(c => { c.votes = 0; });
      state.votingState.tieBreakerLevel = 1;
      break;

    case TieBreakerAction.NARROW:
      // إخفاء الكل وإبقاء المتعادلين فقط
      if (tiedCandidates) {
        state.votingState.candidates = tiedCandidates.map(c => ({ ...c, votes: 0 }));
        state.votingState.totalVotesCast = 0;
        state.votingState.tieBreakerLevel = 2;
      }
      break;

    case TieBreakerAction.CANCEL:
      // إلغاء التصويت بدون إقصاء
      state.votingState.totalVotesCast = 0;
      state.votingState.candidates = [];
      state.votingState.tieBreakerLevel = 0;
      break;

    case TieBreakerAction.ELIMINATE_ALL:
      // إقصاء جميع المتعادلين
      if (tiedCandidates) {
        for (const candidate of tiedCandidates) {
          const physicalId = candidate.type === CandidateType.DEAL
            ? candidate.targetPhysicalId
            : candidate.targetPhysicalId;
          const player = state.players.find(p => p.physicalId === physicalId);
          if (player) player.isAlive = false;
        }
      }
      state.votingState.tieBreakerLevel = 0;
      break;
  }

  await setGameState(roomId, state);
  return state;
}

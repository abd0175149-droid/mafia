// ══════════════════════════════════════════════════════
// 🤝 محرك الاتفاقيات (Deal Engine)
// المرجع: docs/03_DAY_PHASE_ENGINE.md - القسم 1
// ══════════════════════════════════════════════════════

import { type GameState, getAlivePlayers, CandidateType, type DealCandidate } from './state.js';
import { getGameState, setGameState } from '../config/redis.js';

/**
 * إنشاء اتفاقية جديدة
 * - لا يمكن استهداف نفس اللاعب في اتفاقيتين مختلفتين
 * - يُخفى كارت المستهدف من ساحة التصويت ويُستبدل بكارت الاتفاقية
 */
export async function createDeal(
  roomId: string,
  initiatorPhysicalId: number,
  targetPhysicalId: number
): Promise<GameState> {
  const state = await getGameState(roomId);
  if (!state) throw new Error(`Room ${roomId} not found`);

  // التحقق: كلاهما حي
  const alive = getAlivePlayers(state);
  const initiator = alive.find(p => p.physicalId === initiatorPhysicalId);
  const target = alive.find(p => p.physicalId === targetPhysicalId);

  if (!initiator) throw new Error(`Initiator #${initiatorPhysicalId} is not alive`);
  if (!target) throw new Error(`Target #${targetPhysicalId} is not alive`);

  // التحقق: المستهدف ليس مستهدفاً في اتفاقية أخرى
  if (state.votingState.hiddenPlayersFromVoting.includes(targetPhysicalId)) {
    throw new Error(`Player #${targetPhysicalId} is already targeted in another deal`);
  }

  // إنشاء مرشح الاتفاقية
  const dealCandidate: DealCandidate = {
    type: CandidateType.DEAL,
    initiatorPhysicalId,
    targetPhysicalId,
    votes: 0,
  };

  state.votingState.candidates.push(dealCandidate);
  state.votingState.hiddenPlayersFromVoting.push(targetPhysicalId);

  // إزالة كارت المستهدف العادي من المرشحين (إن وُجد)
  state.votingState.candidates = state.votingState.candidates.filter(c => {
    if (c.type === CandidateType.PLAYER && c.targetPhysicalId === targetPhysicalId) {
      return false;
    }
    return true;
  });

  await setGameState(roomId, state);
  return state;
}

/**
 * إلغاء اتفاقية
 * - إعادة المستهدف إلى ساحة التصويت ككارت عادي
 */
export async function removeDeal(
  roomId: string,
  initiatorPhysicalId: number,
  targetPhysicalId: number
): Promise<GameState> {
  const state = await getGameState(roomId);
  if (!state) throw new Error(`Room ${roomId} not found`);

  // إزالة الاتفاقية من المرشحين
  state.votingState.candidates = state.votingState.candidates.filter(c => {
    if (c.type === CandidateType.DEAL &&
        c.initiatorPhysicalId === initiatorPhysicalId &&
        c.targetPhysicalId === targetPhysicalId) {
      return false;
    }
    return true;
  });

  // إعادة المستهدف لساحة التصويت
  state.votingState.hiddenPlayersFromVoting = state.votingState.hiddenPlayersFromVoting.filter(
    id => id !== targetPhysicalId
  );

  // إعادة إضافة كارت اللاعب العادي
  const alreadyExists = state.votingState.candidates.some(
    c => c.type === CandidateType.PLAYER && c.targetPhysicalId === targetPhysicalId
  );
  if (!alreadyExists) {
    state.votingState.candidates.push({
      type: CandidateType.PLAYER,
      targetPhysicalId,
      votes: 0,
    });
  }

  await setGameState(roomId, state);
  return state;
}

/**
 * الحصول على جميع الاتفاقيات النشطة
 */
export function getActiveDeals(state: GameState): DealCandidate[] {
  return state.votingState.candidates.filter(
    (c): c is DealCandidate => c.type === CandidateType.DEAL
  );
}

// ══════════════════════════════════════════════════════
// 🗄️ إدارة الحالة الحية (Game State Manager)
// المرجع: docs/05_SYSTEM_ARCHITECTURE.md
// ══════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid';
import { getGameState, setGameState, deleteGameState } from '../config/redis.js';
import { Role } from './roles.js';

// ── الأنواع (Types) ────────────────────────────────

export enum Phase {
  LOBBY = 'LOBBY',
  ROLE_GENERATION = 'ROLE_GENERATION',
  ROLE_BINDING = 'ROLE_BINDING',
  DAY_DISCUSSION = 'DAY_DISCUSSION',
  DAY_VOTING = 'DAY_VOTING',
  DAY_TIEBREAKER = 'DAY_TIEBREAKER',
  NIGHT = 'NIGHT',
  MORNING_RECAP = 'MORNING_RECAP',
  GAME_OVER = 'GAME_OVER',
}

export interface Player {
  physicalId: number;
  name: string;
  googleId: string | null;
  role: Role | null;
  isAlive: boolean;
  isSilenced: boolean;
}

export enum CandidateType {
  PLAYER = 'PLAYER',
  DEAL = 'DEAL',
}

export interface PlayerCandidate {
  type: CandidateType.PLAYER;
  targetPhysicalId: number;
  votes: number;
}

export interface DealCandidate {
  type: CandidateType.DEAL;
  initiatorPhysicalId: number;
  targetPhysicalId: number;
  votes: number;
}

export type Candidate = PlayerCandidate | DealCandidate;

export interface VotingState {
  totalVotesCast: number;
  candidates: Candidate[];
  hiddenPlayersFromVoting: number[];
  tieBreakerLevel: number; // 0 = عادي, 1 = إعادة, 2 = حصر
}

export interface NightActions {
  godfatherTarget: number | null;
  silencerTarget: number | null;
  sheriffTarget: number | null;
  sheriffResult: string | null;  // 'CITIZEN' | 'MAFIA' | null
  doctorTarget: number | null;
  sniperTarget: number | null;    // null = تخطي
  nurseTarget: number | null;     // null = غير مفعلة
  lastProtectedTarget: number | null; // قيد الطبيب: الهدف المحمي الليلة الماضية
}

export interface MorningEvent {
  type: 'ASSASSINATION' | 'ASSASSINATION_BLOCKED' | 'SNIPE_MAFIA' | 'SNIPE_CITIZEN' | 'SILENCED' | 'SHERIFF_RESULT';
  targetPhysicalId: number;
  targetName: string;
  extra?: Record<string, unknown>;
  revealed: boolean; // هل عُرض على شاشة العرض؟
}

export interface GameConfig {
  maxJustifications: number;
  currentJustification: number;
}

export interface GameState {
  roomId: string;
  roomCode: string;
  phase: Phase;
  round: number;
  config: GameConfig;
  players: Player[];
  votingState: VotingState;
  nightActions: NightActions;
  morningEvents: MorningEvent[];
  winner: 'MAFIA' | 'CITIZEN' | null;
  createdAt: string;
}

// ── إنشاء غرفة جديدة ─────────────────────────────

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createRoom(playerCount: number, maxJustifications: number = 2): Promise<GameState> {
  const roomId = uuidv4().substring(0, 8);
  const roomCode = generateRoomCode();

  const state: GameState = {
    roomId,
    roomCode,
    phase: Phase.LOBBY,
    round: 0,
    config: {
      maxJustifications,
      currentJustification: 0,
    },
    players: [],
    votingState: {
      totalVotesCast: 0,
      candidates: [],
      hiddenPlayersFromVoting: [],
      tieBreakerLevel: 0,
    },
    nightActions: {
      godfatherTarget: null,
      silencerTarget: null,
      sheriffTarget: null,
      sheriffResult: null,
      doctorTarget: null,
      sniperTarget: null,
      nurseTarget: null,
      lastProtectedTarget: null,
    },
    morningEvents: [],
    winner: null,
    createdAt: new Date().toISOString(),
  };

  await setGameState(roomId, state);
  return state;
}

// ── قراءة الغرفة ──────────────────────────────────

export async function getRoom(roomId: string): Promise<GameState | null> {
  return await getGameState(roomId);
}

// ── تحديث جزئي ──────────────────────────────────

export async function updateRoom(roomId: string, updates: Partial<GameState>): Promise<GameState> {
  const state = await getGameState(roomId);
  if (!state) throw new Error(`Room ${roomId} not found`);

  const updated = { ...state, ...updates };
  await setGameState(roomId, updated);
  return updated;
}

// ── إضافة لاعب ──────────────────────────────────

export async function addPlayer(
  roomId: string,
  physicalId: number,
  name: string,
  googleId: string | null = null
): Promise<GameState> {
  const state = await getGameState(roomId);
  if (!state) throw new Error(`Room ${roomId} not found`);

  // التحقق من عدم تكرار الرقم الفيزيائي
  if (state.players.some(p => p.physicalId === physicalId)) {
    throw new Error(`Physical ID ${physicalId} already registered`);
  }

  const player: Player = {
    physicalId,
    name,
    googleId,
    role: null,
    isAlive: true,
    isSilenced: false,
  };

  state.players.push(player);
  state.players.sort((a, b) => a.physicalId - b.physicalId);
  await setGameState(roomId, state);
  return state;
}

// ── تعديل لاعب (Override الليدر) ────────────────

export async function updatePlayer(
  roomId: string,
  physicalId: number,
  updates: Partial<Pick<Player, 'name' | 'physicalId'>>
): Promise<GameState> {
  const state = await getGameState(roomId);
  if (!state) throw new Error(`Room ${roomId} not found`);

  const player = state.players.find(p => p.physicalId === physicalId);
  if (!player) throw new Error(`Player #${physicalId} not found`);

  Object.assign(player, updates);
  await setGameState(roomId, state);
  return state;
}

// ── ربط دور بلاعب ──────────────────────────────

export async function bindRole(roomId: string, physicalId: number, role: Role): Promise<GameState> {
  const state = await getGameState(roomId);
  if (!state) throw new Error(`Room ${roomId} not found`);

  const player = state.players.find(p => p.physicalId === physicalId);
  if (!player) throw new Error(`Player #${physicalId} not found`);

  player.role = role;
  await setGameState(roomId, state);
  return state;
}

// ── إقصاء لاعب ────────────────────────────────

export async function eliminatePlayer(roomId: string, physicalId: number): Promise<GameState> {
  const state = await getGameState(roomId);
  if (!state) throw new Error(`Room ${roomId} not found`);

  const player = state.players.find(p => p.physicalId === physicalId);
  if (!player) throw new Error(`Player #${physicalId} not found`);

  player.isAlive = false;
  await setGameState(roomId, state);
  return state;
}

// ── تغيير المرحلة ──────────────────────────────

export async function setPhase(roomId: string, phase: Phase): Promise<GameState> {
  return await updateRoom(roomId, { phase });
}

// ── حذف الغرفة ──────────────────────────────────

export async function deleteRoom(roomId: string): Promise<void> {
  await deleteGameState(roomId);
}

// ── مُساعدات ────────────────────────────────────

export function getAlivePlayers(state: GameState): Player[] {
  return state.players.filter(p => p.isAlive);
}

export function getAlivePlayersByTeam(state: GameState): { mafia: Player[]; citizens: Player[] } {
  const alive = getAlivePlayers(state);
  const { MAFIA_ROLES } = require('./roles.js');

  return {
    mafia: alive.filter(p => p.role && MAFIA_ROLES.includes(p.role)),
    citizens: alive.filter(p => p.role && !MAFIA_ROLES.includes(p.role)),
  };
}

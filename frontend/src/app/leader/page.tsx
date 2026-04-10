'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSocket } from '@/hooks/useSocket';
import MafiaCard from '@/components/MafiaCard';
import LeaderDayView from './LeaderDayView';
import LeaderLobbyView from './LeaderLobbyView';
import LeaderRoleConfigurator from './LeaderRoleConfigurator';
import LeaderRoleBinding from './LeaderRoleBinding';
import LeaderNightView from './LeaderNightView';

interface ActiveGame {
  roomId: string;
  roomCode: string;
  gameName: string;
  playerCount: number;
  maxPlayers: number;
  displayPin: string;
}

interface VotingState {
  totalVotesCast: number;
  deals: any[];
  candidates: any[];
  hiddenPlayersFromVoting: number[];
  tieBreakerLevel: number;
}

interface GameState {
  roomId: string;
  roomCode: string;
  phase: string;
  config: {
    gameName: string;
    maxPlayers: number;
    displayPin: string;
  };
  players: any[];
  rolesPool?: string[];
  votingState?: VotingState;
  // Night phase
  nightStep?: any;
  nightComplete?: boolean;
  morningEvents?: any[];
  sheriffResult?: any;
  winner?: string;
  round?: number;
  // Day phase
  justificationData?: any;
  pendingResolution?: any;
  discussionState?: any;
}

export default function LeaderPage() {
  const router = useRouter();
  const { emit, on, isConnected } = useSocket();

  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [leaderName, setLeaderName] = useState('');

  // Active games
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);

  // Create game form
  const [gameName, setGameName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [maxJustifications, setMaxJustifications] = useState(2);
  const [displayPin, setDisplayPin] = useState('');

  // Active game state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [showAdminEliminate, setShowAdminEliminate] = useState(false);

  // Match history
  const [finishedMatches, setFinishedMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Auth Check ──
  useEffect(() => {
    const token = localStorage.getItem('leader_token');
    if (!token) {
      router.push('/leader/login');
      return;
    }
    fetch('/api/leader/verify', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.valid) {
          setIsAuthenticated(true);
          setLeaderName(data.displayName);
        } else {
          localStorage.removeItem('leader_token');
          router.push('/leader/login');
        }
      })
      .catch(() => router.push('/leader/login'))
      .finally(() => setCheckingAuth(false));
  }, [router]);

  // ── Fetch active games via REST ──
  const fetchActiveGames = async () => {
    setLoadingGames(true);
    try {
      const res = await fetch('/api/game/leader-rooms');
      const data = await res.json();
      if (data.success) {
        setActiveGames(data.rooms || []);
      }
    } catch (err) {
      console.error('Failed to fetch games:', err);
    } finally {
      setLoadingGames(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchActiveGames();
      fetchHistory();
    }
  }, [isAuthenticated]);

  // ── Fetch finished matches via REST ──
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/game/history');
      const data = await res.json();
      if (data.success) {
        setFinishedMatches(data.matches || []);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ── Fetch match details ──
  const handleViewMatch = async (matchId: number) => {
    try {
      const res = await fetch(`/api/game/history/${matchId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedMatch(data.match);
      }
    } catch (err) {
      console.error('Failed to fetch match details:', err);
    }
  };

  // ── Listen for player joins and Day events ──
  useEffect(() => {
    if (!gameState) return;
    
    // Player joined
    const offPlayerJoined = on('room:player-joined', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        const existingIdx = prev.players.findIndex((p: any) => p.physicalId === data.physicalId);
        if (existingIdx >= 0) {
          // تحديث بيانات اللاعب الموجود (الاسم، الجنس، إلخ)
          const updatedPlayers = [...prev.players];
          updatedPlayers[existingIdx] = {
            ...updatedPlayers[existingIdx],
            name: data.name || updatedPlayers[existingIdx].name,
            gender: data.gender || updatedPlayers[existingIdx].gender,
          };
          return { ...prev, players: updatedPlayers };
        }
        return {
          ...prev,
          players: [...prev.players, {
            physicalId: data.physicalId,
            name: data.name,
            gender: data.gender || 'MALE',
            isAlive: true,
          }].sort((a: any, b: any) => a.physicalId - b.physicalId),
        };
      });
    });

    if (!gameState?.roomId) return;

    // إعادة المصادقة كـ ليدر في حال انقطع الاتصال وعاد (Cloudflare / Network Drops)
    const offConnect = on('connect', () => {
      console.log('🔄 Socket Reconnected! Automatically re-joining as leader for room:', gameState.roomId);
      const socketPayload = { roomId: gameState.roomId };
      emit('room:rejoin-leader', socketPayload);
    });

    // Phase changed
    const offPhaseChanged = on('game:phase-changed', async (data: any) => {
      // للمراحل الليلية: لا نجلب من API — Socket يتكفل بالبيانات
      if (data.phase === 'NIGHT' || data.phase === 'MORNING_RECAP') {
        setGameState(prev => prev ? {
          ...prev,
          phase: data.phase,
          // تنظيف بيانات النهار القديمة عند دخول الليل
          justificationData: undefined,
          pendingResolution: undefined,
          revealedData: undefined,
        } : prev);
        return;
      }

      // باقي المراحل: جلب State كامل من API
      try {
        const res = await fetch(`/api/leader/state/${gameState.roomId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('leader_token') || ''}` }
        });
        const resData = await res.json();
        if (resData.success) {
          setGameState(prev => prev ? { ...prev, ...resData.state } : resData.state);
        } else {
          setGameState(prev => prev ? { ...prev, phase: data.phase } : prev);
        }
      } catch (err) {
        setGameState(prev => prev ? { ...prev, phase: data.phase } : prev);
      }
    });

    // Player kicked
    const offPlayerKicked = on('room:player-kicked', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.filter(p => p.physicalId !== data.physicalId),
        };
      });
    });

    // Deals created
    const offDealCreated = on('day:deal-created', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          votingState: {
            ...prev.votingState,
            deals: data.deals,
          } as VotingState,
        };
      });
    });

    // Deals removed
    const offDealRemoved = on('day:deal-removed', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          votingState: {
            ...prev.votingState,
            deals: data.deals,
          } as VotingState,
        };
      });
    });

    // Voting started
    const offVotingStarted = on('day:voting-started', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          phase: 'DAY_VOTING',
          votingState: {
            ...prev.votingState,
            candidates: data.candidates,
            hiddenPlayersFromVoting: data.hiddenPlayers,
            totalVotesCast: 0,
            tieBreakerLevel: data.tieBreakerLevel || 0,
          } as VotingState,
        };
      });
    });

    // Vote Update
    const offVoteUpdate = on('day:vote-update', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          votingState: {
            ...prev.votingState,
            candidates: data.candidates,
            totalVotesCast: data.totalVotesCast,
          } as VotingState,
        };
      });
    });

    // Justification Started
    const offJustificationStarted = on('day:justification-started', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          phase: 'DAY_JUSTIFICATION',
          justificationData: data,
        } as any;
      });
    });

    // Justification Timer Started
    const offJustTimerStarted = on('day:justification-timer-started', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          justificationTimer: data,
        } as any;
      });
    });

    // Elimination Pending
    const offEliminationPending = on('day:elimination-pending', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          phase: 'DAY_RESOLUTION_PENDING',
          pendingResolution: data,
        } as any;
      });
    });

    // Elimination Revealed — بعد كشف الهوية
    const offEliminationRevealed = on('day:elimination-revealed', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          phase: 'DAY_REVEALED',
          revealedData: data,
          pendingWinner: data.pendingWinner || (prev as any).pendingWinner || null,
        } as any;
      });
    });

    // Discussion Update
    const offDiscussionUpdate = on('day:discussion-updated', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          discussionState: data.discussionState,
        } as any;
      });
    });

    const offGameClosed = on('game:closed', () => {
      setGameState(null);
    });

    // ── Night Listeners ──
    const offNightStep = on('night:queue-step', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          phase: 'NIGHT',
          nightStep: data,
          nightComplete: false,
        } as any;
      });
    });

    const offNightComplete = on('night:queue-complete', () => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          nightStep: null,
          nightComplete: true,
        } as any;
      });
    });

    const offMorningRecap = on('night:morning-recap', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          phase: 'MORNING_RECAP',
          morningEvents: data.events,
          pendingWinner: data.pendingWinner || null,
        } as any;
      });
    });

    const offSheriffResult = on('night:sheriff-result', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          sheriffResult: data,
        } as any;
      });
    });

    const offGameOver = on('game:over', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          phase: 'GAME_OVER',
          winner: data.winner,
          players: data.players || prev.players,
        } as any;
      });
    });

    const offGameRestarted = on('game:restarted', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          phase: 'LOBBY',
          winner: null,
          players: data.players || prev.players,
          config: data.config || prev.config,
          rolesPool: [],
          votingState: undefined,
          discussionState: undefined,
          justificationData: undefined,
          pendingResolution: undefined,
          round: 1,
        } as any;
      });
    });

    const offConfigUpdated = on('room:config-updated', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          config: { ...prev.config, maxPlayers: data.maxPlayers },
        } as any;
      });
    });

    return () => {
      offConnect();
      offPlayerJoined();
      offPhaseChanged();
      offPlayerKicked();
      offDealCreated();
      offDealRemoved();
      offVotingStarted();
      offVoteUpdate();
      offJustificationStarted();
      offJustTimerStarted();
      offEliminationPending();
      offEliminationRevealed();
      offDiscussionUpdate();
      offGameClosed();
      offNightStep();
      offNightComplete();
      offMorningRecap();
      offSheriffResult();
      offGameOver();
      offGameRestarted();
      offConfigUpdated();
    };
  }, [on, emit, gameState?.roomId]);

  // ── Create Room ──
  const handleCreateRoom = async () => {
    if (!gameName.trim() || !isConnected) return;
    setCreating(true);
    setError('');

    try {
      const response = await emit('room:create', {
        gameName: gameName.trim(),
        maxPlayers,
        maxJustifications,
        displayPin: displayPin || undefined,
      });

      // تجهيز اللاعبين الافتراضيين محلياً
      const autoPlayers = Array.from({ length: maxPlayers }, (_, i) => ({
        physicalId: i + 1,
        name: `لاعب ${i + 1}`,
        phone: '0700000000',
        dob: '2000-01-01',
        gender: 'MALE',
        isAlive: true,
        isSilenced: false,
        justificationCount: 0,
      }));

      setGameState({
        roomId: response.roomId,
        roomCode: response.roomCode,
        phase: 'LOBBY',
        config: {
          gameName: response.gameName || gameName,
          maxPlayers,
          displayPin: response.displayPin || '',
        },
        players: autoPlayers,
        rolesPool: [],
      });

      // تحديث القائمة
      fetchActiveGames();
    } catch (err: any) {
      setError(err.message || 'فشل إنشاء اللعبة');
    } finally {
      setCreating(false);
    }
  };

  // ── Rejoin existing game ──
  const handleRejoinGame = async (game: ActiveGame) => {
    try {
      const res = await fetch(`/api/leader/state/${game.roomId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('leader_token') || ''}` }
      });
      const data = await res.json();

      if (data.success) {
        setGameState({
          roomId: game.roomId,
          roomCode: game.roomCode,
          phase: data.state.phase,
          config: data.state.config || {
            gameName: game.gameName,
            maxPlayers: game.maxPlayers,
            displayPin: game.displayPin,
          },
          players: data.state.players || [],
          rolesPool: data.state.rolesPool || [],
          // ── استعادة كل حقول الحالة عند إعادة الاتصال ──
          votingState: data.state.votingState,
          discussionState: data.state.discussionState,
          justificationData: data.state.justificationData,
          pendingResolution: data.state.pendingResolution,
          round: data.state.round,
        });

        // Join socket room
        const socket = (await import('@/lib/socket')).getSocket();
        socket.emit('room:rejoin-leader', { roomId: game.roomId });
      }
    } catch (err) {
      setError('فشل الاتصال باللعبة');
    }
  };

  if (checkingAuth || !isAuthenticated) {
    return (
      <div className="display-bg min-h-screen flex items-center justify-center font-sans">
        <div className="text-[#555] text-sm font-mono tracking-widest uppercase">VERIFYING CREDENTIALS...</div>
      </div>
    );
  }

  const handleCloseRoom = async () => {
    if (!gameState) return;
    if (!confirm('هل أنت متأكد من إغلاق الغرفة بالكامل؟ سيتم طرد جميع اللاعبين ولن تظهر الغرفة مجدداً.')) return;
    try {
      await emit('room:close', { roomId: gameState.roomId });
      setGameState(null);
      fetchActiveGames();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ══════════════════════════════════════════════════
  // بعد إنشاء / استعادة اللعبة
  // ══════════════════════════════════════════════════
  if (gameState) {
    return (
      <div className="display-bg min-h-screen font-sans relative overflow-hidden blood-vignette selection:bg-[#8A0303] selection:text-white flex flex-col">
        <div className="relative z-10 w-full h-full flex flex-col flex-1">
          {/* ═══ Unified Global Header ═══ */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]/60 bg-[#050505]/70 backdrop-blur-sm shrink-0">
            {/* Left: Logo + MAFIA CLUB */}
            <div className="flex items-center gap-3">
              <Image src="/mafia_logo.png" alt="Mafia" width={36} height={36} className="w-[32px] h-[32px] drop-shadow-[0_0_10px_rgba(138,3,3,0.3)]" priority />
              <div className="flex flex-col items-start leading-none">
                <span className="text-base font-black tracking-tight text-[#C5A059]" style={{ fontFamily: 'Amiri, serif' }}>MAFIA</span>
                <span className="flex justify-between w-full text-[8px] font-light text-[#8A0303]" dir="ltr" style={{ fontFamily: 'Amiri, serif' }}>{'CLUB'.split('').map((l: string, i: number) => <span key={i}>{l}</span>)}</span>
              </div>
              <span className="mx-2 text-[#2a2a2a]">|</span>
              <span className="text-[9px] font-mono uppercase tracking-widest text-[#555]">
                <span className="text-[#C5A059] font-bold">{gameState.phase}</span>
              </span>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-4">
              {/* زر الإقصاء الإداري — يظهر فقط أثناء اللعبة */}
              {gameState.phase !== 'LOBBY' && gameState.phase !== 'GAME_OVER' && (
                <button
                  onClick={() => setShowAdminEliminate(true)}
                  className="text-[#C5A059] text-[10px] font-mono uppercase tracking-[0.15em] hover:text-yellow-400 transition-colors border border-[#C5A059]/30 px-3 py-1.5 hover:border-[#C5A059]"
                >
                  ⚡ إقصاء
                </button>
              )}
              <button
                onClick={() => setGameState(null)}
                className="text-[#555] text-[10px] font-mono uppercase tracking-[0.15em] hover:text-white transition-colors border border-[#2a2a2a] px-3 py-1.5 hover:border-[#555]"
              >
                ← Return
              </button>
              <button
                onClick={handleCloseRoom}
                className="text-[#8A0303] text-[10px] font-mono uppercase tracking-[0.15em] hover:text-red-500 transition-colors border border-[#8A0303]/30 px-3 py-1.5 hover:border-[#8A0303]"
              >
                ✕ Terminate
              </button>
            </div>
          </div>

          {/* ═══ مودال الإقصاء الإداري ═══ */}
          <AnimatePresence>
            {showAdminEliminate && (
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAdminEliminate(false)}
              >
                <motion.div
                  className="noir-card p-6 mx-4 w-full max-w-md border-[#C5A059]/30 relative"
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#C5A059]/40 to-transparent" />
                  
                  <h3 className="text-xl font-black text-[#C5A059] mb-1 text-center" style={{ fontFamily: 'Amiri, serif' }}>
                    إقصاء إداري
                  </h3>
                  <p className="text-[#555] text-[10px] font-mono tracking-widest uppercase text-center mb-6">
                    ADMIN ELIMINATION
                  </p>

                  {/* شبكة أرقام اللاعبين */}
                  <div className="grid grid-cols-5 gap-3 mb-6">
                    {gameState.players
                      .filter((p: any) => p.isAlive)
                      .map((p: any) => (
                        <button
                          key={p.physicalId}
                          onClick={async () => {
                            if (!confirm(`هل أنت متأكد من إقصاء ${p.name} (#${p.physicalId})؟`)) return;
                            try {
                              const res = await emit('admin:eliminate', {
                                roomId: gameState.roomId,
                                physicalId: p.physicalId,
                              });
                              // تحديث اللاعب محلياً
                              setGameState(prev => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  players: prev.players.map((pl: any) =>
                                    pl.physicalId === p.physicalId ? { ...pl, isAlive: false } : pl
                                  ),
                                } as any;
                              });
                              setShowAdminEliminate(false);
                            } catch (err: any) {
                              setError(err.message);
                            }
                          }}
                          className="flex flex-col items-center gap-1 p-3 bg-[#111] border border-[#2a2a2a] rounded-lg hover:border-[#8A0303] hover:bg-[#8A0303]/10 transition-all group"
                        >
                          <span className="text-2xl font-black text-white group-hover:text-[#8A0303] transition-colors font-mono">
                            {p.physicalId}
                          </span>
                          <span className="text-[8px] text-[#555] font-mono truncate max-w-full group-hover:text-[#8A0303]/60">
                            {p.name}
                          </span>
                        </button>
                      ))}
                  </div>

                  <button
                    onClick={() => setShowAdminEliminate(false)}
                    className="w-full py-2 text-[#555] text-xs font-mono uppercase tracking-widest hover:text-white transition-colors border border-[#2a2a2a] hover:border-[#555]"
                  >
                    إلغاء
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Main Content based on Phase ── */}
          <div className="flex-1 overflow-y-auto p-4">
          {gameState.phase === 'LOBBY' && (
            <LeaderLobbyView gameState={gameState} emit={emit} setError={setError} />
          )}

          {gameState.phase === 'ROLE_GENERATION' && (
            <LeaderRoleConfigurator gameState={gameState} emit={emit} setError={setError} />
          )}

          {gameState.phase === 'ROLE_BINDING' && (
            <LeaderRoleBinding gameState={gameState} emit={emit} setError={setError} />
          )}

          {(gameState.phase.startsWith('DAY_')) && (
            <LeaderDayView gameState={gameState} emit={emit} setError={setError} />
          )}

          {(gameState.phase === 'NIGHT' || gameState.phase === 'MORNING_RECAP') && (
            <LeaderNightView gameState={gameState} emit={emit} setError={setError} />
          )}

          {gameState.phase === 'GAME_OVER' && (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="text-8xl mb-6 grayscale">{gameState.winner === 'MAFIA' ? '🩸' : '⚖️'}</div>
              <h2 className="text-4xl font-black text-white mb-4" style={{ fontFamily: 'Amiri, serif' }}>
                {gameState.winner === 'MAFIA' ? 'انتصار المافيا' : 'تطهير المدينة'}
              </h2>
              <p className="text-[#808080] font-mono tracking-widest uppercase text-sm mb-8">
                {gameState.winner === 'MAFIA' ? 'ALL CITIZENS ELIMINATED' : 'THREAT NEUTRALIZED'}
              </p>

              {/* شبكة كروت مصغرة — المراجعة النهائية لليدر */}
              <div className="flex flex-wrap justify-center gap-3">
                {gameState.players.map((p: any) => (
                  <MafiaCard
                    key={p.physicalId}
                    playerNumber={p.physicalId}
                    playerName={p.name}
                    role={p.role}
                    isFlipped={true}
                    flippable={false}
                    isAlive={p.isAlive}
                    size="sm"
                  />
                ))}
              </div>

              {/* زر إعادة تشغيل اللعبة */}
              <button
                onClick={async () => {
                  try {
                    await emit('game:restart', { roomId: gameState.roomId });
                  } catch (err: any) {
                    setError(err.message);
                  }
                }}
                className="btn-premium mt-10 !px-10 !py-4 !text-base tracking-widest uppercase"
              >
                <span>🔄 لعبة جديدة</span>
              </button>
            </div>
          )}



          {error && <p className="text-[#8A0303] mt-6 text-sm font-mono tracking-widest text-center uppercase">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // شاشة إنشاء لعبة + الألعاب النشطة
  // ══════════════════════════════════════════════════
  return (
    <div className="display-bg min-h-screen flex flex-col items-center py-12 px-6 font-sans relative overflow-hidden blood-vignette selection:bg-[#8A0303] selection:text-white">
      <div className="w-full max-w-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-12 border-b border-[#2a2a2a] pb-8 flex flex-col items-center">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="mb-4">
             <Image src="/mafia_logo.png" alt="Mafia Club Logo" width={80} height={80} className="select-none w-[60px] h-[60px] drop-shadow-[0_0_15px_rgba(138,3,3,0.3)]" priority />
           </motion.div>
           <h1 className="text-center mb-8">
             <span className="block text-4xl font-black tracking-tight text-[#C5A059] mb-1" style={{ fontFamily: 'Amiri, serif', textShadow: '0 0 20px rgba(138,3,3,0.4)' }}>MAFIA</span>
             <span className="flex justify-between text-xl font-light text-[#8A0303] w-full" dir="ltr" style={{ fontFamily: 'Amiri, serif' }}>{'CLUB'.split('').map((l: string, i: number) => <span key={i}>{l}</span>)}</span>
           </h1>

          <h2 className="text-3xl font-black mb-2 text-white" style={{ fontFamily: 'Amiri, serif' }}>المقر الرئيسي</h2>
          <p className="text-[#808080] text-xs font-mono tracking-[0.2em] uppercase">
            DIRECTOR: <span className="text-[#C5A059]">{leaderName}</span>
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 font-mono">
            <div className={`w-2 h-2 ${isConnected ? 'bg-[#2E5C31] shadow-[0_0_10px_#2E5C31]' : 'bg-[#8A0303]'} animate-pulse`} />
            <span className="text-[#555] text-[10px] tracking-widest uppercase">{isConnected ? 'SERVER CONN_ESTABLISHED' : 'OFFLINE'}</span>
          </div>
        </div>

        {/* ── الألعاب النشطة ── */}
        {activeGames.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h2 className="text-xs font-mono tracking-[0.3em] text-[#555] mb-4 uppercase">ACTIVE OPERATIONS ({activeGames.length})</h2>
            <div className="space-y-4">
              {activeGames.map(game => (
                <motion.button
                  key={game.roomId}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleRejoinGame(game)}
                  className="noir-card p-6 w-full flex items-center justify-between text-right hover:border-[#C5A059]/40 transition-all border-[#2a2a2a]"
                >
                  <div>
                    <h3 className="font-black text-white text-xl" style={{ fontFamily: 'Amiri, serif' }}>{game.gameName}</h3>
                    <p className="text-[#808080] text-xs mt-2 font-mono tracking-widest uppercase">
                      CODE: <span className="text-[#C5A059]">{game.roomCode}</span>
                      {' | '}PIN: <span className="text-[#8A0303]">{game.displayPin}</span>
                      {' | '}AGENTS: <span className="text-white">{game.playerCount}</span>/{game.maxPlayers}
                    </p>
                  </div>
                  <span className="text-[#555] text-xs font-mono uppercase tracking-[0.2em] group-hover:text-white transition-colors">RESUME [→]</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── إنشاء لعبة جديدة ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="noir-card p-10 border-[#111]"
        >
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#808080] to-transparent opacity-20" />
          
          <h2 className="text-2xl font-black mb-8 text-center text-white" style={{ fontFamily: 'Amiri, serif' }}>تأسيس عملية جديدة</h2>

          {/* اسم اللعبة */}
          <div className="mb-6">
            <label className="block text-xs font-mono text-[#808080] mb-2 tracking-widest uppercase">Operation Name</label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="اسم العملية..."
              className="w-full p-4 bg-[#050505] border border-[#2a2a2a] text-white text-center text-lg focus:border-[#C5A059] focus:outline-none transition-colors placeholder-[#222]"
              maxLength={50}
            />
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* عدد اللاعبين */}
            <div>
              <label className="block text-xs font-mono text-[#808080] mb-2 tracking-widest uppercase text-center">Max Agents</label>
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => setMaxPlayers(Math.max(6, maxPlayers - 1))} className="w-10 h-10 bg-[#050505] border border-[#2a2a2a] text-[#808080] hover:text-white hover:border-[#555] transition-colors font-mono">−</button>
                <input
                  type="number"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Math.min(27, Math.max(6, parseInt(e.target.value) || 6)))}
                  dir="ltr"
                  className="w-16 p-2 bg-[#050505] border-b border-[#2a2a2a] text-white text-center text-xl font-mono focus:border-[#C5A059] focus:outline-none"
                  min={6} max={27}
                />
                <button onClick={() => setMaxPlayers(Math.min(27, maxPlayers + 1))} className="w-10 h-10 bg-[#050505] border border-[#2a2a2a] text-[#808080] hover:text-white hover:border-[#555] transition-colors font-mono">+</button>
              </div>
            </div>

            {/* عدد التبريرات */}
            <div>
              <label className="block text-xs font-mono text-[#808080] mb-2 tracking-widest uppercase text-center">Justifications</label>
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => setMaxJustifications(Math.max(1, maxJustifications - 1))} className="w-10 h-10 bg-[#050505] border border-[#2a2a2a] text-[#808080] hover:text-white hover:border-[#555] transition-colors font-mono">−</button>
                <span className="text-xl font-mono text-white w-16 text-center border-b border-[#2a2a2a] pb-1">{maxJustifications}</span>
                <button onClick={() => setMaxJustifications(Math.min(5, maxJustifications + 1))} className="w-10 h-10 bg-[#050505] border border-[#2a2a2a] text-[#808080] hover:text-white hover:border-[#555] transition-colors font-mono">+</button>
              </div>
            </div>
          </div>

          {/* PIN */}
          <div className="mb-10">
            <label className="block text-xs font-mono text-[#808080] mb-2 tracking-widest uppercase text-center">Display PIN (Optional)</label>
            <input
              type="text"
              value={displayPin}
              onChange={(e) => setDisplayPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="AUTO-GENERATED"
              dir="ltr"
              className="w-full p-4 bg-[#050505] border border-[#2a2a2a] text-[#C5A059] text-center font-mono text-xl tracking-[0.4em] focus:border-[#C5A059] focus:outline-none placeholder-[#222]"
              maxLength={6}
            />
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={!isConnected || creating || !gameName.trim()}
            className="btn-premium w-full text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{creating ? 'INITIALIZING...' : 'CREATE OPERATION'}</span>
          </button>

          {error && <p className="text-[#8A0303] mt-6 text-xs font-mono text-center tracking-widest uppercase">{error}</p>}
        </motion.div>

        {/* ── الألعاب المنتهية ── */}
        {finishedMatches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-12 mb-8"
          >
            <h2 className="text-xs font-mono tracking-[0.3em] text-[#555] mb-4 uppercase">COMPLETED OPERATIONS ({finishedMatches.length})</h2>
            <div className="space-y-3">
              {finishedMatches.map((m: any) => {
                const mins = m.durationSeconds ? Math.floor(m.durationSeconds / 60) : 0;
                const secs = m.durationSeconds ? m.durationSeconds % 60 : 0;
                const duration = m.durationSeconds ? `${mins}:${secs.toString().padStart(2, '0')}` : '—';
                const dt = m.endedAt ? new Date(m.endedAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }) : '';
                return (
                  <motion.button
                    key={m.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleViewMatch(m.id)}
                    className="noir-card p-5 w-full flex items-center justify-between text-right hover:border-[#555]/40 transition-all border-[#1a1a1a] opacity-70 hover:opacity-100"
                  >
                    <div>
                      <h3 className="font-black text-[#808080] text-lg" style={{ fontFamily: 'Amiri, serif' }}>{m.gameName}</h3>
                      <p className="text-[#555] text-[10px] mt-1.5 font-mono tracking-widest uppercase">
                        {dt} | AGENTS: <span className="text-white">{m.playerCount}</span>
                        {' | '}ROUNDS: <span className="text-white">{m.totalRounds || '—'}</span>
                        {' | '}⏱ <span className="text-white">{duration}</span>
                      </p>
                    </div>
                    <span className={`text-xs font-mono uppercase tracking-[0.2em] px-3 py-1 border ${
                      m.winner === 'MAFIA' 
                        ? 'text-[#8A0303] border-[#8A0303]/30' 
                        : 'text-[#C5A059] border-[#C5A059]/30'
                    }`}>
                      {m.winner === 'MAFIA' ? '🔴 MAFIA' : '🟡 CITIZEN'}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── مودال ملخص المباراة ── */}
        <AnimatePresence>
          {selectedMatch && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setSelectedMatch(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="noir-card p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto border-[#2a2a2a]"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#2a2a2a]">
                  <div>
                    <h3 className="text-2xl font-black text-white" style={{ fontFamily: 'Amiri, serif' }}>{selectedMatch.gameName}</h3>
                    <p className="text-[#555] text-[10px] font-mono tracking-widest uppercase mt-1">
                      CODE: {selectedMatch.roomCode} | ⏱ {selectedMatch.durationFormatted}
                    </p>
                  </div>
                  <span className={`text-sm font-mono font-black px-4 py-2 border ${
                    selectedMatch.winner === 'MAFIA'
                      ? 'text-[#8A0303] border-[#8A0303]/40 bg-[#8A0303]/10'
                      : 'text-[#C5A059] border-[#C5A059]/40 bg-[#C5A059]/10'
                  }`}>
                    {selectedMatch.winner === 'MAFIA' ? '🔴 فوز المافيا' : '🟡 فوز المدينة'}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 bg-[#0a0a0a] border border-[#1a1a1a]">
                    <div className="text-2xl font-black text-white font-mono">{selectedMatch.playerCount}</div>
                    <div className="text-[8px] font-mono text-[#555] tracking-widest uppercase mt-1">AGENTS</div>
                  </div>
                  <div className="text-center p-3 bg-[#0a0a0a] border border-[#1a1a1a]">
                    <div className="text-2xl font-black text-white font-mono">{selectedMatch.totalRounds || '—'}</div>
                    <div className="text-[8px] font-mono text-[#555] tracking-widest uppercase mt-1">ROUNDS</div>
                  </div>
                  <div className="text-center p-3 bg-[#0a0a0a] border border-[#1a1a1a]">
                    <div className="text-2xl font-black text-white font-mono">{selectedMatch.durationFormatted}</div>
                    <div className="text-[8px] font-mono text-[#555] tracking-widest uppercase mt-1">DURATION</div>
                  </div>
                </div>

                {/* Players */}
                {selectedMatch.players && (
                  <div>
                    <h4 className="text-[10px] font-mono tracking-[0.3em] text-[#555] mb-3 uppercase">AGENT ROSTER</h4>
                    <div className="space-y-2">
                      {selectedMatch.players.map((p: any) => (
                        <div
                          key={p.physicalId}
                          className={`flex items-center justify-between px-4 py-2.5 border ${
                            p.team === 'MAFIA' ? 'border-[#8A0303]/20 bg-[#8A0303]/5' : 'border-[#2a2a2a] bg-[#050505]'
                          } ${!p.survivedToEnd ? 'opacity-40' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono text-[#555] w-6">#{p.physicalId}</span>
                            <span className={`font-bold text-sm ${
                              p.survivedToEnd ? 'text-white' : 'text-[#555] line-through'
                            }`}>{p.playerName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-mono tracking-widest uppercase px-2 py-0.5 border ${
                              p.team === 'MAFIA' ? 'text-[#8A0303] border-[#8A0303]/30' : 'text-[#C5A059] border-[#C5A059]/30'
                            }`}>{p.role}</span>
                            {!p.survivedToEnd && <span className="text-[#8A0303] text-xs">💀</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Close */}
                <button
                  onClick={() => setSelectedMatch(null)}
                  className="w-full mt-6 py-3 text-[#555] text-xs font-mono uppercase tracking-[0.2em] hover:text-white transition-colors border border-[#2a2a2a] hover:border-[#555]"
                >
                  [ CLOSE REPORT ]
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* رجوع */}
        <div className="text-center mt-12 mb-8">
          <button onClick={() => router.push('/')} className="text-[#555] text-xs font-mono tracking-[0.2em] uppercase hover:text-white transition-colors">
            [ ABORT TO MAIN MENU ]
          </button>
        </div>
      </div>
    </div>
  );
}

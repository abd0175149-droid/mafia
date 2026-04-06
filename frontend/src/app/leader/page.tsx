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
    }
  }, [isAuthenticated]);

  // ── Listen for player joins and Day events ──
  useEffect(() => {
    if (!gameState) return;
    
    // Player joined
    const offPlayerJoined = on('room:player-joined', (data: any) => {
      setGameState(prev => {
        if (!prev) return prev;
        const exists = prev.players.some((p: any) => p.physicalId === data.physicalId);
        if (exists) return prev;
        return {
          ...prev,
          players: [...prev.players, {
            physicalId: data.physicalId,
            name: data.name,
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
          config: {
            gameName: game.gameName,
            maxPlayers: game.maxPlayers,
            displayPin: game.displayPin,
          },
          players: data.state.players || [],
          rolesPool: data.state.rolesPool || [],
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
      <div className="display-bg min-h-screen p-8 font-sans relative overflow-hidden blood-vignette selection:bg-[#8A0303] selection:text-white">
        <div className="relative z-10 w-full h-full">
          {/* Minimal Navigation Bar */}
          <div className="flex flex-row-reverse items-center justify-between mb-6 pb-4 border-b border-[#2a2a2a]/50">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setGameState(null)}
                className="text-[#555] text-[10px] font-mono uppercase tracking-[0.2em] hover:text-white transition-colors"
              >
                [ Return ]
              </button>
              <button
                onClick={handleCloseRoom}
                className="text-[#8A0303] text-[10px] font-mono uppercase tracking-[0.2em] hover:text-red-500 transition-colors"
              >
                [ Terminate ]
              </button>
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#555]">
              SYSTEM PHASE: <span className="text-[#C5A059] font-bold ml-2">{gameState.phase}</span>
            </div>
          </div>

          {/* ── Main Content based on Phase ── */}
          
          <div className="flex flex-col items-center justify-center gap-3 mb-8 w-full border-b border-[#2a2a2a]/40 pb-6">
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
               <Image src="/mafia_logo.png" alt="Mafia Club Logo" width={60} height={60} className="select-none w-[50px] h-[50px] drop-shadow-[0_0_15px_rgba(138,3,3,0.3)]" priority />
             </motion.div>
             <h1 className="text-center">
               <span className="block text-3xl font-black tracking-tight text-[#C5A059] mb-1" style={{ fontFamily: 'Amiri, serif', textShadow: '0 0 20px rgba(138,3,3,0.4)' }}>MAFIA</span>
               <span className="flex justify-between text-lg font-light text-[#8A0303] w-full" dir="ltr" style={{ fontFamily: 'Amiri, serif' }}>{'CLUB'.split('').map((l: string, i: number) => <span key={i}>{l}</span>)}</span>
             </h1>
          </div>

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
            </div>
          )}



          {error && <p className="text-[#8A0303] mt-6 text-sm font-mono tracking-widest text-center uppercase">{error}</p>}
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

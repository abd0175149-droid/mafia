'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import LeaderDayView from './LeaderDayView';

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
  votingState?: VotingState;
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

    // Phase changed
    const offPhaseChanged = on('game:phase-changed', (data: any) => {
      setGameState(prev => prev ? { ...prev, phase: data.phase } : prev);
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

    return () => {
      offPlayerJoined();
      offPhaseChanged();
      offDealCreated();
      offDealRemoved();
      offVotingStarted();
      offVoteUpdate();
      offEliminationPending();
    };
  }, [on, gameState?.roomId]);

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

      setGameState({
        roomId: response.roomId,
        roomCode: response.roomCode,
        phase: 'LOBBY',
        config: {
          gameName: response.gameName || gameName,
          maxPlayers,
          displayPin: response.displayPin || '',
        },
        players: [],
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
      const res = await fetch(`/api/game/state/${game.roomId}`);
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

  // ══════════════════════════════════════════════════
  // بعد إنشاء / استعادة اللعبة
  // ══════════════════════════════════════════════════
  if (gameState) {
    return (
      <div className="display-bg min-h-screen p-8 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between mb-10 border-b border-[#2a2a2a] pb-6">
          <div>
            <h1 className="text-3xl font-black text-white" style={{ fontFamily: 'Amiri, serif' }}>{gameState.config.gameName}</h1>
            <p className="text-[#808080] text-xs mt-2 font-mono uppercase tracking-[0.2em]">
              OP_CODE: <span className="text-[#C5A059]">{gameState.roomCode}</span>
              {' | '}
              PIN: <span className="text-[#8A0303]">{gameState.config.displayPin}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="noir-card px-6 py-3 text-xs font-mono uppercase tracking-widest border-[#C5A059]/30">
              <span className="text-[#555]">Phase: </span>
              <span className="text-[#C5A059] font-bold">{gameState.phase}</span>
            </div>
            <button
              onClick={() => setGameState(null)}
              className="text-[#555] text-xs font-mono uppercase tracking-widest hover:text-white transition-colors"
            >
              [ Return ]
            </button>
          </div>
        </div>

        {/* ── Main Content based on Phase ── */}
        
        {gameState.phase === 'LOBBY' && (
          <div className="mb-10">
            <h2 className="text-sm font-mono tracking-[0.3em] uppercase mb-6 text-[#555]">
              AGENT ROSTER: <span className="text-[#C5A059]">{gameState.players.length}</span>
              <span className="text-[#333]"> / {gameState.config.maxPlayers}</span>
            </h2>

            {gameState.players.length === 0 ? (
              <div className="noir-card p-12 text-center border-[#2a2a2a]">
                <p className="text-[#808080] text-sm font-mono tracking-[0.2em] uppercase">AWAITING AGENT CONNECTIONS...</p>
                <p className="text-[#555] text-xs mt-4 font-mono tracking-widest uppercase">
                  DISTRIBUTE OP_CODE: <span className="text-[#C5A059] font-bold">{gameState.roomCode}</span>
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {gameState.players.map((player: any, i: number) => (
                  <motion.div
                    key={player.physicalId}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-[#0c0c0c] border border-[#2a2a2a] p-4 flex flex-col items-center gap-3 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-[#C5A059] opacity-30 group-hover:opacity-100 transition-opacity" />
                    <div className="w-12 h-12 rounded-none bg-[#111] border border-[#2a2a2a] flex items-center justify-center text-[#808080] font-mono text-xl">
                      {player.physicalId}
                    </div>
                    <div className="text-center w-full">
                      <p className="font-bold text-sm text-white truncate">{player.name}</p>
                      <p className="text-[#C5A059] text-[10px] font-mono tracking-widest uppercase mt-1">VERIFIED</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Start Game Button */}
            {gameState.players.length >= 6 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mt-12">
                <button
                  onClick={async () => {
                    try {
                      // Note: For now we jump straight to DAY_DISCUSSION to test the Day phase engine!
                      await emit('game:transition-phase', { roomId: gameState.roomId, targetPhase: 'DAY_DISCUSSION' });
                    } catch (err: any) {
                      setError(err.message);
                    }
                  }}
                  className="btn-premium px-16 py-5 !text-lg !border-[#8A0303]/50"
                >
                  <span>COMMENCE OPERATION</span>
                </button>
              </motion.div>
            )}
          </div>
        )}

        {(gameState.phase.startsWith('DAY_')) && (
          <LeaderDayView gameState={gameState} emit={emit} setError={setError} />
        )}



        {error && <p className="text-[#8A0303] mt-6 text-sm font-mono tracking-widest text-center uppercase">{error}</p>}
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // شاشة إنشاء لعبة + الألعاب النشطة
  // ══════════════════════════════════════════════════
  return (
    <div className="display-bg min-h-screen flex flex-col items-center py-12 px-6 font-sans">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12 border-b border-[#2a2a2a] pb-8">
          <div className="text-6xl mb-4 grayscale opacity-80">⚖️</div>
          <h1 className="text-4xl font-black mb-2 text-white" style={{ fontFamily: 'Amiri, serif' }}>المقر الرئيسي</h1>
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

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';

interface ActiveGame {
  roomId: string;
  roomCode: string;
  gameName: string;
  playerCount: number;
  maxPlayers: number;
  displayPin: string;
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

  // ── Listen for player joins ──
  useEffect(() => {
    if (!gameState) return;
    const cleanup = on('room:player-joined', (data: any) => {
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
    return cleanup;
  }, [on, gameState]);

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
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-dark-400 text-xl">⏳ جاري التحقق...</div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // بعد إنشاء / استعادة اللعبة
  // ══════════════════════════════════════════════════
  if (gameState) {
    return (
      <div className="min-h-screen bg-dark-900 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">👑 {gameState.config.gameName}</h1>
            <p className="text-dark-400 text-sm mt-1">
              كود اللعبة: <span className="text-gold-400 font-mono font-bold text-xl">{gameState.roomCode}</span>
              {' • '}
              PIN: <span className="text-emerald-400 font-mono font-bold">{gameState.config.displayPin}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="glass-card px-4 py-2 text-sm">
              <span className="text-dark-400">المرحلة: </span>
              <span className="text-gold-400 font-bold">{gameState.phase}</span>
            </div>
            <button
              onClick={() => setGameState(null)}
              className="glass-card px-4 py-2 text-sm text-dark-400 hover:text-white transition-colors"
            >
              ← رجوع
            </button>
          </div>
        </div>

        {/* Players Grid */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">
            اللاعبون: <span className="text-emerald-400">{gameState.players.length}</span>
            <span className="text-dark-500"> / {gameState.config.maxPlayers}</span>
          </h2>

          {gameState.players.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <p className="text-dark-400 text-lg">⏳ بانتظار انضمام اللاعبين...</p>
              <p className="text-dark-500 text-sm mt-2">
                شارك كود اللعبة <span className="text-gold-400 font-mono font-bold">{gameState.roomCode}</span> مع اللاعبين
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {gameState.players.map((player: any, i: number) => (
                <motion.div
                  key={player.physicalId}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-card p-3 flex items-center gap-3 border-emerald-500/20"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-600/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
                    {player.physicalId}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{player.name}</p>
                    <p className="text-emerald-400 text-xs">✓</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Start Game Button */}
        {gameState.players.length >= 6 && gameState.phase === 'LOBBY' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mt-8">
            <button
              onClick={async () => {
                try {
                  await emit('room:start-generation', { roomId: gameState.roomId });
                } catch (err: any) {
                  setError(err.message);
                }
              }}
              className="btn-primary text-xl px-12 py-4"
            >
              🎲 بدء التوليد
            </button>
          </motion.div>
        )}

        {error && <p className="text-mafia-400 mt-4 text-center">{error}</p>}
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // شاشة إنشاء لعبة + الألعاب النشطة
  // ══════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">👑</div>
          <h1 className="text-3xl font-bold mb-1">لوحة الليدر</h1>
          <p className="text-dark-400 text-sm">
            مرحباً <span className="text-gold-400 font-bold">{leaderName}</span>
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-500'}`} />
            <span className="text-dark-500 text-xs">{isConnected ? 'متصل' : 'غير متصل'}</span>
          </div>
        </div>

        {/* ── الألعاب النشطة ── */}
        {activeGames.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h2 className="text-lg font-bold text-gold-400 mb-3">🎮 ألعاب نشطة ({activeGames.length})</h2>
            <div className="space-y-3">
              {activeGames.map(game => (
                <motion.button
                  key={game.roomId}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleRejoinGame(game)}
                  className="glass-card p-4 w-full flex items-center justify-between text-right hover:border-gold-500/30 transition-all"
                >
                  <div>
                    <h3 className="font-bold text-gold-400">{game.gameName}</h3>
                    <p className="text-dark-400 text-xs mt-1">
                      كود: <span className="font-mono">{game.roomCode}</span>
                      {' • PIN: '}<span className="font-mono">{game.displayPin}</span>
                      {' • '}<span className="text-emerald-400">{game.playerCount}</span>/{game.maxPlayers}
                    </p>
                  </div>
                  <span className="text-dark-400 text-sm">استعادة ←</span>
                </motion.button>
              ))}
            </div>
            <hr className="border-dark-700 my-6" />
          </motion.div>
        )}

        {/* ── إنشاء لعبة جديدة ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-8"
        >
          <h2 className="text-xl font-bold mb-6 text-center">✨ إنشاء لعبة جديدة</h2>

          {/* اسم اللعبة */}
          <div className="mb-5">
            <label className="block text-sm text-dark-400 mb-2">🏷️ اسم اللعبة</label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="مثال: بطولة المافيا #3"
              className="w-full p-3 rounded-xl bg-dark-800 border border-dark-600 text-white text-center text-lg focus:border-gold-500 focus:outline-none transition-colors"
              maxLength={50}
            />
          </div>

          {/* عدد اللاعبين */}
          <div className="mb-5">
            <label className="block text-sm text-dark-400 mb-2">👥 عدد اللاعبين (6-27)</label>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setMaxPlayers(Math.max(6, maxPlayers - 1))} className="w-12 h-12 rounded-xl bg-mafia-600/30 text-mafia-400 font-bold text-xl hover:bg-mafia-600/50 transition-colors">−</button>
              <input
                type="number"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Math.min(27, Math.max(6, parseInt(e.target.value) || 6)))}
                className="w-20 p-3 rounded-xl bg-dark-800 border border-dark-600 text-white text-center text-2xl font-bold focus:border-gold-500 focus:outline-none"
                min={6} max={27}
              />
              <button onClick={() => setMaxPlayers(Math.min(27, maxPlayers + 1))} className="w-12 h-12 rounded-xl bg-emerald-600/30 text-emerald-400 font-bold text-xl hover:bg-emerald-600/50 transition-colors">+</button>
            </div>
          </div>

          {/* عدد التبريرات */}
          <div className="mb-5">
            <label className="block text-sm text-dark-400 mb-2">💬 عدد التبريرات</label>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setMaxJustifications(Math.max(1, maxJustifications - 1))} className="w-12 h-12 rounded-xl bg-mafia-600/30 text-mafia-400 font-bold text-xl hover:bg-mafia-600/50 transition-colors">−</button>
              <span className="text-2xl font-bold text-gold-400 w-12 text-center">{maxJustifications}</span>
              <button onClick={() => setMaxJustifications(Math.min(5, maxJustifications + 1))} className="w-12 h-12 rounded-xl bg-emerald-600/30 text-emerald-400 font-bold text-xl hover:bg-emerald-600/50 transition-colors">+</button>
            </div>
          </div>

          {/* PIN */}
          <div className="mb-8">
            <label className="block text-sm text-dark-400 mb-2">🔒 رقم سري لشاشة العرض <span className="text-dark-600">(اختياري)</span></label>
            <input
              type="text"
              value={displayPin}
              onChange={(e) => setDisplayPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="يُولّد تلقائياً"
              className="w-full p-3 rounded-xl bg-dark-800 border border-dark-600 text-white text-center font-mono text-lg focus:border-gold-500 focus:outline-none tracking-widest"
              maxLength={6}
            />
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={!isConnected || creating || !gameName.trim()}
            className="btn-primary w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? '⏳ جاري الإنشاء...' : '🎮 إنشاء اللعبة'}
          </button>

          {error && <p className="text-mafia-400 mt-4 text-sm text-center">{error}</p>}
        </motion.div>

        {/* رجوع */}
        <div className="text-center mt-6">
          <button onClick={() => router.push('/')} className="text-dark-500 text-sm hover:text-dark-300 transition-colors">
            ← العودة للرئيسية
          </button>
        </div>
      </div>
    </div>
  );
}

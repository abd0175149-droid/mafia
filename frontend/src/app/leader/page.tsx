'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useGameState } from '@/hooks/useGameState';

export default function LeaderPage() {
  const router = useRouter();
  const { gameState, createRoom, isConnected, error, loading } = useGameState();
  const [gameName, setGameName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [maxJustifications, setMaxJustifications] = useState(2);
  const [displayPin, setDisplayPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // التحقق من تسجيل الدخول
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
        } else {
          localStorage.removeItem('leader_token');
          router.push('/leader/login');
        }
      })
      .catch(() => {
        router.push('/leader/login');
      })
      .finally(() => setCheckingAuth(false));
  }, [router]);

  const handleCreateRoom = async () => {
    if (!gameName.trim()) return;
    try {
      await createRoom(gameName, maxPlayers, maxJustifications, displayPin || undefined);
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  if (checkingAuth || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-dark-400">⏳ جاري التحقق...</div>
      </div>
    );
  }

  // ── حالة ما قبل إنشاء الغرفة ──
  if (!gameState) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-10 max-w-md w-full"
        >
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">👑</div>
            <h1 className="text-3xl font-bold mb-2">إنشاء لعبة جديدة</h1>
            <div className="flex items-center justify-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-mafia-500'}`} />
              <span className="text-sm text-dark-400">
                {isConnected ? 'متصل بالسيرفر ✓' : '⏳ جاري الاتصال...'}
              </span>
            </div>
          </div>

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
            <label className="block text-sm text-dark-400 mb-2">👥 عدد اللاعبين</label>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setMaxPlayers(Math.max(6, maxPlayers - 1))}
                className="w-12 h-12 rounded-xl bg-mafia-600/30 text-mafia-400 font-bold text-xl hover:bg-mafia-600/50 transition-colors"
              >−</button>
              <input
                type="number"
                value={maxPlayers}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 6;
                  setMaxPlayers(Math.min(27, Math.max(6, v)));
                }}
                className="w-20 p-3 rounded-xl bg-dark-800 border border-dark-600 text-white text-center text-2xl font-bold focus:border-gold-500 focus:outline-none"
                min={6}
                max={27}
              />
              <button
                onClick={() => setMaxPlayers(Math.min(27, maxPlayers + 1))}
                className="w-12 h-12 rounded-xl bg-emerald-600/30 text-emerald-400 font-bold text-xl hover:bg-emerald-600/50 transition-colors"
              >+</button>
            </div>
            <p className="text-dark-500 text-xs mt-1 text-center">
              {maxPlayers <= 8 ? '🎯 صغيرة' : maxPlayers <= 14 ? '⚔️ متوسطة' : '🔥 كبيرة'}
            </p>
          </div>

          {/* عدد التبريرات */}
          <div className="mb-5">
            <label className="block text-sm text-dark-400 mb-2">💬 عدد التبريرات</label>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setMaxJustifications(Math.max(1, maxJustifications - 1))}
                className="w-12 h-12 rounded-xl bg-mafia-600/30 text-mafia-400 font-bold text-xl hover:bg-mafia-600/50 transition-colors"
              >−</button>
              <span className="text-2xl font-bold text-gold-400 w-12 text-center">{maxJustifications}</span>
              <button
                onClick={() => setMaxJustifications(Math.min(5, maxJustifications + 1))}
                className="w-12 h-12 rounded-xl bg-emerald-600/30 text-emerald-400 font-bold text-xl hover:bg-emerald-600/50 transition-colors"
              >+</button>
            </div>
          </div>

          {/* رقم سري لشاشة العرض */}
          <div className="mb-8">
            <label className="block text-sm text-dark-400 mb-2">🔒 رقم سري لشاشة العرض <span className="text-dark-600">(اختياري)</span></label>
            <input
              type="text"
              value={displayPin}
              onChange={(e) => setDisplayPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="سيُولّد تلقائياً"
              className="w-full p-3 rounded-xl bg-dark-800 border border-dark-600 text-white text-center font-mono text-lg focus:border-gold-500 focus:outline-none transition-colors tracking-widest"
              maxLength={6}
            />
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={!isConnected || loading || !gameName.trim()}
            className="btn-primary w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ جاري الإنشاء...' : '🎮 إنشاء اللعبة'}
          </button>

          {error && (
            <p className="text-mafia-400 mt-4 text-sm text-center">{error}</p>
          )}
        </motion.div>
      </div>
    );
  }

  // ── بعد إنشاء اللعبة ──
  return (
    <div className="min-h-screen bg-dark-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">👑 {gameState.config?.gameName || 'لعبة مافيا'}</h1>
          <p className="text-dark-400 text-sm">
            كود اللعبة: <span className="text-gold-400 font-mono font-bold text-lg">{gameState.roomCode}</span>
            {' • '}
            PIN: <span className="text-emerald-400 font-mono font-bold">{gameState.config?.displayPin}</span>
          </p>
        </div>
        <div className="glass-card px-4 py-2 text-sm">
          <span className="text-dark-400">المرحلة: </span>
          <span className="text-gold-400 font-bold">{gameState.phase}</span>
        </div>
      </div>

      {/* Players Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            اللاعبون: {' '}
            <span className="text-emerald-400">{gameState.players.length}</span>
            <span className="text-dark-500"> / {gameState.config?.maxPlayers || maxPlayers}</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
          {gameState.players.map((player: any, i: number) => (
            <motion.div
              key={player.physicalId}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-4 flex items-center gap-3 border-emerald-500/20"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-600/30 flex items-center justify-center text-emerald-400 font-bold">
                {player.physicalId}
              </div>
              <div>
                <p className="font-bold text-sm">{player.name}</p>
                <p className="text-emerald-400 text-xs">✓ مسجل</p>
              </div>
            </motion.div>
          ))}
        </div>

        {gameState.players.length >= 6 && gameState.phase === 'LOBBY' && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="btn-primary text-lg mx-auto block"
          >
            🎲 بدء التوليد
          </motion.button>
        )}
      </div>
    </div>
  );
}

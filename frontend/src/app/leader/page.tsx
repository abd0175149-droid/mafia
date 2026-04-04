'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameState } from '@/hooks/useGameState';
import { Phase, formatPlayer } from '@/lib/constants';

export default function LeaderPage() {
  const { gameState, createRoom, isConnected, error, loading } = useGameState();
  const [maxJustifications, setMaxJustifications] = useState(2);

  const handleCreateRoom = async () => {
    try {
      await createRoom(maxJustifications);
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  // ── حالة ما قبل إنشاء الغرفة ──
  if (!gameState) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-10 max-w-md w-full text-center"
        >
          <div className="text-6xl mb-6">👑</div>
          <h1 className="text-3xl font-bold mb-2">لوحة الليدر</h1>
          <p className="text-dark-400 mb-8">أنشئ غرفة جديدة وابدأ اللعبة</p>

          {/* Connection Status */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-mafia-500'}`} />
            <span className="text-sm text-dark-400">
              {isConnected ? 'متصل' : 'غير متصل'}
            </span>
          </div>

          {/* عدد التبريرات */}
          <div className="mb-6">
            <label className="block text-sm text-dark-400 mb-2">عدد التبريرات المسموحة</label>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setMaxJustifications(Math.max(1, maxJustifications - 1))}
                className="btn-vote minus"
              >
                −
              </button>
              <span className="text-3xl font-bold text-gold-400 w-12 text-center">{maxJustifications}</span>
              <button
                onClick={() => setMaxJustifications(Math.min(5, maxJustifications + 1))}
                className="btn-vote plus"
              >
                +
              </button>
            </div>
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={!isConnected || loading}
            className="btn-primary w-full text-lg"
          >
            {loading ? '⏳ جاري الإنشاء...' : '🎮 إنشاء غرفة جديدة'}
          </button>

          {error && (
            <p className="text-mafia-400 mt-4 text-sm">{error}</p>
          )}
        </motion.div>
      </div>
    );
  }

  // ── حالة بعد إنشاء الغرفة ── التوجيه حسب المرحلة ──
  return (
    <div className="min-h-screen bg-dark-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">👑 لوحة الليدر</h1>
          <p className="text-dark-400 text-sm">
            الغرفة: <span className="text-gold-400 font-mono font-bold">{gameState.roomCode}</span>
            {' • '}
            الجولة: <span className="text-white font-bold">{gameState.round}</span>
          </p>
        </div>
        <div className="glass-card px-4 py-2 text-sm">
          <span className="text-dark-400">المرحلة: </span>
          <span className="text-gold-400 font-bold">{gameState.phase}</span>
        </div>
      </div>

      {/* Players Grid (Lobby) */}
      {gameState.phase === Phase.LOBBY && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">
              اللاعبون المسجلون: {' '}
              <span className="text-emerald-400">{gameState.players.length}</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
            {gameState.players.map((player, i) => (
              <motion.div
                key={player.physicalId}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="player-card registered"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-600/30 flex items-center justify-center text-emerald-400 font-bold">
                  {player.physicalId}
                </div>
                <div>
                  <p className="font-bold text-sm">{formatPlayer(player.physicalId, player.name)}</p>
                  <p className="text-emerald-400 text-xs">✓ مسجل</p>
                </div>
              </motion.div>
            ))}
          </div>

          {gameState.players.length >= 6 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="btn-primary text-lg mx-auto block"
              onClick={async () => {
                try {
                  await createRoom(maxJustifications);
                } catch (e) {}
              }}
            >
              🎲 بدء التوليد
            </motion.button>
          )}
        </div>
      )}
    </div>
  );
}

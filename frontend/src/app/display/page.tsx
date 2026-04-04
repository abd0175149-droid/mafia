'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';
import { Phase } from '@/lib/constants';

export default function DisplayPage() {
  const { on, isConnected } = useSocket();
  const [phase, setPhase] = useState<Phase>(Phase.LOBBY);
  const [roomCode, setRoomCode] = useState('------');
  const [playerCount, setPlayerCount] = useState(0);
  const [animation, setAnimation] = useState<any>(null);
  const [winner, setWinner] = useState<string | null>(null);

  useEffect(() => {
    const cleanups = [
      on('room:player-joined', (data: any) => {
        setPlayerCount(data.totalPlayers);
      }),
      on('game:phase-changed', (data: { phase: Phase }) => {
        setPhase(data.phase);
      }),
      on('night:animation', (data: any) => {
        setAnimation(data);
        // Auto-clear after 5 seconds
        setTimeout(() => setAnimation(null), 5000);
      }),
      on('game:over', (data: any) => {
        setWinner(data.winner);
        setPhase(Phase.GAME_OVER);
      }),
    ];

    return () => cleanups.forEach(c => c());
  }, [on]);

  return (
    <div className="display-bg min-h-screen flex flex-col items-center justify-center p-8 relative">
      {/* Connection Dot */}
      <div className="absolute top-4 left-4">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-mafia-500'}`} />
      </div>

      <AnimatePresence mode="wait">
        {/* ── شاشة اللوبي ── */}
        {phase === Phase.LOBBY && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <motion.div
              className="text-9xl mb-8"
              animate={{ rotate: [0, -3, 3, 0] }}
              transition={{ duration: 5, repeat: Infinity }}
            >
              🎭
            </motion.div>

            <h1 className="text-6xl font-black mb-4 text-white">
              محرك المافيا الهجين
            </h1>

            {/* Room Code */}
            <div className="glass-card px-12 py-6 inline-block mb-8">
              <p className="text-dark-400 text-sm mb-2">كود الغرفة</p>
              <p className="text-6xl font-mono font-black text-gold-400 tracking-widest">
                {roomCode}
              </p>
            </div>

            {/* Player Counter */}
            <motion.div
              className="glass-card px-8 py-4 inline-block"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <p className="text-dark-400 text-sm mb-1">اللاعبون المسجلون</p>
              <p className="text-5xl font-black">
                <span className="text-emerald-400">{playerCount}</span>
                <span className="text-dark-500 mx-2">/</span>
                <span className="text-dark-400">∞</span>
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* ── شاشة الليل ── */}
        {phase === Phase.NIGHT && (
          <motion.div
            key="night"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <motion.div
              className="text-9xl mb-8"
              animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              🌙
            </motion.div>
            <h2 className="text-5xl font-black text-dark-300">الليل حلّ...</h2>
            <p className="text-dark-500 text-xl mt-4">الأدوار تتحرك في الظلام</p>

            {/* Night Animation */}
            <AnimatePresence>
              {animation && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="glass-card p-8 mt-8 max-w-lg mx-auto"
                >
                  <NightAnimationDisplay data={animation} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── شاشة نهاية اللعبة ── */}
        {phase === Phase.GAME_OVER && winner && (
          <motion.div
            key="gameover"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <motion.div
              className="text-9xl mb-8"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 2, ease: 'easeInOut' }}
            >
              {winner === 'MAFIA' ? '🔪' : '🛡️'}
            </motion.div>
            <h1 className={`text-7xl font-black mb-4 ${
              winner === 'MAFIA' ? 'text-gradient-mafia' : 'text-gradient-citizen'
            }`}>
              {winner === 'MAFIA' ? 'فازت المافيا!' : 'فاز المواطنون!'}
            </h1>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── مكون الأنيميشن الليلية ──
function NightAnimationDisplay({ data }: { data: any }) {
  const animations: Record<string, { icon: string; text: string; color: string }> = {
    ASSASSINATION_ATTEMPT: { icon: '🔪', text: 'محاولة اغتيال...', color: 'text-mafia-400' },
    ASSASSINATION: { icon: '💀', text: 'تم الاغتيال!', color: 'text-mafia-400' },
    ASSASSINATION_BLOCKED: { icon: '🛡️', text: 'الحماية نجحت!', color: 'text-emerald-400' },
    SILENCE: { icon: '🤐', text: 'تم الإسكات', color: 'text-amber-400' },
    INVESTIGATION: { icon: '🔍', text: 'جاري الاستعلام...', color: 'text-citizen-400' },
    PROTECTION: { icon: '💓', text: 'حماية نشطة', color: 'text-emerald-400' },
    SNIPE: { icon: '🎯', text: 'قنص!', color: 'text-orange-400' },
    SNIPE_MAFIA: { icon: '🎯', text: 'قنص ناجح!', color: 'text-emerald-400' },
    SNIPE_CITIZEN: { icon: '💔', text: 'قنص فاشل...', color: 'text-mafia-400' },
    SILENCED: { icon: '🤐', text: 'تم إسكاته', color: 'text-amber-400' },
    SHERIFF_RESULT: { icon: '🔍', text: `النتيجة: ${data.extra?.result || ''}`, color: 'text-citizen-400' },
  };

  const anim = animations[data.type] || { icon: '❓', text: data.type, color: 'text-white' };

  return (
    <div className="text-center">
      <motion.div
        className="text-7xl mb-4"
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 1, repeat: 2 }}
      >
        {anim.icon}
      </motion.div>
      <p className={`text-3xl font-bold ${anim.color}`}>{anim.text}</p>
      {data.targetName && (
        <p className="text-dark-400 mt-2 text-xl">#{data.targetPhysicalId} - {data.targetName}</p>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phase } from '@/lib/constants';
import { getSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';

type DisplayStep = 'pin' | 'select-game' | 'lobby' | 'game';

export default function DisplayPage() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [step, setStep] = useState<DisplayStep>('pin');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [loading, setLoading] = useState(false);

  // Game data
  const [activeGames, setActiveGames] = useState<any[]>([]);
  const [phase, setPhase] = useState<Phase>(Phase.LOBBY);
  const [roomCode, setRoomCode] = useState('------');
  const [gameName, setGameName] = useState('');
  const [playerCount, setPlayerCount] = useState(0);
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [animation, setAnimation] = useState<any>(null);
  const [winner, setWinner] = useState<string | null>(null);

  // تهيئة السوكت
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Display socket connected');
      setIsConnected(true);
    });
    socket.on('disconnect', () => setIsConnected(false));
    if (socket.connected) setIsConnected(true);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  // Helper: emit with promise
  const socketEmit = useCallback((event: string, data: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        return reject(new Error('السوكت غير متصل'));
      }
      console.log(`📤 Emitting: ${event}`, data);
      socket.emit(event, data, (response: any) => {
        console.log(`📥 Response for ${event}:`, response);
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'خطأ غير معروف'));
        }
      });
    });
  }, []);

  // ── إدخال PIN ثم جلب الألعاب ──
  const handlePinSubmit = async () => {
    if (pin.length < 4) return;
    setPinError('');
    setLoading(true);

    try {
      console.log('🔍 Fetching active games...');
      const res = await socketEmit('room:list-active', {});
      const rooms = res.rooms || [];
      console.log('📋 Active rooms:', rooms);
      setActiveGames(rooms);

      if (rooms.length === 0) {
        setPinError('لا توجد ألعاب نشطة حالياً');
        setLoading(false);
        return;
      }

      if (rooms.length === 1) {
        await verifyAndJoin(rooms[0].roomId);
      } else {
        setStep('select-game');
      }
    } catch (err: any) {
      console.error('❌ Error:', err);
      setPinError(err.message || 'خطأ في الاتصال');
    }
    setLoading(false);
  };

  // ── التحقق من PIN والدخول للعبة ──
  const verifyAndJoin = async (roomId: string) => {
    try {
      console.log(`🔐 Verifying PIN for room: ${roomId}`);
      const res = await socketEmit('room:verify-display-pin', { roomId, pin });
      console.log('✅ PIN verified:', res);
      setGameName(res.gameName);
      setRoomCode(res.roomCode);
      setPlayerCount(res.playerCount || 0);
      setMaxPlayers(res.maxPlayers || 10);
      setStep('lobby');
    } catch (err: any) {
      console.error('❌ PIN error:', err);
      setPinError(err.message || 'الرقم السري غير صحيح');
    }
  };

  // ── أحداث اللعبة ──
  useEffect(() => {
    if (step !== 'lobby' && step !== 'game') return;
    const socket = socketRef.current;
    if (!socket) return;

    const onPlayerJoined = (data: any) => setPlayerCount(data.totalPlayers);
    const onPhaseChanged = (data: { phase: Phase }) => setPhase(data.phase);
    const onNightAnim = (data: any) => {
      setAnimation(data);
      setTimeout(() => setAnimation(null), 5000);
    };
    const onGameOver = (data: any) => {
      setWinner(data.winner);
      setPhase(Phase.GAME_OVER);
    };

    socket.on('room:player-joined', onPlayerJoined);
    socket.on('game:phase-changed', onPhaseChanged);
    socket.on('night:animation', onNightAnim);
    socket.on('game:over', onGameOver);

    return () => {
      socket.off('room:player-joined', onPlayerJoined);
      socket.off('game:phase-changed', onPhaseChanged);
      socket.off('night:animation', onNightAnim);
      socket.off('game:over', onGameOver);
    };
  }, [step]);

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${roomCode}`
    : '';

  return (
    <div className="display-bg min-h-screen flex flex-col items-center justify-center p-8 relative">
      {/* Connection Dot */}
      <div className="absolute top-4 left-4">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-mafia-500'}`} />
      </div>

      <AnimatePresence mode="wait">

        {/* ── شاشة إدخال PIN ── */}
        {step === 'pin' && (
          <motion.div
            key="pin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <div className="text-8xl mb-6">🔒</div>
            <h1 className="text-4xl font-black mb-4 text-white">شاشة العرض</h1>
            <p className="text-dark-400 mb-8">أدخل الرقم السري للوصول</p>

            <input
              type="text"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••"
              className="w-64 p-4 rounded-2xl bg-dark-800/80 border border-dark-600 text-white text-center font-mono text-4xl tracking-[0.5em] focus:border-gold-500 focus:outline-none transition-colors mx-auto block"
              maxLength={6}
              autoFocus
            />

            {pinError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-mafia-400 mt-4"
              >
                {pinError}
              </motion.p>
            )}

            <button
              onClick={handlePinSubmit}
              disabled={pin.length < 4 || !isConnected || loading}
              className="btn-primary mt-8 px-12 text-lg disabled:opacity-50"
            >
              {loading ? '⏳ جاري التحقق...' : isConnected ? 'دخول' : '⏳ جاري الاتصال...'}
            </button>
          </motion.div>
        )}

        {/* ── اختيار اللعبة ── */}
        {step === 'select-game' && (
          <motion.div
            key="select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center w-full max-w-lg"
          >
            <h2 className="text-3xl font-black mb-6 text-white">اختر اللعبة</h2>
            <div className="space-y-4">
              {activeGames.map((game) => (
                <motion.button
                  key={game.roomId}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => verifyAndJoin(game.roomId)}
                  className="glass-card p-6 w-full text-right flex items-center justify-between hover:border-gold-500/40 transition-all"
                >
                  <div>
                    <h3 className="text-xl font-bold text-gold-400">{game.gameName}</h3>
                    <p className="text-dark-400 text-sm">
                      كود: {game.roomCode} • {game.playerCount}/{game.maxPlayers} لاعب
                    </p>
                  </div>
                  <div className="text-3xl">🎭</div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── شاشة اللوبي مع QR ── */}
        {(step === 'lobby' || step === 'game') && phase === Phase.LOBBY && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <motion.h1
              className="text-5xl font-black mb-8 text-gradient-gold"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              🎭 {gameName}
            </motion.h1>

            {/* QR Code */}
            <div className="glass-card p-8 inline-block mb-8">
              {joinUrl && (
                <QRCodeSVG
                  value={joinUrl}
                  size={280}
                  bgColor="transparent"
                  fgColor="#ffffff"
                  level="M"
                  includeMargin={false}
                />
              )}
            </div>

            <div className="mb-8">
              <p className="text-dark-400 text-lg mb-2">أو أدخل الكود:</p>
              <p className="text-5xl font-mono font-black text-gold-400 tracking-[0.3em]">
                {roomCode}
              </p>
            </div>

            <motion.div
              className="glass-card px-12 py-6 inline-block"
              animate={{ scale: [1, 1.01, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <p className="text-dark-400 text-lg mb-2">اللاعبون المسجلون</p>
              <p className="text-5xl font-black">
                <span className="text-emerald-400">{playerCount}</span>
                <span className="text-dark-500 mx-3">/</span>
                <span className="text-dark-400">{maxPlayers}</span>
              </p>
              <div className="w-full bg-dark-700 rounded-full h-2 mt-4">
                <motion.div
                  className="bg-gradient-to-r from-emerald-500 to-gold-500 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (playerCount / maxPlayers) * 100)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ── شاشة الليل ── */}
        {phase === Phase.NIGHT && (
          <motion.div key="night" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
            <motion.div className="text-9xl mb-8" animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 3, repeat: Infinity }}>🌙</motion.div>
            <h2 className="text-5xl font-black text-dark-300">الليل حلّ...</h2>
            <p className="text-dark-500 text-xl mt-4">الأدوار تتحرك في الظلام</p>
            <AnimatePresence>
              {animation && (
                <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="glass-card p-8 mt-8 max-w-lg mx-auto">
                  <NightAnimationDisplay data={animation} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── نهاية اللعبة ── */}
        {phase === Phase.GAME_OVER && winner && (
          <motion.div key="gameover" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <motion.div className="text-9xl mb-8" animate={{ rotate: [0, 360] }} transition={{ duration: 2, ease: 'easeInOut' }}>
              {winner === 'MAFIA' ? '🔪' : '🛡️'}
            </motion.div>
            <h1 className={`text-7xl font-black mb-4 ${winner === 'MAFIA' ? 'text-gradient-mafia' : 'text-gradient-citizen'}`}>
              {winner === 'MAFIA' ? 'فازت المافيا!' : 'فاز المواطنون!'}
            </h1>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// ── QR Code component (dynamic import fallback) ──
function QRCodeSVG(props: any) {
  const [QR, setQR] = useState<any>(null);

  useEffect(() => {
    import('qrcode.react').then(mod => {
      setQR(() => mod.QRCodeSVG);
    }).catch(() => {
      console.warn('QR code library not available');
    });
  }, []);

  if (!QR) {
    return (
      <div className="w-[280px] h-[280px] flex items-center justify-center text-dark-400">
        ⏳ تحميل QR...
      </div>
    );
  }

  return <QR {...props} />;
}

// ── Night Animation ──
function NightAnimationDisplay({ data }: { data: any }) {
  const animations: Record<string, { icon: string; text: string; color: string }> = {
    ASSASSINATION_ATTEMPT: { icon: '🔪', text: 'محاولة اغتيال...', color: 'text-mafia-400' },
    ASSASSINATION: { icon: '💀', text: 'تم الاغتيال!', color: 'text-mafia-400' },
    ASSASSINATION_BLOCKED: { icon: '🛡️', text: 'الحماية نجحت!', color: 'text-emerald-400' },
    SILENCE: { icon: '🤐', text: 'تم الإسكات', color: 'text-amber-400' },
    INVESTIGATION: { icon: '🔍', text: 'جاري الاستعلام...', color: 'text-citizen-400' },
    PROTECTION: { icon: '💓', text: 'حماية نشطة', color: 'text-emerald-400' },
    SNIPE: { icon: '🎯', text: 'قنص!', color: 'text-orange-400' },
  };

  const anim = animations[data.type] || { icon: '❓', text: data.type, color: 'text-white' };

  return (
    <div className="text-center">
      <motion.div className="text-7xl mb-4" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1, repeat: 2 }}>{anim.icon}</motion.div>
      <p className={`text-3xl font-bold ${anim.color}`}>{anim.text}</p>
      {data.targetName && <p className="text-dark-400 mt-2 text-xl">#{data.targetPhysicalId} - {data.targetName}</p>}
    </div>
  );
}

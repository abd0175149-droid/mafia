'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phase } from '@/lib/constants';
import { getSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';

// ══════════════════════════════════════════════════════
// 📺 شاشة العرض - Display Page
// تستخدم REST API لجلب البيانات + Socket للتحديثات الحية
// ══════════════════════════════════════════════════════

type DisplayStep = 'pin' | 'select-game' | 'lobby';

interface ActiveGame {
  roomId: string;
  roomCode: string;
  gameName: string;
  playerCount: number;
  maxPlayers: number;
}

interface PlayerInfo {
  physicalId: number;
  name: string;
  isAlive: boolean;
}

export default function DisplayPage() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // UI State
  const [step, setStep] = useState<DisplayStep>('pin');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [loading, setLoading] = useState(false);

  // Game State
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState('');
  const [roomCode, setRoomCode] = useState('------');
  const [gameName, setGameName] = useState('');
  const [playerCount, setPlayerCount] = useState(0);
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [phase, setPhase] = useState<Phase>(Phase.LOBBY);
  const [winner, setWinner] = useState<string | null>(null);
  const [animation, setAnimation] = useState<any>(null);

  // ── Socket Init ──
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) setIsConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // ── Socket Events (بعد الدخول للوبي) ──
  useEffect(() => {
    if (step !== 'lobby' || !currentRoomId) return;
    const socket = socketRef.current;
    if (!socket) return;

    // الانضمام لغرفة السوكت
    socket.emit('display:join-room', { roomId: currentRoomId });

    const onPlayerJoined = (data: any) => {
      setPlayerCount(data.totalPlayers);
      setPlayers(prev => {
        if (prev.some(p => p.physicalId === data.physicalId)) return prev;
        return [...prev, { physicalId: data.physicalId, name: data.name, isAlive: true }]
          .sort((a, b) => a.physicalId - b.physicalId);
      });
    };

    const onPhaseChanged = (data: any) => {
      setPhase(data.phase);
    };

    const onNightAnimation = (data: any) => {
      setAnimation(data);
      setTimeout(() => setAnimation(null), 5000);
    };

    const onGameOver = (data: any) => {
      setWinner(data.winner);
      setPhase(Phase.GAME_OVER);
    };

    const onPlayerUpdated = (data: any) => {
      setPlayerCount(data.totalPlayers);
    };

    socket.on('room:player-joined', onPlayerJoined);
    socket.on('room:player-updated', onPlayerUpdated);
    socket.on('game:phase-changed', onPhaseChanged);
    socket.on('night:animation', onNightAnimation);
    socket.on('game:over', onGameOver);
    socket.on('game:started', (data: any) => {
      setPhase(data.phase);
    });

    return () => {
      socket.off('room:player-joined', onPlayerJoined);
      socket.off('room:player-updated', onPlayerUpdated);
      socket.off('game:phase-changed', onPhaseChanged);
      socket.off('night:animation', onNightAnimation);
      socket.off('game:over', onGameOver);
      socket.off('game:started');
    };
  }, [step, currentRoomId]);

  // ══════════════════════════════════════════════════
  // 🔐 الخطوة 1: إدخال PIN → جلب الألعاب عبر REST
  // ══════════════════════════════════════════════════
  const handlePinSubmit = async () => {
    if (pin.length < 4 || loading) return;
    setPinError('');
    setLoading(true);

    try {
      // جلب الألعاب عبر REST (موثوق عبر أي proxy)
      const res = await fetch('/api/game/active');
      const data = await res.json();

      if (!data.success || !data.rooms || data.rooms.length === 0) {
        setPinError('لا توجد ألعاب نشطة حالياً');
        return;
      }

      const rooms: ActiveGame[] = data.rooms;
      setActiveGames(rooms);

      if (rooms.length === 1) {
        // لعبة واحدة → تحقق من PIN مباشرة
        await verifyPinAndJoin(rooms[0].roomId);
      } else {
        // أكثر من لعبة → اعرض القائمة
        setStep('select-game');
      }
    } catch (err: any) {
      setPinError('خطأ في الاتصال بالسيرفر');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ══════════════════════════════════════════════════
  // 🔓 التحقق من PIN والدخول عبر REST
  // ══════════════════════════════════════════════════
  const verifyPinAndJoin = async (roomId: string) => {
    setLoading(true);
    setPinError('');

    try {
      const res = await fetch('/api/game/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, pin }),
      });

      const data = await res.json();

      if (!data.success) {
        setPinError(data.error || 'الرقم السري غير صحيح');
        return;
      }

      // نجاح! → انتقل للوبي
      setCurrentRoomId(roomId);
      setGameName(data.gameName);
      setRoomCode(data.roomCode);
      setPlayerCount(data.playerCount || 0);
      setMaxPlayers(data.maxPlayers || 10);

      // استخراج اللاعبين من state
      if (data.state?.players) {
        setPlayers(data.state.players.map((p: any) => ({
          physicalId: p.physicalId,
          name: p.name,
          isAlive: p.isAlive,
        })));
      }

      setStep('lobby');
    } catch (err: any) {
      setPinError('خطأ في الاتصال');
      console.error('Verify error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── QR URL ──
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${roomCode}`
    : '';

  // ══════════════════════════════════════════════════
  // 🖥️ واجهة العرض
  // ══════════════════════════════════════════════════
  return (
    <div className="display-bg min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Ambient lights */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-mafia-600/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-citizen-600/5 rounded-full blur-3xl" />

      {/* Connection indicator */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
        <span className="text-xs text-dark-500">{isConnected ? 'متصل' : 'غير متصل'}</span>
      </div>

      <AnimatePresence mode="wait">

        {/* ══════════════════════════════════════════ */}
        {/* شاشة إدخال PIN                           */}
        {/* ══════════════════════════════════════════ */}
        {step === 'pin' && (
          <motion.div
            key="pin-screen"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center relative z-10"
          >
            <div className="text-8xl mb-6">🔒</div>
            <h1 className="text-4xl font-black mb-3 text-white">شاشة العرض</h1>
            <p className="text-dark-400 mb-8 text-lg">أدخل الرقم السري للوصول</p>

            <div className="mb-6">
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="****"
                className="w-72 p-5 rounded-2xl bg-dark-800/80 border-2 border-dark-600 text-white text-center font-mono text-4xl tracking-[0.5em] focus:border-gold-500 focus:outline-none transition-all mx-auto block"
                maxLength={6}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              />
              <p className="text-dark-600 text-xs mt-2">{pin.length} / 4+ أرقام</p>
            </div>

            {pinError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-mafia-500/10 border border-mafia-500/30 rounded-xl p-3 mb-4 max-w-xs mx-auto"
              >
                <p className="text-mafia-400 text-sm">❌ {pinError}</p>
              </motion.div>
            )}

            <button
              onClick={handlePinSubmit}
              disabled={pin.length < 4 || loading}
              className="btn-primary mt-4 px-16 py-4 text-xl disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ جاري التحقق...' : '🔓 دخول'}
            </button>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* اختيار اللعبة (أكثر من لعبة نشطة)       */}
        {/* ══════════════════════════════════════════ */}
        {step === 'select-game' && (
          <motion.div
            key="select-screen"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center w-full max-w-lg relative z-10"
          >
            <div className="text-6xl mb-4">🎭</div>
            <h2 className="text-3xl font-black mb-2 text-white">اختر اللعبة</h2>
            <p className="text-dark-400 mb-8">{activeGames.length} ألعاب نشطة</p>

            <div className="space-y-4">
              {activeGames.map((game) => (
                <motion.button
                  key={game.roomId}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => verifyPinAndJoin(game.roomId)}
                  disabled={loading}
                  className="glass-card p-6 w-full flex items-center justify-between hover:border-gold-500/40 transition-all text-right disabled:opacity-50"
                >
                  <div>
                    <h3 className="text-xl font-bold text-gold-400">{game.gameName}</h3>
                    <p className="text-dark-400 text-sm mt-1">
                      كود: <span className="font-mono text-dark-300">{game.roomCode}</span>
                      {' • '}
                      <span className="text-emerald-400">{game.playerCount}</span>/{game.maxPlayers} لاعب
                    </p>
                  </div>
                  <div className="text-4xl">🎮</div>
                </motion.button>
              ))}
            </div>

            {pinError && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-mafia-400 mt-4">
                {pinError}
              </motion.p>
            )}

            <button
              onClick={() => { setStep('pin'); setPinError(''); }}
              className="text-dark-500 mt-6 text-sm hover:text-dark-300 transition-colors"
            >
              ← رجوع
            </button>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* شاشة اللوبي (QR + عداد)                  */}
        {/* ══════════════════════════════════════════ */}
        {step === 'lobby' && phase === Phase.LOBBY && (
          <motion.div
            key="lobby-screen"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center relative z-10"
          >
            {/* عنوان اللعبة */}
            <motion.h1
              className="text-5xl md:text-6xl font-black mb-10"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <span className="text-gradient-gold">🎭 {gameName}</span>
            </motion.h1>

            <div className="flex flex-col md:flex-row items-center justify-center gap-12">
              {/* QR Code */}
              <div className="glass-card p-8">
                <div className="bg-white rounded-2xl p-4 mb-4">
                  <QRDisplay url={joinUrl} />
                </div>
                <p className="text-dark-400 text-sm">امسح للانضمام</p>
              </div>

              {/* معلومات اللعبة */}
              <div className="text-center">
                {/* كود اللعبة */}
                <div className="mb-8">
                  <p className="text-dark-400 text-lg mb-2">أو أدخل الكود:</p>
                  <p className="text-6xl font-mono font-black text-gold-400 tracking-[0.3em]">
                    {roomCode}
                  </p>
                </div>

                {/* عداد اللاعبين */}
                <motion.div
                  className="glass-card px-12 py-6"
                  animate={{ scale: [1, 1.005, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <p className="text-dark-400 text-lg mb-3">اللاعبون المسجلون</p>
                  <p className="text-6xl font-black mb-3">
                    <span className="text-emerald-400">{playerCount}</span>
                    <span className="text-dark-600 mx-2">/</span>
                    <span className="text-dark-500">{maxPlayers}</span>
                  </p>

                  {/* شريط التقدم */}
                  <div className="w-64 bg-dark-700 rounded-full h-3 mx-auto">
                    <motion.div
                      className="bg-gradient-to-r from-emerald-500 to-gold-500 h-3 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (playerCount / maxPlayers) * 100)}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </motion.div>

                {/* قائمة اللاعبين */}
                {players.length > 0 && (
                  <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-md">
                    {players.map((p) => (
                      <motion.span
                        key={p.physicalId}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-dark-800/80 border border-dark-600 rounded-full px-3 py-1 text-sm"
                      >
                        <span className="text-emerald-400 font-bold">#{p.physicalId}</span>
                        <span className="text-dark-300 mr-1"> {p.name}</span>
                      </motion.span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ الليل ═══ */}
        {step === 'lobby' && phase === Phase.NIGHT && (
          <motion.div key="night" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center relative z-10">
            <motion.div className="text-9xl mb-8" animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 3, repeat: Infinity }}>🌙</motion.div>
            <h2 className="text-6xl font-black text-dark-300 mb-4">الليل حلّ...</h2>
            <p className="text-dark-500 text-2xl">الأدوار تتحرك في الظلام</p>
            <AnimatePresence>
              {animation && (
                <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="glass-card p-8 mt-8 max-w-lg mx-auto">
                  <NightAnim data={animation} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ═══ نهاية اللعبة ═══ */}
        {step === 'lobby' && phase === Phase.GAME_OVER && winner && (
          <motion.div key="gameover" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center relative z-10">
            <motion.div className="text-9xl mb-8" animate={{ rotate: [0, 360] }} transition={{ duration: 2 }}>
              {winner === 'MAFIA' ? '🔪' : '🛡️'}
            </motion.div>
            <h1 className={`text-7xl font-black ${winner === 'MAFIA' ? 'text-gradient-mafia' : 'text-gradient-citizen'}`}>
              {winner === 'MAFIA' ? 'فازت المافيا!' : 'فاز المواطنون!'}
            </h1>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// 📱 QR Code (تحميل ديناميكي)
// ══════════════════════════════════════════════════════
function QRDisplay({ url }: { url: string }) {
  const [QRComponent, setQRComponent] = useState<any>(null);

  useEffect(() => {
    import('qrcode.react')
      .then(mod => setQRComponent(() => mod.QRCodeSVG || mod.default))
      .catch(() => console.warn('QR library not available'));
  }, []);

  if (!QRComponent || !url) {
    return <div className="w-[250px] h-[250px] bg-gray-100 rounded flex items-center justify-center text-gray-400">QR</div>;
  }

  return <QRComponent value={url} size={250} bgColor="#ffffff" fgColor="#000000" level="M" />;
}

// ══════════════════════════════════════════════════════
// 🌙 Night Animation
// ══════════════════════════════════════════════════════
function NightAnim({ data }: { data: any }) {
  const map: Record<string, { icon: string; text: string; color: string }> = {
    ASSASSINATION: { icon: '💀', text: 'تم الاغتيال!', color: 'text-mafia-400' },
    ASSASSINATION_BLOCKED: { icon: '🛡️', text: 'الحماية نجحت!', color: 'text-emerald-400' },
    SILENCE: { icon: '🤐', text: 'تم الإسكات', color: 'text-amber-400' },
    INVESTIGATION: { icon: '🔍', text: 'جاري الاستعلام...', color: 'text-citizen-400' },
    PROTECTION: { icon: '💓', text: 'حماية نشطة', color: 'text-emerald-400' },
    SNIPE: { icon: '🎯', text: 'قنص!', color: 'text-orange-400' },
  };
  const a = map[data.type] || { icon: '❓', text: data.type, color: 'text-white' };
  return (
    <div className="text-center">
      <motion.div className="text-7xl mb-4" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1, repeat: 2 }}>{a.icon}</motion.div>
      <p className={`text-3xl font-bold ${a.color}`}>{a.text}</p>
    </div>
  );
}

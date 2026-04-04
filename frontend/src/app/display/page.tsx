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
    <div className="display-bg flex flex-col items-center justify-center p-8 font-arabic">
      
      {/* ── Cinematic Ambient Lighting ── */}
      <div className="ambient-sphere w-[600px] h-[600px] bg-mafia-600/10 top-[-20%] left-[-10%] animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="ambient-sphere w-[800px] h-[800px] bg-citizen-600/10 bottom-[-30%] right-[-10%] animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
      <div className="ambient-sphere w-[400px] h-[400px] bg-gold-500/10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      {/* Connection indicator */}
      <div className="absolute top-6 left-6 flex items-center gap-3 bg-dark-900/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/5 shadow-xl z-20">
        <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${isConnected ? 'bg-emerald-400 text-emerald-400 animate-pulse' : 'bg-red-500 text-red-500'}`} />
        <span className="text-xs font-bold tracking-widest text-dark-300 uppercase">{isConnected ? 'متصل بالسيرفر' : 'غير متصل'}</span>
      </div>

      <AnimatePresence mode="wait">

        {/* ══════════════════════════════════════════ */}
        {/* شاشة إدخال PIN                           */}
        {/* ══════════════════════════════════════════ */}
        {step === 'pin' && (
          <motion.div
            key="pin-screen"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-center relative z-10 glass-card p-16 border-white/10"
          >
            <div className="text-9xl mb-8 drop-shadow-2xl">🔒</div>
            <h1 className="text-5xl font-black mb-4 text-white tracking-widest">شاشة العرض</h1>
            <p className="text-dark-300 mb-10 text-xl font-light">أدخل الرقم السري للوصول إلى الغرفة</p>

            <div className="mb-8">
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="****"
                className="w-80 p-6 rounded-3xl bg-dark-950/80 border-2 border-dark-600 text-white text-center font-mono text-5xl tracking-[0.5em] focus:border-gold-500 focus:outline-none focus:ring-4 focus:ring-gold-500/20 shadow-inner transition-all mx-auto block"
                maxLength={6}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              />
              <p className="text-dark-500 font-mono mt-3 uppercase text-sm tracking-widest">{pin.length} / 4+ أرقام</p>
            </div>

            {pinError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-mafia-500/20 border border-mafia-500/50 rounded-xl p-4 mb-6 max-w-sm mx-auto backdrop-blur-md"
              >
                <p className="text-mafia-400 font-bold">❌ {pinError}</p>
              </motion.div>
            )}

            <button
              onClick={handlePinSubmit}
              disabled={pin.length < 4 || loading}
              className="btn-premium w-full mt-2"
            >
              <span>{loading ? '⏳ جاري التحقق...' : '🔓 فتح الشاشة'}</span>
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
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="w-full max-w-7xl relative z-10"
          >
            {/* عنوان اللعبة */}
            <motion.div className="text-center mb-16">
              <h1 className="text-6xl md:text-8xl font-black tracking-tight drop-shadow-2xl">
                <span className="text-gradient-gold">🎭 {gameName}</span>
              </h1>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              
              {/* القسم الأيمن: QR Code */}
              <div className="flex flex-col items-center justify-center">
                <motion.div 
                  className="glass-card p-12 relative group"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  {/* تأثيرات خلف الـ QR */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-gold-500/20 to-emerald-500/20 rounded-3xl blur-2xl group-hover:opacity-100 transition-opacity opacity-50" />
                  
                  <div className="bg-white rounded-3xl p-6 relative z-10 shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                    <QRDisplay url={joinUrl} />
                  </div>
                  <p className="text-dark-300 text-xl font-bold mt-8 text-center tracking-widest uppercase">
                    امسح الكود بكاميرا هاتفك
                  </p>
                </motion.div>
              </div>

              {/* القسم الأيسر: الإحصائيات والأكواد */}
              <div className="flex flex-col flex-1 h-full justify-center">
                
                {/* كود اللعبة */}
                <div className="glass-card p-8 mb-8 text-center border-gold-500/20 bg-gradient-to-bl from-dark-900/80 to-dark-950/80">
                  <p className="text-dark-400 text-xl mb-3 uppercase tracking-widest font-bold">أو أدخل كود اللعبة يدوياً</p>
                  <p className="text-7xl lg:text-8xl font-mono font-black text-white tracking-[0.25em] drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                    {roomCode.split('').map((char, i) => (
                      <span key={i} className={i < 3 ? 'text-gold-400' : 'text-white'}>{char}</span>
                    ))}
                  </p>
                </div>

                {/* عداد اللاعبين */}
                <div className="glass-card p-10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
                  
                  <p className="text-dark-300 text-xl mb-4 font-bold tracking-widest uppercase">اللاعبون المسجلون</p>
                  <div className="flex items-end gap-4 mb-6">
                    <span className="text-8xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.4)] leading-none">{playerCount}</span>
                    <span className="text-4xl font-black text-dark-600 mb-2">/</span>
                    <span className="text-4xl font-black text-dark-500 mb-2">{maxPlayers}</span>
                  </div>

                  {/* شريط التقدم */}
                  <div className="w-full bg-dark-900 rounded-full h-4 shadow-inner">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-emerald-600 shadow-[0_0_15px_rgba(52,211,153,0.5)] relative"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (playerCount / maxPlayers) * 100)}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    >
                      {/* لمعة على الشريط */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full h-full animate-[shimmer_2s_infinite]" />
                    </motion.div>
                  </div>
                </div>

                {/* قائمة اللاعبين */}
                {players.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-8 flex flex-wrap gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar"
                  >
                    <AnimatePresence>
                      {players.map((p, i) => (
                        <motion.div
                          key={p.physicalId}
                          initial={{ opacity: 0, scale: 0.5, y: 20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ delay: i * 0.05, type: 'spring' }}
                          className="bg-dark-800/80 backdrop-blur-md border border-dark-600/50 rounded-2xl px-5 py-2 flex items-center gap-3 shadow-lg"
                        >
                          <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-black flex items-center justify-center text-sm">{p.physicalId}</span>
                          <span className="text-white font-bold tracking-wide">{p.name}</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
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

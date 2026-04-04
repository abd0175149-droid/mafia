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
    <div className="display-bg flex flex-col items-center justify-center p-8 font-sans selection:bg-[#8A0303] selection:text-white">
      
      {/* Connection indicator */}
      <div className="absolute top-6 left-6 flex items-center gap-3 bg-[#0c0c0c] border border-[#2a2a2a] px-4 py-2 opacity-80 z-20">
        <div className={`w-3 h-3 ${isConnected ? 'bg-[#2E5C31] shadow-[0_0_10px_#2E5C31] animate-pulse' : 'bg-[#8A0303]'}`} />
        <span className="text-xs font-mono tracking-widest text-[#808080] uppercase">{isConnected ? 'Server Connected' : 'Disconnected'}</span>
      </div>

      <AnimatePresence mode="wait">

        {/* ══════════════════════════════════════════ */}
        {/* شاشة إدخال PIN                           */}
        {/* ══════════════════════════════════════════ */}
        {step === 'pin' && (
          <motion.div
            key="pin-screen"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-center relative z-10 noir-card p-16 w-full max-w-xl"
          >
            <div className="text-8xl mb-8 grayscale opacity-80">🗝️</div>
            <h1 className="text-5xl font-black mb-4 text-white tracking-widest uppercase" style={{ fontFamily: 'Amiri, serif' }}>تصريح الدخول</h1>
            <p className="text-[#808080] mb-10 text-lg font-mono tracking-widest">ENTER ACCESS CODE</p>

            <div className="mb-8">
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="****"
                className="w-full max-w-[300px] p-6 bg-[#050505] border border-[#2a2a2a] text-white text-center font-mono text-5xl tracking-[0.5em] focus:border-[#C5A059] focus:outline-none focus:ring-0 transition-all mx-auto block"
                maxLength={6}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              />
              <p className="text-[#555] font-mono mt-4 uppercase text-xs tracking-[0.4em]">{pin.length} / 4+ DIGITS</p>
            </div>

            {pinError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#8A0303]/10 border border-[#8A0303]/40 p-4 mb-6 max-w-sm mx-auto"
              >
                <p className="text-[#8A0303] font-bold font-mono text-sm uppercase tracking-widest">{pinError}</p>
              </motion.div>
            )}

            <button
              onClick={handlePinSubmit}
              disabled={pin.length < 4 || loading}
              className="btn-premium w-full max-w-[300px] mx-auto block"
            >
              <span>{loading ? 'VERIFYING...' : 'ACCESS'}</span>
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
            <div className="text-6xl mb-4 grayscale">🎭</div>
            <h2 className="text-4xl font-black mb-2 text-white" style={{ fontFamily: 'Amiri, serif' }}>اختر اللعبة</h2>
            <p className="text-[#808080] mb-8 font-mono">{activeGames.length} ACTIVE GAMES</p>

            <div className="space-y-4">
              {activeGames.map((game) => (
                <motion.button
                  key={game.roomId}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => verifyPinAndJoin(game.roomId)}
                  disabled={loading}
                  className="noir-card p-6 w-full flex items-center justify-between hover:border-[#C5A059]/40 transition-all text-right disabled:opacity-50"
                >
                  <div>
                    <h3 className="text-2xl font-bold text-[#C5A059]" style={{ fontFamily: 'Amiri, serif' }}>{game.gameName}</h3>
                    <p className="text-[#808080] text-sm mt-2 font-mono">
                      CODE: <span className="text-white">{game.roomCode}</span>
                      {' | '}
                      AGENTS: <span className="text-[#C5A059]">{game.playerCount}</span>/{game.maxPlayers}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>

            {pinError && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[#8A0303] font-mono mt-4">
                {pinError}
              </motion.p>
            )}

            <button
              onClick={() => { setStep('pin'); setPinError(''); }}
              className="text-[#555] mt-8 text-sm hover:text-white transition-colors font-mono tracking-widest uppercase"
            >
              [ Return ]
            </button>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* شاشة اللوبي                             */}
        {/* ══════════════════════════════════════════ */}
        {step === 'lobby' && phase === Phase.LOBBY && (
          <motion.div
            key="lobby-screen"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="w-full max-w-6xl relative z-10"
          >
            {/* عنوان اللعبة */}
            <motion.div className="flex items-center justify-between border-b-2 border-[#2a2a2a] pb-6 mb-12">
              <h1 className="text-6xl md:text-7xl font-black tracking-tighter" style={{ fontFamily: 'Amiri, serif' }}>
                <span className="text-white">{gameName}</span>
              </h1>
              <div className="text-right">
                <p className="text-[#808080] text-sm uppercase tracking-widest font-mono mb-2">OPERATION CODE</p>
                <p className="text-5xl font-mono text-[#C5A059] tracking-[0.2em]">{roomCode}</p>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              
              {/* القسم الأيمن: QR Code */}
              <div className="flex flex-col items-center">
                <div className="noir-card p-8 mb-6 border-[#8A0303]/30 relative">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#8A0303]" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#8A0303]" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#8A0303]" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#8A0303]" />
                  
                  <div className="bg-white p-4 grayscale contrast-125 mb-4">
                    <QRDisplay url={joinUrl} />
                  </div>
                  <p className="text-[#808080] text-sm font-mono mt-4 text-center tracking-widest uppercase">
                    SCAN TO ENTER THE OPERATION
                  </p>
                </div>
              </div>

              {/* القسم الأيسر: الإحصائيات والأكواد */}
              <div className="flex flex-col h-full">
                
                {/* عداد اللاعبين */}
                <div className="mb-10 font-mono">
                  <p className="text-[#555] text-sm mb-2 tracking-[0.3em] uppercase">AGENTS REGISTERED</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-7xl font-black text-[#C5A059]">{playerCount}</span>
                    <span className="text-3xl text-[#333]">/</span>
                    <span className="text-3xl text-[#555]">{maxPlayers}</span>
                  </div>
                </div>

                {/* قائمة اللاعبين */}
                <div>
                  <p className="text-[#555] text-sm mb-4 tracking-[0.3em] uppercase border-b border-[#2a2a2a] pb-2">ACTIVE ROSTER</p>
                  {players.length > 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar"
                    >
                      <AnimatePresence>
                        {players.map((p, i) => (
                          <motion.div
                            key={p.physicalId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-[#0c0c0c] border border-[#2a2a2a] p-3 flex items-center gap-3"
                          >
                            <span className="text-xs font-mono text-[#555]">AGENT_{p.physicalId.toString().padStart(2, '0')}</span>
                            <span className="text-white font-bold tracking-wider">{p.name}</span>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  ) : (
                    <p className="text-[#333] font-mono italic">AWAITING AGENTS...</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ الليل ═══ */}
        {step === 'lobby' && phase === Phase.NIGHT && (
          <motion.div key="night" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center relative z-10 w-full">
            <motion.div className="text-9xl mb-8 grayscale opacity-50" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 4, repeat: Infinity }}>🌑</motion.div>
            <h2 className="text-6xl font-black text-white mb-4 tracking-widest uppercase" style={{ fontFamily: 'Amiri, serif' }}>الظلام دامس</h2>
            <p className="text-[#808080] text-xl font-mono tracking-[0.3em]">OPERATION NIGHTFALL</p>
            <AnimatePresence>
              {animation && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="noir-card p-10 mt-12 max-w-lg mx-auto border-[#8A0303]/40">
                  <NightAnim data={animation} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ═══ نهاية اللعبة ═══ */}
        {step === 'lobby' && phase === Phase.GAME_OVER && winner && (
          <motion.div key="gameover" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center relative z-10 w-full max-w-3xl noir-card p-20 border-[#C5A059]/40">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100%] h-1 bg-gradient-to-r from-transparent via-[#C5A059] to-transparent opacity-50" />
            <motion.div className="text-9xl mb-10 grayscale">
              {winner === 'MAFIA' ? '🩸' : '⚖️'}
            </motion.div>
            <h1 className="text-7xl font-black uppercase tracking-tighter text-white" style={{ fontFamily: 'Amiri, serif' }}>
              {winner === 'MAFIA' ? 'انتصار المافيا' : 'تطهير المدينة'}
            </h1>
            <p className="text-[#808080] font-mono mt-6 tracking-[0.4em] uppercase">
              {winner === 'MAFIA' ? 'ALL CITIZENS ELIMINATED' : 'THREAT NEUTRALIZED'}
            </p>
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
    ASSASSINATION: { icon: '🩸', text: 'تم التصفية', color: 'text-[#8A0303]' },
    ASSASSINATION_BLOCKED: { icon: '⚕️', text: 'نجت الضحية', color: 'text-white' },
    SILENCE: { icon: '🤐', text: 'ممنوع من الكلام', color: 'text-[#555555]' },
    INVESTIGATION: { icon: '👁️', text: 'كشف الهوية', color: 'text-[#C5A059]' },
    PROTECTION: { icon: '💉', text: 'رعاية طبية', color: 'text-[#555555]' },
    SNIPE: { icon: '🎯', text: 'قنص قاتل', color: 'text-[#8A0303]' },
  };
  const a = map[data.type] || { icon: '❓', text: data.type, color: 'text-[#808080]' };
  return (
    <div className="text-center border-t border-b border-[#2a2a2a] py-8">
      <motion.div className="text-7xl mb-4 grayscale" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1, repeat: 2 }}>{a.icon}</motion.div>
      <p className={`text-3xl font-black tracking-widest ${a.color}`} style={{ fontFamily: 'Amiri, serif' }}>{a.text}</p>
    </div>
  );
}

'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phase } from '@/lib/constants';
import { getSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';
import DisplayDayView from './DisplayDayView';

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
  role?: string;
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
  const [discussionState, setDiscussionState] = useState<any>(null);
  const [teamCounts, setTeamCounts] = useState<{citizenAlive: number; mafiaAlive: number}>({citizenAlive: 0, mafiaAlive: 0});

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
        return [...prev, {
          physicalId: data.physicalId,
          name: data.name,
          isAlive: true,
          gender: data.gender,
        }].sort((a: any, b: any) => a.physicalId - b.physicalId);
      });
    };

    const onPhaseChanged = async (data: any) => {
      setPhase(data.phase);
      // تحديث بيانات اللاعبين عند تغير المرحلة
      try {
        const res = await fetch(`/api/game/state/${currentRoomId}`);
        const d = await res.json();
        if (d.success && d.state?.players) {
          setPlayers(prev => {
            return d.state.players.map((p: any) => ({
              physicalId: p.physicalId,
              name: p.name,
              isAlive: p.isAlive,
              gender: p.gender,
              role: prev.find((pp: any) => pp.physicalId === p.physicalId)?.role || p.role,
            }));
          });
        }
        // تحديث أعداد الفرق (من الباك إند مباشرة)
        if (d.state?.teamCounts) {
          setTeamCounts(d.state.teamCounts);
        }
      } catch (_) {}
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

    const onMorningEvent = (data: any) => {
      setAnimation(data);
      // أحداث الصباح تبقى أطول على الشاشة
      setTimeout(() => setAnimation(null), 7000);
    };

    const onNightStarted = () => {
      setAnimation(null); // تنظيف أي أنيميشن سابقة
    };

    socket.on('room:player-joined', onPlayerJoined);
    socket.on('room:player-updated', onPlayerUpdated);
    socket.on('game:phase-changed', onPhaseChanged);
    socket.on('night:animation', onNightAnimation);
    socket.on('display:morning-event', onMorningEvent);
    socket.on('display:night-started', onNightStarted);
    socket.on('game:over', onGameOver);
    socket.on('game:started', (data: any) => {
      setPhase(data.phase);
    });

    return () => {
      socket.off('room:player-joined', onPlayerJoined);
      socket.off('room:player-updated', onPlayerUpdated);
      socket.off('game:phase-changed', onPhaseChanged);
      socket.off('night:animation', onNightAnimation);
      socket.off('display:morning-event', onMorningEvent);
      socket.off('display:night-started', onNightStarted);
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

      // استخراج حالة الغرفة
      if (data.state) {
        setPhase(data.state.phase || 'LOBBY');
        setDiscussionState(data.state.discussionState || null);
        if (data.state.players) {
          setPlayers(data.state.players.map((p: any) => ({
            physicalId: p.physicalId,
            name: p.name,
            isAlive: p.isAlive,
            gender: p.gender,
            role: p.role,
          })));
        }
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

            <form onSubmit={(e) => { e.preventDefault(); handlePinSubmit(); }} className="mb-8">
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="****"
                className="w-full max-w-[300px] p-6 bg-[#050505] border border-[#2a2a2a] text-white text-center font-mono text-5xl tracking-[0.5em] focus:border-[#C5A059] focus:outline-none focus:ring-0 transition-all mx-auto block"
                maxLength={6}
                autoFocus
              />
              <p className="text-[#555] font-mono mt-4 uppercase text-xs tracking-[0.4em]">{pin.length} / 4+ DIGITS</p>
            </form>

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

        {/* ═══ النهار ═══ */}
        {step === 'lobby' && phase.startsWith('DAY_') && (
          <DisplayDayView key="day-view" roomId={currentRoomId} players={players} initialDiscussionState={discussionState} teamCounts={teamCounts} />
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

        {/* ═══ ملخص الصباح ═══ */}
        {step === 'lobby' && phase === Phase.MORNING_RECAP && (
          <motion.div key="morning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center relative z-10 w-full">
            <motion.div 
              className="text-9xl mb-8 opacity-60" 
              animate={{ opacity: [0.4, 0.8, 0.4], rotate: [0, 5, -5, 0] }} 
              transition={{ duration: 5, repeat: Infinity }}
            >
              ☀️
            </motion.div>
            <h2 className="text-5xl font-black text-white mb-4 tracking-widest uppercase" style={{ fontFamily: 'Amiri, serif' }}>صباح جديد</h2>
            <p className="text-[#808080] text-lg font-mono tracking-[0.3em]">MORNING INTELLIGENCE REPORT</p>
            <AnimatePresence>
              {animation && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8, y: 30 }} 
                  animate={{ opacity: 1, scale: 1, y: 0 }} 
                  exit={{ opacity: 0, scale: 0.8, y: -30 }} 
                  transition={{ duration: 0.6 }}
                  className="noir-card p-10 mt-12 max-w-xl mx-auto border-[#C5A059]/30"
                >
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
    // أنيميشن الطابور الليلي (بدون أسماء)
    ASSASSINATION_ATTEMPT: { icon: '🔪', text: 'عملية اغتيال جارية', color: 'text-[#8A0303]' },
    SILENCE: { icon: '🤐', text: 'عملية إسكات', color: 'text-[#555555]' },
    INVESTIGATION: { icon: '👁️', text: 'تحقيق جارٍ', color: 'text-[#C5A059]' },
    PROTECTION: { icon: '💉', text: 'حماية طبية', color: 'text-[#2E5C31]' },
    SNIPE: { icon: '🎯', text: 'تصويب القناص', color: 'text-[#8A0303]' },
    // أنيميشن ملخص الصباح
    ASSASSINATION: { icon: '🩸', text: 'تم الاغتيال', color: 'text-[#8A0303]' },
    ASSASSINATION_BLOCKED: { icon: '🛡️', text: 'نجاة بالحماية', color: 'text-[#2E5C31]' },
    SNIPE_MAFIA: { icon: '🎯', text: 'القناص نجح', color: 'text-[#C5A059]' },
    SNIPE_CITIZEN: { icon: '💀', text: 'القناص فشل', color: 'text-[#8A0303]' },
  };
  const a = map[data.type] || { icon: '❓', text: data.type, color: 'text-[#808080]' };

  return (
    <div className="text-center py-8">
      <motion.div
        className="text-8xl mb-6"
        animate={{ scale: [0.8, 1.2, 1] }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        {a.icon}
      </motion.div>
      <motion.p
        className={`text-4xl font-black tracking-widest mb-3 ${a.color}`}
        style={{ fontFamily: 'Amiri, serif' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {a.text}
      </motion.p>

      {/* الاغتيال — يعرض اسم الضحية */}
      {data.type === 'ASSASSINATION' && data.targetName && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          <p className="text-white text-2xl font-black mt-4" style={{ fontFamily: 'Amiri, serif' }}>{data.targetName}</p>
          <p className="text-[#555] font-mono text-sm mt-1">#{data.targetPhysicalId}</p>
        </motion.div>
      )}

      {/* الحماية — رسالة عامة بدون اسم */}
      {data.type === 'ASSASSINATION_BLOCKED' && (
        <motion.p className="text-[#2E5C31] text-lg font-mono mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          تم إنقاذ أحد اللاعبين من الاغتيال
        </motion.p>
      )}

      {/* قنص ناجح — خرج المافيا فقط */}
      {data.type === 'SNIPE_MAFIA' && (
        <motion.p className="text-[#C5A059] text-lg font-mono mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          خرج عضو مافيا من اللعبة
        </motion.p>
      )}

      {/* قنص فاشل — خرج لاعبان */}
      {data.type === 'SNIPE_CITIZEN' && (
        <motion.p className="text-[#8A0303] text-lg font-mono mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          خرج لاعبان من اللعبة
        </motion.p>
      )}
    </div>
  );
}

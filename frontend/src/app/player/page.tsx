'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameState } from '@/hooks/useGameState';

type Step = 'code' | 'phone' | 'register' | 'number' | 'done';

export default function PlayerPage() {
  return <PlayerFlow />;
}

function PlayerFlow({ initialRoomCode = '' }: { initialRoomCode?: string }) {
  const { joinRoom, isConnected, error, loading, emit } = useGameState();
  const [step, setStep] = useState<Step>(initialRoomCode ? 'phone' : 'code');
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [roomId, setRoomId] = useState('');
  const [gameName, setGameName] = useState('');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [physicalId, setPhysicalId] = useState('');
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [apiError, setApiError] = useState('');

  // ── الخطوة 1: إدخال كود اللعبة ──
  const handleFindRoom = async () => {
    setApiError('');
    try {
      const res = await emit('room:find-by-code', { roomCode: roomCode.trim() });
      setRoomId(res.roomId);
      setGameName(res.gameName);
      setStep('phone');
    } catch (err: any) {
      setApiError(err.message);
    }
  };

  // ── الخطوة 2: البحث بالهاتف ──
  const handlePhoneLookup = async () => {
    setApiError('');
    const normalized = phone.startsWith('0') ? phone : '0' + phone;
    try {
      const res = await fetch('/api/player/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized }),
      });
      const data = await res.json();

      if (data.found && data.player) {
        setDisplayName(data.player.displayName);
        setPlayerId(data.player.id);
        setStep('number'); // لاعب سابق → مباشرة لرقم اللعبة
      } else {
        setStep('register'); // لاعب جديد → تسجيل البيانات
      }
    } catch (err) {
      setApiError('خطأ في الاتصال');
    }
  };

  // ── الخطوة 3: تسجيل لاعب جديد ──
  const handleRegister = async () => {
    setApiError('');
    const normalized = phone.startsWith('0') ? phone : '0' + phone;
    const dateOfBirth = dobYear && dobMonth && dobDay
      ? `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`
      : null;

    try {
      const res = await fetch('/api/player/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalized,
          displayName,
          dateOfBirth,
          gender: gender || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPlayerId(data.player.id);
        setStep('number');
      } else {
        setApiError(data.error);
      }
    } catch (err) {
      setApiError('خطأ في الاتصال');
    }
  };

  // ── الخطوة 4: الانضمام للعبة ──
  const handleJoinGame = async () => {
    if (!physicalId || !displayName) return;
    setApiError('');
    try {
      await joinRoom(roomId, parseInt(physicalId), displayName, phone, playerId || undefined);
      setStep('done');
    } catch (err: any) {
      setApiError(err.message);
    }
  };

  return (
    <div className="display-bg flex flex-col items-center justify-center p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="noir-card p-10 max-w-sm w-full border-[#8A0303]/20 relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#8A0303] to-transparent opacity-50" />
        
        <AnimatePresence mode="wait">

          {/* ── خطوة 1: كود اللعبة ── */}
          {step === 'code' && (
            <motion.div key="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-8 border-b border-[#2a2a2a] pb-6">
                <div className="text-6xl mb-4 grayscale opacity-80">🕵️</div>
                <h1 className="text-3xl font-black mb-2 text-white" style={{ fontFamily: 'Amiri, serif' }}>الانضمام للعبة</h1>
                <p className="text-[#808080] text-xs font-mono uppercase tracking-widest">ENTER OPERATION CODE</p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="------"
                className="w-full p-4 bg-[#050505] border border-[#2a2a2a] text-white text-center font-mono text-4xl tracking-[0.4em] focus:border-[#C5A059] focus:outline-none transition-colors mb-6 placeholder-dark-800"
                maxLength={6}
                autoFocus
              />

              {apiError && <p className="text-[#8A0303] text-xs font-mono text-center mb-4 tracking-widest uppercase">{apiError}</p>}

              <button
                onClick={handleFindRoom}
                disabled={roomCode.length !== 6 || !isConnected}
                className="btn-premium w-full !text-base disabled:opacity-50"
              >
                <span>{isConnected ? 'CONNECT' : 'CONNECTING...'}</span>
              </button>
            </motion.div>
          )}

          {/* ── خطوة 2: رقم الهاتف ── */}
          {step === 'phone' && (
            <motion.div key="phone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-8 border-b border-[#2a2a2a] pb-6">
                <div className="text-6xl mb-4 grayscale opacity-80">☎️</div>
                <h1 className="text-3xl font-black mb-2 text-[#C5A059]" style={{ fontFamily: 'Amiri, serif' }}>{gameName || 'لعبة مافيا'}</h1>
                <p className="text-[#808080] text-xs font-mono uppercase tracking-widest">AGENT IDENTIFICATION</p>
              </div>

              <div className="flex items-center gap-2 mb-6 font-mono">
                <span className="bg-[#050505] border border-[#2a2a2a] px-3 py-4 text-[#808080] text-lg shrink-0">
                  +962
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="7XXXXXXXX"
                  className="w-full p-4 bg-[#050505] border border-[#2a2a2a] text-white text-lg tracking-widest focus:border-[#C5A059] focus:outline-none transition-colors"
                  maxLength={10}
                  autoFocus
                />
              </div>

              {apiError && <p className="text-[#8A0303] text-xs font-mono text-center mb-4 tracking-widest uppercase">{apiError}</p>}

              <button
                onClick={handlePhoneLookup}
                disabled={phone.length < 9}
                className="btn-premium w-full !text-base disabled:opacity-50"
              >
                <span>VERIFY IDENTITY</span>
              </button>
            </motion.div>
          )}

          {/* ── خطوة 3: التسجيل (للجدد) ── */}
          {step === 'register' && (
            <motion.div key="register" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-black mb-1 text-white" style={{ fontFamily: 'Amiri, serif' }}>إنشاء هوية جديدة</h2>
                <p className="text-[#808080] text-xs font-mono tracking-[0.2em] uppercase">NEW AGENT REGISTRATION</p>
              </div>

              {/* الاسم */}
              <div className="mb-5">
                <label className="block text-xs font-mono text-[#808080] mb-2 tracking-widest uppercase">Codename</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="الاسم المستعار"
                  className="w-full p-4 bg-[#050505] border border-[#2a2a2a] text-white text-center text-lg focus:border-[#C5A059] focus:outline-none transition-colors font-bold"
                  maxLength={20}
                  autoFocus
                />
              </div>

              {/* تاريخ الميلاد */}
              <div className="mb-5">
                <label className="block text-xs font-mono text-[#808080] mb-2 tracking-widest uppercase">Date of Birth</label>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <select
                    value={dobDay}
                    onChange={(e) => setDobDay(e.target.value)}
                    className="p-3 bg-[#050505] border border-[#2a2a2a] text-white text-center focus:border-[#C5A059] focus:outline-none text-sm"
                  >
                    <option value="">DD</option>
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                    ))}
                  </select>
                  <select
                    value={dobMonth}
                    onChange={(e) => setDobMonth(e.target.value)}
                    className="p-3 bg-[#050505] border border-[#2a2a2a] text-white text-center focus:border-[#C5A059] focus:outline-none text-sm"
                  >
                    <option value="">MM</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                    ))}
                  </select>
                  <select
                    value={dobYear}
                    onChange={(e) => setDobYear(e.target.value)}
                    className="p-3 bg-[#050505] border border-[#2a2a2a] text-white text-center focus:border-[#C5A059] focus:outline-none text-sm"
                  >
                    <option value="">YYYY</option>
                    {Array.from({ length: 50 }, (_, i) => {
                      const year = new Date().getFullYear() - 8 - i;
                      return <option key={year} value={String(year)}>{year}</option>;
                    })}
                  </select>
                </div>
              </div>

              {/* الجنس */}
              <div className="mb-8">
                <label className="block text-xs font-mono text-[#808080] mb-2 tracking-widest uppercase">Gender</label>
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <button
                    onClick={() => setGender('male')}
                    className={`p-3 border text-center font-bold tracking-widest transition-all ${
                      gender === 'male'
                        ? 'bg-[#1a1a1a] border-[#C5A059] text-white'
                        : 'bg-[#050505] border-[#2a2a2a] text-[#555] hover:border-[#555]'
                    }`}
                  >
                    MALE
                  </button>
                  <button
                    onClick={() => setGender('female')}
                    className={`p-3 border text-center font-bold tracking-widest transition-all ${
                      gender === 'female'
                        ? 'bg-[#1a1a1a] border-[#8A0303] text-white'
                        : 'bg-[#050505] border-[#2a2a2a] text-[#555] hover:border-[#555]'
                    }`}
                  >
                    FEMALE
                  </button>
                </div>
              </div>

              {apiError && <p className="text-[#8A0303] text-xs font-mono text-center mb-4 tracking-widest uppercase">{apiError}</p>}

              <button
                onClick={handleRegister}
                disabled={!displayName}
                className="btn-premium w-full !text-base disabled:opacity-50"
              >
                <span>SUBMIT ARCHIVE</span>
              </button>
            </motion.div>
          )}

          {/* ── خطوة 4: رقم اللاعب ── */}
          {step === 'number' && (
            <motion.div key="number" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-8 border-b border-[#2a2a2a] pb-6">
                <h2 className="text-3xl font-black mb-2 text-white" style={{ fontFamily: 'Amiri, serif' }}>مرحباً {displayName}</h2>
                <p className="text-[#808080] text-xs font-mono uppercase tracking-[0.2em]">ASSIGN AGENT ID</p>
              </div>

              <input
                type="number"
                inputMode="numeric"
                value={physicalId}
                onChange={(e) => setPhysicalId(e.target.value)}
                placeholder="0"
                className="w-full p-6 bg-[#050505] border border-[#2a2a2a] text-white text-center text-6xl font-mono focus:border-[#C5A059] focus:outline-none transition-colors mb-6 placeholder-[#222]"
                min={1}
                max={27}
                autoFocus
              />

              {apiError && <p className="text-[#8A0303] text-xs font-mono text-center mb-4 tracking-widest uppercase">{apiError}</p>}

              <button
                onClick={handleJoinGame}
                disabled={!physicalId || loading}
                className="btn-premium w-full !text-base disabled:opacity-50"
              >
                <span>{loading ? 'JOINING...' : 'CONFIRM ID & ENTER'}</span>
              </button>
            </motion.div>
          )}

          {/* ── خطوة 5: تم ── */}
          {step === 'done' && (
            <motion.div key="done" initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="text-center py-6">
              <motion.div
                className="text-7xl mb-6 grayscale opacity-90"
                animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                ♟️
              </motion.div>
              <h2 className="text-2xl font-black mb-4 text-[#C5A059]" style={{ fontFamily: 'Amiri, serif' }}>اكتمل التسجيل</h2>
              <div className="bg-[#050505] border border-[#2a2a2a] p-4 inline-block mx-auto mb-6">
                <p className="text-white text-xl font-bold tracking-widest">
                  AGENT_{physicalId?.toString().padStart(2, '0')}: <span className="text-[#808080]">{displayName}</span>
                </p>
              </div>
              <p className="text-[#555] text-xs font-mono uppercase tracking-[0.2em] leading-relaxed">
                STATUS CONFIRMED. WAITING FOR OPERATION COMMENCEMENT. 
                PLEASE STAND BY.
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
